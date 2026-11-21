import React, { useEffect, useState } from 'react';
import { FolderTree } from 'lucide-react';
import { projectsAPI } from '../services/api';

/**
 * Task 047 (WES CRM handoff): "Move under…" / "Move to top level" for a project.
 *
 * Tasks in two projects can wait on each other only when both projects sit under the same
 * parent project; this is how an existing project gets a parent. The server refuses a move
 * under the project's own sub-project and one that would go deeper than three levels. Moving a
 * Business project under a Private parent asks first, because it would make it Private too.
 */
export default function MoveProjectSection({ project, onMoved }) {
  const [options, setOptions] = useState([]);
  const [target, setTarget] = useState(project.parent_project_id ? String(project.parent_project_id) : '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let alive = true;
    projectsAPI.getAllTree()
      .then(({ projects = [] }) => {
        if (!alive) return;
        // Not itself, and not anything below it (the server refuses those anyway).
        const below = new Set([project.id]);
        let grew = true;
        while (grew) {
          grew = false;
          for (const p of projects) {
            if (p.parent_project_id && below.has(p.parent_project_id) && !below.has(p.id)) { below.add(p.id); grew = true; }
          }
        }
        const seen = new Set();
        setOptions(projects.filter(p => !below.has(p.id) && (p.depth || 0) < 2 && !seen.has(p.id) && seen.add(p.id)));
      })
      .catch(() => alive && setOptions([]));
    return () => { alive = false; };
  }, [project.id]);

  const current = project.parent_project_id ? String(project.parent_project_id) : '';

  const move = async (allowPrivate = false) => {
    setBusy(true);
    setMessage(null);
    try {
      const body = { parent_project_id: target ? parseInt(target, 10) : null };
      if (allowPrivate) body.allow_private_parent = true;
      await projectsAPI.update(project.id, body);
      setMessage({ ok: true, text: target ? 'Moved.' : 'Moved to the top level.' });
      if (onMoved) onMoved();
    } catch (err) {
      if (err.code === 'PRIVATE_PARENT' && !allowPrivate) {
        setBusy(false);
        if (window.confirm(`${err.message}\n\nMove it anyway?`)) return move(true);
        return;
      }
      setMessage({ ok: false, text: err.message || 'Could not move the project.' });
    } finally {
      setBusy(false);
    }
  };

  const label = (p) => `${'— '.repeat(p.depth || 0)}${p.name}${p.privacy && p.privacy !== 'business' ? ' (Private)' : ''}`;

  return (
    <div data-testid="move-project">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
        <FolderTree className="w-4 h-4" />
        Where this project sits
      </label>
      <div className="flex items-center gap-2">
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          aria-label="Move under"
        >
          <option value="">Top level (no parent project)</option>
          {options.map(p => (
            <option key={p.id} value={String(p.id)}>Under: {label(p)}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => move(false)}
          disabled={busy || target === current}
          className="px-3 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-40"
        >
          {busy ? 'Moving…' : target ? 'Move under' : 'Move to top level'}
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        Tasks in two projects can wait on each other only when both sit under the same parent project.
        The parent's Overview shows them on one combined Gantt chart.
      </p>
      {message && (
        <p className={`text-sm mt-1 ${message.ok ? 'text-green-700' : 'text-red-600'}`}>{message.text}</p>
      )}
    </div>
  );
}
