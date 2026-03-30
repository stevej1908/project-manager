const { pool } = require('../config/database');

// Get project-level dependencies
const getProjectDependencies = async (req, res) => {
  try {
    const { projectId } = req.query;
    const userId = req.user.id;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId query parameter is required' });
    }

    // Check access
    const accessCheck = await pool.query(
      `SELECT p.id FROM projects p
       LEFT JOIN project_members pm ON p.id = pm.project_id
       WHERE p.id = $1 AND (p.owner_id = $2 OR pm.user_id = $2)`,
      [projectId, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get all project dependencies where this project or its children are involved
    // Scope to the parent project tree
    const result = await pool.query(
      `SELECT pd.*,
        sp.name as source_name, sp.color as source_color,
        tp.name as target_name, tp.color as target_color
       FROM project_dependencies pd
       INNER JOIN projects sp ON pd.source_project_id = sp.id
       INNER JOIN projects tp ON pd.target_project_id = tp.id
       WHERE pd.source_project_id IN (
         SELECT id FROM projects WHERE parent_project_id = $1
       )
       OR pd.target_project_id IN (
         SELECT id FROM projects WHERE parent_project_id = $1
       )
       OR pd.source_project_id = $1
       OR pd.target_project_id = $1
       ORDER BY pd.created_at DESC`,
      [projectId]
    );

    res.json({ dependencies: result.rows });
  } catch (error) {
    console.error('Error getting project dependencies:', error);
    res.status(500).json({
      error: 'Failed to get project dependencies',
      message: error.message
    });
  }
};

// Create project-level dependency
const createProjectDependency = async (req, res) => {
  try {
    const {
      source_project_id,
      target_project_id,
      dependency_type,
      description
    } = req.body;
    const userId = req.user.id;

    if (!source_project_id || !target_project_id) {
      return res.status(400).json({
        error: 'source_project_id and target_project_id are required'
      });
    }

    // Validate both projects exist and user has access
    const projectsCheck = await pool.query(
      `SELECT p.id, p.parent_project_id, p.name
       FROM projects p
       LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $3
       WHERE p.id IN ($1, $2) AND (p.owner_id = $3 OR pm.user_id = $3)`,
      [source_project_id, target_project_id, userId]
    );

    if (projectsCheck.rows.length < 2) {
      return res.status(404).json({ error: 'One or both projects not found or access denied' });
    }

    // Validate they are siblings (share the same parent)
    const source = projectsCheck.rows.find(r => r.id === parseInt(source_project_id));
    const target = projectsCheck.rows.find(r => r.id === parseInt(target_project_id));

    if (source.parent_project_id !== target.parent_project_id) {
      return res.status(400).json({
        error: 'Project dependencies can only be created between sibling projects (same parent)'
      });
    }

    // Check for circular dependency
    const circularCheck = await pool.query(
      'SELECT check_project_circular_dependency($1, $2) as has_cycle',
      [source_project_id, target_project_id]
    );

    if (circularCheck.rows[0].has_cycle) {
      return res.status(400).json({
        error: 'Cannot create dependency: would create a circular dependency'
      });
    }

    const result = await pool.query(
      `INSERT INTO project_dependencies (source_project_id, target_project_id, dependency_type, description, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [source_project_id, target_project_id, dependency_type || 'finish_to_start', description, userId]
    );

    // Enrich response with project names
    const dep = result.rows[0];
    dep.source_name = source.name;
    dep.target_name = target.name;

    res.status(201).json({ dependency: dep });
  } catch (error) {
    console.error('Error creating project dependency:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'This project dependency already exists' });
    }
    res.status(500).json({
      error: 'Failed to create project dependency',
      message: error.message
    });
  }
};

// Update project-level dependency
const updateProjectDependency = async (req, res) => {
  try {
    const { id } = req.params;
    const { dependency_type, description } = req.body;
    const userId = req.user.id;

    // Check access via source project
    const accessCheck = await pool.query(
      `SELECT pd.id FROM project_dependencies pd
       INNER JOIN projects p ON pd.source_project_id = p.id
       LEFT JOIN project_members pm ON p.id = pm.project_id
       WHERE pd.id = $1 AND (p.owner_id = $2 OR pm.user_id = $2)`,
      [id, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Dependency not found or access denied' });
    }

    const result = await pool.query(
      `UPDATE project_dependencies
       SET dependency_type = COALESCE($1, dependency_type),
           description = COALESCE($2, description)
       WHERE id = $3
       RETURNING *`,
      [dependency_type, description, id]
    );

    res.json({ dependency: result.rows[0] });
  } catch (error) {
    console.error('Error updating project dependency:', error);
    res.status(500).json({
      error: 'Failed to update project dependency',
      message: error.message
    });
  }
};

// Delete project-level dependency
const deleteProjectDependency = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check access
    const accessCheck = await pool.query(
      `SELECT pd.id FROM project_dependencies pd
       INNER JOIN projects p ON pd.source_project_id = p.id
       LEFT JOIN project_members pm ON p.id = pm.project_id
       WHERE pd.id = $1 AND (p.owner_id = $2 OR pm.user_id = $2)`,
      [id, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Dependency not found or access denied' });
    }

    await pool.query('DELETE FROM project_dependencies WHERE id = $1', [id]);

    res.json({ message: 'Project dependency deleted successfully' });
  } catch (error) {
    console.error('Error deleting project dependency:', error);
    res.status(500).json({
      error: 'Failed to delete project dependency',
      message: error.message
    });
  }
};

module.exports = {
  getProjectDependencies,
  createProjectDependency,
  updateProjectDependency,
  deleteProjectDependency
};
