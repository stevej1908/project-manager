import React from 'react';
import { AuthProvider } from './context/AuthContext';
import { ProjectProvider } from './context/ProjectContext';
import Router from './Router';

function App() {
  return (
    <AuthProvider>
      <ProjectProvider>
        <Router />
      </ProjectProvider>
    </AuthProvider>
  );
}

export default App;
