// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Full-stack e2e config for the task/project hierarchy flow.
 *
 * Stands up the real backend (:5000) against a test database and the frontend
 * (:3000), then drives the app in Chromium. Auth is programmatic — see
 * tests/e2e/flow/hierarchy.setup.js.
 *
 * Required env (same values for the test process AND the backend below):
 *   JWT_SECRET            secret the backend verifies tokens with
 *   E2E_DATABASE_URL      (or DATABASE_URL) a LOCAL, disposable Postgres
 */
const DB_URL = process.env.E2E_DATABASE_URL || process.env.DATABASE_URL || '';
const JWT_SECRET = process.env.JWT_SECRET || '';
const isCI = !!process.env.CI;

// Feed the backend the individual DB_* vars rather than DATABASE_URL: the
// server forces SSL when DATABASE_URL is set, which a local/CI Postgres rejects.
// The DB_* path uses ssl:false.
let dbEnv = {};
if (DB_URL) {
  const u = new URL(DB_URL);
  dbEnv = {
    DB_HOST: u.hostname,
    DB_PORT: u.port || '5432',
    DB_NAME: decodeURIComponent(u.pathname).replace(/^\//, ''),
    DB_USER: decodeURIComponent(u.username),
    DB_PASSWORD: decodeURIComponent(u.password),
  };
}

module.exports = defineConfig({
  testDir: './tests/e2e/flow',
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: 1,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'setup', testMatch: /hierarchy\.setup\.js/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'tests/e2e/flow/.auth/user.json' },
      dependencies: ['setup'],
    },
  ],

  webServer: [
    {
      // Backend API against the test database. Run from repo root so dotenv
      // finds no .env (server/.env stays unread) and our env below wins.
      command: 'node server/server.js',
      // 127.0.0.1, not localhost: on Windows Node resolves localhost to ::1
      // first, but the server listens on IPv4, so the readiness probe hangs.
      url: 'http://127.0.0.1:5000/api/health',
      reuseExistingServer: !isCI,
      timeout: 60 * 1000,
      env: {
        ...dbEnv,
        JWT_SECRET,
        PORT: '5000',
        NODE_ENV: 'test',
        FRONTEND_URL: 'http://localhost:3000',
      },
    },
    {
      // CRA dev server. CI:'' so react-scripts doesn't treat warnings as errors.
      command: 'npm start',
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: !isCI,
      timeout: 180 * 1000,
      // No HOST: setting it trips a CRA 5 dev-server bug (allowedHosts empty).
      // CRA binds IPv4 loopback, which is why the readiness url uses 127.0.0.1.
      env: { BROWSER: 'none', CI: '', PORT: '3000' },
    },
  ],
});
