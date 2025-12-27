import React, { useEffect, useRef, useState, useCallback } from 'react';
import Gantt from 'frappe-gantt';
import { format, parseISO, addDays } from 'date-fns';
import '../styles/frappe-gantt.css';

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
  const isInitialized = useRef(false);
  const taskNamesRef = useRef(null);
  const ganttScrollRef = useRef(null);
  const [currentViewMode, setCurrentViewMode] = useState(viewMode);

  // Calculate progress based on subtasks or status
  const calculateProgress = useCallback((task) => {
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
  }, [tasks]);

  // Get assignee names
  const getAssigneeNames = useCallback((task) => {
    if (!task.assignees || task.assignees.length === 0) return 'Unassigned';
    return task.assignees
      .map(a => a.contact_name || a.user_name || 'Unknown')
      .join(', ');
  }, []);

  // Calculate critical path using CPM (Critical Path Method)
  const calculateCriticalPath = useCallback(() => {
    if (tasks.length === 0) return new Set();

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

  // Sort tasks hierarchically (parents followed by their children)
  const sortTasksHierarchically = useCallback((tasksToSort) => {
    const sorted = [];
    const processed = new Set();

    const addTaskAndChildren = (task) => {
      if (processed.has(task.id)) return;

      sorted.push(task);
      processed.add(task.id);

      // Find and add immediate children
      const children = tasksToSort
        .filter(t => t.parent_task_id === task.id)
        .sort((a, b) => (a.position || 0) - (b.position || 0));

      children.forEach(child => addTaskAndChildren(child));
    };

    // First add all root tasks (no parent)
    const rootTasks = tasksToSort
      .filter(t => !t.parent_task_id)
      .sort((a, b) => (a.position || 0) - (b.position || 0));

    rootTasks.forEach(task => addTaskAndChildren(task));

    // Add any remaining tasks that weren't processed (orphans)
    tasksToSort.forEach(task => {
      if (!processed.has(task.id)) {
        sorted.push(task);
      }
    });

    return sorted;
  }, []);

  // Add date labels to Gantt bars
  const addDateLabelsToBars = useCallback((ganttTasks) => {
    if (!ganttContainer.current) return;

    // Find all bar groups in the SVG
    const barGroups = ganttContainer.current.querySelectorAll('.bar-wrapper');

    barGroups.forEach((barGroup, index) => {
      const task = ganttTasks[index];
      if (!task) return;

      // Find the bar rect element
      const barRect = barGroup.querySelector('.bar');
      if (!barRect) return;

      // Get bar dimensions and position
      const barX = parseFloat(barRect.getAttribute('x'));
      const barY = parseFloat(barRect.getAttribute('y'));
      const barWidth = parseFloat(barRect.getAttribute('width'));
      const barHeight = parseFloat(barRect.getAttribute('height'));

      // Format dates
      const startDate = format(parseISO(task.start), 'MMM d');
      const endDate = format(parseISO(task.end), 'MMM d');

      // Remove existing date labels if any
      const existingLabels = barGroup.querySelectorAll('.date-label');
      existingLabels.forEach(label => label.remove());

      // Create SVG text elements for dates
      const svg = barGroup.closest('svg');
      const svgNS = svg.namespaceURI;

      // Only add dates if bar is wide enough (at least 80px)
      if (barWidth >= 80) {
        // Start date label (left side)
        const startText = document.createElementNS(svgNS, 'text');
        startText.setAttribute('class', 'date-label');
        startText.setAttribute('x', barX + 5);
        startText.setAttribute('y', barY + barHeight / 2);
        startText.setAttribute('font-size', '10px');
        startText.setAttribute('fill', '#666');
        startText.setAttribute('dominant-baseline', 'central');
        startText.textContent = startDate;

        // End date label (right side)
        const endText = document.createElementNS(svgNS, 'text');
        endText.setAttribute('class', 'date-label');
        endText.setAttribute('x', barX + barWidth - 5);
        endText.setAttribute('y', barY + barHeight / 2);
        endText.setAttribute('font-size', '10px');
        endText.setAttribute('fill', '#666');
        endText.setAttribute('text-anchor', 'end');
        endText.setAttribute('dominant-baseline', 'central');
        endText.textContent = endDate;

        barGroup.appendChild(startText);
        barGroup.appendChild(endText);
      }
    });
  }, []);

  // Transform tasks to Gantt format
  const transformTasksForGantt = useCallback(() => {
    const criticalPath = calculateCriticalPath();
    const sortedTasks = sortTasksHierarchically(tasks);

    return sortedTasks.map(task => {
      // Ensure tasks have valid dates
      const start = task.start_date ? parseISO(task.start_date) : new Date();
      const end = task.end_date ? parseISO(task.end_date) : addDays(start, 1);

      // Build dependencies array for this task
      const taskDeps = dependencies
        .filter(dep => dep.dependent_task_id === task.id)
        .map(dep => `task_${dep.depends_on_task_id}`);

      // Build a single compound class name (no spaces) for frappe-gantt
      // frappe-gantt's classList.add() doesn't handle space-separated classes
      const isCritical = criticalPath.has(task.id);
      let customClass = `priority-${task.priority}`;

      // Add additional class modifiers as suffixes to create unique compound classes
      if (task.parent_task_id) {
        customClass += '-subtask';
      }
      if (isCritical) {
        customClass += '-critical';
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
        custom_class: customClass,
        // Store original task data for callbacks
        _task: task,
        _assignees: assignees,
        _isCritical: isCritical
      };
    });
  }, [tasks, dependencies, calculateCriticalPath, calculateProgress, getAssigneeNames, sortTasksHierarchically]);

  // Initialize or update Gantt chart
  useEffect(() => {
    if (!ganttContainer.current || tasks.length === 0) {
      return;
    }

    // Small delay to ensure container has dimensions
    const timeoutId = setTimeout(() => {
      const ganttTasks = transformTasksForGantt();

      if (ganttInstance.current && isInitialized.current) {
        // Update existing instance
        try {
          ganttInstance.current.refresh(ganttTasks);
          // Re-add date labels after refresh
          setTimeout(() => {
            addDateLabelsToBars(ganttTasks);
          }, 200);
        } catch (error) {
          console.error('Error refreshing Gantt:', error);
          // If refresh fails, destroy and recreate
          ganttInstance.current = null;
          isInitialized.current = false;
        }
      }

      if (!ganttInstance.current || !isInitialized.current) {
        // Create new instance
        try {
          // Ensure container has explicit dimensions
          if (!ganttContainer.current.style.width) {
            ganttContainer.current.style.width = '100%';
          }

        ganttInstance.current = new Gantt(ganttContainer.current, ganttTasks, {
        view_mode: currentViewMode,
        language: 'en',
        bar_height: 30,
        bar_corner_radius: 3,
        arrow_curve: 5,
        padding: 18,
        date_format: 'YYYY-MM-DD',
        scroll_to: 'today',
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

        isInitialized.current = true;

        // Add date labels to bars and calculate exact row heights
        setTimeout(() => {
          addDateLabelsToBars(ganttTasks);

          // Calculate actual Gantt row height for perfect alignment
          if (ganttContainer.current) {
            const bars = ganttContainer.current.querySelectorAll('.bar-wrapper');
            if (bars.length >= 2) {
              const firstBar = bars[0].querySelector('.bar');
              const secondBar = bars[1].querySelector('.bar');

              if (firstBar && secondBar) {
                const firstY = parseFloat(firstBar.getAttribute('y'));
                const secondY = parseFloat(secondBar.getAttribute('y'));
                const actualRowHeight = secondY - firstY;

                console.log('Frappe-Gantt actual row height:', actualRowHeight);
                console.log('Our task name row height: 48px');
                console.log('Difference:', Math.abs(actualRowHeight - 48));
              }
            }
          }
        }, 200);
      } catch (error) {
        console.error('Error creating Gantt instance:', error);
      }
      }
    }, 100); // 100ms delay to ensure container has dimensions

    // Cleanup - only clear timeout, don't destroy instance on every render
    return () => {
      clearTimeout(timeoutId);
      // Don't destroy ganttInstance here - it causes bars to disappear
      // Instance will be cleaned up on component unmount
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, dependencies]); // Removed currentViewMode - view changes handled by changeViewMode()

  // Synchronize scroll between task names and Gantt chart
  useEffect(() => {
    const taskNamesEl = taskNamesRef.current;
    const ganttScrollEl = ganttScrollRef.current;

    if (!taskNamesEl || !ganttScrollEl) return;

    const syncScroll = (source, target) => {
      return () => {
        target.scrollTop = source.scrollTop;
      };
    };

    const handleTaskNamesScroll = syncScroll(taskNamesEl, ganttScrollEl);
    const handleGanttScroll = syncScroll(ganttScrollEl, taskNamesEl);

    taskNamesEl.addEventListener('scroll', handleTaskNamesScroll);
    ganttScrollEl.addEventListener('scroll', handleGanttScroll);

    return () => {
      taskNamesEl?.removeEventListener('scroll', handleTaskNamesScroll);
      ganttScrollEl?.removeEventListener('scroll', handleGanttScroll);
    };
  }, [tasks]); // Re-attach when tasks change

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (ganttInstance.current) {
        ganttInstance.current = null;
      }
      isInitialized.current = false;
    };
  }, []); // Empty dependency array = only run on mount/unmount

  // Change view mode
  const changeViewMode = (mode) => {
    setCurrentViewMode(mode);
    if (ganttInstance.current) {
      ganttInstance.current.change_view_mode(mode);

      // Scroll to today's date after view mode change
      setTimeout(() => {
        if (ganttInstance.current) {
          // Frappe Gantt automatically centers on the scroll_to date
          // Ensure it's visible after view change
          ganttInstance.current.scroll_today();
        }

        // Re-add date labels after view mode change
        const ganttTasks = transformTasksForGantt();
        addDateLabelsToBars(ganttTasks);
      }, 200);
    }
  };

  // Scroll to today
  const scrollToToday = () => {
    if (ganttInstance.current) {
      ganttInstance.current.scroll_today();
    }
  };

  // Scroll left/right
  const scrollHorizontal = (direction) => {
    const ganttScrollEl = ganttScrollRef.current;
    console.log('Scroll button clicked!', direction);
    console.log('ganttScrollRef.current:', ganttScrollEl);

    if (ganttScrollEl) {
      const scrollAmount = 300; // pixels
      const currentScroll = ganttScrollEl.scrollLeft;
      console.log('Current scroll position:', currentScroll);
      console.log('Scroll width:', ganttScrollEl.scrollWidth);
      console.log('Client width:', ganttScrollEl.clientWidth);

      const newScroll = direction === 'left' ? currentScroll - scrollAmount : currentScroll + scrollAmount;
      console.log('New scroll position:', newScroll);

      ganttScrollEl.scrollTo({
        left: newScroll,
        behavior: 'smooth'
      });

      // Also try scrollLeft directly as a fallback
      setTimeout(() => {
        ganttScrollEl.scrollLeft = newScroll;
      }, 100);
    } else {
      console.log('ganttScrollRef.current is null!');
    }
  };

  return (
    <div className="gantt-chart-container">
      {/* View Mode Selector and Navigation */}
      <div className="gantt-controls mb-4 flex gap-4 items-center">
        <div className="flex gap-2">
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

        {/* Navigation Controls */}
        <div className="flex gap-2 items-center border-l border-gray-300 pl-4">
          <button
            onClick={() => scrollHorizontal('left')}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            title="Scroll left"
          >
            ← Earlier
          </button>
          <button
            onClick={scrollToToday}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            title="Center on today"
          >
            Today
          </button>
          <button
            onClick={() => scrollHorizontal('right')}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            title="Scroll right"
          >
            Later →
          </button>
        </div>
      </div>

      {/* Gantt Chart Container */}
      {tasks.length > 0 ? (
        <div className="gantt-wrapper bg-white rounded-lg shadow-sm border border-gray-200 flex" style={{ maxHeight: '70vh' }}>
          {/* Sticky Task Names Column */}
          <div
            ref={taskNamesRef}
            className="gantt-task-names sticky left-0 bg-white border-r border-gray-200 z-10 overflow-y-auto"
            style={{ minWidth: '250px', maxWidth: '250px', maxHeight: '70vh' }}
          >
            <div className="font-semibold text-sm text-gray-700 p-4 border-b border-gray-200 sticky top-0 bg-white z-20" style={{ height: '60px' }}>
              Task Name
            </div>
            <div className="task-names-list">
              {sortTasksHierarchically(tasks).map((task, index) => (
                <div
                  key={task.id}
                  className="task-name-item px-4 text-sm border-b border-gray-100 hover:bg-gray-50 cursor-pointer truncate"
                  style={{ height: '48px', display: 'flex', alignItems: 'center' }}
                  onClick={() => onTaskClick && onTaskClick(task)}
                  title={task.title}
                >
                  <span className={`${task.parent_task_id ? 'ml-4 text-gray-600' : 'font-medium text-gray-900'}`}>
                    {task.title}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Gantt Chart */}
          <div className="flex-1 relative">
            {/* Sticky Timeline Header Overlay */}
            <div className="sticky top-0 z-40 bg-white border-b border-gray-200" style={{ height: '60px' }}>
              <div className="text-sm font-semibold text-gray-700 px-4 py-4">
                Timeline
              </div>
            </div>

            {/* Scrollable Gantt Container */}
            <div
              ref={ganttScrollRef}
              className="overflow-auto gantt-scroll-wrapper"
              style={{ maxHeight: 'calc(70vh - 60px)', maxWidth: '100%', position: 'relative' }}
            >
              <div
                ref={ganttContainer}
                className="gantt-chart"
                style={{ height: 'auto', minWidth: '800px' }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <p>No tasks with dates to display in Gantt chart</p>
          <p className="text-sm mt-2">Add start and end dates to tasks to see them here</p>
        </div>
      )}

      {/* Custom Styles */}
      <style>{`
        .gantt-chart-container {
          width: 100%;
        }

        .gantt-wrapper {
          position: relative;
          overflow: hidden;
        }

        .gantt-task-names {
          overflow-y: auto;
          overflow-x: hidden;
          flex-shrink: 0;
        }

        .gantt-chart {
          position: relative;
          min-height: 400px;
        }

        /* Ensure SVG renders properly during scroll */
        .gantt svg {
          display: block;
          width: 100%;
          height: auto;
        }

        /* Fix for bars disappearing on scroll */
        .gantt .bar-wrapper {
          pointer-events: auto;
        }

        /* Ensure proper rendering and prevent black screen on scroll */
        .gantt-scroll-wrapper {
          -webkit-overflow-scrolling: touch;
          backface-visibility: hidden;
          transform: translateZ(0);
        }

        /* Smooth scrolling */
        .gantt-task-names,
        .gantt-scroll-container {
          scroll-behavior: smooth;
        }

        /* Gantt scroll wrapper configuration */
        .gantt-scroll-wrapper {
          position: relative;
        }

        /* The frappe-gantt .grid-header already has position:sticky in the library CSS */
        /* Just ensure it has proper z-index and background */
        .gantt-container .grid-header {
          z-index: 50 !important;
          background: white !important;
        }

        /* Make task names header match timeline header height and behavior */
        .gantt-task-names > div:first-child {
          position: sticky !important;
          top: 0 !important;
          z-index: 51 !important;
          background: white !important;
        }

        /* Task bar colors by priority - frappe-gantt applies custom_class to bar-wrapper */
        .bar-wrapper[class*="priority-low"] .bar {
          fill: #9ca3af !important;
        }

        .bar-wrapper[class*="priority-medium"] .bar {
          fill: #3b82f6 !important;
        }

        .bar-wrapper[class*="priority-high"] .bar {
          fill: #f59e0b !important;
        }

        .bar-wrapper[class*="priority-urgent"] .bar {
          fill: #ef4444 !important;
        }

        /* Subtask styling */
        .bar-wrapper[class*="-subtask"] .bar {
          opacity: 0.7;
          height: 20px !important;
        }

        /* Critical path styling */
        .bar-wrapper[class*="-critical"] .bar {
          stroke: #dc2626 !important;
          stroke-width: 3px !important;
          filter: drop-shadow(0 2px 4px rgba(220, 38, 38, 0.4));
        }

        /* Fallback: ensure all bars have visible color */
        .gantt .bar {
          fill: #3b82f6 !important;
          stroke: #1e40af !important;
          stroke-width: 1px !important;
        }

        /* Gantt popup styling */
        .gantt-popup {
          padding: 12px;
          min-width: 250px;
        }

        .gantt-popup-title {
          font-weight: 600;
          font-size: 14px;
          margin-bottom: 8px;
          color: #1f2937;
        }

        .gantt-popup-content {
          font-size: 12px;
          color: #6b7280;
        }

        .gantt-popup-content p {
          margin: 4px 0;
        }

        .gantt-popup-content strong {
          color: #374151;
        }

        /* Status and Priority badges in popup */
        .status-badge, .priority-badge {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          text-transform: capitalize;
        }

        .status-todo {
          background: #f3f4f6;
          color: #6b7280;
        }

        .status-in_progress {
          background: #dbeafe;
          color: #1e40af;
        }

        .status-review {
          background: #fef3c7;
          color: #92400e;
        }

        .status-done {
          background: #d1fae5;
          color: #065f46;
        }

        .priority-low {
          background: #f3f4f6;
          color: #6b7280;
        }

        .priority-medium {
          background: #dbeafe;
          color: #1e40af;
        }

        .priority-high {
          background: #fed7aa;
          color: #92400e;
        }

        .priority-urgent {
          background: #fecaca;
          color: #991b1b;
        }

        .critical-badge {
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
