/**
 * Task 051 (WES CRM handoff): every open task has a date or a blocker.
 *
 *  - A task may only wait on a task that has a date, directly or further up its chain
 *    (a finished blocker counts as dated: there is nothing left to wait for).
 *  - Loops are refused at any length, naming the tasks in the loop.
 *  - When a blocker is marked done, each open task waiting on it that has no due date gets
 *    one: the done date + 2 working days (Arizona). The person who closed the blocker is then
 *    asked to confirm or change it; if they don't answer, the date stands.
 *
 * Everything here takes a pg client or pool (anything with .query), so it runs inside the
 * caller's transaction.
 */

const WAIT_DAYS = 2;   // working days after the blocker is done

/** Today's date in Arizona, YYYY-MM-DD. */
const arizonaToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Phoenix' });

/** Today (Arizona) + n calendar days, YYYY-MM-DD: the 7-day default for a task saved with no date. */
function daysFromToday(n) {
  const d = new Date(`${arizonaToday()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** ymd + n working days (Saturday and Sunday skipped). */
function workdaysAfter(ymd, n) {
  const d = new Date(`${ymd}T12:00:00Z`);
  let left = n;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) left -= 1;
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Does this task have a date, or reach a dated (or finished) task through what it waits on?
 * Returns null when it does, or { id, title } of the task itself when it does not.
 */
async function undatedChain(db, taskId) {
  const r = await db.query(
    `WITH RECURSIVE chain AS (
       SELECT t.id FROM tasks t WHERE t.id = $1
       UNION
       SELECT td.depends_on_task_id FROM task_dependencies td JOIN chain c ON td.dependent_task_id = c.id
     )
     SELECT EXISTS (SELECT 1 FROM chain c JOIN tasks t ON t.id = c.id
                     WHERE t.end_date IS NOT NULL OR t.status = 'done') AS dated,
            (SELECT title FROM tasks WHERE id = $1) AS title`,
    [taskId]);
  const row = r.rows[0];
  return row && row.dated ? null : { id: Number(taskId), title: row ? row.title : null };
}

/**
 * Would "dependent waits on dependsOn" close a loop? Returns null, or the loop as a list of
 * { id, title } starting and ending with the dependent task.
 */
async function loopPath(db, dependentId, dependsOnId) {
  // Walk from the blocker along what it waits on, remembering how each task was reached.
  const start = Number(dependsOnId), goal = Number(dependentId);
  const came = new Map([[start, null]]);
  let frontier = [start];
  let found = start === goal;
  for (let depth = 0; frontier.length && !found && depth < 1000; depth += 1) {
    const r = await db.query(
      'SELECT dependent_task_id AS a, depends_on_task_id AS b FROM task_dependencies WHERE dependent_task_id = ANY($1::int[])',
      [frontier]);
    const next = [];
    for (const { a, b } of r.rows) {
      if (came.has(b)) continue;
      came.set(b, a);
      if (b === goal) { found = true; break; }
      next.push(b);
    }
    frontier = next;
  }
  if (!found) return null;
  // goal <- ... <- start, then the new link start <- goal closes it.
  const ids = [];
  for (let at = goal; at !== null && at !== undefined; at = came.get(at)) ids.unshift(at);
  ids.unshift(goal);   // the new link: goal waits on start
  const titles = new Map((await db.query('SELECT id, title FROM tasks WHERE id = ANY($1::int[])', [ids])).rows.map(t => [t.id, t.title]));
  return ids.map(id => ({ id, title: titles.get(id) || null }));
}

const describe = (t) => `${t.id}${t.title ? ` "${t.title}"` : ''}`;

/** The plain messages the screens and the CRM show. */
function undatedMessage(t) {
  return `Task ${describe(t)} has no due date and waits on nothing with a date, so nothing can wait on it yet. Give it a due date first.`;
}
function loopMessage(path) {
  return `Cannot create dependency: would create a circular dependency (a loop: ${path.map(describe).join(' waits on ')}).`;
}

/**
 * The blocker taskId is now done: give each open task waiting on it that has no due date
 * the done date + 2 working days. Returns [{ id, title, end_date }] for the ones dated.
 */
async function dateWaitingTasks(db, taskId) {
  const due = workdaysAfter(arizonaToday(), WAIT_DAYS);
  const r = await db.query(
    `UPDATE tasks t SET end_date = $2::date, updated_at = CURRENT_TIMESTAMP
       FROM task_dependencies td
      WHERE td.depends_on_task_id = $1 AND td.dependent_task_id = t.id
        AND t.end_date IS NULL AND t.status <> 'done'
      RETURNING t.id, t.title, t.project_id, to_char(t.end_date, 'YYYY-MM-DD') AS end_date`,
    [taskId, due]);
  return r.rows;
}

module.exports = { WAIT_DAYS, arizonaToday, daysFromToday, workdaysAfter, undatedChain, loopPath, undatedMessage, loopMessage, dateWaitingTasks };
