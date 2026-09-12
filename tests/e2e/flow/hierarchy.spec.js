/**
 * End-to-end: the task/project hierarchy flow, against the real backend and
 * database. Signed in programmatically as the seeded test user (see
 * hierarchy.setup.js), this walks the journey the design describes:
 *
 *   create project -> add a task (with status) -> add a sub-task from the list
 *   -> promote the sub-task to top level from its details -> add a sub-project.
 */
const { test, expect } = require('@playwright/test');

const RUN = Date.now();
const PROJECT = `E2E Hierarchy ${RUN}`;
const SUBPROJECT = `E2E Sub ${RUN}`;
const PARENT_TASK = `Parent task ${RUN}`;
const CHILD_TASK = `Child task ${RUN}`;

test('task & project hierarchy flow', async ({ page }) => {
  test.setTimeout(120000);

  await test.step('loads the dashboard authenticated', async () => {
    await page.goto('/');
    await expect(page.getByText('My Projects')).toBeVisible({ timeout: 30000 });
  });

  await test.step('creates a top-level project', async () => {
    await page.getByRole('button', { name: 'New Project' }).click();
    await page.getByPlaceholder('Enter project name').fill(PROJECT);
    // Scope to the modal form — the empty dashboard also has a "Create Project" button.
    await page.locator('form').getByRole('button', { name: 'Create Project' }).click();
    await expect(page.getByText(PROJECT)).toBeVisible();
  });

  await test.step('opens the project and adds a task with a status', async () => {
    await page.getByText(PROJECT).click();
    await page.getByRole('button', { name: 'New Task' }).click();
    await page.getByPlaceholder('Enter task title').fill(PARENT_TASK);
    await page.getByRole('combobox').selectOption('in_progress'); // item 5: status on create
    await page.locator('form').getByRole('button', { name: 'Create Task' }).click();
    await expect(page.getByText(PARENT_TASK)).toBeVisible();
  });

  await test.step('adds a sub-task from the list row (item 2)', async () => {
    const parentRow = page.getByRole('row').filter({ hasText: PARENT_TASK });
    await parentRow.getByTitle('Add sub-task').click();
    await expect(page.getByText('Create New Sub-Task')).toBeVisible();
    await page.getByPlaceholder('Enter task title').fill(CHILD_TASK);
    await page.locator('form').getByRole('button', { name: 'Create Task' }).click();

    // Wait until the parent actually shows it has a sub-task (count badge) so the
    // expand chevron exists, then expand and see the sub-task. Gating on the badge
    // avoids clicking before the list has reloaded with the new child.
    await expect(parentRow.getByText('(1)')).toBeVisible();
    await parentRow.getByRole('button').first().click(); // chevron
    await expect(page.getByText(CHILD_TASK)).toBeVisible();
  });

  await test.step('promotes the sub-task to top level from its details (item 3)', async () => {
    await page.getByText(CHILD_TASK).click();
    await expect(page.getByRole('heading', { name: 'Task Details' })).toBeVisible();

    // Item 3 UI: the re-parent picker ("Make subtask of…") and the promote
    // affordance are both present for a task that has a parent.
    await expect(page.getByRole('option', { name: /make subtask of/i })).toBeAttached();
    const promote = page.getByTitle('Promote to top-level task');
    await expect(promote).toBeVisible();
    await promote.click();

    // Promote persists via the API and the modal closes; the sub-task is now a
    // top-level sibling (verified next).
    await expect(page.getByRole('heading', { name: 'Task Details' })).toBeHidden();
    // Both are now top-level rows, each with its own "Add sub-task" control.
    await expect(page.getByTitle('Add sub-task')).toHaveCount(2);
  });

  await test.step('creates a sub-project (item 4)', async () => {
    await page.getByTitle('Add Sub-Project').click();
    await expect(page.getByRole('heading', { name: 'Create Sub-Project' })).toBeVisible();
    await page.getByPlaceholder('Enter sub-project name').fill(SUBPROJECT);
    await page.locator('form').getByRole('button', { name: 'Create Sub-Project' }).click();
    await expect(page.getByText(SUBPROJECT)).toBeVisible();
  });
});
