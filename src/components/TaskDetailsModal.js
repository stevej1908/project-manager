import React, { useEffect, useState } from 'react';
import {
  X,
  Calendar,
  User,
  Tag,
  Paperclip,
  MessageSquare,
  Send,
  Loader,
  Plus,
  Trash2,
  Link as LinkIcon,
  ExternalLink,
  FolderOpen,
  Mail
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { tasksAPI, dependenciesAPI, googleAPI } from '../services/api';
import DriveFilePicker from './DriveFilePicker';
import EmailAttachmentModal from './EmailAttachmentModal';

const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'];
const STATUS_OPTIONS = ['todo', 'in_progress', 'review', 'done'];

const PRIORITY_COLORS = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

const STATUS_COLORS = {
  todo: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  review: 'bg-yellow-100 text-yellow-700',
  done: 'bg-green-100 text-green-700',
};

export default function TaskDetailsModal({ taskId, onClose, onUpdate }) {
  const [task, setTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [emails, setEmails] = useState([]);
  const [dependencies, setDependencies] = useState([]);
  const [subTasks, setSubTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editMode, setEditMode] = useState({});
  const [editValues, setEditValues] = useState({});

  // Comment state
  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);

  // Dependency state
  const [availableTasks, setAvailableTasks] = useState([]);
  const [showAddDependency, setShowAddDependency] = useState(false);
  const [newDependency, setNewDependency] = useState({
    depends_on_task_id: '',
    dependency_type: 'finish_to_start'
  });

  // Drive picker state
  const [showDrivePicker, setShowDrivePicker] = useState(false);

  // Email picker state
  const [showEmailPicker, setShowEmailPicker] = useState(false);

  useEffect(() => {
    loadTaskDetails();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const loadTaskDetails = async () => {
    try {
      setLoading(true);
      const [taskResponse, depsData, emailsData] = await Promise.all([
        tasksAPI.getById(taskId),
        dependenciesAPI.getForTask(taskId),
        googleAPI.getTaskEmails(taskId)
      ]);

      const taskData = taskResponse.task; // Backend returns { task: {...} }
      setTask(taskData);
      // Comments and attachments come from the task object
      setComments(taskData.comments || []);
      setAttachments(taskData.attachments || []);
      setEmails(emailsData.emails || []);
      // Combine depends_on and blocks arrays into one
      const allDeps = [
        ...(depsData.depends_on || []),
        ...(depsData.blocks || [])
      ];
      setDependencies(allDeps);

      // Load all tasks for dependency dropdown and sub-tasks
      const allTasksResponse = await tasksAPI.getAll(taskData.project_id);
      const allTasks = allTasksResponse.tasks || [];

      // Filter out current task from available tasks (can't depend on itself)
      const available = allTasks.filter(t => t.id !== taskId);
      setAvailableTasks(available);

      // Load sub-tasks if this task has any
      if (taskData.subtask_count > 0) {
        const subs = allTasks.filter(t => t.parent_task_id === taskId);
        setSubTasks(subs);
      }
    } catch (error) {
      console.error('Error loading task details:', error);
      alert('Failed to load task details');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldEdit = (field, value) => {
    setEditValues({ ...editValues, [field]: value });
  };

  const handleFieldSave = async (field) => {
    try {
      setSaving(true);
      const updateData = { [field]: editValues[field] };
      const updatedTask = await tasksAPI.update(taskId, updateData);
      setTask(updatedTask);
      setEditMode({ ...editMode, [field]: false });
      if (onUpdate) onUpdate(updatedTask);
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task');
    } finally {
      setSaving(false);
    }
  };

  const handleFieldCancel = (field) => {
    setEditMode({ ...editMode, [field]: false });
    setEditValues({ ...editValues, [field]: task[field] });
  };

  const startEdit = (field) => {
    setEditMode({ ...editMode, [field]: true });
    setEditValues({ ...editValues, [field]: task[field] });
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      setAddingComment(true);
      await tasksAPI.addComment(taskId, newComment);
      // Reload task details to get updated comments
      await loadTaskDetails();
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Failed to add comment');
    } finally {
      setAddingComment(false);
    }
  };

  const handleAddDependency = async (e) => {
    e.preventDefault();
    if (!newDependency.depends_on_task_id) {
      alert('Please select a task');
      return;
    }

    try {
      await dependenciesAPI.create({
        dependent_task_id: taskId,
        depends_on_task_id: parseInt(newDependency.depends_on_task_id),
        dependency_type: newDependency.dependency_type
      });

      // Reload dependencies
      const depsData = await dependenciesAPI.getForTask(taskId);
      const allDeps = [
        ...(depsData.depends_on || []),
        ...(depsData.blocks || [])
      ];
      setDependencies(allDeps);

      // Reset form
      setNewDependency({
        depends_on_task_id: '',
        dependency_type: 'finish_to_start'
      });
      setShowAddDependency(false);

      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error adding dependency:', error);
      alert(error.response?.data?.message || 'Failed to add dependency');
    }
  };

  const handleDeleteDependency = async (depId) => {
    if (!window.confirm('Remove this dependency?')) return;

    try {
      await dependenciesAPI.delete(depId);

      // Reload dependencies
      const depsData = await dependenciesAPI.getForTask(taskId);
      const allDeps = [
        ...(depsData.depends_on || []),
        ...(depsData.blocks || [])
      ];
      setDependencies(allDeps);

      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error deleting dependency:', error);
      alert('Failed to delete dependency');
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    if (!window.confirm('Remove this attachment?')) return;

    try {
      await tasksAPI.deleteAttachment(attachmentId);

      // Reload task details
      await loadTaskDetails();

      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error deleting attachment:', error);
      alert('Failed to delete attachment');
    }
  };

  const handleDeleteEmail = async (emailId) => {
    if (!window.confirm('Remove this email attachment?')) return;

    try {
      await googleAPI.deleteTaskEmail(emailId);

      // Reload task details
      await loadTaskDetails();

      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error deleting email:', error);
      alert('Failed to delete email attachment');
    }
  };

  const handleFileAttached = async () => {
    // Reload task details to get the new attachment
    await loadTaskDetails();
    if (onUpdate) onUpdate();
  };

  if (loading || !task) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <Loader className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Task Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content - Left Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title
                </label>
                {editMode.title ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editValues.title}
                      onChange={(e) => handleFieldEdit('title', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      autoFocus
                    />
                    <button
                      onClick={() => handleFieldSave('title')}
                      disabled={saving}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => handleFieldCancel('title')}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => startEdit('title')}
                    className="px-3 py-2 border border-transparent rounded-lg hover:border-gray-300 hover:bg-gray-50 cursor-pointer"
                  >
                    <h3 className="text-lg font-semibold text-gray-900">{task.title}</h3>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                {editMode.description ? (
                  <div className="space-y-2">
                    <textarea
                      value={editValues.description || ''}
                      onChange={(e) => handleFieldEdit('description', e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleFieldSave('description')}
                        disabled={saving}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => handleFieldCancel('description')}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => startEdit('description')}
                    className="px-3 py-2 border border-transparent rounded-lg hover:border-gray-300 hover:bg-gray-50 cursor-pointer min-h-[100px]"
                  >
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {task.description || 'Click to add description...'}
                    </p>
                  </div>
                )}
              </div>

              {/* Comments Section */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare className="w-5 h-5 text-gray-700" />
                  <h4 className="text-lg font-semibold text-gray-900">
                    Comments ({comments.length})
                  </h4>
                </div>

                {/* Add Comment Form */}
                <form onSubmit={handleAddComment} className="mb-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a comment..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <button
                      type="submit"
                      disabled={!newComment.trim() || addingComment}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      Send
                    </button>
                  </div>
                </form>

                {/* Comments List */}
                <div className="space-y-3">
                  {comments.map((comment) => (
                    <div key={comment.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-900">
                          {comment.name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {format(parseISO(comment.created_at), 'MMM d, yyyy h:mm a')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {comment.comment}
                      </p>
                    </div>
                  ))}
                  {comments.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No comments yet. Be the first to comment!
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar - Right Column */}
            <div className="space-y-6">
              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={task.status}
                  onChange={(e) => {
                    handleFieldEdit('status', e.target.value);
                    handleFieldSave('status');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status.replace('_', ' ')}
                    </option>
                  ))}
                </select>
                <span
                  className={`inline-block mt-2 px-3 py-1 text-xs font-medium rounded ${
                    STATUS_COLORS[task.status]
                  }`}
                >
                  {task.status.replace('_', ' ')}
                </span>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Tag className="w-4 h-4 inline mr-1" />
                  Priority
                </label>
                <select
                  value={task.priority}
                  onChange={(e) => {
                    handleFieldEdit('priority', e.target.value);
                    handleFieldSave('priority');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {PRIORITY_OPTIONS.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
                <span
                  className={`inline-block mt-2 px-3 py-1 text-xs font-medium rounded ${
                    PRIORITY_COLORS[task.priority]
                  }`}
                >
                  {task.priority}
                </span>
              </div>

              {/* Dates */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Start Date
                </label>
                {editMode.start_date ? (
                  <div className="space-y-2">
                    <input
                      type="date"
                      value={editValues.start_date || ''}
                      onChange={(e) => handleFieldEdit('start_date', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleFieldSave('start_date')}
                        disabled={saving}
                        className="flex-1 px-3 py-1 bg-primary-600 text-white text-sm rounded hover:bg-primary-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => handleFieldCancel('start_date')}
                        className="flex-1 px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => startEdit('start_date')}
                    className="px-3 py-2 border border-transparent rounded-lg hover:border-gray-300 hover:bg-gray-50 cursor-pointer"
                  >
                    <p className="text-sm text-gray-700">
                      {task.start_date
                        ? format(parseISO(task.start_date), 'MMM d, yyyy')
                        : 'Not set'}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  End Date
                </label>
                {editMode.end_date ? (
                  <div className="space-y-2">
                    <input
                      type="date"
                      value={editValues.end_date || ''}
                      onChange={(e) => handleFieldEdit('end_date', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleFieldSave('end_date')}
                        disabled={saving}
                        className="flex-1 px-3 py-1 bg-primary-600 text-white text-sm rounded hover:bg-primary-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => handleFieldCancel('end_date')}
                        className="flex-1 px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => startEdit('end_date')}
                    className="px-3 py-2 border border-transparent rounded-lg hover:border-gray-300 hover:bg-gray-50 cursor-pointer"
                  >
                    <p className="text-sm text-gray-700">
                      {task.end_date
                        ? format(parseISO(task.end_date), 'MMM d, yyyy')
                        : 'Not set'}
                    </p>
                  </div>
                )}
              </div>

              {/* Assignees */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="w-4 h-4 inline mr-1" />
                  Assignees ({task.assignees?.length || 0})
                </label>
                <div className="space-y-2">
                  {task.assignees && task.assignees.length > 0 ? (
                    task.assignees.map((assignee) => (
                      <div key={assignee.id} className="bg-gray-50 rounded-lg p-2">
                        <p className="text-sm font-medium text-gray-900">
                          {assignee.contact_name || assignee.user_id}
                        </p>
                        {assignee.contact_email && (
                          <p className="text-xs text-gray-600">{assignee.contact_email}</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No assignees</p>
                  )}
                </div>
              </div>

              {/* Attachments */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Paperclip className="w-4 h-4" />
                    Attachments ({attachments.length})
                  </label>
                  <button
                    onClick={() => setShowDrivePicker(true)}
                    className="flex items-center gap-1 text-primary-600 hover:text-primary-700 p-1 text-sm"
                    title="Attach from Drive"
                  >
                    <FolderOpen className="w-4 h-4" />
                    <span className="text-xs">Drive</span>
                  </button>
                </div>
                <div className="space-y-2">
                  {attachments.map((attachment) => (
                    <div key={attachment.id} className="bg-gray-50 rounded-lg p-3 flex items-start gap-3">
                      {/* Thumbnail */}
                      {attachment.thumbnail_url ? (
                        <img
                          src={attachment.thumbnail_url}
                          alt={attachment.file_name}
                          className="w-12 h-12 rounded object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                          <Paperclip className="w-5 h-5 text-gray-400" />
                        </div>
                      )}

                      {/* File Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {attachment.file_name}
                        </p>
                        {attachment.file_type && (
                          <p className="text-xs text-gray-500 truncate">
                            {attachment.file_type}
                          </p>
                        )}
                        {attachment.drive_url && (
                          <a
                            href={attachment.drive_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary-600 hover:underline flex items-center gap-1 mt-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Open in Drive
                          </a>
                        )}
                      </div>

                      {/* Delete Button */}
                      <button
                        onClick={() => handleDeleteAttachment(attachment.id)}
                        className="text-red-600 hover:text-red-700 p-1"
                        title="Remove attachment"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {attachments.length === 0 && (
                    <p className="text-sm text-gray-500 py-2">No attachments</p>
                  )}
                </div>
              </div>

              {/* Email Attachments */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Mail className="w-4 h-4" />
                    Emails ({emails.length})
                  </label>
                  <button
                    onClick={() => setShowEmailPicker(true)}
                    className="flex items-center gap-1 text-primary-600 hover:text-primary-700 p-1 text-sm"
                    title="Attach emails from Gmail"
                  >
                    <Mail className="w-4 h-4" />
                    <span className="text-xs">Gmail</span>
                  </button>
                </div>
                <div className="space-y-2">
                  {emails.map((email) => (
                    <div key={email.id} className="bg-blue-50 rounded-lg p-3 flex items-start gap-3 border border-blue-100">
                      {/* Email Icon */}
                      <div className="w-10 h-10 bg-blue-100 rounded flex items-center justify-center flex-shrink-0">
                        <Mail className="w-5 h-5 text-blue-600" />
                      </div>

                      {/* Email Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {email.subject || '(No subject)'}
                        </p>
                        <p className="text-xs text-gray-600 truncate">
                          From: {email.sender}
                        </p>
                        {email.email_date && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {format(parseISO(email.email_date), 'MMM d, yyyy')}
                          </p>
                        )}
                        {email.snippet && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {email.snippet}
                          </p>
                        )}
                        <a
                          href={`https://mail.google.com/mail/u/0/#inbox/${email.message_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary-600 hover:underline flex items-center gap-1 mt-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Open in Gmail
                        </a>
                      </div>

                      {/* Delete Button */}
                      <button
                        onClick={() => handleDeleteEmail(email.id)}
                        className="text-red-600 hover:text-red-700 p-1"
                        title="Remove email"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {emails.length === 0 && (
                    <p className="text-sm text-gray-500 py-2">No emails attached</p>
                  )}
                </div>
              </div>

              {/* Dependencies */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <LinkIcon className="w-4 h-4" />
                    Dependencies ({dependencies.length})
                  </label>
                  <button
                    onClick={() => setShowAddDependency(!showAddDependency)}
                    className="text-primary-600 hover:text-primary-700 p-1"
                    title="Add dependency"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Add Dependency Form */}
                {showAddDependency && (
                  <form onSubmit={handleAddDependency} className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          This task depends on:
                        </label>
                        <select
                          value={newDependency.depends_on_task_id}
                          onChange={(e) => setNewDependency({ ...newDependency, depends_on_task_id: e.target.value })}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                          required
                        >
                          <option value="">Select a task...</option>
                          {availableTasks.map(t => (
                            <option key={t.id} value={t.id}>
                              {t.parent_task_id ? '  └─ ' : ''}{t.title}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Dependency Type:
                        </label>
                        <select
                          value={newDependency.dependency_type}
                          onChange={(e) => setNewDependency({ ...newDependency, dependency_type: e.target.value })}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="finish_to_start">Finish-to-Start</option>
                          <option value="start_to_start">Start-to-Start</option>
                          <option value="finish_to_finish">Finish-to-Finish</option>
                          <option value="start_to_finish">Start-to-Finish</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded hover:bg-primary-700"
                        >
                          Add Dependency
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAddDependency(false)}
                          className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                {/* Dependencies List */}
                <div className="space-y-2">
                  {dependencies.map((dep) => {
                    // Determine if this is a blocking or blocked dependency
                    const isBlocking = dep.dependent_task_id === taskId;
                    const relatedTaskId = isBlocking ? dep.depends_on_task_id : dep.dependent_task_id;
                    const relatedTask = availableTasks.find(t => t.id === relatedTaskId);

                    return (
                      <div key={dep.id} className="bg-gray-50 rounded-lg p-3 flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-gray-500 uppercase">
                              {dep.dependency_type.replace(/_/g, ' ')}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              isBlocking ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {isBlocking ? 'Blocks this' : 'This blocks'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-900">
                            {relatedTask ? relatedTask.title : `Task #${relatedTaskId}`}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteDependency(dep.id)}
                          className="text-red-600 hover:text-red-700 p-1"
                          title="Remove dependency"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                  {dependencies.length === 0 && !showAddDependency && (
                    <p className="text-sm text-gray-500 py-2">No dependencies</p>
                  )}
                </div>
              </div>

              {/* Sub-tasks */}
              {subTasks.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sub-tasks ({subTasks.length})
                  </label>
                  <div className="space-y-2">
                    {subTasks.map((subTask) => (
                      <div key={subTask.id} className="bg-gray-50 rounded-lg p-2">
                        <p className="text-sm font-medium text-gray-900">{subTask.title}</p>
                        <span
                          className={`inline-block mt-1 px-2 py-0.5 text-xs rounded ${
                            STATUS_COLORS[subTask.status]
                          }`}
                        >
                          {subTask.status.replace('_', ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Parent Task */}
              {task.parent_task_title && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Parent Task
                  </label>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-sm text-gray-900">{task.parent_task_title}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Drive File Picker Modal */}
      {showDrivePicker && (
        <DriveFilePicker
          taskId={taskId}
          onClose={() => setShowDrivePicker(false)}
          onFileAttached={handleFileAttached}
        />
      )}

      {/* Email Attachment Modal */}
      {showEmailPicker && (
        <EmailAttachmentModal
          taskId={taskId}
          onClose={() => setShowEmailPicker(false)}
          onEmailsAttached={handleFileAttached}
        />
      )}
    </div>
  );
}
