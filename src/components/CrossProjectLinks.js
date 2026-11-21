import React, { useCallback, useEffect, useState } from 'react';
import { dependenciesAPI } from '../services/api';

/**
 * Task 047 (WES CRM handoff): "waits on another project" markers.
 *
 * A task that waits on a task in a DIFFERENT project must never look free to start when its
 * project is opened on its own (Steve, 20 Nov: "nobody opening one sub-project should think they
 * have a clean shot"). The project's own Gantt chart, task list and task details all use these.
 *
 *   ⇠ waits on <task> (<project>)   - red while the other task is unfinished
 *   ✓ <task> done (<project>)        - muted once it is done (kept, so the history shows)
 *   ⇢ holds up <task> (<project>)    - on the other side: something elsewhere waits on this task
 *   ⇠ waits on a task you can't see  - a Private blocker: no title, project or id (task 042/045)
 */

export function otherTaskUrl(link) {
  return `/project/${link.other_project_id}?view=gantt&task=${link.other_task_id}`;
}

export function combinedGanttUrl(parentId) {
  return `/project/${parentId}?view=overview`;
}

/** Loads one project's links to other projects; returns them grouped by task id. */
export function useCrossProjectLinks(projectId, refreshKey) {
  const [state, setState] = useState({ byTask: {}, parent: null, waitingCount: 0, loaded: false });

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await dependenciesAPI.getExternal(projectId);
      setState(groupLinks(data));
    } catch (err) {
      // Never block the page on this; the project still shows, just without the markers.
      console.error('Error loading links to other projects:', err);
      setState({ byTask: {}, parent: null, waitingCount: 0, loaded: true, error: true });
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load, refreshKey]);
  return { ...state, reload: load };
}

export function groupLinks(data) {
  const byTask = {};
  const entry = (id) => (byTask[id] = byTask[id] || { waitsOn: [], holdsUp: [] });
  (data.waits_on || []).forEach(l => entry(l.task_id).waitsOn.push(l));
  (data.holds_up || []).forEach(l => entry(l.task_id).holdsUp.push(l));
  const waitingCount = Object.values(byTask).filter(e => isWaiting(e)).length;
  return { byTask, parent: data.parent || null, waitingCount, loaded: true };
}

/** True when the task waits on unfinished work in another project. */
export function isWaiting(entry) {
  return !!(entry && entry.waitsOn.some(l => l.hidden || !l.other_done));
}

/** Plain-text lines (for the Gantt bar popup and tooltips). */
export function linkLines(entry) {
  if (!entry) return [];
  const out = [];
  entry.waitsOn.forEach(l => {
    if (l.hidden) out.push({ kind: 'waits', text: "⇠ waits on a task you can't see" });
    else if (l.other_done) out.push({ kind: 'done', text: `✓ ${l.other_title} done (${l.other_project_name})`, link: l });
    else out.push({ kind: 'waits', text: `⇠ waits on ${l.other_title} (${l.other_project_name})`, link: l });
  });
  entry.holdsUp.forEach(l => {
    if (l.hidden) out.push({ kind: 'holds', text: "⇢ holds up a task you can't see" });
    else out.push({ kind: 'holds', text: `⇢ holds up ${l.other_title} (${l.other_project_name})`, link: l });
  });
  return out;
}

const STYLE = {
  waits: 'bg-red-50 text-red-700 border-red-200 font-medium',
  holds: 'bg-amber-50 text-amber-800 border-amber-200',
  done: 'bg-gray-50 text-gray-500 border-gray-200',
};

/** Small badges under a task's name. `compact` keeps it to one line (Gantt name column). */
export function CrossProjectBadges({ entry, compact = false }) {
  const lines = linkLines(entry);
  if (!lines.length) return null;
  const shown = compact ? lines.slice(0, 1) : lines;
  return (
    <div className={compact ? 'truncate' : 'flex flex-wrap gap-1 mt-1'} data-testid="cross-project-badges">
      {shown.map((l, i) => (
        <span
          key={i}
          className={`inline-block text-xs px-1.5 py-0.5 rounded border ${STYLE[l.kind]} ${compact ? 'max-w-full truncate' : ''}`}
          title={l.text}
          data-kind={l.kind}
        >
          {l.link ? (
            <a href={otherTaskUrl(l.link)} onClick={(e) => e.stopPropagation()} className="hover:underline">{l.text}</a>
          ) : l.text}
        </span>
      ))}
      {compact && lines.length > 1 && <span className="text-xs text-gray-500 ml-1">+{lines.length - 1}</span>}
    </div>
  );
}

/** One line at the top of a project's chart or list when any task here waits on another project. */
export function CrossProjectBanner({ links }) {
  if (!links || !links.waitingCount) return null;
  const n = links.waitingCount;
  const parentId = links.parent && links.parent.id;
  return (
    <div className="mb-3 px-4 py-2 rounded-lg border border-red-200 bg-red-50 text-sm text-red-800" data-testid="cross-project-banner">
      <strong>{n === 1 ? '1 task here waits' : `${n} tasks here wait`} on unfinished work in another project.</strong>{' '}
      Marked ⇠ below.
      {parentId && (
        <> See both projects together on <a className="underline" href={combinedGanttUrl(parentId)}>{links.parent.name}'s combined Gantt chart</a>.</>
      )}
    </div>
  );
}

/** The task details panel: what this task waits on, and what waits on it, in other projects. */
export function CrossProjectPanel({ entry, parent }) {
  const lines = linkLines(entry);
  if (!lines.length) return null;
  const waiting = isWaiting(entry);
  const shared = parent && lines.some(l => l.link && l.link.shared_parent_id) ? parent : null;
  return (
    <div
      className={`rounded-lg border p-3 ${waiting ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'}`}
      data-testid="cross-project-panel"
    >
      <p className={`text-sm font-semibold mb-1 ${waiting ? 'text-red-800' : 'text-gray-700'}`}>
        {waiting ? 'Not free to start: this task waits on another project' : 'Links to other projects'}
      </p>
      <ul className="space-y-1">
        {lines.map((l, i) => (
          <li key={i} className={`text-sm ${l.kind === 'waits' ? 'text-red-700' : l.kind === 'holds' ? 'text-amber-800' : 'text-gray-500'}`}>
            {l.link ? <a href={otherTaskUrl(l.link)} className="hover:underline">{l.text}</a> : l.text}
          </li>
        ))}
      </ul>
      {shared && (
        <p className="text-xs text-gray-600 mt-2">
          Both projects on one chart: <a className="underline" href={combinedGanttUrl(shared.id)}>{shared.name}, combined Gantt</a>.
        </p>
      )}
    </div>
  );
}

export default CrossProjectBadges;

