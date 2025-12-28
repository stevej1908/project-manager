import React, { useContext, useState, useEffect } from 'react';
import { ProjectContext } from '../context/ProjectContext';
import { Plus, ChevronDown, ChevronRight, X as CloseIcon, Link as LinkIcon } from 'lucide-react';
import CreateTaskModal from './CreateTaskModal';
import TaskDetailsModal from './TaskDetailsModal';
import { format } from 'date-fns';
import { dependenciesAPI } from '../services/api';

const STATUS_COLUMNS = [
  { id: 'todo', title: 'To Do' },
  { id: 'in_progress', title: 'In Progress' },
  { id: 'review', title: 'Review' },
  { id: 'done', title: 'Done' }
];

export default function TaskListView({ projectId }) {
  const { tasks, updateTask, loadProject } = useContext(ProjectContext);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalParentId, setCreateModalParentId] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [expandedTasks, setExpandedTasks] = useState(new Set());
  const [taskDependencies, setTaskDependencies] = useState({});

  // Load dependencies for all tasks
  useEffect(() => {
    if (projectId) {
      loadDependencies();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const loadDependencies = async () => {
    try {
      const response = await dependenciesAPI.getAll(projectId);
      const deps = response.dependencies || [];

      // Create a map of taskId -> dependency count
      const depMap = {};
      deps.forEach(dep => {
        depMap[dep.dependent_task_id] = (depMap[dep.dependent_task_id] || 0) + 1;
        depMap[dep.depends_on_task_id] = (depMap[dep.depends_on_task_id] || 0) + 1;
      });

      setTaskDependencies(depMap);
    } catch (error) {
      console.error('Error loading dependencies:', error);
    }
  };

  // Get only parent tasks (top-level)
  const getParentTasks = () => {
    return tasks
      .filter((task) => !task.parent_task_id)
      .sort((a, b) => a.position - b.position);
  };

  // Get sub-tasks for a specific parent task
  const getSubTasks = (parentId) => {
    return tasks
      .filter((task) => task.parent_task_id === parentId)
      .sort((a, b) => a.position - b.position);
  };

  const toggleTaskExpansion = (taskId) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const handleCreateTask = (parentId = null) => {
    setCreateModalParentId(parentId);
    setShowCreateModal(true);
  };

  const handleTaskClick = (task) => {
    setSelectedTaskId(task.id);
  };

  const handleTaskUpdate = () => {
    loadProject(projectId);
  };

  const handleStatusChange = async (taskId, newStatus, hasSubTasks) => {
    if (hasSubTasks) {
      alert('Cannot manually change status of tasks with sub-tasks. Status is derived from sub-task statuses.');
      return;
    }

    try {
      await updateTask(taskId, { status: newStatus });
    } catch (error) {
      console.error('Error updating task status:', error);
      alert(error.response?.data?.message || 'Failed to update task status');
    }
  };

  // Format assignee names for tooltip
  const getAssigneeText = (assignees) => {
    if (!assignees || assignees.length === 0) return 'Unassigned';
    return assignees.map(a => a.contact_name || a.user_name || 'Unknown').join(', ');
  };

  // Render a single task row
  const renderTaskRow = (task, depth = 0) => {
    const subTasks = getSubTasks(task.id);
    const hasSubTasks = subTasks.length > 0;
    const isExpanded = expandedTasks.has(task.id);

    return (
      <React.Fragment key={task.id}>
        <tr className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
          {/* Task Name Column */}
          <td
            className="py-3 px-4 cursor-pointer"
            style={{ paddingLeft: `${depth * 24 + 16}px` }}
            onDoubleClick={() => handleTaskClick(task)}
            title={`Assigned to: ${getAssigneeText(task.assignees)}\nDue: ${task.end_date ? format(new Date(task.end_date), 'MMM d, yyyy') : 'No due date'}`}
          >
            <div className="flex items-center gap-2">
              {/* Expand/Collapse button */}
              {hasSubTasks && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTaskExpansion(task.id);
                  }}
                  className="p-0.5 hover:bg-gray-200 rounded transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-600" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  )}
                </button>
              )}

              <span className="text-sm text-gray-900 font-medium">
                {task.title}
              </span>

              {/* Dependency indicator */}
              {taskDependencies[task.id] > 0 && (
                <span className="text-primary-600" title={`${taskDependencies[task.id]} dependencies`}>
                  <LinkIcon className="w-3.5 h-3.5" />
                </span>
              )}

              {hasSubTasks && (
                <span className="text-xs text-gray-500">
                  ({task.subtask_count})
                </span>
              )}

              {/* Add Sub-task button (only for parent tasks) */}
              {depth === 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCreateTask(task.id);
                  }}
                  className="ml-2 p-1 text-primary-600 hover:bg-primary-50 rounded transition-colors"
                  title="Add sub-task"
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
            </div>
          </td>

          {/* Status Columns */}
          {STATUS_COLUMNS.map((column) => (
            <td key={column.id} className="py-3 px-4 text-center">
              <button
                onClick={() => handleStatusChange(task.id, column.id, hasSubTasks)}
                className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
                  task.status === column.id
                    ? 'bg-primary-600 text-white'
                    : 'hover:bg-gray-200 text-transparent hover:text-gray-400'
                }`}
                disabled={hasSubTasks}
                title={hasSubTasks ? 'Status controlled by sub-tasks' : `Set to ${column.title}`}
              >
                {task.status === column.id ? <CloseIcon className="w-4 h-4" /> : 'o'}
              </button>
            </td>
          ))}
        </tr>

        {/* Render sub-tasks if expanded */}
        {isExpanded && hasSubTasks && (
          <>
            {subTasks.map((subTask) => renderTaskRow(subTask, depth + 1))}
          </>
        )}
      </React.Fragment>
    );
  };

  const parentTasks = getParentTasks();

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Header with Add Task button */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Tasks</h3>
          <button
            onClick={() => handleCreateTask(null)}
            className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-900">
                  Task Name
                </th>
                {STATUS_COLUMNS.map((column) => (
                  <th key={column.id} className="py-3 px-4 text-center text-sm font-semibold text-gray-900 w-32">
                    {column.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parentTasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500">
                    No tasks yet. Click "Add Task" to create one.
                  </td>
                </tr>
              ) : (
                parentTasks.map((task) => renderTaskRow(task))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <CreateTaskModal
          projectId={projectId}
          initialStatus="todo"
          parentTaskId={createModalParentId}
          onClose={() => {
            setShowCreateModal(false);
            setCreateModalParentId(null);
          }}
        />
      )}

      {selectedTaskId && (
        <TaskDetailsModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={handleTaskUpdate}
        />
      )}
    </>
  );
}
