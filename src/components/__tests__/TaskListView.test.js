/**
 * Unit Tests for TaskListView Component
 *
 * Tests the task list board view component
 * Run with: npm test
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskListView from '../TaskListView';
import { ProjectContext } from '../../context/ProjectContext';

// Mock the API
jest.mock('../../services/api', () => ({
  tasksAPI: {
    getAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  dependenciesAPI: {
    getAll: jest.fn()
  }
}));

// Mock ProjectContext
const mockProjectContext = {
  currentProject: {
    id: 1,
    name: 'Test Project',
    description: 'Test description'
  },
  refreshProject: jest.fn()
};

describe('TaskListView Component', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  test('renders status columns', () => {
    render(
      <ProjectContext.Provider value={mockProjectContext}>
        <TaskListView projectId={1} />
      </ProjectContext.Provider>
    );

    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  test('displays loading state initially', () => {
    render(
      <ProjectContext.Provider value={mockProjectContext}>
        <TaskListView projectId={1} />
      </ProjectContext.Provider>
    );

    // Check for loading spinner or skeleton
    expect(screen.getByTestId('loading-spinner') || screen.getByText(/loading/i)).toBeInTheDocument();
  });

  // Add more tests as needed
  test('renders empty state when no tasks', async () => {
    const { tasksAPI } = require('../../services/api');
    tasksAPI.getAll.mockResolvedValue({ tasks: [] });

    render(
      <ProjectContext.Provider value={mockProjectContext}>
        <TaskListView projectId={1} />
      </ProjectContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText(/no tasks yet/i) || screen.getByText(/get started/i)).toBeInTheDocument();
    });
  });
});
