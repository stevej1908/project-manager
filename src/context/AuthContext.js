import React, { createContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState({ type: 'dashboard' });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (token) {
        const { user: userData } = await authAPI.getCurrentUser();
        setUser(userData);
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      localStorage.removeItem('authToken');
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    try {
      const { authUrl } = await authAPI.getAuthUrl();
      window.location.href = authUrl;
    } catch (error) {
      console.error('Error getting auth URL:', error);
      alert('Failed to initiate login. Please try again.');
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Error logging out:', error);
    } finally {
      localStorage.removeItem('authToken');
      setUser(null);
      setCurrentView({ type: 'dashboard' });
    }
  };

  const setToken = async (token) => {
    try {
      localStorage.setItem('authToken', token);
      // Verify storage worked (Safari ITP fix)
      const stored = localStorage.getItem('authToken');
      if (stored !== token) {
        console.error('localStorage failed - Safari ITP may be blocking');
        // Try setting again
        localStorage.setItem('authToken', token);
      }
      await checkAuth();
      return true;
    } catch (error) {
      console.error('Error setting token:', error);
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        currentView,
        setCurrentView,
        login,
        logout,
        setToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
