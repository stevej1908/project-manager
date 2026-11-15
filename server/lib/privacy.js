/**
 * Task 042 (WES CRM handoff): "Private" inside Project Manager.
 *
 * Business (everyone the project is shared with sees it, as before) or Private (only its owner:
 * projects.owner_id, tasks.created_by). There are no admins in Project Manager, so nobody else
 * sees a Private project or task.
 *
 * The rules live in the database (migration 006), so every query uses the same ones:
 *   pm_project_role(project, user)     'owner' | 'editor' | 'viewer' | NULL
 *   pm_project_visible(project, user)  has a role there, and no Private project in the chain is someone else's
 *   pm_task_visible(task, user)        project visible, and no Private task in the chain is someone else's
 * A sub-project of a Private project, and a sub-task of a Private task, are hidden with it.
 * Anything hidden answers 404, exactly like something that does not exist.
 */
const { pool } = require('../config/database');

const LEVELS = ['business', 'private'];

function parseLevel(value) {
  if (value === true) return 'private';
  if (value === false) return 'business';
  if (value === undefined || value === null || value === '') return null;
  const v = String(value).trim().toLowerCase();
  return LEVELS.includes(v) ? v : null;
}

const canEdit = (role) => role === 'owner' || role === 'editor';

/** A project as this user sees it: { row, role, visible }. row is null if it does not exist. */
async function projectAccess(projectId, userId, client = pool) {
  if (!projectId || !/^\d+$/.test(String(projectId))) return { row: null, role: null, visible: false };
  const r = await client.query(
    `SELECT p.*, pm_project_role(p.id, $2) AS my_role, pm_project_visible(p.id, $2) AS my_visible
       FROM projects p WHERE p.id = $1`, [projectId, userId]);
  const row = r.rows[0] || null;
  return { row, role: row ? row.my_role : null, visible: !!(row && row.my_visible) };
}

/** A task as this user sees it: { row, role, visible }. role is the user's role on its project. */
async function taskAccess(taskId, userId, client = pool) {
  if (!taskId || !/^\d+$/.test(String(taskId))) return { row: null, role: null, visible: false };
  const r = await client.query(
    `SELECT t.*, pm_project_role(t.project_id, $2) AS my_role, pm_task_visible(t.id, $2) AS my_visible,
            (SELECT COUNT(*) FROM tasks c WHERE c.parent_task_id = t.id)::int AS subtask_count_all
       FROM tasks t WHERE t.id = $1`, [taskId, userId]);
  const row = r.rows[0] || null;
  return { row, role: row ? row.my_role : null, visible: !!(row && row.my_visible) };
}

/** Is the project, or any project above it, Private? (A new task or sub-project there starts Private.) */
async function projectChainPrivate(projectId, client = pool) {
  const r = await client.query(
    `WITH RECURSIVE chain AS (
       SELECT id, parent_project_id, privacy, 0 AS lvl FROM projects WHERE id = $1
       UNION ALL
       SELECT p.id, p.parent_project_id, p.privacy, c.lvl + 1 FROM projects p JOIN chain c ON p.id = c.parent_project_id WHERE c.lvl < 10)
     SELECT EXISTS (SELECT 1 FROM chain WHERE privacy <> 'business') AS any_private`, [projectId]);
  return !!(r.rows[0] && r.rows[0].any_private);
}

/** Is the task, or any task above it, Private? */
async function taskChainPrivate(taskId, client = pool) {
  if (!taskId) return false;
  const r = await client.query(
    `WITH RECURSIVE chain AS (
       SELECT id, parent_task_id, privacy, 0 AS lvl FROM tasks WHERE id = $1
       UNION ALL
       SELECT t.id, t.parent_task_id, t.privacy, c.lvl + 1 FROM tasks t JOIN chain c ON t.id = c.parent_task_id WHERE c.lvl < 20)
     SELECT EXISTS (SELECT 1 FROM chain WHERE privacy <> 'business') AS any_private`, [taskId]);
  return !!(r.rows[0] && r.rows[0].any_private);
}

/** A Private task may not be assigned to another Project Manager user (task 042). */
async function otherUserAssignees(taskOwnerId, assignees, client = pool) {
  const list = Array.isArray(assignees) ? assignees : [];
  const ids = list.map(a => a && a.user_id).filter(Boolean).map(Number).filter(id => id !== Number(taskOwnerId));
  const emails = list.map(a => a && a.contact_email && String(a.contact_email).trim().toLowerCase()).filter(Boolean);
  if (ids.length) return true;
  if (!emails.length) return false;
  const r = await client.query(`SELECT 1 FROM users WHERE LOWER(email) = ANY($1) AND id <> $2 LIMIT 1`, [emails, taskOwnerId]);
  return r.rows.length > 0;
}

async function logChange(client, { type, id, name, from, to, by, via = 'switch', parentType = null, parentId = null }) {
  if (from === to) return;
  await (client || pool).query(
    `INSERT INTO privacy_change_log (record_type, record_id, record_name, old_privacy, new_privacy, changed_by, via, parent_type, parent_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [type, id, name || null, from || null, to, by || null, via, parentType, parentId]);
}

async function history(type, id) {
  return (await pool.query(
    `SELECT l.old_privacy, l.new_privacy, l.changed_at, l.via, u.name AS changed_by_name
       FROM privacy_change_log l LEFT JOIN users u ON u.id = l.changed_by
      WHERE l.record_type = $1 AND l.record_id = $2 ORDER BY l.changed_at DESC LIMIT 50`, [type, id])).rows;
}

const NOT_FOUND = { project: 'Project not found', task: 'Task not found' };
const PRIVATE_ASSIGN = 'This task is Private, so it can only be assigned to you. Make it Business first to assign it to someone else.';

module.exports = {
  LEVELS, parseLevel, canEdit, projectAccess, taskAccess, projectChainPrivate, taskChainPrivate,
  otherUserAssignees, logChange, history, NOT_FOUND, PRIVATE_ASSIGN,
};
