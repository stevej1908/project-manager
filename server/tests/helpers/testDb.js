/**
 * Test database connection — deliberately paranoid.
 *
 * `server/.env` points DATABASE_URL at a Neon cloud host, and
 * `config/database.js` calls `dotenv.config()` at import time. This suite
 * CREATES and DELETES users, projects and tasks. Reaching that Neon database
 * would destroy real data, so nothing here falls back to `.env`:
 *
 *   1. The connection must be given explicitly via TEST_DATABASE_URL.
 *   2. It is refused unless it names a local host AND a database whose name
 *      marks it as disposable (contains "test" or "dev").
 *   3. After connecting, we ask the server what it actually is and check
 *      again — intent is not the same as arrival.
 *
 * If this file ever seems to be in the way, that is the point. Loosen the
 * allowlist, never the checks.
 */
const { Pool } = require('pg');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '']);
const DISPOSABLE = /(^|[^a-z])(test|dev)/i;

/**
 * True for loopback and RFC1918 private addresses. A managed cloud database
 * (Neon, RDS, …) presents a public address and is never on these ranges, so
 * this is safe to accept — and it lets the runtime check pass when the server
 * is a CI Postgres *service container*, which is reached on localhost but
 * reports a private container IP (e.g. 172.17.x) from inet_server_addr().
 */
function isLocalOrPrivateAddr(addr) {
  if (LOCAL_HOSTS.has(addr)) return true;
  return /^10\./.test(addr)
    || /^192\.168\./.test(addr)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(addr);
}

const SETUP_HINT = [
  'Set TEST_DATABASE_URL to a LOCAL, disposable database, e.g.',
  '  postgres://postgres:<password>@localhost:5432/project_manager_test',
  'It must be a database you are willing to have rows created and deleted in.',
  'Do NOT point it at the Neon URL in server/.env.',
].join('\n');

function parseTarget(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch (err) {
    throw new Error(`TEST_DATABASE_URL is not a valid URL.\n${SETUP_HINT}`);
  }
  return { host: url.hostname, database: decodeURIComponent(url.pathname).replace(/^\//, '') };
}

/** Throws unless the target is both local and disposable. */
function assertDisposableTarget({ host, database }) {
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `Refusing to run tests against non-local host "${host}". ` +
      `These tests create and delete data.\n${SETUP_HINT}`
    );
  }
  if (!DISPOSABLE.test(database)) {
    throw new Error(
      `Refusing to run tests against database "${database}": the name does not ` +
      `contain "test" or "dev", so it is not recognisably disposable.\n${SETUP_HINT}`
    );
  }
}

let sharedPool = null;

/** Lazily builds the single test pool. Safe to call from a jest.mock factory. */
function getTestPool() {
  if (sharedPool) return sharedPool;

  const rawUrl = process.env.TEST_DATABASE_URL;
  if (!rawUrl) {
    throw new Error(`TEST_DATABASE_URL is not set.\n${SETUP_HINT}`);
  }

  const target = parseTarget(rawUrl);
  assertDisposableTarget(target);

  // statement_timeout guards against a runaway query hanging the whole suite —
  // e.g. the depth-recompute recursive CTE looping if the cycle guard is ever
  // broken. A regression like that should fail fast, not hang.
  sharedPool = new Pool({ connectionString: rawUrl, max: 4, connectionTimeoutMillis: 5000, statement_timeout: 3000 });
  sharedPool.__target = target;
  return sharedPool;
}

/**
 * Verify what we actually connected to, not what we meant to connect to.
 * Call once in beforeAll, before any fixture is written.
 */
async function assertConnectedDatabaseIsSafe(pool) {
  const { rows } = await pool.query(
    'SELECT current_database() AS db, host(COALESCE(inet_server_addr(), \'127.0.0.1\'::inet)) AS addr'
  );
  const { db, addr } = rows[0];

  if (!DISPOSABLE.test(db)) {
    throw new Error(`Connected to database "${db}", which is not recognisably disposable. Aborting.`);
  }
  if (!isLocalOrPrivateAddr(addr)) {
    throw new Error(`Connected to server at "${addr}", which is a public host. Aborting.`);
  }
  return { db, addr };
}

/** Fails with a readable message if the hierarchy migration has not been applied. */
async function assertHierarchySchema(pool) {
  const { rows } = await pool.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'tasks' AND column_name IN ('parent_task_id', 'depth_level')`
  );
  const found = rows.map((r) => r.column_name);
  const missing = ['parent_task_id', 'depth_level'].filter((c) => !found.includes(c));
  if (missing.length) {
    throw new Error(
      `tasks table is missing ${missing.join(', ')}. Apply the migrations ` +
      `(database/migrations/001_add_subtasks_and_dependencies.sql) to the test database first.`
    );
  }
}

module.exports = { getTestPool, assertConnectedDatabaseIsSafe, assertHierarchySchema };
