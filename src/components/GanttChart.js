import React, { useEffect, useRef, useState, useCallback } from 'react';
import Gantt from 'frappe-gantt';
import { format, parseISO, addDays } from 'date-fns';

/**
 * GanttChart Component
 *
 * A modular Gantt chart component for visualizing tasks and dependencies
 * Uses frappe-gantt library for rendering
 *
 * @param {Array} tasks - Array of task objects
 * @param {Array} dependencies - Array of dependency objects
 * @param {Function} onTaskUpdate - Callback when task dates are updated via drag
 * @param {Function} onTaskClick - Callback when a task is clicked
 * @param {String} viewMode - View mode: 'Day', 'Week', 'Month', 'Year'
 */
export default function GanttChart({
  tasks = [],
  dependencies = [],
  onTaskUpdate,
  onTaskClick,
  viewMode = 'Week'
}) {
  const ganttContainer = useRef(null);
  const ganttInstance = useRef(null);
  const [currentViewMode, setCurrentViewMode] = useState(viewMode);

  // Calculate progress based on subtasks or status
  const calculateProgress = (task) => {
    if (task.subtask_count > 0) {
      // For parent tasks, calculate based on subtasks
      const subtasks = tasks.filter(t => t.parent_task_id === task.id);
      if (subtasks.length === 0) return 0;

      const completedSubtasks = subtasks.filter(t => t.status === 'done').length;
      return Math.round((completedSubtasks / subtasks.length) * 100);
    } else {
      // For regular tasks, use status
      switch (task.status) {
        case 'done': return 100;
        case 'review': return 75;
        case 'in_progress': return 50;
        case 'todo': return 0;
        default: return 0;
      }
    }
  };

  // Get assignee names
  const getAssigneeNames = (task) => {
    if (!task.assignees || task.assignees.length === 0) return 'Unassigned';
    return task.assignees
      .map(a => a.contact_name || a.user_name || 'Unknown')
      .join(', ');
  };

  // Calculate critical path using CPM (Critical Path Method)
  const calculateCriticalPath = useCallback(() => {
    if (tasks.length === 0) return new Set();

    // Build task map for quick lookup
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    // Calculate duration for each task (in days)
    const durations = new Map();
    tasks.forEach(task => {
      if (task.start_date && task.end_date) {
        const start = parseISO(task.start_date);
        const end = parseISO(task.end_date);
        const duration = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
        durations.set(task.id, duration);
      } else {
        durations.set(task.id, 1);
      }
    });

    // Build dependency graph
    const dependents = new Map(); // taskId -> tasks that depend on it
    const prerequisites = new Map(); // taskId -> tasks it depends on

    tasks.forEach(task => {
      dependents.set(task.id, []);
      prerequisites.set(task.id, []);
    });

    dependencies.forEach(dep => {
      if (dependents.has(dep.depends_on_task_id)) {
        dependents.get(dep.depends_on_task_id).push(dep.dependent_task_id);
      }
      if (prerequisites.has(dep.dependent_task_id)) {
        prerequisites.get(dep.dependent_task_id).push(dep.depends_on_task_id);
      }
    });

    // Calculate earliest start/finish times (forward pass)
    const earliestStart = new Map();
    const earliestFinish = new Map();

    const calculateEarliest = (taskId, visited = new Set()) => {
      if (visited.has(taskId)) return earliestFinish.get(taskId) || 0;
      if (earliestFinish.has(taskId)) return earliestFinish.get(taskId);

      visited.add(taskId);
      const prereqs = prerequisites.get(taskId) || [];

      let maxPrereqFinish = 0;
      for (const prereqId of prereqs) {
        const prereqFinish = calculateEarliest(prereqId, visited);
        maxPrereqFinish = Math.max(maxPrereqFinish, prereqFinish);
      }

      earliestStart.set(taskId, maxPrereqFinish);
      const finish = maxPrereqFinish + (durations.get(taskId) || 1);
      earliestFinish.set(taskId, finish);

      return finish;
    };

    tasks.forEach(task => calculateEarliest(task.id));

    // Calculate latest start/finish times (backward pass)
    const projectEnd = Math.max(...Array.from(earliestFinish.values()));
    const latestFinish = new Map();
    const latestStart = new Map();

    const calculateLatest = (taskId, visited = new Set()) => {
      if (visited.has(taskId)) return latestStart.get(taskId) || 0;
      if (latestStart.has(taskId)) return latestStart.get(taskId);

      visited.add(taskId);
      const deps = dependents.get(taskId) || [];

      let minDepStart = projectEnd;
      if (deps.length === 0) {
        minDepStart = projectEnd;
      } else {
        for (const depId of deps) {
          const depStart = calculateLatest(depId, visited);
          minDepStart = Math.min(minDepStart, depStart);
        }
      }

      latestFinish.set(taskId, minDepStart);
      const start = minDepStart - (durations.get(taskId) || 1);
      latestStart.set(taskId, start);

      return start;
    };

    tasks.forEach(task => calculateLatest(task.id));

    // Find critical tasks (where earliestStart === latestStart)
    const criticalTasks = new Set();
    tasks.forEach(task => {
      const es = earliestStart.get(task.id) || 0;
      const ls = latestStart.get(task.id) || 0;
      const slack = ls - es;

      if (slack === 0) {
        criticalTasks.add(task.id);
      }
    });

    return criticalTasks;
  }, [tasks, dependencies]);

  // Transform tasks to Gantt format
  const transformTasksForGantt = useCallback(() => {
    const criticalPath = calculateCriticalPath();

    return tasks.map(task => {
      // Ensure tasks have valid dates
      const start = task.start_date ? parseISO(task.start_date) : new Date();
      const end = task.end_date ? parseISO(task.end_date) : addDays(start, 1);

      // Build dependencies array for this task
      const taskDeps = dependencies
        .filter(dep => dep.dependent_task_id === task.id)
        .map(dep => `task_${dep.depends_on_task_id}`);

      const classes = ['priority-' + task.priority, 'status-' + task.status];
      if (task.parent_task_id) {
        classes.push('subtask');
      }

      // Add critical path indicator
      const isCritical = criticalPath.has(task.id);
      if (isCritical) {
        classes.push('critical-path');
      }

      const progress = calculateProgress(task);
      const assignees = getAssigneeNames(task);

      return {
        id: `task_${task.id}`,
        name: task.title,
        start: format(start, 'yyyy-MM-dd'),
        end: format(end, 'yyyy-MM-dd'),
        progress: progress,
        dependencies: taskDeps.join(', '),
        custom_class: classes.join(' '),
        // Store original task data for callbacks
        _task: task,
        _assignees: assignees,
        _isCritical: isCritical
      };
    });
  }, [tasks, dependencies, calculateCriticalPath]);

  // Initialize or update Gantt chart
  useEffect(() => {
    if (!ganttContainer.current || tasks.length === 0) return;

    const ganttTasks = transformTasksForGantt();

    if (ganttInstance.current) {
      // Update existing instance
      ganttInstance.current.refresh(ganttTasks);
    } else {
      // Create new instance
      ganttInstance.current = new Gantt(ganttContainer.current, ganttTasks, {
        view_mode: currentViewMode,
        language: 'en',
        bar_height: 30,
        bar_corner_radius: 3,
        arrow_curve: 5,
        padding: 18,
        date_format: 'YYYY-MM-DD',
        custom_popup_html: function(task) {
          const originalTask = task._task;
          return `
            <div class="gantt-popup">
              <div class="gantt-popup-title">
                ${task.name}
                ${task._isCritical ? '<span class="critical-badge">Critical Path</span>' : ''}
              </div>
              <div class="gantt-popup-content">
                <p><strong>Status:</strong> <span class="status-badge status-${originalTask.status}">${originalTask.status.replace('_', ' ')}</span></p>
                <p><strong>Priority:</strong> <span class="priority-badge priority-${originalTask.priority}">${originalTask.priority}</span></p>
                <p><strong>Progress:</strong> ${task.progress}%</p>
                <p><strong>Assigned to:</strong> ${task._assignees}</p>
                <p><strong>Start:</strong> ${format(parseISO(task.start), 'MMM dd, yyyy')}</p>
                <p><strong>End:</strong> ${format(parseISO(task.end), 'MMM dd, yyyy')}</p>
                ${originalTask.parent_task_title ? `<p><strong>Parent:</strong> ${originalTask.parent_task_title}</p>` : ''}
                ${originalTask.subtask_count > 0 ? `<p><strong>Sub-tasks:</strong> ${originalTask.subtask_count}</p>` : ''}
                ${originalTask.attachment_count > 0 ? `<p><strong>Attachments:</strong> ${originalTask.attachment_count}</p>` : ''}
              </div>
            </div>
          `;
        },
        on_click: function(task) {
          if (onTaskClick) {
            onTaskClick(task._task);
          }
        },
        on_date_change: function(task, start, end) {
          if (onTaskUpdate) {
            onTaskUpdate(task._task.id, {
              start_date: format(start, 'yyyy-MM-dd'),
              end_date: format(end, 'yyyy-MM-dd')
            });
          }
        }
      });
    }

    // Cleanup
    return () => {
      if (ganttInstance.current) {
        ganttInstance.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, dependencies, currentViewMode]);

  // Change view mode
  const changeViewMode = (mode) => {
    setCurrentViewMode(mode);
    if (ganttInstance.current) {
      ganttInstance.current.change_view_mode(mode);
    }
  };

  return (
    <div className="gantt-chart-container">
      {/* View Mode Selector */}
      <div className="gantt-controls mb-4 flex gap-2">
        {['Day', 'Week', 'Month', 'Year'].map(mode => (
          <button
            key={mode}
            onClick={() => changeViewMode(mode)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentViewMode === mode
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* Gantt Chart Container */}
      {tasks.length > 0 ? (
        <div
          ref={ganttContainer}
          className="gantt-chart bg-white rounded-lg shadow-sm border border-gray-200 p-4"
        />
      ) : (
        <div className="text-center py-12 text-gray-500">
          <p>No tasks with dates to display in Gantt chart</p>
          <p className="text-sm mt-2">Add start and end dates to tasks to see them here</p>
        </div>
      )}

      {/* Custom Styles */}
      <style jsx>{`
        .gantt-chart-container {
          width: 100%;
        }

        .gantt-chart {
          overflow-x: auto;
        }

        /* Task bar colors by priority */
        :global(.bar.priority-low) {
          fill: #9ca3af !important;
        }

        :global(.bar.priority-medium) {
          fill: #3b82f6 !important;
        }

        :global(.bar.priority-high) {
          fill: #f59e0b !important;
        }

        :global(.bar.priority-urgent) {
          fill: #ef4444 !important;
        }

        /* Subtask styling */
        :global(.bar.subtask) {
          opacity: 0.7;
          height: 20px !important;
        }

        /* Status styling */
        :global(.bar.status-done) {
          fill: #10b981 !important;
        }

        /* Critical path styling */
        :global(.bar.critical-path) {
          stroke: #dc2626 !important;
          stroke-width: 3px !important;
          filter: drop-shadow(0 2px 4px rgba(220, 38, 38, 0.4));
        }

        /* Gantt popup styling */
        :global(.gantt-popup) {
          padding: 12px;
          min-width: 250px;
        }

        :global(.gantt-popup-title) {
          font-weight: 600;
          font-size: 14px;
          margin-bottom: 8px;
          color: #1f2937;
        }

        :global(.gantt-popup-content) {
          font-size: 12px;
          color: #6b7280;
        }

        :global(.gantt-popup-content p) {
          margin: 4px 0;
        }

        :global(.gantt-popup-content strong) {
          color: #374151;
        }

        /* Status and Priority badges in popup */
        :global(.status-badge), :global(.priority-badge) {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          text-transform: capitalize;
        }

        :global(.status-todo) {
          background: #f3f4f6;
          color: #6b7280;
        }

        :global(.status-in_progress) {
          background: #dbeafe;
          color: #1e40af;
        }

        :global(.status-review) {
          background: #fef3c7;
          color: #92400e;
        }

        :global(.status-done) {
          background: #d1fae5;
          color: #065f46;
        }

        :global(.priority-low) {
          background: #f3f4f6;
          color: #6b7280;
        }

        :global(.priority-medium) {
          background: #dbeafe;
          color: #1e40af;
        }

        :global(.priority-high) {
          background: #fed7aa;
          color: #92400e;
        }

        :global(.priority-urgent) {
          background: #fecaca;
          color: #991b1b;
        }

        :global(.critical-badge) {
          display: inline-block;
          margin-left: 8px;
          padding: 2px 6px;
          background: #dc2626;
          color: white;
          border-radius: 3px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
        }
      `}</style>
    </div>
  );
}
