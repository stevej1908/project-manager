// Task 051 (WES CRM handoff): every open task has a due date or a task it waits on.
// A task saved with neither gets 7 days from today (Arizona), shown in the date box first.

export const DEFAULT_DAYS = 7;

export const arizonaToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Phoenix' });

/** Today (Arizona) + n days, YYYY-MM-DD. */
export function daysFromToday(n = DEFAULT_DAYS) {
  const d = new Date(`${arizonaToday()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** "3 Dec 2026" */
export const fmtDay = (ymd) => (ymd
  ? new Date(`${String(ymd).slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  : '');

export const NEEDS_DATE_NOTE = 'A task needs a due date, so 7 days from today is filled in. Change it if you like, then save again.';
