import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { tasksAPI } from '../services/api';
import { daysFromToday, fmtDay } from '../utils/taskDates';

/**
 * Task 051 (WES CRM handoff): asked after a task is marked done.
 *
 *  1. If tasks were waiting on it with no date, they already have one (done date + 2 working
 *     days). Accept with one click, or change it. Closing keeps the date already saved.
 *  2. "Is anything still pending?"  Add follow-on (title, same project, due date required)
 *     or Nothing pending. Closing counts as Nothing pending.
 *
 * ask = { task, datedWaiting: [{ id, title, end_date }] }; onFinished(changed) when both are over.
 */
export default function DoneQuestions({ ask, onFinished }) {
  const [step, setStep] = useState(ask.datedWaiting && ask.datedWaiting.length ? 'dates' : 'pending');
  const [dates, setDates] = useState(() => Object.fromEntries((ask.datedWaiting || []).map(t => [t.id, String(t.end_date).slice(0, 10)])));
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState(`Follow-on: ${ask.task.title}`);
  const [due, setDue] = useState(daysFromToday());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Closing: on the dates step the saved dates stand; on the pending step it means Nothing pending.
  const close = () => {
    if (saving) return;
    if (step === 'dates') { setStep('pending'); return; }
    onFinished(changed);
  };

  const saveDates = async () => {
    setSaving(true); setError('');
    try {
      for (const t of ask.datedWaiting) {
        const v = dates[t.id];
        if (!v) { setError(`"${t.title}" needs a date.`); setSaving(false); return; }
        if (v !== String(t.end_date).slice(0, 10)) { await tasksAPI.update(t.id, { end_date: v }); setChanged(true); }
      }
      setStep('pending');
    } catch (e) {
      setError(e.message || 'Could not save the dates.');
    } finally {
      setSaving(false);
    }
  };

  const addFollowOn = async () => {
    if (!title.trim()) { setError('The follow-on needs a title.'); return; }
    if (!due) { setDue(daysFromToday()); setError('The follow-on needs a due date, so 7 days from today is filled in.'); return; }
    setSaving(true); setError('');
    try {
      const t = ask.task;
      const { task: made } = await tasksAPI.create({
        project_id: t.project_id, title: title.trim(), status: 'todo', priority: t.priority || 'medium',
        end_date: due, privacy: t.privacy || undefined
      });
      await tasksAPI.addComment(t.id, `Follow-on: ${String(made.title).replace(/^Follow-on:\s*/i, '')}, due ${fmtDay(due)}.`).catch(() => {});
      onFinished(true);
    } catch (e) {
      setError(e.message || 'Could not add the follow-on.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]" data-testid="done-questions">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {step === 'dates' ? 'Tasks that were waiting on this one' : 'Is anything still pending?'}
          </h2>
          <button onClick={close} className="p-1 hover:bg-gray-100 rounded" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {step === 'dates' && (
            <>
              <p className="text-sm text-gray-700">
                "{ask.task.title}" is done. These were waiting on it and had no date, so each now has one
                (2 working days from today). Keep it or change it.
              </p>
              <ul className="space-y-2">
                {ask.datedWaiting.map(t => (
                  <li key={t.id} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-gray-900">{t.title}</span>
                    <input type="date" className="border border-gray-300 rounded px-2 py-1 text-sm" aria-label={`Due date for ${t.title}`}
                      value={dates[t.id] || ''} onChange={(e) => setDates({ ...dates, [t.id]: e.target.value })} />
                  </li>
                ))}
              </ul>
            </>
          )}

          {step === 'pending' && !adding && (
            <p className="text-sm text-gray-700">"{ask.task.title}" is done. Is there a next step that still needs doing?</p>
          )}

          {step === 'pending' && adding && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Follow-on task
                <input className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label className="block text-sm font-medium text-gray-700">Due date
                <input type="date" className="mt-1 border border-gray-300 rounded px-2 py-1 text-sm" value={due} onChange={(e) => setDue(e.target.value)} />
              </label>
            </div>
          )}

          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200">
          {step === 'dates' && (
            <button onClick={saveDates} disabled={saving} className="px-4 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Keep these dates'}
            </button>
          )}
          {step === 'pending' && !adding && (
            <>
              <button onClick={() => onFinished(changed)} className="px-4 py-2 rounded border border-gray-300 text-sm hover:bg-gray-50">Nothing pending</button>
              <button onClick={() => setAdding(true)} className="px-4 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700">Add follow-on</button>
            </>
          )}
          {step === 'pending' && adding && (
            <>
              <button onClick={() => setAdding(false)} disabled={saving} className="px-4 py-2 rounded border border-gray-300 text-sm hover:bg-gray-50">Back</button>
              <button onClick={addFollowOn} disabled={saving} className="px-4 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save follow-on'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
