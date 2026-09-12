/**
 * Item 2 of the task-hierarchy design, in TaskListView: the "Add sub-task"
 * affordance must be available on rows at ANY depth (the old code only offered
 * it on top-level rows). These tests reveal nested rows and check the control
 * is present on them and opens the create modal parented to that row.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskListView from '../TaskListView';
import { ProjectContext } from '../../context/ProjectContext';

jest.mock('../../services/api', () => ({
  dependenciesAPI: { getAll: jest.fn() },
}));
const { dependenciesAPI } = require('../../services/api');
// CRA's jest resetMocks:true wipes factory impls before each test.
beforeEach(() => dependenciesAPI.getAll.mockResolvedValue({ dependencies: [] }));
// Stub the modals TaskListView can open so we can assert the parent it passes.
jest.mock('../CreateTaskModal', () => (props) => (
  <div data-testid="create-task-modal" data-parent={String(props.parentTaskId)} />
));
jest.mock('../TaskDetailsModal', () => () => null);

// Parent (1) -> Sub (2) -> Grand (3): three levels.
const TASKS = [
  { id: 1, title: 'Parent', parent_task_id: null, position: 0, status: 'todo', subtask_count: 1, assignees: [] },
  { id: 2, title: 'Sub', parent_task_id: 1, position: 0, status: 'todo', subtask_count: 1, assignees: [] },
  { id: 3, title: 'Grand', parent_task_id: 2, position: 0, status: 'todo', subtask_count: 0, assignees: [] },
];

function renderView() {
  render(
    <ProjectContext.Provider value={{ tasks: TASKS, updateTask: jest.fn(), loadProject: jest.fn() }}>
      <TaskListView projectId={1} />
    </ProjectContext.Provider>
  );
}

/** The chevron is the first button in a row that has sub-tasks. */
async function expandRow(title) {
  const row = screen.getByText(title).closest('tr');
  await userEvent.click(within(row).getAllByRole('button')[0]);
}

describe('TaskListView add sub-task at any depth (item 2)', () => {
  test('offers an Add sub-task control on nested rows, not just the top level', async () => {
    renderView();

    // Only the top-level row is visible at first.
    expect(screen.getAllByTitle('Add sub-task')).toHaveLength(1);

    await expandRow('Parent'); // reveals Sub (depth 1)
    await expandRow('Sub');    // reveals Grand (depth 2)

    // Every visible row — including the two nested ones — has the control.
    expect(screen.getAllByTitle('Add sub-task')).toHaveLength(3);
  });

  test('opening it on a nested row uses that row as the parent', async () => {
    renderView();

    await expandRow('Parent');
    const subRow = screen.getByText('Sub').closest('tr');
    await userEvent.click(within(subRow).getByTitle('Add sub-task'));

    expect(screen.getByTestId('create-task-modal')).toHaveAttribute('data-parent', '2');
  });
});
