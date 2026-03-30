import React, { useState, useContext } from 'react';
import { ProjectContext } from '../context/ProjectContext';
import { AuthContext } from '../context/AuthContext';
import { X, Trash2, ArrowUp, ArrowDown, Folder } from 'lucide-react';

const COLORS = [
  '#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444',
];

export default function ProjectSettingsModal({ project, onClose }) {
  const { updateProject, deleteProject, childProjects, reorderChildProjects } = useContext(ProjectContext);
  const { setCurrentView } = useContext(AuthContext);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [color, setColor] = useState(project.color);
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteOption, setDeleteOption] = useState('orphan'); // 'orphan' or 'cascade'

  const hasChildren = childProjects && childProjects.length > 0;

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await updateProject(project.id, { name, description, color });
      onClose();
    } catch (error) {
      alert('Failed to update project');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      const deleteChildren = deleteOption === 'cascade';
      await deleteProject(project.id, deleteChildren);
      setCurrentView({ type: 'dashboard' });
      onClose();
    } catch (error) {
      alert('Failed to delete project');
    }
  };

  const handleMoveChild = async (idx, direction) => {
    const children = [...childProjects];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= children.length) return;

    [children[idx], children[targetIdx]] = [children[targetIdx], children[idx]];
    const ordered = children.map((c, i) => ({ id: c.id, position: i }));
    try {
      await reorderChildProjects(project.id, ordered);
    } catch (error) {
      console.error('Error reordering:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Project Settings</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Project Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-10 h-10 rounded-lg ${color === c ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Parent Project Info */}
          {project.parent && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Parent Project</label>
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: project.parent.color }}
                />
                {project.parent.name}
              </div>
            </div>
          )}

          {/* Sub-Projects Section */}
          {hasChildren && (
            <div className="border-t border-gray-200 pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sub-Projects ({childProjects.length})
              </label>
              <div className="space-y-2">
                {childProjects.map((child, idx) => (
                  <div key={child.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                    <Folder className="w-4 h-4" style={{ color: child.color }} />
                    <span className="flex-1 truncate">{child.name}</span>
                    <span className="text-xs text-gray-500">{child.task_count || 0} tasks</span>
                    <button
                      type="button"
                      onClick={() => handleMoveChild(idx, 'up')}
                      disabled={idx === 0}
                      className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveChild(idx, 'down')}
                      disabled={idx >= childProjects.length - 1}
                      className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-gray-200 pt-4 mt-6">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4" />
              Delete Project
            </button>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm">
            <h3 className="text-lg font-semibold mb-2">Delete Project?</h3>
            <p className="text-gray-600 mb-4">
              This will permanently delete the project and all its tasks.
            </p>

            {hasChildren && (
              <div className="mb-4 space-y-2">
                <p className="text-sm font-medium text-gray-700">This project has {childProjects.length} sub-project(s):</p>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="deleteOption"
                    value="orphan"
                    checked={deleteOption === 'orphan'}
                    onChange={() => setDeleteOption('orphan')}
                    className="text-primary-600"
                  />
                  Move sub-projects to top level
                </label>
                <label className="flex items-center gap-2 text-sm text-red-600">
                  <input
                    type="radio"
                    name="deleteOption"
                    value="cascade"
                    checked={deleteOption === 'cascade'}
                    onChange={() => setDeleteOption('cascade')}
                    className="text-red-600"
                  />
                  Delete all sub-projects too
                </label>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
