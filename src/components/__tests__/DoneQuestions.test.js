/**
 * Task 051 (WES CRM handoff): the questions asked after a task is marked done.
 *  - Waiting tasks that just got a date: one click keeps them; closing keeps them too.
 *  - "Is anything still pending?": Add follow-on (date required, filled in 7 days out) or
 *    Nothing pending; closing counts as Nothing pending.
 * Also: a new task starts with a due date 7 days out.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DoneQuestions from '../DoneQuestions';
import CreateTaskModal from '../CreateTaskModal';
import { ProjectContext } from '../../context/ProjectContext';
import { tasksAPI } from '../../services/api';
import { daysFromToday } from '../../utils/taskDates';

jest.mock('../../services/api', () => ({
  tasksAPI: { update: jest.fn(), create: jest.fn(), addComment: jest.fn() },
}));
jest.mock('../ContactsPickerModal', () => () => null);

const done = { id: 10, title: 'Call the clinic', project_id: 3, priority: 'high', privacy: 'business' };

beforeEach(() => {
  jest.clearAllMocks();
  tasksAPI.update.mockResolvedValue({ task: {} });
  tasksAPI.create.mockResolvedValue({ task: { id: 11, title: 'Follow-on: Call the clinic' } });
  tasksAPI.addComment.mockResolvedValue({});
});

test('nothing waiting: asks only whether anything is pending; Nothing pending ends it', async () => {
  const onFinished = jest.fn();
  render(<DoneQuestions ask={{ task: done, datedWaiting: [] }} onFinished={onFinished} />);
  expect(screen.getByText('Is anything still pending?')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Nothing pending' }));
  expect(onFinished).toHaveBeenCalledWith(false);
  expect(tasksAPI.create).not.toHaveBeenCalled();
});

test('closing the question counts as Nothing pending', async () => {
  const onFinished = jest.fn();
  render(<DoneQuestions ask={{ task: done, datedWaiting: [] }} onFinished={onFinished} />);
  await userEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(onFinished).toHaveBeenCalledWith(false);
});

test('Add follow-on: same project, title prefilled, due 7 days out; the done task gets a note naming it', async () => {
  const onFinished = jest.fn();
  render(<DoneQuestions ask={{ task: done, datedWaiting: [] }} onFinished={onFinished} />);
  await userEvent.click(screen.getByRole('button', { name: 'Add follow-on' }));
  expect(screen.getByDisplayValue('Follow-on: Call the clinic')).toBeInTheDocument();
  expect(screen.getByDisplayValue(daysFromToday())).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Save follow-on' }));
  await waitFor(() => expect(onFinished).toHaveBeenCalledWith(true));
  expect(tasksAPI.create).toHaveBeenCalledWith(expect.objectContaining({
    project_id: 3, title: 'Follow-on: Call the clinic', end_date: daysFromToday(), status: 'todo', privacy: 'business',
  }));
  expect(tasksAPI.addComment).toHaveBeenCalledWith(10, expect.stringMatching(/^Follow-on: Call the clinic, due /));
});

test('waiting tasks that got a date: shown first; one click keeps them, then the pending question', async () => {
  const onFinished = jest.fn();
  render(<DoneQuestions ask={{ task: done, datedWaiting: [{ id: 20, title: 'Send the pitch', end_date: '2026-12-01' }] }} onFinished={onFinished} />);
  expect(screen.getByText('Tasks that were waiting on this one')).toBeInTheDocument();
  expect(screen.getByLabelText('Due date for Send the pitch')).toHaveValue('2026-12-01');
  await userEvent.click(screen.getByRole('button', { name: 'Keep these dates' }));
  expect(tasksAPI.update).not.toHaveBeenCalled();   // unchanged: already saved
  expect(await screen.findByText('Is anything still pending?')).toBeInTheDocument();
});

test('a changed date is saved', async () => {
  render(<DoneQuestions ask={{ task: done, datedWaiting: [{ id: 20, title: 'Send the pitch', end_date: '2026-12-01' }] }} onFinished={jest.fn()} />);
  const box = screen.getByLabelText('Due date for Send the pitch');
  await userEvent.clear(box);
  await userEvent.type(box, '2026-12-04');
  await userEvent.click(screen.getByRole('button', { name: 'Keep these dates' }));
  await waitFor(() => expect(tasksAPI.update).toHaveBeenCalledWith(20, { end_date: '2026-12-04' }));
});

test('a new task starts with a due date 7 days out', () => {
  render(
    <ProjectContext.Provider value={{ createTask: jest.fn(), loadTasks: jest.fn() }}>
      <CreateTaskModal projectId={1} onClose={jest.fn()} />
    </ProjectContext.Provider>
  );
  expect(screen.getByDisplayValue(daysFromToday())).toBeInTheDocument();
});
