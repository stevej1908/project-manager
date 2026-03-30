import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ProjectContext } from '../context/ProjectContext';
import {
  ArrowLeft,
  Plus,
  Settings,
  Share2,
  Mail,
  Upload,
  LayoutGrid,
  BarChart3,
  Layers,
  FolderPlus,
  ChevronRight
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import TaskListView from '../components/TaskListView';
import GanttView from '../components/GanttView';
import ProjectOverview from '../components/ProjectOverview';
import CreateTaskModal from '../components/CreateTaskModal';
import CreateProjectModal from '../components/CreateProjectModal';
import ProjectSettingsModal from '../components/ProjectSettingsModal';
import ShareProjectModal from '../components/ShareProjectModal';
import GmailPickerModal from '../components/GmailPickerModal';
import ImportTasksModal from '../components/ImportTasksModal';

export default function ProjectPage({ projectId, onBack }) {
  const { setCurrentView } = useContext(AuthContext);
  const { currentProject, loadProject, loadTasks, loading } = useContext(ProjectContext);
  const [view, setView] = useState('board'); // 'board', 'gantt', or 'overview'
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [showCreateSubProjectModal, setShowCreateSubProjectModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showGmailPicker, setShowGmailPicker] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const hasChildren = currentProject && (
    (currentProject.children && currentProject.children.length > 0) ||
    parseInt(currentProject.child_count) > 0
  );

  useEffect(() => {
    loadProject(projectId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Auto-switch to overview for parent projects
  useEffect(() => {
    if (hasChildren && view === 'board') {
      setView('overview');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasChildren]);

  const navigateToProject = (targetProjectId) => {
    setCurrentView({ type: 'project', projectId: targetProjectId });
  };

  if (loading || !currentProject) {
    return (
      <div className="h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                {/* Breadcrumb for child projects */}
                {currentProject.parent && (
                  <div className="flex items-center gap-1 text-sm text-gray-500 mb-1">
                    <button
                      onClick={() => navigateToProject(currentProject.parent.id)}
                      className="hover:text-primary-600 transition-colors"
                    >
                      {currentProject.parent.name}
                    </button>
                    <ChevronRight className="w-3 h-3" />
                  </div>
                )}
                <h1 className="text-2xl font-bold text-gray-900">
                  {currentProject.name}
                </h1>
                {currentProject.description && (
                  <p className="text-sm text-gray-600 mt-1">
                    {currentProject.description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* View Toggle */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                {hasChildren && (
                  <button
                    onClick={() => setView('overview')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${
                      view === 'overview'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                    title="Project Overview"
                  >
                    <Layers className="w-4 h-4" />
                    <span className="hidden sm:inline text-sm">Overview</span>
                  </button>
                )}
                <button
                  onClick={() => setView('board')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${
                    view === 'board'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Board View"
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span className="hidden sm:inline text-sm">Board</span>
                </button>
                <button
                  onClick={() => setView('gantt')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${
                    view === 'gantt'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Gantt Chart"
                >
                  <BarChart3 className="w-4 h-4" />
                  <span className="hidden sm:inline text-sm">Gantt</span>
                </button>
              </div>

              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Import tasks from file"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Import</span>
              </button>
              <button
                onClick={() => setShowGmailPicker(true)}
                className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Create task from Gmail"
              >
                <Mail className="w-4 h-4" />
                <span className="hidden sm:inline">Gmail</span>
              </button>
              <button
                onClick={() => setShowShareModal(true)}
                className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">Share</span>
              </button>
              <button
                onClick={() => setShowSettingsModal(true)}
                className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
              </button>
              {hasChildren && (
                <button
                  onClick={() => setShowCreateSubProjectModal(true)}
                  className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Add Sub-Project"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span className="hidden sm:inline">Sub-Project</span>
                </button>
              )}
              <button
                onClick={() => setShowCreateTaskModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span>New Task</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {view === 'overview' && hasChildren ? (
          <ProjectOverview
            projectId={projectId}
            onNavigateToProject={navigateToProject}
            onAddSubProject={() => setShowCreateSubProjectModal(true)}
          />
        ) : view === 'gantt' ? (
          <GanttView projectId={projectId} />
        ) : (
          <TaskListView projectId={projectId} />
        )}
      </main>

      {/* Modals */}
      {showCreateTaskModal && (
        <CreateTaskModal
          projectId={projectId}
          onClose={() => setShowCreateTaskModal(false)}
        />
      )}
      {showCreateSubProjectModal && (
        <CreateProjectModal
          parentProjectId={projectId}
          parentProjectName={currentProject.name}
          onClose={() => {
            setShowCreateSubProjectModal(false);
            loadProject(projectId);
          }}
        />
      )}
      {showSettingsModal && (
        <ProjectSettingsModal
          project={currentProject}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
      {showShareModal && (
        <ShareProjectModal
          project={currentProject}
          onClose={() => setShowShareModal(false)}
        />
      )}
      {showGmailPicker && (
        <GmailPickerModal
          projectId={projectId}
          onClose={() => setShowGmailPicker(false)}
        />
      )}
      {showImportModal && (
        <ImportTasksModal
          projectId={projectId}
          onClose={() => setShowImportModal(false)}
          onImportComplete={() => loadTasks(projectId)}
        />
      )}
    </div>
  );
}
