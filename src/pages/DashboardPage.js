import React, { useContext, useEffect, useState, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ProjectContext } from '../context/ProjectContext';
import { projectsAPI } from '../services/api';
import { Plus, Folder, LogOut, CheckSquare, ChevronRight, ChevronDown, FolderTree } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import CreateProjectModal from '../components/CreateProjectModal';

export default function DashboardPage() {
  const { user, logout, setCurrentView } = useContext(AuthContext);
  const { projects, loading, loadProjects } = useContext(ProjectContext);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createParentId, setCreateParentId] = useState(null);
  const [createParentName, setCreateParentName] = useState('');
  const [expandedProjects, setExpandedProjects] = useState(new Set());
  const [childrenCache, setChildrenCache] = useState({});
  const [loadingChildren, setLoadingChildren] = useState(new Set());

  useEffect(() => {
    loadProjects();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenProject = (projectId) => {
    setCurrentView({ type: 'project', projectId });
  };

  const toggleExpand = useCallback(async (e, projectId) => {
    e.stopPropagation();

    if (expandedProjects.has(projectId)) {
      setExpandedProjects(prev => {
        const next = new Set(prev);
        next.delete(projectId);
        return next;
      });
      return;
    }

    // Fetch children if not cached
    if (!childrenCache[projectId]) {
      setLoadingChildren(prev => new Set(prev).add(projectId));
      try {
        const { children } = await projectsAPI.getChildren(projectId);
        setChildrenCache(prev => ({ ...prev, [projectId]: children }));
      } catch (error) {
        console.error('Error loading children:', error);
      } finally {
        setLoadingChildren(prev => {
          const next = new Set(prev);
          next.delete(projectId);
          return next;
        });
      }
    }

    setExpandedProjects(prev => new Set(prev).add(projectId));
  }, [expandedProjects, childrenCache]);

  const handleCreateSubProject = (e, projectId, projectName) => {
    e.stopPropagation();
    setCreateParentId(projectId);
    setCreateParentName(projectName);
    setShowCreateModal(true);
  };

  const handleCloseCreateModal = () => {
    const parentIdToInvalidate = createParentId;
    setShowCreateModal(false);
    setCreateParentId(null);
    setCreateParentName('');
    // Refresh projects list
    loadProjects();
    // Clear children cache so it re-fetches
    if (parentIdToInvalidate) {
      setChildrenCache(prev => {
        const next = { ...prev };
        delete next[parentIdToInvalidate];
        return next;
      });
    }
  };

  const getAggregateTaskCount = (project) => {
    const own = parseInt(project.task_count) || 0;
    const desc = parseInt(project.descendant_task_count) || 0;
    return own + desc;
  };

  const getAggregateCompletedCount = (project) => {
    const own = parseInt(project.completed_count) || 0;
    const desc = parseInt(project.descendant_completed_count) || 0;
    return own + desc;
  };

  const renderChildProject = (child) => (
    <div
      key={child.id}
      onClick={() => handleOpenProject(child.id)}
      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow cursor-pointer ml-6 flex items-center gap-4"
    >
      <div
        className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${child.color}20` }}
      >
        <Folder className="w-4 h-4" style={{ color: child.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-gray-900 truncate">{child.name}</h4>
        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
          <span>{child.task_count || 0} tasks</span>
          <span>{child.completed_count || 0} done</span>
          {parseInt(child.in_progress_count) > 0 && (
            <span className="text-blue-600">{child.in_progress_count} active</span>
          )}
        </div>
      </div>
      {parseInt(child.task_count) > 0 && (
        <div className="flex-shrink-0">
          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full"
              style={{
                width: `${Math.round((parseInt(child.completed_count) || 0) / (parseInt(child.task_count) || 1) * 100)}%`
              }}
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <CheckSquare className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Project Manager</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                {user?.picture && (
                  <img
                    src={user.picture}
                    alt={user.name}
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <span className="text-sm text-gray-700">{user?.name}</span>
              </div>
              <button
                onClick={logout}
                className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">My Projects</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            New Project
          </button>
        </div>

        {loading ? (
          <div className="py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
            <Folder className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No projects yet
            </h3>
            <p className="text-gray-600 mb-4">
              Get started by creating your first project
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => {
              const childCount = parseInt(project.child_count) || 0;
              const isExpanded = expandedProjects.has(project.id);
              const isLoadingChildren = loadingChildren.has(project.id);
              const cachedChildren = childrenCache[project.id];
              const totalTasks = getAggregateTaskCount(project);
              const totalCompleted = getAggregateCompletedCount(project);

              return (
                <div key={project.id} className={childCount > 0 && isExpanded ? 'col-span-1 md:col-span-2 lg:col-span-3' : ''}>
                  <div
                    onClick={() => handleOpenProject(project.id)}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${project.color}20` }}
                        >
                          {childCount > 0 ? (
                            <FolderTree className="w-6 h-6" style={{ color: project.color }} />
                          ) : (
                            <Folder className="w-6 h-6" style={{ color: project.color }} />
                          )}
                        </div>
                        {childCount > 0 && (
                          <button
                            onClick={(e) => toggleExpand(e, project.id)}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-5 h-5 text-gray-500" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-gray-500" />
                            )}
                          </button>
                        )}
                      </div>
                      {childCount > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                            {childCount} sub-project{childCount !== 1 ? 's' : ''}
                          </span>
                          <button
                            onClick={(e) => handleCreateSubProject(e, project.id, project.name)}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                            title="Add sub-project"
                          >
                            <Plus className="w-4 h-4 text-gray-400" />
                          </button>
                        </div>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {project.name}
                    </h3>
                    {project.description && (
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                        {project.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>{totalTasks} tasks</span>
                      <span>•</span>
                      <span>{totalCompleted} completed</span>
                    </div>
                  </div>

                  {/* Expanded children */}
                  {childCount > 0 && isExpanded && (
                    <div className="mt-2 space-y-2">
                      {isLoadingChildren ? (
                        <div className="ml-6 py-4">
                          <LoadingSpinner size="sm" />
                        </div>
                      ) : cachedChildren ? (
                        <>
                          {cachedChildren.map(renderChildProject)}
                          <button
                            onClick={(e) => handleCreateSubProject(e, project.id, project.name)}
                            className="ml-6 flex items-center gap-2 px-4 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            Add sub-project
                          </button>
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {showCreateModal && (
        <CreateProjectModal
          onClose={handleCloseCreateModal}
          parentProjectId={createParentId}
          parentProjectName={createParentName}
        />
      )}
    </div>
  );
}
