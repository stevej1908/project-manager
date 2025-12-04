import React, { useContext } from 'react';
import { AuthContext } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProjectPage from './pages/ProjectPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import LoadingSpinner from './components/LoadingSpinner';

function Router() {
  const { user, loading, currentView, setCurrentView } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Handle authentication callback
  const path = window.location.pathname;
  if (path === '/auth/callback') {
    return <AuthCallbackPage />;
  }

  if (path === '/auth/error') {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Authentication Error</h1>
          <p className="text-gray-600 mb-4">There was an error signing in. Please try again.</p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  // Simple routing based on currentView
  if (currentView.type === 'project' && currentView.projectId) {
    return <ProjectPage projectId={currentView.projectId} onBack={() => setCurrentView({ type: 'dashboard' })} />;
  }

  return <DashboardPage />;
}

export default Router;
