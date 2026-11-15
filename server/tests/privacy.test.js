/**
 * Task 042 (WES CRM handoff): "Private" inside Project Manager.
 *
 * Three people: an owner (like Steve), an editor the project is shared with (like Deb), and a
 * signed-in user it is not shared with. Real local Postgres, as for the hierarchy tests; only
 * config/database is pointed at it. Requests go through the real routes and sign-in check.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'privacy-test-secret';
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

let app, steve, deb, rita;
const R = {};
const token = (id) => `Bearer ${jwt.sign({ id, email: `u${id}@example.test`, name: `User ${id}` }, process.env.JWT_SECRET, { expiresIn: '10m' })}`;
const as = (id) => ({
  get: (u) => request(app).get(u).set('Authorization', token(id)),
  post: (u, b) => request(app).post(u).set('Authorization', token(id)).send(b || {}),
  put: (u, b) => request(app).put(u).set('Authorization', token(id)).send(b || {}),
  del: (u) => request(app).delete(u).set('Authorization', token(id)),
});
const titles = (rows) => rows.map(r => r.title.replace(/ \[.*$/, '')).sort();

beforeAll(async () => {
  await assertConnectedDatabaseIsSafe(pool);
  await assertHierarchySchema(pool);
  const cols = await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'privacy'`);
  if (!cols.rows.length) throw new Error('Migration 006 (private projects and tasks) is not applied to the test database.');

  app = express();
  app.use(express.json());
  app.use('/api/projects', require('../routes/projects'));
  app.use('/api/tasks', require('../routes/tasks'));
  app.use('/api/dependencies', require('../routes/dependencies'));

  steve = await createUser(pool);
  deb = await createUser(pool);
  rita = await createUser(pool);
  const debEmail = (await pool.query('SELECT email FROM users WHERE id = $1', [deb])).rows[0].email;
  R.debEmail = debEmail;

  const S = as(steve);
  const proj = async (body) => { const r = await S.post('/api/projects', body); expect(r.status).toBe(201); return r.body.project; };
  const task = async (body) => { const r = await S.post('/api/tasks', body); expect(r.status).toBe(201); return r.body.task; };

  R.shared = await proj({ name: 'Shared work', privacy: 'business' });
  expect((await S.post(`/api/projects/${R.shared.id}/share`, { email: debEmail, role: 'editor' })).status).toBeLessThan(300);
  R.openChild = await proj({ name: 'Open child', parent_project_id: R.shared.id, privacy: 'business' });
  R.secretChild = await proj({ name: 'Secret child', parent_project_id: R.shared.id, privacy: 'private' });
  R.personal = await proj({ name: 'Personal', privacy: 'private' });

  R.bizTask = await task({ project_id: R.shared.id, title: 'Business task', privacy: 'business' });
  R.privTask = await task({ project_id: R.shared.id, title: 'Private task', privacy: 'private' });
  R.bizSub = await task({ project_id: R.shared.id, title: 'Business sub-task', parent_task_id: R.bizTask.id, privacy: 'business' });
  R.privSub = await task({ project_id: R.shared.id, title: 'Private sub-task', parent_task_id: R.bizTask.id, privacy: 'private' });
  R.underPriv = await task({ project_id: R.shared.id, title: 'Under the private task', parent_task_id: R.privTask.id });
  R.secretTask = await task({ project_id: R.secretChild.id, title: 'Secret child task' });
  R.openTask = await task({ project_id: R.openChild.id, title: 'Open child task', privacy: 'business' });
  R.personalTask = await task({ project_id: R.personal.id, title: 'Personal task' });
}, 60000);

afterAll(async () => {
  await pool.query('DELETE FROM privacy_change_log WHERE changed_by = ANY($1::int[])', [[steve, deb, rita].filter(Boolean)]);
  await cleanup(pool);
  await pool.end();
});

describe('defaults', () => {
  test('a task in a Private project, or under a Private task, starts Private when nothing is chosen', () => {
    expect(R.personalTask.privacy).toBe('private');
    expect(R.secretTask.privacy).toBe('private');
    expect(R.underPriv.privacy).toBe('private');
    expect(R.bizTask.privacy).toBe('business');
  });
});

describe('the owner sees everything', () => {
  test('all projects, sub-projects and tasks', async () => {
    const S = as(steve);
    const list = (await S.get('/api/projects')).body.projects.map(p => p.name);
    expect(list).toEqual(expect.arrayContaining(['Shared work', 'Personal']));
    const tasks = (await S.get(`/api/tasks?projectId=${R.shared.id}`)).body.tasks;
    expect(titles(tasks)).toEqual(['Business sub-task', 'Business task', 'Private sub-task', 'Private task', 'Under the private task'].sort());
    expect((await S.get(`/api/projects/${R.secretChild.id}`)).status).toBe(200);
  });
});

describe('the editor it is shared with sees only Business', () => {
  test('dashboard: no Private project; counts leave Private tasks and sub-projects out', async () => {
    const mine = (await as(steve).get('/api/projects')).body.projects.find(p => p.id === R.shared.id);
    const hers = (await as(deb).get('/api/projects')).body.projects;
    expect(hers.map(p => p.name)).not.toContain('Personal');
    const shared = hers.find(p => p.id === R.shared.id);
    expect(Number(shared.task_count)).toBe(2);            // Business task + Business sub-task
    expect(Number(mine.task_count)).toBe(5);
    expect(Number(shared.child_count)).toBe(1);           // Open child only
    expect(Number(shared.descendant_task_count)).toBe(1); // Open child task only
  });
  test('project tree, project page, children and the combined Gantt leave the Private sub-project out', async () => {
    const D = as(deb);
    const tree = (await D.get('/api/projects?tree=true')).body.projects.map(p => p.name);
    expect(tree).toEqual(expect.arrayContaining(['Shared work', 'Open child']));
    expect(tree).not.toContain('Secret child');
    const page = (await D.get(`/api/projects/${R.shared.id}`)).body.project;
    expect(page.children.map(c => c.name)).toEqual(['Open child']);
    expect(page.child_count).toBe(1);
    const children = (await D.get(`/api/projects/${R.shared.id}/children`)).body;
    expect(JSON.stringify(children)).not.toContain('Secret child');
    const t = (await D.get(`/api/projects/${R.shared.id}/tree`)).body;
    expect(t.tree.map(x => x.name)).not.toContain('Secret child');
    expect(t.all_tasks.map(x => x.title)).not.toEqual(expect.arrayContaining([expect.stringContaining('Secret child task')]));
  });
  test('Private projects answer "not found", like ones that do not exist', async () => {
    const D = as(deb);
    for (const p of [R.secretChild, R.personal]) {
      expect((await D.get(`/api/projects/${p.id}`)).status).toBe(404);
      expect((await D.get(`/api/tasks?projectId=${p.id}`)).status).toBe(404);
      expect((await D.put(`/api/projects/${p.id}`, { name: 'x' })).status).toBe(404);
      expect((await D.post('/api/tasks', { project_id: p.id, title: 'sneaky' })).status).toBe(404);
    }
  });
  test('task list: no Private task, nothing under one; the sub-task count leaves the Private one out', async () => {
    const tasks = (await as(deb).get(`/api/tasks?projectId=${R.shared.id}`)).body.tasks;
    expect(titles(tasks)).toEqual(['Business sub-task', 'Business task']);
    expect(Number(tasks.find(t => t.id === R.bizTask.id).subtask_count)).toBe(1);
  });
  test('Private tasks cannot be opened, changed, deleted or commented on', async () => {
    const D = as(deb);
    for (const t of [R.privTask, R.privSub, R.underPriv]) {
      expect((await D.get(`/api/tasks/${t.id}`)).status).toBe(404);
      expect((await D.put(`/api/tasks/${t.id}`, { title: 'x' })).status).toBe(404);
      expect((await D.post(`/api/tasks/${t.id}/comments`, { comment: 'x' })).status).toBe(404);
      expect((await D.del(`/api/tasks/${t.id}`)).status).toBe(404);
      expect((await D.get(`/api/tasks/${t.id}/privacy`)).status).toBe(404);
    }
  });
  test('a Business parent\'s status does not follow its Private sub-task', async () => {
    const S = as(steve);
    expect((await S.put(`/api/tasks/${R.privSub.id}`, { status: 'in_progress' })).status).toBe(200);
    const parent = (await pool.query('SELECT status FROM tasks WHERE id = $1', [R.bizTask.id])).rows[0];
    expect(parent.status).toBe('todo');
  });
  test('dependencies with a Private task are left out', async () => {
    const S = as(steve);
    expect((await S.post('/api/dependencies', { dependent_task_id: R.bizTask.id, depends_on_task_id: R.privTask.id })).status).toBeLessThan(300);
    const mine = (await S.get(`/api/dependencies?projectId=${R.shared.id}`)).body.dependencies;
    const hers = (await as(deb).get(`/api/dependencies?projectId=${R.shared.id}`)).body.dependencies;
    expect(mine.length).toBe(1);
    expect(hers.length).toBe(0);
    expect((await as(deb).get(`/api/dependencies/task/${R.bizTask.id}`)).body.depends_on).toEqual([]);
  });
});

describe('someone the project is not shared with (gaps closed by this task)', () => {
  test('cannot see, add to, change or delete anything in it', async () => {
    const X = as(rita);
    expect((await X.get(`/api/projects/${R.shared.id}`)).status).toBe(404);
    expect((await X.post('/api/tasks', { project_id: R.shared.id, title: 'sneaky' })).status).toBe(404);
    expect((await X.put(`/api/tasks/${R.bizTask.id}`, { title: 'changed' })).status).toBe(404);
    expect((await X.del(`/api/tasks/${R.bizTask.id}`)).status).toBe(404);
    expect((await X.post(`/api/tasks/${R.bizTask.id}/assignees`, { contact_email: 'a@example.test' })).status).toBe(404);
    const still = (await pool.query('SELECT title FROM tasks WHERE id = $1', [R.bizTask.id])).rows[0];
    expect(still.title).toMatch(/^Business task/);
  });
});

describe('assigning, sharing and switching', () => {
  test('a Private task cannot be assigned to another user; an outside contact is fine', async () => {
    const S = as(steve);
    const r = await S.post(`/api/tasks/${R.privTask.id}/assignees`, { contact_email: R.debEmail, contact_name: 'Deb' });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/Private/);
    expect((await S.post(`/api/tasks/${R.privTask.id}/assignees`, { contact_email: 'doctor@clinic.example', contact_name: 'Doctor' })).status).toBe(201);
    expect((await S.post('/api/tasks', { project_id: R.shared.id, title: 'x', privacy: 'private', assignees: [{ contact_email: R.debEmail }] })).status).toBe(400);
  });
  test('a Private project is not shared until it is Business', async () => {
    const r = await as(steve).post(`/api/projects/${R.personal.id}/share`, { email: R.debEmail, role: 'viewer' });
    expect(r.status).toBe(400);
  });
  test('only the owner can switch; the switch is logged; then the other user sees it', async () => {
    expect((await as(deb).put(`/api/tasks/${R.bizTask.id}/privacy`, { privacy: 'private' })).status).toBe(403);
    const S = as(steve);
    const r = await S.put(`/api/tasks/${R.privTask.id}/privacy`, { privacy: 'business' });
    expect(r.status).toBe(200);
    expect((await as(deb).get(`/api/tasks/${R.privTask.id}`)).status).toBe(200);
    const h = (await S.get(`/api/tasks/${R.privTask.id}/privacy`)).body;
    expect(h.is_owner).toBe(true);
    expect(h.history[0]).toEqual(expect.objectContaining({ old_privacy: 'private', new_privacy: 'business' }));
    const p = await S.put(`/api/projects/${R.secretChild.id}/privacy`, { privacy: 'business' });
    expect(p.status).toBe(200);
    const hers = (await as(deb).get(`/api/projects/${R.shared.id}`)).body.project.children.map(c => c.name).sort();
    expect(hers).toEqual(['Open child', 'Secret child']);
    // Its task was created Private (inside a Private project) and stays Private on its own.
    expect((await as(deb).get(`/api/tasks/${R.secretTask.id}`)).status).toBe(404);
  });
  test('a task assigned to someone else cannot be made Private', async () => {
    const S = as(steve);
    const t = (await S.post('/api/tasks', { project_id: R.shared.id, title: 'Assigned', privacy: 'business', assignees: [{ contact_email: R.debEmail }] })).body.task;
    const r = await S.put(`/api/tasks/${t.id}/privacy`, { privacy: 'private' });
    expect(r.status).toBe(400);
  });
});
