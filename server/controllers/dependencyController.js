const { pool } = require('../config/database');

// Get all dependencies for a project
const getDependencies = async (req, res) => {
  try {
    const { projectId } = req.query;
    const userId = req.user.id;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    // Check if user has access to the project
    const accessCheck = await pool.query(
      `SELECT p.id FROM projects p
       LEFT JOIN project_members pm ON p.id = pm.project_id
       WHERE p.id = $1 AND (p.owner_id = $2 OR pm.user_id = $2)`,
      [projectId, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }

    // Get all dependencies for tasks in this project
    const result = await pool.query(
      `SELECT td.*
       FROM task_dependencies td
       INNER JOIN tasks t1 ON td.dependent_task_id = t1.id
       INNER JOIN tasks t2 ON td.depends_on_task_id = t2.id
       WHERE t1.project_id = $1
       ORDER BY td.created_at DESC`,
      [projectId]
    );

    res.json({ dependencies: result.rows });
  } catch (error) {
    console.error('Error getting dependencies:', error);
    res.status(500).json({
      error: 'Failed to get dependencies',
      message: error.message
    });
  }
};

// Create task dependency
const createDependency = async (req, res) => {
  try {
    const {
      dependent_task_id,
      depends_on_task_id,
      dependency_type,
      lag_days,
      from_point,
      to_point
    } = req.body;
    const userId = req.user.id;

    if (!dependent_task_id || !depends_on_task_id) {
      return res.status(400).json({
        error: 'Both dependent_task_id and depends_on_task_id are required'
      });
    }

    // Validate both tasks exist and user has access
    const tasksCheck = await pool.query(
      `SELECT t.id, t.project_id, p.owner_id, pm.role
       FROM tasks t
       INNER JOIN projects p ON t.project_id = p.id
       LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $3
       WHERE t.id IN ($1, $2)`,
      [dependent_task_id, depends_on_task_id, userId]
    );

    if (tasksCheck.rows.length < 2) {
      return res.status(404).json({ error: 'One or both tasks not found' });
    }

    // Check if tasks are in different projects
    const projectIds = [...new Set(tasksCheck.rows.map(r => r.project_id))];
    let isCrossProject = false;

    if (projectIds.length > 1) {
      // Cross-project dependency: validate both projects are siblings (same parent)
      const projectParents = await pool.query(
        `SELECT id, parent_project_id FROM projects WHERE id = ANY($1::int[])`,
        [projectIds]
      );

      const parents = projectParents.rows;
      if (parents.length < 2 || parents[0].parent_project_id !== parents[1].parent_project_id) {
        return res.status(400).json({
          error: 'Cross-project dependencies can only be created between tasks in sibling projects (same parent)'
        });
      }

      if (parents[0].parent_project_id === null) {
        return res.status(400).json({
          error: 'Cross-project dependencies require projects to share a common parent project'
        });
      }

      isCrossProject = true;
    }

    // Check for circular dependency
    const circularCheck = await pool.query(
      'SELECT check_circular_dependency($1, $2) as has_cycle',
      [dependent_task_id, depends_on_task_id]
    );

    if (circularCheck.rows[0].has_cycle) {
      return res.status(400).json({
        error: 'Cannot create dependency: would create a circular dependency'
      });
    }

    // Create the dependency
    const result = await pool.query(
      `INSERT INTO task_dependencies (
        dependent_task_id, depends_on_task_id, dependency_type,
        lag_days, from_point, to_point, created_by, is_cross_project
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        dependent_task_id,
        depends_on_task_id,
        dependency_type || 'finish_to_start',
        lag_days || 0,
        from_point || 100,
        to_point || 0,
        userId,
        isCrossProject
      ]
    );

    res.status(201).json({ dependency: result.rows[0] });
  } catch (error) {
    console.error('Error creating dependency:', error);
    if (error.code === '23505') {
      // Unique constraint violation
      return res.status(400).json({
        error: 'This dependency already exists'
      });
    }
    res.status(500).json({
      error: 'Failed to create dependency',
      message: error.message
    });
  }
};

// Update task dependency
const updateDependency = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      dependency_type,
      lag_days,
      from_point,
      to_point
    } = req.body;
    const userId = req.user.id;

    // Check if user has access to the dependency
    const accessCheck = await pool.query(
      `SELECT td.id FROM task_dependencies td
       INNER JOIN tasks t ON td.dependent_task_id = t.id
       INNER JOIN projects p ON t.project_id = p.id
       LEFT JOIN project_members pm ON p.id = pm.project_id
       WHERE td.id = $1 AND (p.owner_id = $2 OR pm.user_id = $2)`,
      [id, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Dependency not found or access denied'
      });
    }

    const result = await pool.query(
      `UPDATE task_dependencies
       SET dependency_type = COALESCE($1, dependency_type),
           lag_days = COALESCE($2, lag_days),
           from_point = COALESCE($3, from_point),
           to_point = COALESCE($4, to_point)
       WHERE id = $5
       RETURNING *`,
      [dependency_type, lag_days, from_point, to_point, id]
    );

    res.json({ dependency: result.rows[0] });
  } catch (error) {
    console.error('Error updating dependency:', error);
    res.status(500).json({
      error: 'Failed to update dependency',
      message: error.message
    });
  }
};

// Delete task dependency
const deleteDependency = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if user has access
    const accessCheck = await pool.query(
      `SELECT td.id FROM task_dependencies td
       INNER JOIN tasks t ON td.dependent_task_id = t.id
       INNER JOIN projects p ON t.project_id = p.id
       LEFT JOIN project_members pm ON p.id = pm.project_id
       WHERE td.id = $1 AND (p.owner_id = $2 OR pm.user_id = $2)`,
      [id, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Dependency not found or access denied'
      });
    }

    await pool.query('DELETE FROM task_dependencies WHERE id = $1', [id]);

    res.json({ message: 'Dependency deleted successfully' });
  } catch (error) {
    console.error('Error deleting dependency:', error);
    res.status(500).json({
      error: 'Failed to delete dependency',
      message: error.message
    });
  }
};

// Get dependencies for a specific task
const getTaskDependencies = async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;

    // Check if user has access to the task
    const accessCheck = await pool.query(
      `SELECT t.id FROM tasks t
       INNER JOIN projects p ON t.project_id = p.id
       LEFT JOIN project_members pm ON p.id = pm.project_id
       WHERE t.id = $1 AND (p.owner_id = $2 OR pm.user_id = $2)`,
      [taskId, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found or access denied' });
    }

    // Get dependencies where this task depends on others
    const dependsOn = await pool.query(
      `SELECT td.*, t.title as task_title, t.status, t.end_date
       FROM task_dependencies td
       INNER JOIN tasks t ON td.depends_on_task_id = t.id
       WHERE td.dependent_task_id = $1`,
      [taskId]
    );

    // Get dependencies where other tasks depend on this one
    const blockedBy = await pool.query(
      `SELECT td.*, t.title as task_title, t.status, t.start_date
       FROM task_dependencies td
       INNER JOIN tasks t ON td.dependent_task_id = t.id
       WHERE td.depends_on_task_id = $1`,
      [taskId]
    );

    res.json({
      depends_on: dependsOn.rows,
      blocks: blockedBy.rows
    });
  } catch (error) {
    console.error('Error getting task dependencies:', error);
    res.status(500).json({
      error: 'Failed to get task dependencies',
      message: error.message
    });
  }
};

// Get cross-project task dependencies
const getCrossProjectDependencies = async (req, res) => {
  try {
    const { parent_project_id } = req.query;
    const userId = req.user.id;

    if (!parent_project_id) {
      return res.status(400).json({ error: 'parent_project_id query parameter is required' });
    }

    // Check access to parent project
    const accessCheck = await pool.query(
      `SELECT p.id FROM projects p
       LEFT JOIN project_members pm ON p.id = pm.project_id
       WHERE p.id = $1 AND (p.owner_id = $2 OR pm.user_id = $2)`,
      [parent_project_id, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get all cross-project dependencies where both tasks belong to children of the parent
    const result = await pool.query(
      `SELECT td.*,
        t1.title as dependent_task_title, t1.project_id as dependent_project_id,
        p1.name as dependent_project_name, p1.color as dependent_project_color,
        t2.title as depends_on_task_title, t2.project_id as depends_on_project_id,
        p2.name as depends_on_project_name, p2.color as depends_on_project_color
       FROM task_dependencies td
       INNER JOIN tasks t1 ON td.dependent_task_id = t1.id
       INNER JOIN tasks t2 ON td.depends_on_task_id = t2.id
       INNER JOIN projects p1 ON t1.project_id = p1.id
       INNER JOIN projects p2 ON t2.project_id = p2.id
       WHERE td.is_cross_project = true
         AND p1.parent_project_id = $1
         AND p2.parent_project_id = $1
       ORDER BY td.created_at DESC`,
      [parent_project_id]
    );

    res.json({ dependencies: result.rows });
  } catch (error) {
    console.error('Error getting cross-project dependencies:', error);
    res.status(500).json({
      error: 'Failed to get cross-project dependencies',
      message: error.message
    });
  }
};

module.exports = {
  getDependencies,
  createDependency,
  updateDependency,
  deleteDependency,
  getTaskDependencies,
  getCrossProjectDependencies
};
