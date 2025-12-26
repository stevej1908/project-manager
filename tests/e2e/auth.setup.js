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

const { test as setup, expect } = require('@playwright/test');
const path = require('path');

const authFile = path.join(__dirname, '.auth', 'user.json');

setup('authenticate with Google OAuth', async ({ page }) => {
  console.log('\n🔐 AUTHENTICATION SETUP');
  console.log('Please complete Google OAuth login manually in the browser...\n');

  // Go to the login page
  await page.goto('http://localhost:3000');

  // Wait for Google OAuth redirect/login
  // This is where you manually complete the OAuth flow in the browser
  await page.waitForURL('**/dashboard', { timeout: 120000 }); // 2 minutes to complete OAuth

  // Verify we're logged in
  await expect(page).toHaveURL(/dashboard/);

  // Save signed-in state to 'user.json'
  await page.context().storageState({ path: authFile });

  console.log('\n✅ Authentication successful!');
  console.log(`📁 Auth state saved to: ${authFile}\n`);
});
