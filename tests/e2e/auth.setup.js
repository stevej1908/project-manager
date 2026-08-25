/**
 * Playwright Authentication Setup
 *
 * This file handles Google OAuth authentication ONCE
 * and saves the authentication state for reuse in all tests
 *
 * HOW TO USE:
 * 1. Run this setup once in headed mode (not headless)
 * 2. Manually complete Google OAuth login
 * 3. Auth state is saved to .auth/user.json
 * 4. All subsequent tests use the saved auth state
 *
 * Run: npx playwright test --project=setup --headed
 */

const { test: setup, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const authFile = path.join(__dirname, '.auth', 'user.json');

setup('authenticate with Google OAuth', async ({ page }) => {
  // Skip if auth state already exists
  if (fs.existsSync(authFile)) {
    console.log('\n✅ Auth state already exists, skipping OAuth setup.');
    return;
  }

  setup.setTimeout(180000); // 3 minutes to complete OAuth

  console.log('\n🔐 AUTHENTICATION SETUP');
  console.log('Please complete Google OAuth login manually in the browser...\n');

  // Go to the login page
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  await page.goto(baseUrl);

  // Wait for user to complete Google OAuth and return to the app
  // The callback URL contains a token param, then redirects to /
  await page.waitForSelector('text=My Projects', { timeout: 120000 });

  // Save signed-in state to 'user.json'
  await page.context().storageState({ path: authFile });

  console.log('\n✅ Authentication successful!');
  console.log(`📁 Auth state saved to: ${authFile}\n`);
});
