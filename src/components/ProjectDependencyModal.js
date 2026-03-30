import React, { useState } from 'react';
import { projectDependenciesAPI } from '../services/api';
import { X } from 'lucide-react';

const DEPENDENCY_TYPES = [
  { value: 'finish_to_start', label: 'Finish to Start (FS)', desc: 'Target must finish before source can start' },
  { value: 'start_to_start', label: 'Start to Start (SS)', desc: 'Both start at the same time' },
  { value: 'finish_to_finish', label: 'Finish to Finish (FF)', desc: 'Both finish at the same time' },
  { value: 'start_to_finish', label: 'Start to Finish (SF)', desc: 'Target must start before source can finish' },
];

export default function ProjectDependencyModal({ parentProjectId, childProjects, onClose }) {
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [depType, setDepType] = useState('finish_to_start');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!sourceId || !targetId) {
      setError('Please select both a blocked and blocking project');
      return;
    }

    if (sourceId === targetId) {
      setError('A project cannot depend on itself');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await projectDependenciesAPI.create({
        source_project_id: parseInt(sourceId),
        target_project_id: parseInt(targetId),
        dependency_type: depType,
        description: description || undefined,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create dependency');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Add Project Dependency</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Blocked Project (Source) *
            </label>
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select project...</option>
              {childProjects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">This project is waiting/blocked</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Blocking Project (Target) *
            </label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select project...</option>
              {childProjects.filter(p => p.id.toString() !== sourceId).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">This project must complete first</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dependency Type
            </label>
            <select
              value={depType}
              onChange={(e) => setDepType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {DEPENDENCY_TYPES.map(dt => (
                <option key={dt.value} value={dt.value}>{dt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="e.g., QMS must be complete before FDA registration"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Dependency'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
