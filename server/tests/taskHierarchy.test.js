/**
 * Regression tests for updateTask's re-parent / promote guards.
 *
 * Scope: item 1 of docs/plans/2026-07-08-task-project-hierarchy-ux-design.md.
 *
 * These run against a real local Postgres on purpose. The guards being tested
 * are almost entirely SQL — a recursive CTE for cycle detection and another for
 * the subtree depth recompute — so a mocked pg client would assert the shape of
 * query strings and prove nothing about whether the guards hold. The only thing
 * mocked is the config/database module, and only so the controller cannot reach
 * the Neon URL in server/.env; the pool behind it is a real pool.
 */
jest.mock('../config/database', () => {
  const { getTestPool } = require('./helpers/testDb');
  return { pool: getTestPool() };
});

const { pool } = require('../config/database');
const { assertConnectedDatabaseIsSafe, assertHierarchySchema } = require('./helpers/testDb');
const { updateTask } = require('../controllers/taskController');
const { createUser, createProject, createTask, getTask, cleanup } = require('./helpers/fixtures');

const NONEXISTENT_TASK_ID = 2147483647;

/** Drive the controller directly with req/res doubles. */
function callUpdateTask({ taskId, userId, body }) {
  const req = { params: { id: String(taskId) }, body, user: { id: userId } };
  const result = { statusCode: 200, payload: undefined };
  const res = {
    status(code) { result.statusCode = code; return this; },
    json(payload) { result.payload = payload; return this; },
  };
  return updateTask(req, res).then(() => result);
}

async function seedProject() {
  const userId = await createUser(pool);
  const projectId = await createProject(pool, userId);
  return { userId, projectId };
}

beforeAll(async () => {
  await assertConnectedDatabaseIsSafe(pool);
  await assertHierarchySchema(pool);
});

afterAll(async () => {
  await cleanup(pool);
  await pool.end();
});

describe('updateTask re-parenting', () => {
  test('moves a task under a new parent and sets its depth', async () => {
    const { userId, projectId } = await seedProject();
    const parentId = await createTask(pool, { projectId, title: 'Parent' });
    const taskId = await createTask(pool, { projectId, title: 'Mover' });

    const { statusCode } = await callUpdateTask({
      taskId, userId, body: { parent_task_id: parentId },
    });

    expect(statusCode).toBe(200);
    const moved = await getTask(pool, taskId);
    expect(moved.parent_task_id).toBe(parentId);
    expect(moved.depth_level).toBe(1);
  });

  test('promotes a task to top level when parent_task_id is null', async () => {
    const { userId, projectId } = await seedProject();
    const parentId = await createTask(pool, { projectId, title: 'Parent' });
    const taskId = await createTask(pool, { projectId, title: 'Child', parentTaskId: parentId, depth: 1 });

    const { statusCode } = await callUpdateTask({
      taskId, userId, body: { parent_task_id: null },
    });

    expect(statusCode).toBe(200);
    const promoted = await getTask(pool, taskId);
    expect(promoted.parent_task_id).toBeNull();
    expect(promoted.depth_level).toBe(0);
  });

  test('leaves the parent unchanged when parent_task_id is absent from the body', async () => {
    const { userId, projectId } = await seedProject();
    const parentId = await createTask(pool, { projectId, title: 'Parent' });
    const taskId = await createTask(pool, { projectId, title: 'Child', parentTaskId: parentId, depth: 1 });

    const { statusCode } = await callUpdateTask({
      taskId, userId, body: { title: 'Renamed, not re-parented' },
    });

    expect(statusCode).toBe(200);
    const after = await getTask(pool, taskId);
    expect(after.parent_task_id).toBe(parentId);
    expect(after.depth_level).toBe(1);
  });

  test('recomputes depth for the entire moved subtree', async () => {
    const { userId, projectId } = await seedProject();
    const newParentId = await createTask(pool, { projectId, title: 'New parent' });
    const topId = await createTask(pool, { projectId, title: 'Subtree root' });
    const midId = await createTask(pool, { projectId, title: 'Middle', parentTaskId: topId, depth: 1 });
    const leafId = await createTask(pool, { projectId, title: 'Leaf', parentTaskId: midId, depth: 2 });

    const { statusCode } = await callUpdateTask({
      taskId: topId, userId, body: { parent_task_id: newParentId },
    });

    expect(statusCode).toBe(200);
    expect((await getTask(pool, topId)).depth_level).toBe(1);
    expect((await getTask(pool, midId)).depth_level).toBe(2);
    expect((await getTask(pool, leafId)).depth_level).toBe(3);
  });
});

