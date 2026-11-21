/**
 * Task 047 (WES CRM handoff): tasks that wait on a task in another project.
 *
 * - Links across projects are allowed only between sibling projects (same parent); two top-level
 *   projects are refused (unchanged behaviour, checked here so it stays that way).
 * - GET /api/dependencies/external?projectId= tells a project's own screens which of its tasks wait
 *   on, or hold up, a task in another project, so a waiting task never looks free to start.
 * - A Private blocker someone else can't see shows only as hidden, and only while it is unfinished.
 * - Moving a project under a parent (the route the CRM and the "Move under…" screen use): refused
 *   under its own sub-project; a Business project under a Private parent needs an explicit say-so.
 *
 * Real local Postgres, as for the privacy tests; real routes and sign-in check.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'cross-project-test-secret';
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

let app, steve, deb;
const R = {};
const token = (id) => `Bearer ${jwt.sign({ id, email: `u${id}@example.test`, name: `User ${id}` }, process.env.JWT_SECRET, { expiresIn: '10m' })}`;
const as = (id) => ({
  get: (u) => request(app).get(u).set('Authorization', token(id)),
  post: (u, b) => request(app).post(u).set('Authorization', token(id)).send(b || {}),
  put: (u, b) => request(app).put(u).set('Authorization', token(id)).send(b || {}),
});

beforeAll(async () => {
  await assertConnectedDatabaseIsSafe(pool);
  await assertHierarchySchema(pool);

  app = express();
  app.use(express.json());
  app.use('/api/projects', require('../routes/projects'));
  app.use('/api/tasks', require('../routes/tasks'));
  app.use('/api/dependencies', require('../routes/dependencies'));

  steve = await createUser(pool);
  deb = await createUser(pool);
  const debEmail = (await pool.query('SELECT email FROM users WHERE id = $1', [deb])).rows[0].email;

  const S = as(steve);
  const proj = async (body) => { const r = await S.post('/api/projects', body); expect(r.status).toBe(201); return r.body.project; };
  const task = async (body) => { const r = await S.post('/api/tasks', body); expect(r.status).toBe(201); return r.body.task; };

  R.parent = await proj({ name: 'Clinic X go-live', privacy: 'business' });
  expect((await S.post(`/api/projects/${R.parent.id}/share`, { email: debEmail, role: 'editor' })).status).toBeLessThan(300);
  R.hardware = await proj({ name: 'Order hardware', parent_project_id: R.parent.id, privacy: 'business' });
  R.rollout = await proj({ name: 'Clinic X rollout', parent_project_id: R.parent.id, privacy: 'business' });
  R.topA = await proj({ name: 'Top A', privacy: 'business' });
  R.topB = await proj({ name: 'Top B', privacy: 'business' });
  R.secret = await proj({ name: 'Steve private parent', privacy: 'private' });

  R.order = await task({ project_id: R.hardware.id, title: 'Hardware arrives', privacy: 'business' });
  R.privOrder = await task({ project_id: R.hardware.id, title: 'Steve private vendor call', privacy: 'private' });
  R.start = await task({ project_id: R.rollout.id, title: 'Start rollout', privacy: 'business' });
  R.train = await task({ project_id: R.rollout.id, title: 'Train staff', privacy: 'business' });
  R.a = await task({ project_id: R.topA.id, title: 'Top A task' });
  R.b = await task({ project_id: R.topB.id, title: 'Top B task' });
}, 60000);

afterAll(async () => {
  await pool.query('DELETE FROM privacy_change_log WHERE changed_by = ANY($1::int[])', [[steve, deb].filter(Boolean)]);
  await cleanup(pool);
  await pool.end();
});

describe('links across projects', () => {
  test('sibling projects can be linked; two top-level projects cannot', async () => {
    const S = as(steve);
    const ok = await S.post('/api/dependencies', { dependent_task_id: R.start.id, depends_on_task_id: R.order.id });
    expect(ok.status).toBe(201);
    expect(ok.body.dependency.is_cross_project).toBe(true);

    const no = await S.post('/api/dependencies', { dependent_task_id: R.a.id, depends_on_task_id: R.b.id });
    expect(no.status).toBe(400);
    expect(no.body.error).toMatch(/common parent|sibling/i);
  });

  test("the waiting project's own screens hear about it: waits on, with the other task and project", async () => {
    const r = await as(steve).get(`/api/dependencies/external?projectId=${R.rollout.id}`);
    expect(r.status).toBe(200);
    expect(r.body.parent).toEqual({ id: R.parent.id, name: 'Clinic X go-live' });
    expect(r.body.waits_on).toHaveLength(1);
    expect(r.body.waits_on[0]).toMatchObject({
      task_id: R.start.id, other_task_id: R.order.id, other_title: 'Hardware arrives',
      other_project_id: R.hardware.id, other_project_name: 'Order hardware',
      other_done: false, shared_parent_id: R.parent.id,
    });
    expect(r.body.holds_up).toHaveLength(0);
  });

  test("the other side too: the blocking project's screens show what it holds up", async () => {
    const r = await as(steve).get(`/api/dependencies/external?projectId=${R.hardware.id}`);
    expect(r.status).toBe(200);
    expect(r.body.waits_on).toHaveLength(0);
    expect(r.body.holds_up).toEqual([expect.objectContaining({
      task_id: R.order.id, other_task_id: R.start.id, other_title: 'Start rollout', other_project_name: 'Clinic X rollout',
    })]);
  });

  test("a task's own link list names the other task's project", async () => {
    const r = await as(steve).get(`/api/dependencies/task/${R.start.id}`);
    expect(r.status).toBe(200);
    expect(r.body.depends_on[0]).toMatchObject({ task_title: 'Hardware arrives', project_id: R.hardware.id, project_name: 'Order hardware' });
  });

  test('a task linked inside its own project is not reported as another project', async () => {
    const S = as(steve);
    expect((await S.post('/api/dependencies', { dependent_task_id: R.train.id, depends_on_task_id: R.start.id })).status).toBe(201);
    const r = await S.get(`/api/dependencies/external?projectId=${R.rollout.id}`);
    expect(r.body.waits_on.map(l => l.task_id)).toEqual([R.start.id]);
  });

  test('when the blocker is done the link stays, marked done', async () => {
    expect((await as(steve).put(`/api/tasks/${R.order.id}`, { status: 'done' })).status).toBe(200);
    const r = await as(steve).get(`/api/dependencies/external?projectId=${R.rollout.id}`);
    expect(r.body.waits_on[0]).toMatchObject({ other_task_id: R.order.id, other_done: true });
    expect((await as(steve).put(`/api/tasks/${R.order.id}`, { status: 'todo' })).status).toBe(200);
  });

  test("a Private blocker: Steve sees it by name; Deb sees only 'a task you can't see', and nothing once it is done", async () => {
    expect((await as(steve).post('/api/dependencies', { dependent_task_id: R.train.id, depends_on_task_id: R.privOrder.id })).status).toBe(201);

    const mine = await as(steve).get(`/api/dependencies/external?projectId=${R.rollout.id}`);
    expect(mine.body.waits_on.map(l => l.other_title)).toContain('Steve private vendor call');

    const hers = await as(deb).get(`/api/dependencies/external?projectId=${R.rollout.id}`);
    expect(hers.status).toBe(200);
    const hidden = hers.body.waits_on.filter(l => l.hidden);
    expect(hidden).toEqual([{ dependency_id: expect.any(Number), task_id: R.train.id, hidden: true, other_done: false }]);
    expect(JSON.stringify(hers.body)).not.toMatch(/private vendor call/i);
    expect(JSON.stringify(hers.body)).not.toContain(`"other_task_id":${R.privOrder.id}`);

    // Deb's view of the blocking project: the Private task isn't there at all.
    const herHardware = await as(deb).get(`/api/dependencies/external?projectId=${R.hardware.id}`);
    expect(herHardware.body.holds_up.map(l => l.task_id)).not.toContain(R.privOrder.id);

    expect((await as(steve).put(`/api/tasks/${R.privOrder.id}`, { status: 'done' })).status).toBe(200);
    const later = await as(deb).get(`/api/dependencies/external?projectId=${R.rollout.id}`);
    expect(later.body.waits_on.filter(l => l.hidden)).toHaveLength(0);
  });

  test("a project someone can't see answers not found", async () => {
    const r = await as(deb).get(`/api/dependencies/external?projectId=${R.secret.id}`);
    expect(r.status).toBe(404);
  });
});

describe('moving a project under a parent', () => {
  test('move a top-level project under a parent and back to the top level', async () => {
    const S = as(steve);
    const under = await S.put(`/api/projects/${R.topA.id}`, { parent_project_id: R.parent.id });
    expect(under.status).toBe(200);
    expect(under.body.project.parent_project_id).toBe(R.parent.id);
    expect((await pool.query('SELECT depth FROM projects WHERE id = $1', [R.topA.id])).rows[0].depth).toBe(1);

    // Now siblings of the rollout project, so a link is allowed.
    expect((await S.post('/api/dependencies', { dependent_task_id: R.a.id, depends_on_task_id: R.start.id })).status).toBe(201);

    const back = await S.put(`/api/projects/${R.topA.id}`, { parent_project_id: null });
    expect(back.status).toBe(200);
    expect(back.body.project.parent_project_id).toBeNull();
    expect((await pool.query('SELECT depth FROM projects WHERE id = $1', [R.topA.id])).rows[0].depth).toBe(0);
  });

  test('a project cannot go under its own sub-project', async () => {
    const r = await as(steve).put(`/api/projects/${R.parent.id}`, { parent_project_id: R.rollout.id });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/own descendants/i);
  });

  test('a Business project under a Private parent needs an explicit say-so', async () => {
    const S = as(steve);
    const asked = await S.put(`/api/projects/${R.topB.id}`, { parent_project_id: R.secret.id });
    expect(asked.status).toBe(409);
    expect(asked.body.code).toBe('PRIVATE_PARENT');
    expect((await pool.query('SELECT parent_project_id FROM projects WHERE id = $1', [R.topB.id])).rows[0].parent_project_id).toBeNull();

    const yes = await S.put(`/api/projects/${R.topB.id}`, { parent_project_id: R.secret.id, allow_private_parent: true });
    expect(yes.status).toBe(200);
    expect(yes.body.project.parent_project_id).toBe(R.secret.id);
  });
});
