/**
 * E2E auth setup (programmatic — no interactive Google OAuth).
 *
 * Seeds a known test user into the test database, resets its data, mints a JWT
 * the backend will accept, and writes a Playwright storageState that pre-loads
 * that token into localStorage. All specs then start authenticated as that user.
 */
const { test: setup } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { getPool, setupSchema, seedUser, resetUserData } = require('./helpers/db');
const { mint } = require('./helpers/mintToken');

const authFile = path.join(__dirname, '.auth', 'user.json');

setup('seed database and authenticate the test user', async () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET must be set and must match the backend the e2e server runs with.');
  }

  const pool = getPool();
  try {
    await setupSchema(pool);
    const user = await seedUser(pool);
    await resetUserData(pool, user.id);

    const token = mint({ id: user.id, email: user.email, name: user.name }, secret);
    const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
    const origin = new URL(baseURL).origin;

    const state = {
      cookies: [],
      origins: [{ origin, localStorage: [{ name: 'authToken', value: token }] }],
    };
    fs.mkdirSync(path.dirname(authFile), { recursive: true });
    fs.writeFileSync(authFile, JSON.stringify(state, null, 2));
  } finally {
    await pool.end();
  }
});
