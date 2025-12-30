import React, { useEffect, useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';

export default function AuthCallbackPage() {
  const { setToken } = useContext(AuthContext);
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    // Get token from URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const error = params.get('error');

    console.log('AuthCallback - Token found:', token ? 'Yes' : 'No');
    console.log('AuthCallback - Error param:', error);

    // Countdown timer to show user
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
        }
        return prev - 1;
      });
    }, 1000);

    // Wait 3 seconds before redirecting to allow token storage to complete
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
    }, 3000);

    return () => {
      clearTimeout(timer);
      clearInterval(countdownInterval);
    };
  }, [setToken]);

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center max-w-md p-8">
        <div className="mb-8">
          <div className="inline-block animate-spin rounded-full h-24 w-24 border-8 border-blue-200 border-t-blue-600"></div>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Signing you in...</h2>
        <p className="text-gray-600 text-lg">Please wait {countdown} second{countdown !== 1 ? 's' : ''}</p>
        <div className="mt-6 bg-white/80 backdrop-blur rounded-lg p-4 shadow-lg">
          <p className="text-sm text-gray-500">Securing your session</p>
        </div>
      </div>
    </div>
  );
}
