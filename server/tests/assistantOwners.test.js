/**
 * Task 048 (WES CRM handoff):
 *  - an owner may be a name with no email (an AI assistant such as "Duet (AI assistant)");
 *    never on a Private task; the same name twice is refused;
 *  - deleting a task (DELETE /api/tasks/:id): what goes with it, so the screen's question is true.
 * Real local Postgres, real routes and sign-in check (as privacy.test.js).
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'assistant-owner-test-secret';
jest.mock('../config/database', () => {
  const { getTestPool } = require('./helpers/testDb');
  return { pool: getTestPool() };
});

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { assertConnectedDatabaseIsSafe, assertHierarchySchema } = require('./helpers/testDb');
const { createUser, cleanup } = require('./helpers/fixtures');

let app, steve;
const R = {};
const token = (id) => `Bearer ${jwt.sign({ id, email: `u${id}@example.test`, name: `User ${id}` }, process.env.JWT_SECRET, { expiresIn: '10m' })}`;
const as = (id) => ({
  get: (u) => request(app).get(u).set('Authorization', token(id)),
  post: (u, b) => request(app).post(u).set('Authorization', token(id)).send(b || {}),
  del: (u) => request(app).delete(u).set('Authorization', token(id)),
});
const count = async (sql, p) => Number((await pool.query(sql, p)).rows[0].n);

beforeAll(async () => {
  await assertConnectedDatabaseIsSafe(pool);
  await assertHierarchySchema(pool);
  app = express();
  app.use(express.json());
  app.use('/api/projects', require('../routes/projects'));
  app.use('/api/tasks', require('../routes/tasks'));
  app.use('/api/dependencies', require('../routes/dependencies'));
  steve = await createUser(pool);
  const S = as(steve);
  R.p = (await S.post('/api/projects', { name: 'Research', privacy: 'business' })).body.project;
  R.other = (await S.post('/api/projects', { name: 'Other', privacy: 'business' })).body.project;
  const task = async (b) => (await S.post('/api/tasks', b)).body.task;
  R.biz = await task({ project_id: R.p.id, title: 'Check RTM codes', privacy: 'business' });
  R.priv = await task({ project_id: R.p.id, title: 'Steve private item', privacy: 'private' });
}, 60000);

afterAll(async () => {
  await pool.query('DELETE FROM privacy_change_log WHERE changed_by = $1', [steve]).catch(() => {});
  await cleanup(pool);
  await pool.end();
});

describe('name-only owners (AI assistants)', () => {
  test('a name with no email is accepted and shows as the owner', async () => {
    const r = await as(steve).post(`/api/tasks/${R.biz.id}/assignees`, { contact_name: 'Duet (AI assistant)' });
    expect(r.status).toBe(201);
    expect(r.body.assignee).toMatchObject({ contact_name: 'Duet (AI assistant)', contact_email: null });
    const t = await as(steve).get(`/api/tasks/${R.biz.id}`);
    expect(t.body.task.assignees.map(a => a.contact_name)).toContain('Duet (AI assistant)');
  });

  test('the same name twice is refused (any capitals)', async () => {
    const r = await as(steve).post(`/api/tasks/${R.biz.id}/assignees`, { contact_name: 'duet (ai assistant)' });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/already assigned/);
  });

  test('neither a name nor an email is refused', async () => {
    const r = await as(steve).post(`/api/tasks/${R.biz.id}/assignees`, { contact_name: '  ' });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/name or an email/);
  });

  test('a Private task cannot be given to a name-only owner', async () => {
    const r = await as(steve).post(`/api/tasks/${R.priv.id}/assignees`, { contact_name: 'Cowork (AI assistant)' });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/Private/);
    expect(await count(`SELECT COUNT(*) n FROM task_assignees WHERE task_id = $1`, [R.priv.id])).toBe(0);
  });

  test('an owner with an email still works as before', async () => {
    const r = await as(steve).post(`/api/tasks/${R.biz.id}/assignees`, { contact_name: 'Bob Cardenas', contact_email: 'bob@example.test' });
    expect(r.status).toBe(201);
  });
});

describe('deleting a task: what goes with it', () => {
  test('sub-tasks (all levels), comments, owners and every waits-on link go; other tasks stay', async () => {
    const S = as(steve);
    const top = (await S.post('/api/tasks', { project_id: R.p.id, title: 'Duplicate to delete' })).body.task;
    const sub = (await S.post('/api/tasks', { project_id: R.p.id, title: 'Its sub-task', parent_task_id: top.id })).body.task;
    const subsub = (await S.post('/api/tasks', { project_id: R.p.id, title: 'Its sub-sub-task', parent_task_id: sub.id })).body.task;
    const waiter = (await S.post('/api/tasks', { project_id: R.p.id, title: 'Waits on it' })).body.task;
    expect((await S.post('/api/dependencies', { dependent_task_id: waiter.id, depends_on_task_id: top.id })).status).toBe(201);
    expect((await S.post(`/api/tasks/${top.id}/comments`, { comment: 'a note' })).status).toBe(201);
    expect((await S.post(`/api/tasks/${top.id}/assignees`, { contact_name: 'Duet (AI assistant)' })).status).toBe(201);

    const d = await S.del(`/api/tasks/${top.id}`);
    expect(d.status).toBe(200);
    expect(await count(`SELECT COUNT(*) n FROM tasks WHERE id = ANY($1::int[])`, [[top.id, sub.id, subsub.id]])).toBe(0);
    expect(await count(`SELECT COUNT(*) n FROM tasks WHERE id = $1`, [waiter.id])).toBe(1);
    expect(await count(`SELECT COUNT(*) n FROM task_dependencies WHERE depends_on_task_id = $1 OR dependent_task_id = $1`, [top.id])).toBe(0);
    expect(await count(`SELECT COUNT(*) n FROM task_comments WHERE task_id = $1`, [top.id])).toBe(0);
    expect(await count(`SELECT COUNT(*) n FROM task_assignees WHERE task_id = $1`, [top.id])).toBe(0);
  });

  test("someone who can't see a task can't delete it", async () => {
    const rita = await createUser(pool);
    const r = await as(rita).del(`/api/tasks/${R.biz.id}`);
    expect(r.status).toBe(404);
    expect(await count(`SELECT COUNT(*) n FROM tasks WHERE id = $1`, [R.biz.id])).toBe(1);
  });
});
