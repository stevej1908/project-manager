/**
 * Task 051 (WES CRM handoff): every open task has a date or a blocker.
 *
 * - A task may only wait on a task that has a date, directly or further up its chain.
 * - Loops are refused at any length, and the message names the tasks in the loop.
 * - When a blocker is marked done, each undated task waiting on it gets done date + 2 working
 *   days (Arizona), and the answer lists them so the screen can ask the person to confirm.
 * - Clearing a due date through the API is not possible (null keeps the date).
 *
 * Real local Postgres, as for the other server tests; real routes and sign-in check.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'task-dates-test-secret';
jest.mock('../config/database', () => {
  const { getTestPool } = require('./helpers/testDb');
  return { pool: getTestPool() };
});

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { assertConnectedDatabaseIsSafe } = require('./helpers/testDb');
const { createUser, cleanup } = require('./helpers/fixtures');
const taskDates = require('../lib/taskDates');

let app, steve, project;
const token = (id) => `Bearer ${jwt.sign({ id, email: `u${id}@example.test`, name: `User ${id}` }, process.env.JWT_SECRET, { expiresIn: '10m' })}`;
const S = {
  post: (u, b) => request(app).post(u).set('Authorization', token(steve)).send(b || {}),
  put: (u, b) => request(app).put(u).set('Authorization', token(steve)).send(b || {}),
  get: (u) => request(app).get(u).set('Authorization', token(steve)),
};
const task = async (title, extra = {}) => {
  const r = await S.post('/api/tasks', { project_id: project.id, title, ...extra });
  expect(r.status).toBe(201);
  return r.body.task;
};
const link = (waiter, blocker) => S.post('/api/dependencies', { dependent_task_id: waiter.id, depends_on_task_id: blocker.id });
const endOf = async (id) => (await pool.query(`SELECT to_char(end_date, 'YYYY-MM-DD') AS d FROM tasks WHERE id = $1`, [id])).rows[0].d;

beforeAll(async () => {
  await assertConnectedDatabaseIsSafe(pool);
  app = express();
  app.use(express.json());
  app.use('/api/projects', require('../routes/projects'));
  app.use('/api/tasks', require('../routes/tasks'));
  app.use('/api/dependencies', require('../routes/dependencies'));
  steve = await createUser(pool);
  const r = await S.post('/api/projects', { name: 'Task 051 dates', privacy: 'business' });
  expect(r.status).toBe(201);
  project = r.body.project;
}, 60000);

afterAll(async () => {
  await cleanup(pool);
  await pool.end();
});

describe('working days', () => {
  test('done date + 2 working days skips the weekend', () => {
    expect(taskDates.workdaysAfter('2026-11-26', 2)).toBe('2026-11-30');   // Thu -> Mon
    expect(taskDates.workdaysAfter('2026-11-27', 2)).toBe('2026-12-01');   // Fri -> Tue
    expect(taskDates.workdaysAfter('2026-11-28', 2)).toBe('2026-12-01');   // Sat -> Tue
  });
});

describe('a task may only wait on a dated task', () => {
  test('waiting on an undated task is refused, naming it', async () => {
    const y = await task('Undated Y');
    const x = await task('Waits on Y', { end_date: '2030-02-01' });
    const r = await link(x, y);
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('BLOCKER_UNDATED');
    expect(r.body.error).toContain(`Task ${y.id} "Undated Y" has no due date`);
  });

  test('waiting on a dated task is allowed', async () => {
    const y = await task('Dated Y', { end_date: '2030-02-01' });
    const x = await task('Waits on dated Y');
    expect((await link(x, y)).status).toBe(201);
  });

  test('an undated task that itself waits on a dated one can be waited on (the chain has a date)', async () => {
    const first = await task('Dated first', { end_date: '2030-02-01' });
    const middle = await task('Undated middle');
    expect((await link(middle, first)).status).toBe(201);
    const last = await task('Waits on the middle');
    expect((await link(last, middle)).status).toBe(201);
  });

  test('a finished blocker counts as dated', async () => {
    const done = await task('Finished, no date');
    await pool.query(`UPDATE tasks SET status = 'done' WHERE id = $1`, [done.id]);
    const x = await task('Waits on finished');
    expect((await link(x, done)).status).toBe(201);
  });
});

describe('loops are refused, naming the tasks', () => {
  test('A waits on B, then B waits on A', async () => {
    const a = await task('Loop A', { end_date: '2030-02-01' });
    const b = await task('Loop B', { end_date: '2030-02-01' });
    expect((await link(a, b)).status).toBe(201);
    const r = await link(b, a);
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('LOOP');
    expect(r.body.error).toMatch(/circular/);
    expect(r.body.loop.map(t => t.id)).toEqual([b.id, a.id, b.id]);
    expect(r.body.error).toContain('"Loop A"');
  });

  test('a three-task loop', async () => {
    const a = await task('Ring A', { end_date: '2030-02-01' });
    const b = await task('Ring B', { end_date: '2030-02-01' });
    const c = await task('Ring C', { end_date: '2030-02-01' });
    expect((await link(a, b)).status).toBe(201);
    expect((await link(b, c)).status).toBe(201);
    const r = await link(c, a);
    expect(r.status).toBe(400);
    expect(r.body.loop.map(t => t.id)).toEqual([c.id, a.id, b.id, c.id]);
  });
});

describe('when a blocker is done, its undated waiting tasks get a date', () => {
  test('done date + 2 working days; dated waiting tasks are left alone; the answer lists them', async () => {
    const blocker = await task('Blocker', { end_date: '2030-02-01' });
    const undated = await task('Waiting, no date');
    const dated = await task('Waiting, has a date', { end_date: '2030-03-01' });
    expect((await link(undated, blocker)).status).toBe(201);
    expect((await link(dated, blocker)).status).toBe(201);

    const r = await S.put(`/api/tasks/${blocker.id}`, { status: 'done' });
    expect(r.status).toBe(200);
    const expected = taskDates.workdaysAfter(taskDates.arizonaToday(), 2);
    expect(r.body.dated_waiting).toEqual([expect.objectContaining({ id: undated.id, title: 'Waiting, no date', end_date: expected })]);
    expect(await endOf(undated.id)).toBe(expected);
    expect(await endOf(dated.id)).toBe('2030-03-01');
  });

  test('a task that is not done dates nothing', async () => {
    const blocker = await task('Still going', { end_date: '2030-02-01' });
    const waiter = await task('Waits');
    expect((await link(waiter, blocker)).status).toBe(201);
    const r = await S.put(`/api/tasks/${blocker.id}`, { status: 'in_progress' });
    expect(r.body.dated_waiting).toEqual([]);
    expect(await endOf(waiter.id)).toBeNull();
  });
});

describe('a due date cannot be cleared through the API', () => {
  test('sending null keeps the date', async () => {
    const t = await task('Keeps its date', { end_date: '2030-02-01' });
    expect((await S.put(`/api/tasks/${t.id}`, { end_date: null, title: 'Keeps its date (renamed)' })).status).toBe(200);
    expect(await endOf(t.id)).toBe('2030-02-01');
  });
});
