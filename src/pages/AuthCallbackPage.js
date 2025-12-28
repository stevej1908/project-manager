import React, { useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

export default function AuthCallbackPage() {
  const { setToken } = useContext(AuthContext);

  useEffect(() => {
    // Get token from URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const error = params.get('error');

    // Debug info (console only)
    console.log('AuthCallback - Token found:', token ? 'Yes' : 'No');
    console.log('AuthCallback - Error param:', error);

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
  }, [setToken]);

  return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-900 font-semibold text-lg">Completing sign in...</p>
      </div>
    </div>
  );
}
