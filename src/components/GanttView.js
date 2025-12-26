import React, { useEffect, useState } from 'react';
import { tasksAPI, dependenciesAPI } from '../services/api';
import GanttChart from './GanttChart';
import LoadingSpinner from './LoadingSpinner';
import TaskDetailsModal from './TaskDetailsModal';
import { AlertCircle, Filter, X } from 'lucide-react';

/**
 * GanttView Component
 *
 * Manages data fetching and state for the Gantt chart
 * Displays tasks and dependencies in a timeline view
 *
 * @param {String} projectId - ID of the project to display
 */
export default function GanttView({ projectId }) {
  const [tasks, setTasks] = useState([]);
  const [dependencies, setDependencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status: [],
    priority: [],
    assignee: '',
    showParentsOnly: false,
    showCriticalPathOnly: false
  });

  // Load tasks and dependencies
  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch tasks and dependencies in parallel
      const [tasksResponse, depsResponse] = await Promise.all([
        tasksAPI.getAll(projectId),
        dependenciesAPI.getAll(projectId)
      ]);

      const tasks = tasksResponse.tasks || [];
      const deps = depsResponse.dependencies || [];

      setTasks(tasks);
      setDependencies(deps);
    } catch (err) {
      console.error('Error loading Gantt data:', err);
      setError(err.message || 'Failed to load Gantt chart data');
    } finally {
      setLoading(false);
    }
  };

  // Handle task date updates from drag
  const handleTaskUpdate = async (taskId, updates) => {
    try {
      await tasksAPI.update(taskId, updates);

      // Update local state
      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === taskId
            ? { ...task, ...updates }
            : task
        )
      );
    } catch (err) {
      console.error('Error updating task:', err);
      // Show error to user (could add toast notification here)
      alert('Failed to update task dates');
      // Reload data to reset
      loadData();
    }
  };

  // Handle task click
  const handleTaskClick = (task) => {
    setSelectedTaskId(task.id);
  };

  // Handle task modal update
  const handleModalUpdate = async (updatedTask) => {
    // Instead of reloading all data, just update the specific task
    // This prevents the Gantt chart from being destroyed and recreated
    if (updatedTask) {
      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === updatedTask.id ? updatedTask : task
        )
      );
    } else {
      // If no specific task provided, reload all data
      loadData();
    }
  };

  // Toggle status filter
  const toggleStatusFilter = (status) => {
    setFilters(prev => ({
      ...prev,
      status: prev.status.includes(status)
        ? prev.status.filter(s => s !== status)
        : [...prev.status, status]
    }));
  };

  // Toggle priority filter
  const togglePriorityFilter = (priority) => {
    setFilters(prev => ({
      ...prev,
      priority: prev.priority.includes(priority)
        ? prev.priority.filter(p => p !== priority)
        : [...prev.priority, priority]
    }));
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      status: [],
      priority: [],
      assignee: '',
      showParentsOnly: false,
      showCriticalPathOnly: false
    });
  };

  // Apply filters to tasks
  const applyFilters = (tasksToFilter) => {
    let filtered = tasksToFilter;

    // Filter by status
    if (filters.status.length > 0) {
      filtered = filtered.filter(task => filters.status.includes(task.status));
    }

    // Filter by priority
    if (filters.priority.length > 0) {
      filtered = filtered.filter(task => filters.priority.includes(task.priority));
    }

    // Filter by assignee
    if (filters.assignee) {
      filtered = filtered.filter(task => {
        if (!task.assignees || task.assignees.length === 0) return false;
        return task.assignees.some(a =>
          (a.contact_name || '').toLowerCase().includes(filters.assignee.toLowerCase()) ||
          (a.contact_email || '').toLowerCase().includes(filters.assignee.toLowerCase())
        );
      });
    }

    // Show parents only
    if (filters.showParentsOnly) {
      filtered = filtered.filter(task => task.subtask_count > 0);
    }

    return filtered;
  };

  // Filter tasks that have dates for Gantt display
  const tasksWithDates = applyFilters(tasks.filter(task => task.start_date || task.end_date));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 font-medium">{error}</p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const hasActiveFilters = filters.status.length > 0 || filters.priority.length > 0 || filters.assignee || filters.showParentsOnly || filters.showCriticalPathOnly;

  return (
    <>
      <div className="gantt-view">
        {/* Filter Controls */}
        <div className="mb-4 flex gap-4 items-start">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              hasActiveFilters
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && <span className="bg-white text-primary-600 px-1.5 py-0.5 rounded text-xs font-bold">{
              filters.status.length + filters.priority.length + (filters.assignee ? 1 : 0) + (filters.showParentsOnly ? 1 : 0) + (filters.showCriticalPathOnly ? 1 : 0)
            }</span>}
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <X className="w-3 h-3" />
              Clear filters
            </button>
          )}

          <div className="flex-1" />

          <div className="text-sm text-gray-600">
            Showing {tasksWithDates.length} of {tasks.filter(t => t.start_date || t.end_date).length} tasks
            {dependencies.length > 0 && ` • ${dependencies.length} dependencies`}
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mb-4 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <div className="space-y-1">
                  {['todo', 'in_progress', 'review', 'done'].map(status => (
                    <label key={status} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.status.includes(status)}
                        onChange={() => toggleStatusFilter(status)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="ml-2 text-sm text-gray-700 capitalize">{status.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Priority Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                <div className="space-y-1">
                  {['low', 'medium', 'high', 'urgent'].map(priority => (
                    <label key={priority} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.priority.includes(priority)}
                        onChange={() => togglePriorityFilter(priority)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="ml-2 text-sm text-gray-700 capitalize">{priority}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Other Filters */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assignee</label>
                <input
                  type="text"
                  value={filters.assignee}
                  onChange={(e) => setFilters(prev => ({ ...prev, assignee: e.target.value }))}
                  placeholder="Search assignees..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />

                <div className="mt-4 space-y-1">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.showParentsOnly}
                      onChange={(e) => setFilters(prev => ({ ...prev, showParentsOnly: e.target.checked }))}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Show parent tasks only</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {tasksWithDates.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
            <p className="text-gray-600 text-lg mb-2">
              {hasActiveFilters ? 'No tasks match your filters' : 'No tasks with dates yet'}
            </p>
            <p className="text-gray-500 text-sm">
              {hasActiveFilters ? 'Try adjusting your filters' : 'Add start and end dates to your tasks to see them in the Gantt chart'}
            </p>
          </div>
        ) : (
          <GanttChart
            tasks={tasksWithDates}
            dependencies={dependencies}
            onTaskUpdate={handleTaskUpdate}
            onTaskClick={handleTaskClick}
            viewMode="Week"
            showCriticalPathOnly={filters.showCriticalPathOnly}
          />
        )}
      </div>

      {selectedTaskId && (
        <TaskDetailsModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={handleModalUpdate}
        />
      )}
    </>
  );
}
