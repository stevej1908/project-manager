/**
 * Items 2 & 3 of the task-hierarchy design, as surfaced in TaskDetailsModal:
 *   - item 2: an "Add sub-task" affordance (available at any depth).
 *   - item 3: "Promote to top-level" and a "Make subtask of…" re-parent picker
 *             that excludes the task itself and its descendants, wired to
 *             updateTask's parent_task_id support.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskDetailsModal from '../TaskDetailsModal';
import { tasksAPI } from '../../services/api';

jest.mock('../../services/api', () => ({
  tasksAPI: { getById: jest.fn(), getAll: jest.fn(), update: jest.fn() },
  dependenciesAPI: { getForTask: jest.fn() },
  googleAPI: { getTaskEmails: jest.fn() },
  projectsAPI: { getById: jest.fn() },
}));

// Child modals: only CreateTaskModal matters here (we assert the parent it is
// opened with); the rest are stubbed to nothing.
jest.mock('../DriveFilePicker', () => () => null);
jest.mock('../EmailAttachmentModal', () => () => null);
jest.mock('../ContactsPickerModal', () => () => null);
jest.mock('../CreateTaskModal', () => (props) => (
  <div data-testid="create-subtask-modal" data-parent={String(props.parentTaskId)} />
));

// The task under test (id 10) is a child of parent id 5, and itself has a
// descendant id 30. Sibling id 20 is a valid re-parent target.
const SELF = { id: 10, project_id: 1, title: 'Child task', status: 'todo', priority: 'medium', parent_task_id: 5, subtask_count: 1, description: '', start_date: null, end_date: null, comments: [], attachments: [] };
const ALL_TASKS = [
  { id: 5, project_id: 1, title: 'Parent task', parent_task_id: null, status: 'todo' },
  SELF,
  { id: 20, project_id: 1, title: 'Sibling task', parent_task_id: null, status: 'todo' },
  { id: 30, project_id: 1, title: 'Own child task', parent_task_id: 10, status: 'todo' },
];

beforeEach(() => {
  jest.clearAllMocks();
  window.alert = jest.fn();
  tasksAPI.getById.mockResolvedValue({ task: SELF });
  tasksAPI.getAll.mockResolvedValue({ tasks: ALL_TASKS });
  tasksAPI.update.mockResolvedValue({ task: SELF });
  const api = require('../../services/api');
  api.dependenciesAPI.getForTask.mockResolvedValue({ depends_on: [], blocks: [] });
  api.googleAPI.getTaskEmails.mockResolvedValue({ emails: [] });
  api.projectsAPI.getById.mockResolvedValue({ project: { id: 1, name: 'P', parent_project_id: null } });
});

function renderModal() {
  const onUpdate = jest.fn();
  render(<TaskDetailsModal taskId={10} onClose={jest.fn()} onUpdate={onUpdate} />);
  return { onUpdate };
}

describe('TaskDetailsModal add sub-task (item 2)', () => {
  test('opens the create-subtask modal with this task as the parent', async () => {
    renderModal();

    const addButton = await screen.findByTitle('Add sub-task');
    await userEvent.click(addButton);

    const modal = screen.getByTestId('create-subtask-modal');
    expect(modal).toHaveAttribute('data-parent', '10');
  });
});

describe('TaskDetailsModal re-parent / promote (item 3)', () => {
  test('promotes to top-level via updateTask with parent_task_id null', async () => {
    renderModal();

    const promote = await screen.findByTitle('Promote to top-level task');
    await userEvent.click(promote);

    // One continuous waitFor keeps act() open across the whole changeParent
    // chain (update -> reload -> clear `reparenting`): assert the call happened
    // and the control has re-enabled, so no trailing state update escapes act.
    await waitFor(() => {
      expect(tasksAPI.update).toHaveBeenCalledWith(10, { parent_task_id: null });
      expect(screen.getByTitle('Promote to top-level task')).toBeEnabled();
    });
  });

  test('re-parent picker excludes the task itself and its descendants', async () => {
    renderModal();

    const option = await screen.findByRole('option', { name: /make subtask of/i });
    const select = option.closest('select');
    const names = within(select).getAllByRole('option').map((o) => o.textContent);

    expect(names.join(' ')).toMatch(/Sibling task/);
    expect(names.join(' ')).toMatch(/Parent task/);
    expect(names.join(' ')).not.toMatch(/Own child task/); // descendant excluded
    expect(names.join(' ')).not.toMatch(/Child task/);      // self excluded
  });

  test('moving under a chosen parent calls updateTask with that parent id', async () => {
    renderModal();

    const option = await screen.findByRole('option', { name: /make subtask of/i });
    const select = option.closest('select');
    await userEvent.selectOptions(select, '20');
    await userEvent.click(screen.getByRole('button', { name: 'Move' }));

    // Single continuous waitFor (see promote test). Settle on the Promote
    // control re-enabling — disabled solely by `reparenting`; the Move button
    // also depends on a selection, which the reload clears.
    await waitFor(() => {
      expect(tasksAPI.update).toHaveBeenCalledWith(10, { parent_task_id: 20 });
      expect(screen.getByTitle('Promote to top-level task')).toBeEnabled();
    });
  });
});
