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
    const params = new URLSearchParams(window.location.search);
    const errorMessage = params.get('message') || params.get('error') || 'Unknown error';

    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-2xl p-8">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Authentication Error</h1>
          <p className="text-gray-600 mb-4">There was an error signing in. Please try again.</p>
          <div className="mb-6 bg-white border-2 border-red-200 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-2 font-semibold">ERROR DETAILS:</p>
            <pre className="text-left text-xs text-red-700 whitespace-pre-wrap break-all font-mono">
              {errorMessage}
            </pre>
          </div>
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
