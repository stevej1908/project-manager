const { pool } = require('../config/database');

// Get all projects for the current user
const getProjects = async (req, res) => {
  try {
    const { archived } = req.query;
    const userId = req.user.id;

    // Get projects owned by user or shared with user
    let query = `
      SELECT DISTINCT p.*, u.name as owner_name, u.email as owner_email,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'done') as completed_count
      FROM projects p
      INNER JOIN users u ON p.owner_id = u.id
      LEFT JOIN project_members pm ON p.id = pm.project_id
      WHERE (p.owner_id = $1 OR pm.user_id = $1)
    `;

    const params = [userId];

    if (archived !== undefined) {
      query += ` AND p.is_archived = $2`;
      params.push(archived === 'true');
    }

    query += ` ORDER BY p.updated_at DESC`;

    const result = await pool.query(query, params);

    res.json({ projects: result.rows });
  } catch (error) {
    console.error('Error getting projects:', error);
    res.status(500).json({
      error: 'Failed to get projects',
      message: error.message
    });
  }
};

// Get single project by ID
const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if user has access to this project
    const result = await pool.query(
      `SELECT p.*, u.name as owner_name, u.email as owner_email
       FROM projects p
       INNER JOIN users u ON p.owner_id = u.id
       LEFT JOIN project_members pm ON p.id = pm.project_id
       WHERE p.id = $1 AND (p.owner_id = $2 OR pm.user_id = $2)`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Project not found or access denied'
      });
    }

    // Get project members
    const membersResult = await pool.query(
      `SELECT pm.id, pm.role, pm.added_at, u.id as user_id, u.name, u.email, u.picture
       FROM project_members pm
       INNER JOIN users u ON pm.user_id = u.id
       WHERE pm.project_id = $1`,
      [id]
    );

    const project = result.rows[0];
    project.members = membersResult.rows;

    res.json({ project });
  } catch (error) {
    console.error('Error getting project:', error);
    res.status(500).json({
      error: 'Failed to get project',
      message: error.message
    });
  }
};

// Create new project
const createProject = async (req, res) => {
  try {
    const { name, description, color } = req.body;
    const userId = req.user.id;

    if (!name) {
      return res.status(400).json({
        error: 'Project name is required'
      });
    }

    const result = await pool.query(
      `INSERT INTO projects (name, description, color, owner_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, description, color || '#0ea5e9', userId]
    );

    res.status(201).json({ project: result.rows[0] });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({
      error: 'Failed to create project',
      message: error.message
    });
  }
};

// Update project
const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, color, is_archived } = req.body;
    const userId = req.user.id;

    // Check if user is owner or has editor role
    const accessCheck = await pool.query(
      `SELECT p.owner_id, pm.role
       FROM projects p
       LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $2
       WHERE p.id = $1`,
      [id, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const { owner_id, role } = accessCheck.rows[0];
    if (owner_id !== userId && role !== 'editor') {
      return res.status(403).json({
        error: 'You do not have permission to edit this project'
      });
    }

    const result = await pool.query(
      `UPDATE projects
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           color = COALESCE($3, color),
           is_archived = COALESCE($4, is_archived),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [name, description, color, is_archived, id]
    );

    res.json({ project: result.rows[0] });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({
      error: 'Failed to update project',
      message: error.message
    });
  }
};

// Delete project
const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if user is owner
    const ownerCheck = await pool.query(
      'SELECT owner_id FROM projects WHERE id = $1',
      [id]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (ownerCheck.rows[0].owner_id !== userId) {
      return res.status(403).json({
        error: 'Only the project owner can delete the project'
      });
    }

    await pool.query('DELETE FROM projects WHERE id = $1', [id]);

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({
      error: 'Failed to delete project',
      message: error.message
    });
  }
};

// Share project with user
const shareProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, role } = req.body;
    const userId = req.user.id;

    if (!email || !role) {
      return res.status(400).json({
        error: 'Email and role are required'
      });
    }

    if (!['editor', 'viewer'].includes(role)) {
      return res.status(400).json({
        error: 'Role must be either "editor" or "viewer"'
      });
    }

    // Check if user is owner
    const ownerCheck = await pool.query(
      'SELECT owner_id FROM projects WHERE id = $1',
      [id]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (ownerCheck.rows[0].owner_id !== userId) {
      return res.status(403).json({
        error: 'Only the project owner can share the project'
      });
    }

    // Find user by email
    const userResult = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User with this email not found. They need to sign up first.'
      });
    }

    const shareWithUserId = userResult.rows[0].id;

    // Check if already shared
    const existingShare = await pool.query(
      'SELECT id FROM project_members WHERE project_id = $1 AND user_id = $2',
      [id, shareWithUserId]
    );

    if (existingShare.rows.length > 0) {
      // Update existing share
      await pool.query(
        'UPDATE project_members SET role = $1 WHERE project_id = $2 AND user_id = $3',
        [role, id, shareWithUserId]
      );
    } else {
      // Create new share
      await pool.query(
        'INSERT INTO project_members (project_id, user_id, role, added_by) VALUES ($1, $2, $3, $4)',
        [id, shareWithUserId, role, userId]
      );
    }

    res.json({ message: 'Project shared successfully' });
  } catch (error) {
    console.error('Error sharing project:', error);
    res.status(500).json({
      error: 'Failed to share project',
      message: error.message
    });
  }
};

// Remove user from project
const removeProjectMember = async (req, res) => {
  try {
    const { id, memberId } = req.params;
    const userId = req.user.id;

    // Check if user is owner
    const ownerCheck = await pool.query(
      'SELECT owner_id FROM projects WHERE id = $1',
      [id]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (ownerCheck.rows[0].owner_id !== userId) {
      return res.status(403).json({
        error: 'Only the project owner can remove members'
      });
    }

    await pool.query(
      'DELETE FROM project_members WHERE id = $1 AND project_id = $2',
      [memberId, id]
    );

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Error removing project member:', error);
    res.status(500).json({
      error: 'Failed to remove member',
      message: error.message
    });
  }
};

module.exports = {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  shareProject,
  removeProjectMember
};
