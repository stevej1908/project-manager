/**
 * Unit tests for the TaskListView component.
 *
 * TaskListView reads its tasks from ProjectContext (not from an API call) and
 * has no loading state of its own, so the context must supply `tasks`,
 * `updateTask` and `loadProject`.
 */
import { render, screen, act } from '@testing-library/react';
import TaskListView from '../TaskListView';
import { ProjectContext } from '../../context/ProjectContext';

// TaskListView only touches dependenciesAPI.getAll (in an effect).
jest.mock('../../services/api', () => ({
  dependenciesAPI: { getAll: jest.fn() },
}));
const { dependenciesAPI } = require('../../services/api');
// Modals are opened on interaction; not exercised here.
jest.mock('../CreateTaskModal', () => () => null);
jest.mock('../TaskDetailsModal', () => () => null);

async function renderView(tasks = []) {
  render(
    <ProjectContext.Provider
      value={{ tasks, updateTask: jest.fn(), loadProject: jest.fn() }}
    >
      <TaskListView projectId={1} />
    </ProjectContext.Provider>
  );
  // Flush the dependency-loading effect's state update inside act().
  await act(async () => {});
}

describe('TaskListView Component', () => {
  // CRA's jest sets resetMocks:true, wiping factory implementations before each
  // test, so (re)establish the effect's dependency call here.
  beforeEach(() => dependenciesAPI.getAll.mockResolvedValue({ dependencies: [] }));

  test('renders the four status columns', async () => {
    await renderView();
    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  test('shows the empty state when there are no tasks', async () => {
    await renderView([]);
    expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument();
  });

  test('renders a row for each top-level task', async () => {
    await renderView([
      { id: 1, title: 'First task', parent_task_id: null, position: 0, status: 'todo', assignees: [] },
      { id: 2, title: 'Second task', parent_task_id: null, position: 1, status: 'todo', assignees: [] },
    ]);
    expect(screen.getByText('First task')).toBeInTheDocument();
    expect(screen.getByText('Second task')).toBeInTheDocument();
    expect(screen.queryByText(/no tasks yet/i)).not.toBeInTheDocument();
  });
});
