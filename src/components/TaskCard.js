import React from 'react';
import { Calendar, Paperclip, MessageSquare, User, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { format } from 'date-fns';

const PRIORITY_COLORS = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

export default function TaskCard({
  task,
  onClick,
  onAddSubTask,
  hasSubTasks = false,
  isExpanded = false,
  onToggleExpand,
  depth = 0
}) {
  // Assignees comes as an array from the API
  const assigneeCount = Array.isArray(task.assignees) ? task.assignees.length : 0;

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border ${
        depth > 0 ? 'border-l-4 border-l-primary-300' : 'border-gray-200'
      } p-4 mb-2 hover:shadow-md transition-shadow cursor-pointer relative`}
    >
      {/* Expand/Collapse button for tasks with sub-tasks */}
      {hasSubTasks && onToggleExpand && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          className="absolute -left-2 top-4 bg-white border border-gray-300 rounded-full p-0.5 hover:bg-gray-100 transition-colors"
          title={isExpanded ? 'Collapse sub-tasks' : 'Expand sub-tasks'}
        >
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 text-gray-600" />
          ) : (
            <ChevronRight className="w-3 h-3 text-gray-600" />
          )}
        </button>
      )}

      <div onClick={onClick}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-1 flex-1">
            <h4 className="text-sm font-medium text-gray-900 line-clamp-2">
              {task.title}
            </h4>
            {task.subtask_count > 0 && (
              <span className="text-xs text-gray-500 ml-1">
                ({task.subtask_count})
              </span>
            )}
          </div>
          {task.priority && (
            <span
              className={`ml-2 px-2 py-0.5 text-xs font-medium rounded ${
                PRIORITY_COLORS[task.priority]
              }`}
            >
              {task.priority}
            </span>
          )}
        </div>

        {task.description && (
          <p className="text-xs text-gray-600 mb-3 line-clamp-2">
            {task.description}
          </p>
        )}

        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-3">
            {task.end_date && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{format(new Date(task.end_date), 'MMM d')}</span>
              </div>
            )}
            {assigneeCount > 0 && (
              <div className="flex items-center gap-1">
                <User className="w-3 h-3" />
                <span>{assigneeCount}</span>
              </div>
            )}
            {task.attachment_count > 0 && (
              <div className="flex items-center gap-1">
                <Paperclip className="w-3 h-3" />
                <span>{task.attachment_count}</span>
              </div>
            )}
            {task.comment_count > 0 && (
              <div className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                <span>{task.comment_count}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Sub-task button */}
      {onAddSubTask && depth === 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddSubTask();
          }}
          className="w-full mt-2 px-2 py-1 text-xs text-primary-600 hover:bg-primary-50 rounded transition-colors flex items-center justify-center gap-1 border border-dashed border-primary-300"
        >
          <Plus className="w-3 h-3" />
          Add Sub-task
        </button>
      )}
    </div>
  );
}