describe('updateTask re-parenting guards', () => {
  test('refuses a parent task in a different project', async () => {
    const { userId, projectId } = await seedProject();
    const otherProjectId = await createProject(pool, userId, 'Other project');
    const taskId = await createTask(pool, { projectId, title: 'Mover' });
    const foreignParentId = await createTask(pool, { projectId: otherProjectId, title: 'Foreign parent' });

    const { statusCode, payload } = await callUpdateTask({
      taskId, userId, body: { parent_task_id: foreignParentId },
    });

    expect(statusCode).toBe(400);
    expect(payload.error).toMatch(/same project/i);
    expect((await getTask(pool, taskId)).parent_task_id).toBeNull();
  });

  test('refuses moving a task under one of its own descendants', async () => {
    const { userId, projectId } = await seedProject();
    const topId = await createTask(pool, { projectId, title: 'Top' });
    const childId = await createTask(pool, { projectId, title: 'Child', parentTaskId: topId, depth: 1 });
    const grandchildId = await createTask(pool, { projectId, title: 'Grandchild', parentTaskId: childId, depth: 2 });

    const { statusCode, payload } = await callUpdateTask({
      taskId: topId, userId, body: { parent_task_id: grandchildId },
    });

    expect(statusCode).toBe(400);
    expect(payload.error).toMatch(/own subtask/i);
    expect((await getTask(pool, topId)).parent_task_id).toBeNull();
  });

  test('refuses a task as its own parent', async () => {
    const { userId, projectId } = await seedProject();
    const taskId = await createTask(pool, { projectId, title: 'Self' });

    const { statusCode, payload } = await callUpdateTask({
      taskId, userId, body: { parent_task_id: taskId },
    });

    expect(statusCode).toBe(400);
    expect(payload.error).toMatch(/own parent/i);
    expect((await getTask(pool, taskId)).parent_task_id).toBeNull();
  });

  test('returns 404 when the new parent does not exist', async () => {
    const { userId, projectId } = await seedProject();
    const taskId = await createTask(pool, { projectId, title: 'Mover' });

    const { statusCode, payload } = await callUpdateTask({
      taskId, userId, body: { parent_task_id: NONEXISTENT_TASK_ID },
    });

    expect(statusCode).toBe(404);
    expect(payload.error).toMatch(/parent task not found/i);
    expect((await getTask(pool, taskId)).parent_task_id).toBeNull();
  });
});

describe('updateTask re-parenting derived status', () => {
  test('refreshes derived status on both the old and the new parent', async () => {
    const { userId, projectId } = await seedProject();
    const oldParentId = await createTask(pool, { projectId, title: 'Old parent', status: 'todo' });
    await createTask(pool, { projectId, title: 'Stays done', parentTaskId: oldParentId, depth: 1, status: 'done' });
    const moverId = await createTask(pool, { projectId, title: 'Mover', parentTaskId: oldParentId, depth: 1, status: 'todo' });
    const newParentId = await createTask(pool, { projectId, title: 'New parent', status: 'done' });

    const { statusCode } = await callUpdateTask({
      taskId: moverId, userId, body: { parent_task_id: newParentId },
    });

    expect(statusCode).toBe(200);
    // Old parent keeps only a done child, so it derives to done.
    expect((await getTask(pool, oldParentId)).status).toBe('done');
    // New parent gains a todo child, so it derives back to todo.
    expect((await getTask(pool, newParentId)).status).toBe('todo');
  });
});
