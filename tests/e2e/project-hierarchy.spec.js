const { test, expect } = require('@playwright/test');

test.describe('Project Hierarchy', () => {

  test('dashboard shows App2Care with hierarchy icon and sub-project badge', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('text=My Projects', { timeout: 15000 });

    // App2Care Incorporation card should be visible
    const app2careCard = page.locator('text=App2Care Incorporation').first();
    await expect(app2careCard).toBeVisible();

    // Should show "6 sub-projects" badge
    await expect(page.locator('text=6 sub-projects')).toBeVisible();
  });

  test('expanding App2Care shows child projects', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('text=My Projects', { timeout: 15000 });

    // Click the expand chevron on App2Care card
    const app2careCard = page.locator('text=App2Care Incorporation').first().locator('..');
    const chevron = app2careCard.locator('svg').first();
    await chevron.click();

    // Wait for children to load - check for known sub-projects (use headings to avoid duplicates in dep table)
    await expect(page.getByRole('heading', { name: 'Pre-Incorporation' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Clerky Workflow' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tax & Compliance' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'FDA Regulatory' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'QMS Setup' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Operations' })).toBeVisible();
  });

  test('clicking App2Care shows Overview tab with sub-project cards', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('text=My Projects', { timeout: 15000 });

    // Click on the App2Care project name
    await page.locator('text=App2Care Incorporation').first().click();

    // Should show Overview tab (auto-selected for parent projects)
    await expect(page.locator('text=Overview')).toBeVisible({ timeout: 10000 });

    // Should show sub-project cards in the overview
    await expect(page.locator('text=Pre-Incorporation')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Clerky Workflow')).toBeVisible();
  });

  test('overview tab shows project dependencies table', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('text=My Projects', { timeout: 15000 });

    await page.locator('text=App2Care Incorporation').first().click();
    await expect(page.locator('text=Overview')).toBeVisible({ timeout: 10000 });

    // Should have a dependencies section
    await expect(page.locator('text=Project Dependencies')).toBeVisible({ timeout: 10000 });
  });

  test('other projects do not show hierarchy elements', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('text=My Projects', { timeout: 15000 });

    // Non-parent projects should not have sub-projects badge
    const personalCard = page.locator('text=Personal').first().locator('..');
    await expect(personalCard.locator('text=sub-projects')).not.toBeVisible();
  });
});
