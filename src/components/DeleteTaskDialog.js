import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { tasksAPI } from '../services/api';

/**
 * Task 048 (WES CRM handoff): "Delete task", asked inside the page (not a browser pop-up).
 *
 * What the server does when a task is deleted (DELETE /api/tasks/:id, ON DELETE CASCADE):
 *   - its sub-tasks, and their sub-tasks, are deleted with it;
 *   - its comments, owners (assignees), attachment links and linked emails go with it
 *     (files in Google Drive and the emails themselves stay where they are);
 *   - every "waits on" link to or from it is removed, so a task that waited on it
 *     no longer shows as waiting.
 * The dialog says which of these apply before anything happens.
 */
export default function DeleteTaskDialog({ task, comments = 0, attachments = 0, emails = 0, waitingOnIt = [], onCancel, onDeleted }) {
  const [subCount, setSubCount] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    tasksAPI.getAll(task.project_id)
      .then(({ tasks = [] }) => {
        if (!alive) return;
        // every task below this one, at any depth
        const below = new Set([task.id]);
        let grew = true;
        while (grew) {
          grew = false;
          for (const t of tasks) if (t.parent_task_id && below.has(t.parent_task_id) && !below.has(t.id)) { below.add(t.id); grew = true; }
        }
        setSubCount(below.size - 1);
      })
      .catch(() => alive && setSubCount(Number(task.subtask_count || 0)));
    return () => { alive = false; };
  }, [task.id, task.project_id, task.subtask_count]);

  const goes = [];
  if (subCount) goes.push(`${subCount} sub-task${subCount === 1 ? '' : 's'} (deleted with it)`);
  if (comments) goes.push(`${comments} comment${comments === 1 ? '' : 's'}`);
  if (attachments) goes.push(`${attachments} attachment link${attachments === 1 ? '' : 's'} (the files stay in Google Drive)`);
  if (emails) goes.push(`${emails} linked email${emails === 1 ? '' : 's'} (the emails stay in Gmail)`);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await tasksAPI.delete(task.id);
      onDeleted();
    } catch (e) {
      setError(e.message || 'Could not delete the task.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[60] p-4" role="dialog" aria-modal="true" aria-labelledby="delete-task-title" data-testid="delete-task-dialog">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 id="delete-task-title" className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          Delete "{task.title}"?
        </h3>
        <p className="text-sm text-gray-700 mt-2">This can't be undone.</p>
        {subCount === null ? (
          <p className="text-sm text-gray-500 mt-3">Checking what goes with it…</p>
        ) : goes.length > 0 && (
          <div className="mt-3 text-sm text-gray-700">
            <p className="font-medium">Also deleted:</p>
            <ul className="list-disc ml-5 mt-1">{goes.map(g => <li key={g}>{g}</li>)}</ul>
          </div>
        )}
        {waitingOnIt.length > 0 && (
          <div className="mt-3 text-sm text-gray-700" data-testid="delete-task-waiting">
            <p className="font-medium">These tasks wait on it. They will no longer show as waiting:</p>
            <ul className="list-disc ml-5 mt-1">{waitingOnIt.map(w => <li key={w}>{w}</li>)}</ul>
          </div>
        )}
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={onCancel} disabled={busy} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
            Cancel
          </button>
          <button type="button" onClick={remove} disabled={busy || subCount === null} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
            {busy ? 'Deleting…' : 'Delete task'}
          </button>
        </div>
      </div>
    </div>
  );
}
