import React, { createContext, useState } from 'react';
import { projectsAPI, tasksAPI, projectDependenciesAPI } from '../services/api';

export const ProjectContext = createContext();

export function ProjectProvider({ children }) {
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [childProjects, setChildProjects] = useState([]);
  const [parentProject, setParentProject] = useState(null);
  const [projectDependencies, setProjectDependencies] = useState([]);

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
      setChildProjects(project.children || []);
      setParentProject(project.parent || null);
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

  const loadChildProjects = async (projectId) => {
    try {
      const { children: childData } = await projectsAPI.getChildren(projectId);
      setChildProjects(childData);
      return childData;
    } catch (error) {
      console.error('Error loading child projects:', error);
      return [];
    }
  };

  const loadProjectTree = async (projectId) => {
    try {
      const data = await projectsAPI.getTree(projectId);
      return data;
    } catch (error) {
      console.error('Error loading project tree:', error);
      return { tree: [], all_tasks: [] };
    }
  };

  const reorderChildProjects = async (parentId, orderedChildren) => {
    try {
      await projectsAPI.reorder(parentId, orderedChildren);
      setChildProjects(prev => {
        const updated = [...prev];
        for (const child of orderedChildren) {
          const idx = updated.findIndex(c => c.id === child.id);
          if (idx !== -1) {
            updated[idx] = { ...updated[idx], position: child.position };
          }
        }
        return updated.sort((a, b) => a.position - b.position);
      });
    } catch (error) {
      console.error('Error reordering projects:', error);
      throw error;
    }
  };

  const loadProjectDependencies = async (projectId) => {
    try {
      const { dependencies } = await projectDependenciesAPI.getAll(projectId);
      setProjectDependencies(dependencies);
      return dependencies;
    } catch (error) {
      console.error('Error loading project dependencies:', error);
      return [];
    }
  };

  const createProject = async (data) => {
    try {
      const { project } = await projectsAPI.create(data);
      if (data.parent_project_id) {
        // Refresh children of current project
        setChildProjects(prev => [...prev, project]);
      } else {
        setProjects([project, ...projects]);
      }
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

  const deleteProject = async (id, deleteChildren = false) => {
    try {
      await projectsAPI.delete(id, deleteChildren);
      setProjects(projects.filter((p) => p.id !== id));
      setChildProjects(prev => prev.filter(p => p.id !== id));
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
        childProjects,
        parentProject,
        projectDependencies,
        loadProjects,
        loadProject,
        loadTasks,
        loadChildProjects,
        loadProjectTree,
        reorderChildProjects,
        loadProjectDependencies,
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
