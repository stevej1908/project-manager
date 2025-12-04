import React, { createContext, useState, useEffect } from 'react';
import { projectsAPI, tasksAPI } from '../services/api';

export const ProjectContext = createContext();

export function ProjectProvider({ children }) {
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const { projects: projectsData } = await projectsAPI.getAll();
      setProjects(projectsData);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProject = async (projectId) => {
    try {
      setLoading(true);
      const { project } = await projectsAPI.getById(projectId);
      setCurrentProject(project);
      await loadTasks(projectId);
    } catch (error) {
      console.error('Error loading project:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async (projectId) => {
    try {
      const { tasks: tasksData } = await tasksAPI.getAll(projectId);
      setTasks(tasksData);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  const createProject = async (data) => {
    try {
      const { project } = await projectsAPI.create(data);
      setProjects([project, ...projects]);
      return project;
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  };

  const updateProject = async (id, data) => {
    try {
      const { project } = await projectsAPI.update(id, data);
      setProjects(projects.map((p) => (p.id === id ? project : p)));
      if (currentProject && currentProject.id === id) {
        setCurrentProject(project);
      }
      return project;
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
  };

  const deleteProject = async (id) => {
    try {
      await projectsAPI.delete(id);
      setProjects(projects.filter((p) => p.id !== id));
      if (currentProject && currentProject.id === id) {
        setCurrentProject(null);
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  };

  const createTask = async (data) => {
    try {
      const { task } = await tasksAPI.create(data);
      setTasks([...tasks, task]);
      return task;
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  };

  const updateTask = async (id, data) => {
    try {
      const { task } = await tasksAPI.update(id, data);
      setTasks(tasks.map((t) => (t.id === id ? task : t)));
      return task;
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  };

  const deleteTask = async (id) => {
    try {
      await tasksAPI.delete(id);
      setTasks(tasks.filter((t) => t.id !== id));
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  };

  const reorderTasks = (reorderedTasks) => {
    setTasks(reorderedTasks);
  };

  return (
    <ProjectContext.Provider
      value={{
        projects,
        currentProject,
        tasks,
        loading,
        loadProjects,
        loadProject,
        loadTasks,
        createProject,
        updateProject,
        deleteProject,
        createTask,
        updateTask,
        deleteTask,
        reorderTasks,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}
