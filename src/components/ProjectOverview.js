import React, { useContext, useEffect, useState, useCallback } from 'react';
import { ProjectContext } from '../context/ProjectContext';
import { projectDependenciesAPI } from '../services/api';
import {
  Folder,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  ArrowRight,
  BarChart3
} from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import GanttView from './GanttView';
import ProjectDependencyModal from './ProjectDependencyModal';

export default function ProjectOverview({ projectId, onNavigateToProject, onAddSubProject }) {
  const {
    childProjects,
    loadChildProjects,
    reorderChildProjects,
    currentProject
  } = useContext(ProjectContext);

  const [projectDeps, setProjectDeps] = useState([]);
  const [loadingDeps, setLoadingDeps] = useState(false);
  const [showDepModal, setShowDepModal] = useState(false);
  const [showCombinedGantt, setShowCombinedGantt] = useState(false);

  useEffect(() => {
    loadChildProjects(projectId);
    loadDependencies();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const loadDependencies = async () => {
    try {
      setLoadingDeps(true);
      const { dependencies } = await projectDependenciesAPI.getAll(projectId);
      setProjectDeps(dependencies);
    } catch (error) {
      console.error('Error loading project dependencies:', error);
    } finally {
      setLoadingDeps(false);
    }
  };

  const handleMoveUp = useCallback(async (idx) => {
    if (idx === 0) return;
    const updated = [...childProjects];
    [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
    const ordered = updated.map((c, i) => ({ id: c.id, position: i }));
    try {
      await reorderChildProjects(projectId, ordered);
    } catch (error) {
      console.error('Error reordering:', error);
    }
  }, [childProjects, projectId, reorderChildProjects]);

  const handleMoveDown = useCallback(async (idx) => {
    if (idx >= childProjects.length - 1) return;
    const updated = [...childProjects];
    [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
    const ordered = updated.map((c, i) => ({ id: c.id, position: i }));
    try {
      await reorderChildProjects(projectId, ordered);
    } catch (error) {
      console.error('Error reordering:', error);
    }
  }, [childProjects, projectId, reorderChildProjects]);

  const handleDeleteDep = async (depId) => {
    try {
      await projectDependenciesAPI.delete(depId);
      setProjectDeps(prev => prev.filter(d => d.id !== depId));
    } catch (error) {
      console.error('Error deleting dependency:', error);
    }
  };

  const getProgressPercent = (child) => {
    const total = parseInt(child.task_count) || 0;
    const done = parseInt(child.completed_count) || 0;
    return total > 0 ? Math.round((done / total) * 100) : 0;
  };

  return (
    <div className="space-y-8">
      {/* Sub-Project Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Sub-Projects ({childProjects.length})
          </h2>
          <button
            onClick={onAddSubProject}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Sub-Project
          </button>
        </div>

        {childProjects.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-lg border-2 border-dashed border-gray-300">
            <Folder className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-3">No sub-projects yet</p>
            <button
              onClick={onAddSubProject}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
            >
              <Plus className="w-4 h-4" />
              Create First Sub-Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {childProjects.map((child, idx) => (
              <div
                key={child.id}
                className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                    onClick={() => onNavigateToProject(child.id)}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${child.color}20` }}
                    >
                      <Folder className="w-5 h-5" style={{ color: child.color }} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{child.name}</h3>
                      <p className="text-xs text-gray-500">
                        {child.task_count || 0} tasks
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    <button
                      onClick={() => handleMoveUp(idx)}
                      disabled={idx === 0}
                      className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                      title="Move up"
                    >
                      <ArrowUp className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                    <button
                      onClick={() => handleMoveDown(idx)}
                      disabled={idx >= childProjects.length - 1}
                      className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                      title="Move down"
                    >
                      <ArrowDown className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mb-2">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>{child.completed_count || 0} / {child.task_count || 0} done</span>
                    <span>{getProgressPercent(child)}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${getProgressPercent(child)}%`,
                        backgroundColor: child.color
                      }}
                    />
                  </div>
                </div>

                {/* Status breakdown */}
                <div className="flex items-center gap-2 text-xs">
                  {parseInt(child.in_progress_count) > 0 && (
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                      {child.in_progress_count} active
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Project Dependencies Table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Project Dependencies ({projectDeps.length})
          </h2>
          <button
            onClick={() => setShowDepModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Dependency
          </button>
        </div>

        {loadingDeps ? (
          <LoadingSpinner size="sm" />
        ) : projectDeps.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500 text-sm">
            No project-level dependencies defined yet.
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Blocked Project</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-700">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Blocking Project</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Description</th>
                  <th className="w-10 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {projectDeps.map(dep => (
                  <tr key={dep.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: dep.source_color }}
                        />
                        {dep.source_name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-gray-500">
                        <ArrowRight className="w-4 h-4" />
                        <span className="text-xs">
                          {dep.dependency_type === 'finish_to_start' ? 'FS' :
                           dep.dependency_type === 'start_to_start' ? 'SS' :
                           dep.dependency_type === 'finish_to_finish' ? 'FF' : 'SF'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: dep.target_color }}
                        />
                        {dep.target_name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {dep.description || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDeleteDep(dep.id)}
                        className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Combined Gantt Toggle */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Combined Timeline</h2>
          <button
            onClick={() => setShowCombinedGantt(!showCombinedGantt)}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${
              showCombinedGantt
                ? 'bg-primary-600 text-white'
                : 'text-primary-600 hover:bg-primary-50'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            {showCombinedGantt ? 'Hide Gantt' : 'Show Gantt'}
          </button>
        </div>

        {showCombinedGantt && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <GanttView
              projectId={projectId}
              crossProjectMode={true}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      {showDepModal && (
        <ProjectDependencyModal
          parentProjectId={projectId}
          childProjects={childProjects}
          onClose={() => {
            setShowDepModal(false);
            loadDependencies();
          }}
        />
      )}
    </div>
  );
}
