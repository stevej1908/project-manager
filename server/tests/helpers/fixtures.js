/**
 * Fixture builders for the task-hierarchy tests.
 *
 * Every record is created under a fresh user with a unique suffix, and
 * `cleanup()` deletes those users — projects and tasks go with them via
 * ON DELETE CASCADE. Nothing uses a fixed name, so repeated runs cannot
 * accumulate duplicates and start failing on ambiguous lookups.
 */
let counter = 0;
const createdUserIds = [];

function unique(prefix) {
  counter += 1;
  return `${prefix}-${process.pid}-${Date.now()}-${counter}`;
}

async function createUser(pool) {
  const tag = unique('hierarchy');
  const { rows } = await pool.query(
    `INSERT INTO users (google_id, email, name)
     VALUES ($1, $2, $3) RETURNING id`,
    [tag, `${tag}@example.test`, 'Hierarchy Fixture User']
  );
  createdUserIds.push(rows[0].id);
  return rows[0].id;
}

async function createProject(pool, ownerId, name = 'Hierarchy Fixture Project') {
  const { rows } = await pool.query(
    `INSERT INTO projects (name, owner_id) VALUES ($1, $2) RETURNING id`,
    [`${name} ${unique('p')}`, ownerId]
  );
  return rows[0].id;
}

/**
 * Insert a task directly, setting depth_level explicitly rather than going
 * through createTask — these tests are about updateTask, and should not fail
 * because task creation changed.
 */
async function createTask(pool, { projectId, title = 'Task', parentTaskId = null, depth = 0, status = 'todo' }) {
  // created_by is NOT NULL in the schema; derive it from the project owner so
  // callers don't have to thread the user id through every fixture call.
  const { rows } = await pool.query(
    `INSERT INTO tasks (project_id, title, status, parent_task_id, depth_level, created_by)
     VALUES ($1, $2, $3, $4, $5, (SELECT owner_id FROM projects WHERE id = $1)) RETURNING id`,
    [projectId, `${title} ${unique('t')}`, status, parentTaskId, depth]
  );
  return rows[0].id;
}

async function getTask(pool, taskId) {
  const { rows } = await pool.query(
    'SELECT id, parent_task_id, depth_level, project_id, status FROM tasks WHERE id = $1',
    [taskId]
  );
  return rows[0];
}

async function cleanup(pool) {
  if (createdUserIds.length === 0) return;
  // Delete projects first: tasks cascade via project_id, which also clears the
  // tasks.created_by references that would otherwise block deleting the users.
  await pool.query('DELETE FROM projects WHERE owner_id = ANY($1::int[])', [createdUserIds]);
  await pool.query('DELETE FROM users WHERE id = ANY($1::int[])', [createdUserIds]);
  createdUserIds.length = 0;
}

module.exports = { createUser, createProject, createTask, getTask, cleanup };
