/**
 * Task 042: who can see a project or task.
 *   GET /api/projects/:id/privacy, GET /api/tasks/:id/privacy   { privacy, is_owner, can_change, history }
 *   PUT /api/projects/:id/privacy, PUT /api/tasks/:id/privacy   { privacy: 'business' | 'private' }
 * Only the owner (projects.owner_id, tasks.created_by) can change it; every change is logged.
 * Anything the user may not see answers 404, like something that does not exist.
 */
const { pool } = require('../config/database');
const privacy = require('../lib/privacy');

const ownerOf = (type, row) => (type === 'project' ? row.owner_id : row.created_by);
const nameOf = (type, row) => (type === 'project' ? row.name : row.title);

async function load(type, id, userId, client) {
  return type === 'project' ? privacy.projectAccess(id, userId, client) : privacy.taskAccess(id, userId, client);
}

function getPrivacy(type) {
  return async (req, res) => {
    try {
      const a = await load(type, req.params.id, req.user.id);
      if (!a.visible) return res.status(404).json({ error: privacy.NOT_FOUND[type] });
      const isOwner = Number(ownerOf(type, a.row)) === Number(req.user.id);
      res.json({
        privacy: a.row.privacy,
        levels: privacy.LEVELS,
        is_owner: isOwner,
        can_change: isOwner,
        history: isOwner ? await privacy.history(type, a.row.id) : []
      });
    } catch (error) {
      console.error(`Error getting ${type} privacy:`, error);
      res.status(500).json({ error: 'Failed to get privacy' });
    }
  };
}

function setPrivacy(type) {
  return async (req, res) => {
    const client = await pool.connect();
    try {
      const level = privacy.parseLevel((req.body || {}).privacy);
      if (!level) return res.status(400).json({ error: 'privacy must be business or private' });
      const a = await load(type, req.params.id, req.user.id, client);
      if (!a.visible) return res.status(404).json({ error: privacy.NOT_FOUND[type] });
      if (Number(ownerOf(type, a.row)) !== Number(req.user.id)) {
        return res.status(403).json({ error: `Only the owner of this ${type} can change who can see it.` });
      }
      if (type === 'task' && level === 'private') {
        const assignees = (await client.query(
          'SELECT user_id, contact_email FROM task_assignees WHERE task_id = $1', [a.row.id])).rows;
        if (await privacy.otherUserAssignees(a.row.created_by, assignees, client)) {
          return res.status(400).json({ error: 'This task is assigned to someone else. Remove them first, then make it Private.' });
        }
      }
      await client.query('BEGIN');
      const table = type === 'project' ? 'projects' : 'tasks';
      const upd = await client.query(
        `UPDATE ${table} SET privacy = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`, [a.row.id, level]);
      await privacy.logChange(client, { type, id: a.row.id, name: nameOf(type, a.row), from: a.row.privacy, to: level, by: req.user.id });
      await client.query('COMMIT');
      res.json({ [type]: upd.rows[0], privacy: level });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      console.error(`Error changing ${type} privacy:`, error);
      res.status(500).json({ error: 'Failed to change privacy' });
    } finally {
      client.release();
    }
  };
}

module.exports = {
  getProjectPrivacy: getPrivacy('project'),
  setProjectPrivacy: setPrivacy('project'),
  getTaskPrivacy: getPrivacy('task'),
  setTaskPrivacy: setPrivacy('task')
};
