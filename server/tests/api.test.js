/**
 * Backend API Tests
 *
 * Tests the Express API endpoints
 * Run with: cd server && npm test
 *
 * Note: These tests require a test database
 * Set TEST_DATABASE_URL in .env.test
 */

const request = require('supertest');
const app = require('../server');

// Mock authentication middleware for testing
jest.mock('../middleware/auth', () => ({
  requireAuth: (req, res, next) => {
    req.user = { id: 1, email: 'test@example.com' };
    next();
  }
}));

describe('API Health Check', () => {
  test('GET /api/health should return 200', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);

    expect(response.body).toHaveProperty('status', 'ok');
  });
});

describe('Projects API', () => {
  test('GET /api/projects should return projects list', async () => {
    const response = await request(app)
      .get('/api/projects')
      .expect(200);

    expect(response.body).toHaveProperty('projects');
    expect(Array.isArray(response.body.projects)).toBe(true);
  });

  test('POST /api/projects should create a project', async () => {
    const newProject = {
      name: 'Test Project',
      description: 'Test description',
      color: '#0ea5e9'
    };

    const response = await request(app)
      .post('/api/projects')
      .send(newProject)
      .expect(201);

    expect(response.body).toHaveProperty('project');
    expect(response.body.project).toHaveProperty('name', newProject.name);
  });
});

describe('Tasks API', () => {
  test('GET /api/tasks should return tasks for a project', async () => {
    const response = await request(app)
      .get('/api/tasks?project_id=1')
      .expect(200);

    expect(response.body).toHaveProperty('tasks');
    expect(Array.isArray(response.body.tasks)).toBe(true);
  });

  test('POST /api/tasks should create a task', async () => {
    const newTask = {
      project_id: 1,
      title: 'Test Task',
      description: 'Test task description',
      status: 'todo',
      priority: 'medium'
    };

    const response = await request(app)
      .post('/api/tasks')
      .send(newTask)
      .expect(201);

    expect(response.body).toHaveProperty('task');
    expect(response.body.task).toHaveProperty('title', newTask.title);
  });
});

// Add more test suites for other endpoints
describe('Error Handling', () => {
  test('Should return 404 for non-existent routes', async () => {
    await request(app)
      .get('/api/nonexistent')
      .expect(404);
  });

  test('Should return 400 for invalid request body', async () => {
    const response = await request(app)
      .post('/api/projects')
      .send({ invalid: 'data' }) // Missing required 'name' field
      .expect(400);

    expect(response.body).toHaveProperty('error');
  });
});

// Clean up after tests
afterAll(async () => {
  // Close database connections, etc.
  if (app.locals.pool) {
    await app.locals.pool.end();
  }
});
