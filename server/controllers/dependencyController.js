const { pool } = require('../config/database');
const privacy = require('../lib/privacy');

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
       WHERE p.id = $1 AND pm_project_visible(p.id, $2)`,
      [projectId, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ error: privacy.NOT_FOUND.project });
    }

    // Get all dependencies for tasks in this project
    const result = await pool.query(
      `SELECT td.*
       FROM task_dependencies td
       INNER JOIN tasks t1 ON td.dependent_task_id = t1.id
       INNER JOIN tasks t2 ON td.depends_on_task_id = t2.id
       WHERE t1.project_id = $1 AND pm_task_visible(t1.id, $2) AND pm_task_visible(t2.id, $2)
       ORDER BY td.created_at DESC`,
      [projectId, userId]
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
      `SELECT t.id, t.project_id, pm_project_role(t.project_id, $3) AS role
       FROM tasks t
       WHERE t.id IN ($1, $2) AND pm_task_visible(t.id, $3)`,
      [dependent_task_id, depends_on_task_id, userId]
    );

    if (tasksCheck.rows.length < 2) {
      return res.status(404).json({ error: 'One or both tasks not found' });
    }
    if (!tasksCheck.rows.every(r => privacy.canEdit(r.role))) {
      return res.status(403).json({ error: 'Viewers cannot add dependencies' });
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
       INNER JOIN tasks t2 ON td.depends_on_task_id = t2.id
       WHERE td.id = $1 AND pm_task_visible(t.id, $2) AND pm_task_visible(t2.id, $2)`,
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
       INNER JOIN tasks t2 ON td.depends_on_task_id = t2.id
       WHERE td.id = $1 AND pm_task_visible(t.id, $2) AND pm_task_visible(t2.id, $2)`,
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
       WHERE t.id = $1 AND pm_task_visible(t.id, $2)`,
      [taskId, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found or access denied' });
    }

    // Get dependencies where this task depends on others
    const dependsOn = await pool.query(
      `SELECT td.*, t.title as task_title, t.status, t.end_date,
              t.project_id, p.name as project_name
       FROM task_dependencies td
       INNER JOIN tasks t ON td.depends_on_task_id = t.id
       INNER JOIN projects p ON p.id = t.project_id
       WHERE td.dependent_task_id = $1 AND pm_task_visible(t.id, $2)`,
      [taskId, userId]
    );

    // Get dependencies where other tasks depend on this one
    const blockedBy = await pool.query(
      `SELECT td.*, t.title as task_title, t.status, t.start_date,
              t.project_id, p.name as project_name
       FROM task_dependencies td
       INNER JOIN tasks t ON td.dependent_task_id = t.id
       INNER JOIN projects p ON p.id = t.project_id
       WHERE td.depends_on_task_id = $1 AND pm_task_visible(t.id, $2)`,
      [taskId, userId]
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
       WHERE p.id = $1 AND pm_project_visible(p.id, $2)`,
      [parent_project_id, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ error: privacy.NOT_FOUND.project });
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
         AND pm_task_visible(t1.id, $2) AND pm_task_visible(t2.id, $2)
       ORDER BY td.created_at DESC`,
      [parent_project_id, userId]
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

// Task 047 (WES CRM handoff): links between a task in this project and a task in ANOTHER project.
// GET /api/dependencies/external?projectId=X
//   waits_on: tasks here that wait on a task elsewhere.  holds_up: tasks here that something elsewhere waits on.
// Each row names the other task and its project. A row whose other task this viewer can't see (Private)
// carries only { hidden: true } and is listed only while it still matters (the blocker is unfinished,
// or, for holds_up, this task is unfinished) - no title, id, project or count beyond that (task 042/045).
const DONE_STATUSES = ['done', 'completed'];
const getExternalDependencies = async (req, res) => {
  try {
    const { projectId } = req.query;
    const userId = req.user.id;
    if (!projectId) return res.status(400).json({ error: 'Project ID is required' });

    const access = await pool.query(
      `SELECT p.id, p.parent_project_id FROM projects p WHERE p.id = $1 AND pm_project_visible(p.id, $2)`,
      [projectId, userId]
    );
    if (access.rows.length === 0) return res.status(404).json({ error: privacy.NOT_FOUND.project });

    const rows = async (hereCol, thereCol) => (await pool.query(
      `SELECT td.id AS dependency_id, td.dependency_type,
              here.id AS task_id, here.status AS task_status,
              there.id AS other_task_id, there.title AS other_title, there.status AS other_status,
              there.project_id AS other_project_id, op.name AS other_project_name,
              op.parent_project_id AS other_parent_id,
              pm_task_visible(there.id, $2) AS visible
       FROM task_dependencies td
       INNER JOIN tasks here ON here.id = td.${hereCol}
       INNER JOIN tasks there ON there.id = td.${thereCol}
       INNER JOIN projects op ON op.id = there.project_id
       WHERE here.project_id = $1 AND there.project_id <> $1 AND pm_task_visible(here.id, $2)
       ORDER BY here.id, there.id`,
      [projectId, userId]
    )).rows;

    const parentId = access.rows[0].parent_project_id;
    const shape = (r, stillMatters) => {
      if (!r.visible) return stillMatters ? { dependency_id: r.dependency_id, task_id: r.task_id, hidden: true, other_done: false } : null;
      return {
        dependency_id: r.dependency_id, task_id: r.task_id, dependency_type: r.dependency_type,
        other_task_id: r.other_task_id, other_title: r.other_title, other_status: r.other_status,
        other_done: DONE_STATUSES.includes(r.other_status),
        other_project_id: r.other_project_id, other_project_name: r.other_project_name,
        // the combined Gantt that draws this link is the shared parent's
        shared_parent_id: parentId && r.other_parent_id === parentId ? parentId : null,
      };
    };
    const waitsOn = (await rows('dependent_task_id', 'depends_on_task_id'))
      .map(r => shape(r, !DONE_STATUSES.includes(r.other_status))).filter(Boolean);
    const holdsUp = (await rows('depends_on_task_id', 'dependent_task_id'))
      .map(r => shape(r, !DONE_STATUSES.includes(r.task_status))).filter(Boolean);

    let parent = null;
    if (parentId) {
      const p = await pool.query(`SELECT id, name FROM projects WHERE id = $1 AND pm_project_visible(id, $2)`, [parentId, userId]);
      parent = p.rows[0] || null;
    }
    res.json({ project_id: Number(projectId), parent, waits_on: waitsOn, holds_up: holdsUp });
  } catch (error) {
    console.error('Error getting external dependencies:', error);
    res.status(500).json({ error: 'Failed to get links to other projects', message: error.message });
  }
};

module.exports = {
  getExternalDependencies,
  getDependencies,
  createDependency,
  updateDependency,
  deleteDependency,
  getTaskDependencies,
  getCrossProjectDependencies
};
