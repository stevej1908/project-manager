/**
 * Item 5 of the task-hierarchy design: CreateTaskModal must offer a Status
 * selector so creating a task has parity with editing one (which always had
 * status). These tests pin that the selector exists, defaults correctly, and
 * that the chosen status reaches the create payload.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateTaskModal from '../CreateTaskModal';
import { ProjectContext } from '../../context/ProjectContext';

// ContactsPickerModal only renders when its picker is opened; stub it so this
// test never depends on its internals.
jest.mock('../ContactsPickerModal', () => () => null);

function renderModal(props = {}) {
  const createTask = jest.fn().mockResolvedValue({});
  const loadTasks = jest.fn().mockResolvedValue();
  const onClose = jest.fn();
  render(
    <ProjectContext.Provider value={{ createTask, loadTasks }}>
      <CreateTaskModal projectId={1} onClose={onClose} {...props} />
    </ProjectContext.Provider>
  );
  return { createTask, loadTasks, onClose };
}

describe('CreateTaskModal status field (item 5)', () => {
  test('renders a Status selector with all four statuses', () => {
    renderModal();
    const select = screen.getByRole('combobox');
    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).toEqual(['todo', 'in_progress', 'review', 'done']);
  });

  test('defaults the status to todo', () => {
    renderModal();
    expect(screen.getByRole('combobox')).toHaveValue('todo');
  });

  test('honours the initialStatus prop', () => {
    renderModal({ initialStatus: 'in_progress' });
    expect(screen.getByRole('combobox')).toHaveValue('in_progress');
  });

  test('sends the chosen status in the create payload', async () => {
    const { createTask } = renderModal();

    await userEvent.type(screen.getByPlaceholderText(/enter task title/i), 'A task');
    await userEvent.selectOptions(screen.getByRole('combobox'), 'review');
    await userEvent.click(screen.getByRole('button', { name: /create task/i }));
    // Task 042: saving first asks "Should this record be private?"
    await userEvent.click(screen.getByRole('button', { name: /business - others can see/i }));

    await waitFor(() => expect(createTask).toHaveBeenCalledTimes(1));
    expect(createTask).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'review', title: 'A task', privacy: 'business' })
    );
  });
});

describe('CreateTaskModal privacy question (task 042)', () => {
  test('saving asks the question first; nothing is created until it is answered', async () => {
    const { createTask } = renderModal();
    await userEvent.type(screen.getByPlaceholderText(/enter task title/i), 'Doctor visit');
    await userEvent.click(screen.getByRole('button', { name: /create task/i }));
    expect(screen.getByText('Should this record be private?')).toBeInTheDocument();
    expect(createTask).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /private - only me/i }));
    await waitFor(() => expect(createTask).toHaveBeenCalledWith(expect.objectContaining({ title: 'Doctor visit', privacy: 'private' })));
  });
  test('Back returns to the form without saving', async () => {
    const { createTask } = renderModal();
    await userEvent.type(screen.getByPlaceholderText(/enter task title/i), 'Something');
    await userEvent.click(screen.getByRole('button', { name: /create task/i }));
    await userEvent.click(screen.getByRole('button', { name: /^back$/i }));
    expect(screen.getByRole('button', { name: /create task/i })).toBeInTheDocument();
    expect(createTask).not.toHaveBeenCalled();
  });
});
