/**
 * Item 4 of the task-hierarchy design: a findable "Add Sub-Project" button on a
 * project, which respects the 3-level depth cap (hidden at max depth) and opens
 * CreateProjectModal parented to the current project.
 *
 * ProjectPage pulls in many heavy children; they are stubbed so these tests
 * exercise only the header's sub-project affordance.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectPage from '../ProjectPage';
import { AuthContext } from '../../context/AuthContext';
import { ProjectContext } from '../../context/ProjectContext';

jest.mock('../../components/LoadingSpinner', () => () => null);
jest.mock('../../components/TaskListView', () => () => <div data-testid="task-list" />);
jest.mock('../../components/GanttView', () => () => null);
jest.mock('../../components/ProjectOverview', () => () => null);
jest.mock('../../components/CreateTaskModal', () => () => null);
jest.mock('../../components/ProjectSettingsModal', () => () => null);
jest.mock('../../components/ShareProjectModal', () => () => null);
jest.mock('../../components/GmailPickerModal', () => () => null);
jest.mock('../../components/ImportTasksModal', () => () => null);
jest.mock('../../components/CreateProjectModal', () => (props) => (
  <div data-testid="create-subproject" data-parent={String(props.parentProjectId)} />
));

function renderPage(project) {
  const projectCtx = {
    currentProject: project,
    loadProject: jest.fn(),
    loadTasks: jest.fn(),
    loading: false,
  };
  render(
    <AuthContext.Provider value={{ setCurrentView: jest.fn() }}>
      <ProjectContext.Provider value={projectCtx}>
        <ProjectPage projectId={project.id} onBack={jest.fn()} />
      </ProjectContext.Provider>
    </AuthContext.Provider>
  );
}

describe('ProjectPage sub-project button (item 4)', () => {
  test('shows the Add Sub-Project button below the depth cap', () => {
    renderPage({ id: 7, name: 'Top project', depth: 0 });
    expect(screen.getByTitle('Add Sub-Project')).toBeInTheDocument();
  });

  test('opens CreateProjectModal parented to the current project', async () => {
    renderPage({ id: 7, name: 'Top project', depth: 0 });

    await userEvent.click(screen.getByTitle('Add Sub-Project'));

    expect(screen.getByTestId('create-subproject')).toHaveAttribute('data-parent', '7');
  });

  test('hides the Add Sub-Project button at the 3-level depth cap', () => {
    renderPage({ id: 9, name: 'Deep project', depth: 2 });
    expect(screen.queryByTitle('Add Sub-Project')).not.toBeInTheDocument();
  });
});
