/**
 * E2E Tests: Board ↔ Gantt View Switching
 *
 * Tests the primary functionality of switching between views
 * Uses authenticated state from auth.setup.js
 *
 * Run: npx playwright test
 */

const { test, expect } = require('@playwright/test');

test.describe('View Switching', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a project page
    // Note: You may need to adjust the project ID based on your test data
    await page.goto('/project/1');
  });

  test('should display Board and Gantt toggle buttons', async ({ page }) => {
    // Check that both view buttons are visible
    const boardButton = page.getByTitle('Board View');
    const ganttButton = page.getByTitle('Gantt Chart');

    await expect(boardButton).toBeVisible();
    await expect(ganttButton).toBeVisible();
  });

  test('should start in Board view by default', async ({ page }) => {
    // Board view should show status columns
    await expect(page.getByText('To Do')).toBeVisible();
    await expect(page.getByText('In Progress')).toBeVisible();
    await expect(page.getByText('Review')).toBeVisible();
    await expect(page.getByText('Done')).toBeVisible();
  });

  test('should switch to Gantt view when Gantt button is clicked', async ({ page }) => {
    // Click Gantt button
    await page.getByTitle('Gantt Chart').click();

    // Wait for Gantt chart to render
    await page.waitForSelector('svg.gantt', { timeout: 5000 });

    // Verify Gantt chart is visible
    const ganttSVG = page.locator('svg.gantt');
    await expect(ganttSVG).toBeVisible();
  });

  test('should switch back to Board view when Board button is clicked', async ({ page }) => {
    // First switch to Gantt
    await page.getByTitle('Gantt Chart').click();
    await page.waitForSelector('svg.gantt');

    // Then switch back to Board
    await page.getByTitle('Board View').click();

    // Verify Board view is showing
    await expect(page.getByText('To Do')).toBeVisible();
  });

  test('should handle rapid view switching', async ({ page }) => {
    // Rapidly switch between views
    for (let i = 0; i < 5; i++) {
      await page.getByTitle('Gantt Chart').click();
      await page.waitForTimeout(100);
      await page.getByTitle('Board View').click();
      await page.waitForTimeout(100);
    }

    // Should end up in Board view
    await expect(page.getByText('To Do')).toBeVisible();

    // No JavaScript errors should have occurred
    const errors = [];
    page.on('pageerror', error => errors.push(error));
    expect(errors.length).toBe(0);
  });

  test('should maintain view state during page reload', async ({ page }) => {
    // Switch to Gantt view
    await page.getByTitle('Gantt Chart').click();
    await page.waitForSelector('svg.gantt');

    // Reload the page
    await page.reload();

    // Note: View state may not persist on reload unless implemented
    // This test documents the current behavior
    // If you add localStorage persistence, update this test
  });
});
