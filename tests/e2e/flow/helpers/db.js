/**
 * E2E test-database helper.
 *
 * Same paranoia as the server unit tests: this creates and deletes rows, so it
 * refuses any connection that is not local (or an RFC1918 private host, for CI
 * service containers) AND named disposably (contains "test"/"dev"). It will not
 * touch the Neon URL in server/.env.
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '']);
const DISPOSABLE = /(^|[^a-z])(test|dev)/i;

const HINT =
  'Set E2E_DATABASE_URL (or DATABASE_URL) to a LOCAL, disposable database, e.g.\n' +
  '  postgres://postgres:<pw>@localhost:5432/project_manager_test';

function dbUrl() {
  const url = process.env.E2E_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('No E2E_DATABASE_URL / DATABASE_URL set.\n' + HINT);
  return url;
}

function assertDisposable(rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch { throw new Error('Invalid database URL.\n' + HINT); }
  const db = decodeURIComponent(u.pathname).replace(/^\//, '');
  if (!LOCAL_HOSTS.has(u.hostname)) {
    throw new Error(`Refusing non-local host "${u.hostname}".\n` + HINT);
  }
  if (!DISPOSABLE.test(db)) {
    throw new Error(`Refusing database "${db}" (not recognisably disposable).\n` + HINT);
  }
}

function getPool() {
  const url = dbUrl();
  assertDisposable(url);
  return new Pool({ connectionString: url, max: 4, connectionTimeoutMillis: 8000 });
}

/**
 * Apply migrations 000-004 tolerantly (000 is a consolidated schema that
 * overlaps 001, and 004 is idempotent) — mirrors run-all-migrations' handling
 * of "already exists". 005 seeds real app2care data and is deliberately skipped.
 */
async function setupSchema(pool) {
  const dir = path.join(__dirname, '..', '..', '..', '..', 'database', 'migrations');
  const files = fs.readdirSync(dir).filter((f) => /^00[0-4].*\.sql$/.test(f)).sort();
  for (const f of files) {
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    try {
      await pool.query(sql);
    } catch (err) {
      if (/already exists|duplicate/i.test(err.message)) continue;
      throw new Error(`Migration ${f} failed: ${err.message}`);
    }
  }
}

const TEST_USER = { google_id: 'e2e-test-user', email: 'e2e@example.test', name: 'E2E Test User' };

async function seedUser(pool) {
  const { rows } = await pool.query(
    `INSERT INTO users (google_id, email, name)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, google_id = EXCLUDED.google_id
     RETURNING id, email, name`,
    [TEST_USER.google_id, TEST_USER.email, TEST_USER.name]
  );
  return rows[0];
}

/** Clear the test user's projects (cascades tasks) so each run starts clean. */
async function resetUserData(pool, userId) {
  await pool.query('DELETE FROM projects WHERE owner_id = $1', [userId]);
}

module.exports = { getPool, setupSchema, seedUser, resetUserData, TEST_USER };
