import React, { useEffect, useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

export default function AuthCallbackPage() {
  const { setToken } = useContext(AuthContext);
  const [debugInfo, setDebugInfo] = useState('Initializing...');

  useEffect(() => {
    // Get token from URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const error = params.get('error');

    // Debug info
    const fullUrl = window.location.href;
    const search = window.location.search;

    console.log('AuthCallback - Full URL:', fullUrl);
    console.log('AuthCallback - Search params:', search);
    console.log('AuthCallback - Token found:', token ? 'Yes' : 'No');
    console.log('AuthCallback - Error param:', error);

    // Show debug info on screen for 2 seconds
    setDebugInfo(
      `URL: ${fullUrl}\n` +
      `Search: ${search}\n` +
      `Token: ${token ? 'FOUND (length: ' + token.length + ')' : 'NOT FOUND'}\n` +
      `Error: ${error || 'None'}\n` +
      `Will redirect in 2 seconds...`
    );

    // Wait 2 seconds before redirecting so user can see debug info
    const timer = setTimeout(() => {
      if (token) {
        console.log('AuthCallback - Setting token and redirecting to /');
        setToken(token);
        // Redirect to dashboard
        window.location.href = '/';
      } else {
        // No token, redirect to error
        console.log('AuthCallback - No token, redirecting to /auth/error');
        window.location.href = '/auth/error' + (error ? '?error=' + encodeURIComponent(error) : '');
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [setToken]);

  return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-2xl p-8">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-900 font-semibold text-lg">Completing sign in...</p>
        <div className="mt-6 bg-white border-2 border-gray-300 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-2 font-semibold">DEBUG INFO (will disappear):</p>
          <pre className="text-left text-xs text-gray-700 whitespace-pre-wrap break-all font-mono">
            {debugInfo}
          </pre>
        </div>
      </div>
    </div>
  );
}
