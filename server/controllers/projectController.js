const { pool } = require('../config/database');

// Get all projects for the current user
const getProjects = async (req, res) => {
  try {
    const { archived, parent_id, tree } = req.query;
    const userId = req.user.id;

    // If tree=true, return full hierarchy
    if (tree === 'true') {
      const result = await pool.query(
        `WITH RECURSIVE project_tree AS (
          SELECT p.*, u.name as owner_name, u.email as owner_email,
            (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
            (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'done') as completed_count,
            (SELECT COUNT(*) FROM projects c WHERE c.parent_project_id = p.id) as child_count
          FROM projects p
          INNER JOIN users u ON p.owner_id = u.id
          LEFT JOIN project_members pm ON p.id = pm.project_id
          WHERE p.parent_project_id IS NULL
            AND (p.owner_id = $1 OR pm.user_id = $1)

          UNION ALL

          SELECT p.*, u.name as owner_name, u.email as owner_email,
            (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
            (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'done') as completed_count,
            (SELECT COUNT(*) FROM projects c WHERE c.parent_project_id = p.id) as child_count
          FROM projects p
          INNER JOIN users u ON p.owner_id = u.id
          INNER JOIN project_tree pt ON p.parent_project_id = pt.id
        )
        SELECT DISTINCT * FROM project_tree ORDER BY depth, position`,
        [userId]
      );

      res.json({ projects: result.rows });
      return;
    }

    // If parent_id specified, return children of that project
    if (parent_id) {
      const result = await pool.query(
        `SELECT DISTINCT p.*, u.name as owner_name, u.email as owner_email,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'done') as completed_count,
          (SELECT COUNT(*) FROM projects c WHERE c.parent_project_id = p.id) as child_count
        FROM projects p
        INNER JOIN users u ON p.owner_id = u.id
        LEFT JOIN project_members pm ON p.id = pm.project_id
        WHERE p.parent_project_id = $1
          AND (p.owner_id = $2 OR pm.user_id = $2)
        ORDER BY p.position, p.created_at`,
        [parent_id, userId]
      );

      res.json({ projects: result.rows });
      return;
    }

    // Default: return top-level projects only (parent_project_id IS NULL)
    let query = `
      SELECT DISTINCT p.*, u.name as owner_name, u.email as owner_email,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'done') as completed_count,
        (SELECT COUNT(*) FROM projects c WHERE c.parent_project_id = p.id) as child_count,
        desc_counts.descendant_task_count,
        desc_counts.descendant_completed_count
      FROM projects p
      INNER JOIN users u ON p.owner_id = u.id
      LEFT JOIN project_members pm ON p.id = pm.project_id
      LEFT JOIN LATERAL (
        WITH RECURSIVE desc_projects AS (
          SELECT id FROM projects WHERE parent_project_id = p.id
          UNION ALL
          SELECT pr.id FROM projects pr JOIN desc_projects dp ON pr.parent_project_id = dp.id
        )
        SELECT
          COALESCE(COUNT(*), 0) as descendant_task_count,
          COALESCE(COUNT(*) FILTER (WHERE t.status = 'done'), 0) as descendant_completed_count
        FROM tasks t
        WHERE t.project_id IN (SELECT id FROM desc_projects)
      ) desc_counts ON true
      WHERE (p.owner_id = $1 OR pm.user_id = $1)
        AND p.parent_project_id IS NULL
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

    // Get child projects with task summaries
    const childrenResult = await pool.query(
      `SELECT p.id, p.name, p.color, p.depth, p.position, p.description,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'done') as completed_count,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'in_progress') as in_progress_count
       FROM projects p
       WHERE p.parent_project_id = $1
       ORDER BY p.position, p.created_at`,
      [id]
    );

    // Get parent project info if this is a child
    const project = result.rows[0];
    let parentProject = null;
    if (project.parent_project_id) {
      const parentResult = await pool.query(
        `SELECT id, name, color, parent_project_id FROM projects WHERE id = $1`,
        [project.parent_project_id]
      );
      if (parentResult.rows.length > 0) {
        parentProject = parentResult.rows[0];
      }
    }

    // Get sibling projects (same parent, excluding self)
    let siblings = [];
    if (project.parent_project_id) {
      const siblingResult = await pool.query(
        `SELECT p.id, p.name, p.color, p.position,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count
         FROM projects p
         WHERE p.parent_project_id = $1 AND p.id != $2
         ORDER BY p.position, p.created_at`,
        [project.parent_project_id, id]
      );
      siblings = siblingResult.rows;
    }

    project.members = membersResult.rows;
    project.children = childrenResult.rows;
    project.parent = parentProject;
    project.sibling_projects = siblings;
    project.child_count = childrenResult.rows.length;

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
    const { name, description, color, parent_project_id } = req.body;
    const userId = req.user.id;

    if (!name) {
      return res.status(400).json({
        error: 'Project name is required'
      });
    }

    let depth = 0;
    let position = 0;

    // If creating a child project, validate parent
    if (parent_project_id) {
      // Check parent exists and user has access
      const parentCheck = await pool.query(
        `SELECT p.id, p.depth, p.owner_id, pm.role
         FROM projects p
         LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $2
         WHERE p.id = $1 AND (p.owner_id = $2 OR pm.user_id = $2)`,
        [parent_project_id, userId]
      );

      if (parentCheck.rows.length === 0) {
        return res.status(404).json({
          error: 'Parent project not found or access denied'
        });
      }

      const parent = parentCheck.rows[0];

      // Check max depth
      if (parent.depth >= 2) {
        return res.status(400).json({
          error: 'Maximum project nesting depth (3 levels) reached'
        });
      }

      depth = parent.depth + 1;

      // Get next position among siblings
      const posResult = await pool.query(
        `SELECT COALESCE(MAX(position), -1) + 1 as next_pos
         FROM projects WHERE parent_project_id = $1`,
        [parent_project_id]
      );
      position = posResult.rows[0].next_pos;
    }

    const result = await pool.query(
      `INSERT INTO projects (name, description, color, owner_id, parent_project_id, depth, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name, description, color || '#0ea5e9', userId, parent_project_id || null, depth, position]
    );

    const newProject = result.rows[0];

    // If child project, copy parent's members (dynamic inheritance)
    if (parent_project_id) {
      await pool.query(
        `INSERT INTO project_members (project_id, user_id, role, added_by)
         SELECT $1, pm.user_id, pm.role, $2
         FROM project_members pm
         WHERE pm.project_id = $3
         ON CONFLICT (project_id, user_id) DO NOTHING`,
        [newProject.id, userId, parent_project_id]
      );
    }

    res.status(201).json({ project: newProject });
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
    const { name, description, color, is_archived, parent_project_id } = req.body;
    const userId = req.user.id;

    // Check if user is owner or has editor role
    const accessCheck = await pool.query(
      `SELECT p.owner_id, p.parent_project_id as current_parent, p.depth, pm.role
       FROM projects p
       LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $2
       WHERE p.id = $1`,
      [id, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const { owner_id, role, current_parent } = accessCheck.rows[0];
    if (owner_id !== userId && role !== 'editor') {
      return res.status(403).json({
        error: 'You do not have permission to edit this project'
      });
    }

    // Handle parent_project_id change (re-parenting)
    if (parent_project_id !== undefined && parent_project_id !== current_parent) {
      if (parent_project_id !== null) {
        // Can't parent to self
        if (parseInt(parent_project_id) === parseInt(id)) {
          return res.status(400).json({ error: 'A project cannot be its own parent' });
        }

        // Check new parent exists
        const newParent = await pool.query(
          `SELECT id, depth FROM projects WHERE id = $1`,
          [parent_project_id]
        );

        if (newParent.rows.length === 0) {
          return res.status(404).json({ error: 'New parent project not found' });
        }

        // Check depth would not exceed limit
        // Get max depth of descendants of this project
        const descDepth = await pool.query(
          `WITH RECURSIVE desc AS (
            SELECT id, depth FROM projects WHERE parent_project_id = $1
            UNION ALL
            SELECT p.id, p.depth FROM projects p JOIN desc d ON p.parent_project_id = d.id
          )
          SELECT COALESCE(MAX(depth), -1) as max_depth FROM desc`,
          [id]
        );

        const currentMaxDescDepth = descDepth.rows[0].max_depth;
        const depthDiff = currentMaxDescDepth >= 0 ? (currentMaxDescDepth - accessCheck.rows[0].depth) : 0;
        const newDepth = newParent.rows[0].depth + 1;

        if (newDepth + depthDiff >= 3) {
          return res.status(400).json({
            error: 'Moving this project would exceed the maximum nesting depth (3 levels)'
          });
        }

        // Check not creating a cycle (can't parent to own descendant)
        const cycleCheck = await pool.query(
          `WITH RECURSIVE desc AS (
            SELECT id FROM projects WHERE parent_project_id = $1
            UNION ALL
            SELECT p.id FROM projects p JOIN desc d ON p.parent_project_id = d.id
          )
          SELECT EXISTS(SELECT 1 FROM desc WHERE id = $2) as is_descendant`,
          [id, parent_project_id]
        );

        if (cycleCheck.rows[0].is_descendant) {
          return res.status(400).json({
            error: 'Cannot move a project under one of its own descendants'
          });
        }
      }
    }

    // Build SET clause dynamically to handle NULL parent_project_id correctly
    const setClauses = [
      'name = COALESCE($1, name)',
      'description = COALESCE($2, description)',
      'color = COALESCE($3, color)',
      'is_archived = COALESCE($4, is_archived)',
      'updated_at = CURRENT_TIMESTAMP'
    ];
    const queryParams = [name, description, color, is_archived];

    // parent_project_id needs special handling: NULL is a valid value (move to top-level)
    if (parent_project_id !== undefined) {
      setClauses.push(`parent_project_id = $5`);
      queryParams.push(parent_project_id);
      queryParams.push(id);
      // id is $6
    } else {
      queryParams.push(id);
      // id is $5
    }

    const idParam = parent_project_id !== undefined ? '$6' : '$5';
    const result = await pool.query(
      `UPDATE projects SET ${setClauses.join(', ')} WHERE id = ${idParam} RETURNING *`,
      queryParams
    );

    // If parent changed, recalculate depth for this project and descendants
    if (parent_project_id !== undefined && parent_project_id !== current_parent) {
      const newDepth = parent_project_id === null ? 0 : (
        await pool.query('SELECT depth FROM projects WHERE id = $1', [parent_project_id])
      ).rows[0].depth + 1;

      const depthShift = newDepth - accessCheck.rows[0].depth;

      // Update this project's depth
      await pool.query('UPDATE projects SET depth = $1 WHERE id = $2', [newDepth, id]);

      // Update all descendants' depth
      if (depthShift !== 0) {
        await pool.query(
          `WITH RECURSIVE desc AS (
            SELECT id FROM projects WHERE parent_project_id = $1
            UNION ALL
            SELECT p.id FROM projects p JOIN desc d ON p.parent_project_id = d.id
          )
          UPDATE projects SET depth = depth + $2 WHERE id IN (SELECT id FROM desc)`,
          [id, depthShift]
        );
      }
    }

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
    const { delete_children } = req.query;
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

    if (delete_children === 'true') {
      // Recursively delete all descendants first
      await pool.query(
        `WITH RECURSIVE desc AS (
          SELECT id FROM projects WHERE parent_project_id = $1
          UNION ALL
          SELECT p.id FROM projects p JOIN desc d ON p.parent_project_id = d.id
        )
        DELETE FROM projects WHERE id IN (SELECT id FROM desc)`,
        [id]
      );
    } else {
      // Children become top-level (ON DELETE SET NULL handles the FK)
      // But we need to reset their depth
      await pool.query(
        `UPDATE projects SET depth = 0, parent_project_id = NULL
         WHERE parent_project_id = $1`,
        [id]
      );
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

    // Also share with all child projects (dynamic inheritance)
    await pool.query(
      `WITH RECURSIVE desc AS (
        SELECT id FROM projects WHERE parent_project_id = $1
        UNION ALL
        SELECT p.id FROM projects p JOIN desc d ON p.parent_project_id = d.id
      )
      INSERT INTO project_members (project_id, user_id, role, added_by)
      SELECT d.id, $2, $3, $4
      FROM desc d
      ON CONFLICT (project_id, user_id) DO UPDATE SET role = $3`,
      [id, shareWithUserId, role, userId]
    );

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

// Get direct child projects
const getProjectChildren = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check access to parent
    const accessCheck = await pool.query(
      `SELECT p.id FROM projects p
       LEFT JOIN project_members pm ON p.id = pm.project_id
       WHERE p.id = $1 AND (p.owner_id = $2 OR pm.user_id = $2)`,
      [id, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    const result = await pool.query(
      `SELECT p.id, p.name, p.description, p.color, p.depth, p.position,
        p.created_at, p.updated_at,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'done') as completed_count,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'in_progress') as in_progress_count
       FROM projects p
       WHERE p.parent_project_id = $1
       ORDER BY p.position, p.created_at`,
      [id]
    );

    res.json({ children: result.rows });
  } catch (error) {
    console.error('Error getting project children:', error);
    res.status(500).json({
      error: 'Failed to get project children',
      message: error.message
    });
  }
};

// Get full descendant tree
const getProjectTree = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check access
    const accessCheck = await pool.query(
      `SELECT p.id FROM projects p
       LEFT JOIN project_members pm ON p.id = pm.project_id
       WHERE p.id = $1 AND (p.owner_id = $2 OR pm.user_id = $2)`,
      [id, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    // Get full tree
    const treeResult = await pool.query(
      `WITH RECURSIVE tree AS (
        SELECT p.id, p.name, p.color, p.depth, p.position, p.parent_project_id,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'done') as completed_count,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'in_progress') as in_progress_count
        FROM projects p WHERE p.id = $1

        UNION ALL

        SELECT p.id, p.name, p.color, p.depth, p.position, p.parent_project_id,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'done') as completed_count,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'in_progress') as in_progress_count
        FROM projects p
        INNER JOIN tree t ON p.parent_project_id = t.id
      )
      SELECT * FROM tree ORDER BY depth, position`,
      [id]
    );

    // Also get all tasks for child projects (for combined Gantt)
    const tasksResult = await pool.query(
      `WITH RECURSIVE desc AS (
        SELECT id FROM projects WHERE parent_project_id = $1
        UNION ALL
        SELECT p.id FROM projects p JOIN desc d ON p.parent_project_id = d.id
      )
      SELECT t.*, p.name as project_name, p.color as project_color
      FROM tasks t
      INNER JOIN desc d ON t.project_id = d.id
      INNER JOIN projects p ON t.project_id = p.id
      ORDER BY p.position, t.position`,
      [id]
    );

    res.json({
      tree: treeResult.rows,
      all_tasks: tasksResult.rows
    });
  } catch (error) {
    console.error('Error getting project tree:', error);
    res.status(500).json({
      error: 'Failed to get project tree',
      message: error.message
    });
  }
};

// Reorder child projects within a parent
const reorderProjects = async (req, res) => {
  try {
    const { id } = req.params;
    const { children } = req.body;
    const userId = req.user.id;

    if (!children || !Array.isArray(children)) {
      return res.status(400).json({ error: 'children array is required' });
    }

    // Check access to parent
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
      return res.status(403).json({ error: 'No permission to reorder' });
    }

    // Validate all children belong to this parent
    const childIds = children.map(c => c.id);
    const validation = await pool.query(
      `SELECT id FROM projects WHERE parent_project_id = $1 AND id = ANY($2::int[])`,
      [id, childIds]
    );

    if (validation.rows.length !== childIds.length) {
      return res.status(400).json({ error: 'Some projects do not belong to this parent' });
    }

    // Batch update positions
    for (const child of children) {
      await pool.query(
        'UPDATE projects SET position = $1 WHERE id = $2',
        [child.position, child.id]
      );
    }

    res.json({ message: 'Projects reordered successfully' });
  } catch (error) {
    console.error('Error reordering projects:', error);
    res.status(500).json({
      error: 'Failed to reorder projects',
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
  removeProjectMember,
  getProjectChildren,
  getProjectTree,
  reorderProjects
};
