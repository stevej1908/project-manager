import React, { useContext, useState } from 'react';
import { ProjectContext } from '../context/ProjectContext';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import TaskCard from './TaskCard';
import { Plus, ChevronDown, ChevronRight } from 'lucide-react';
import CreateTaskModal from './CreateTaskModal';
import TaskDetailsModal from './TaskDetailsModal';

const COLUMNS = [
  { id: 'todo', title: 'To Do', color: 'bg-gray-100' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-blue-100' },
  { id: 'review', title: 'Review', color: 'bg-yellow-100' },
  { id: 'done', title: 'Done', color: 'bg-green-100' },
];

export default function TaskBoard({ projectId }) {
  const { tasks, updateTask, reorderTasks, loadProject } = useContext(ProjectContext);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalStatus, setCreateModalStatus] = useState('todo');
  const [createModalParentId, setCreateModalParentId] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [expandedTasks, setExpandedTasks] = useState(new Set());

  const handleDragEnd = async (result) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;

    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    const taskId = parseInt(draggableId);
    const newStatus = destination.droppableId;

    // Update task status in backend
    try {
      await updateTask(taskId, { status: newStatus });
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  // Get only parent tasks (top-level) by status
  const getParentTasksByStatus = (status) => {
    return tasks
      .filter((task) => task.status === status && !task.parent_task_id)
      .sort((a, b) => a.position - b.position);
  };

  // Get sub-tasks for a specific parent task
  const getSubTasks = (parentId, status) => {
    return tasks
      .filter((task) => task.parent_task_id === parentId && task.status === status)
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

  const handleCreateTask = (status, parentId = null) => {
    setCreateModalStatus(status);
    setCreateModalParentId(parentId);
    setShowCreateModal(true);
  };

  const handleTaskClick = (task) => {
    setSelectedTaskId(task.id);
  };

  const handleTaskUpdate = () => {
    // Reload project data to get updated task info
    loadProject(projectId);
  };

  // Render a task and its sub-tasks recursively
  const renderTaskWithSubtasks = (task, index, status, depth = 0) => {
    const subTasks = getSubTasks(task.id, status);
    const hasSubTasks = subTasks.length > 0;
    const isExpanded = expandedTasks.has(task.id);

    return (
      <React.Fragment key={task.id}>
        <Draggable
          key={task.id}
          draggableId={task.id.toString()}
          index={index}
        >
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.draggableProps}
              {...provided.dragHandleProps}
              style={{
                ...provided.draggableProps.style,
                opacity: snapshot.isDragging ? 0.8 : 1,
                marginLeft: depth > 0 ? `${depth * 16}px` : '0',
              }}
            >
              <TaskCard
                task={task}
                onClick={() => handleTaskClick(task)}
                onAddSubTask={() => handleCreateTask(status, task.id)}
                hasSubTasks={hasSubTasks}
                isExpanded={isExpanded}
                onToggleExpand={() => toggleTaskExpansion(task.id)}
                depth={depth}
              />
            </div>
          )}
        </Draggable>

        {/* Render sub-tasks if expanded */}
        {isExpanded && hasSubTasks && (
          <>
            {subTasks.map((subTask, subIndex) =>
              renderTaskWithSubtasks(subTask, index + subIndex + 1, status, depth + 1)
            )}
          </>
        )}
      </React.Fragment>
    );
  };

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {COLUMNS.map((column) => {
            const parentTasks = getParentTasksByStatus(column.id);

            return (
              <div key={column.id} className="flex flex-col">
                <div className={`${column.color} rounded-t-lg px-4 py-3 flex items-center justify-between`}>
                  <h3 className="font-semibold text-gray-900">{column.title}</h3>
                  <span className="text-sm text-gray-600">
                    {parentTasks.length}
                  </span>
                </div>

                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 bg-gray-50 rounded-b-lg p-2 min-h-[200px] ${
                        snapshot.isDraggingOver ? 'bg-gray-100' : ''
                      }`}
                    >
                      {parentTasks.map((task, index) =>
                        renderTaskWithSubtasks(task, index, column.id)
                      )}
                      {provided.placeholder}

                      <button
                        onClick={() => handleCreateTask(column.id)}
                        className="w-full mt-2 px-3 py-2 text-sm text-gray-600 hover:bg-white hover:text-gray-900 rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Add task
                      </button>
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {showCreateModal && (
        <CreateTaskModal
          projectId={projectId}
          initialStatus={createModalStatus}
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
