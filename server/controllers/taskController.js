const { pool } = require('../config/database');

// Get all tasks for a project
const getTasks = async (req, res) => {
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

    // Get tasks with assignees and sub-task info
    const result = await pool.query(
      `SELECT t.*, u.name as created_by_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', ta.id,
              'user_id', ta.user_id,
              'contact_name', ta.contact_name,
              'contact_email', ta.contact_email,
              'contact_google_id', ta.contact_google_id,
              'assigned_at', ta.assigned_at
            )
          ) FILTER (WHERE ta.id IS NOT NULL),
          '[]'::json
        ) as assignees,
        (SELECT COUNT(*) FROM task_attachments WHERE task_id = t.id) as attachment_count,
        (SELECT COUNT(*) FROM task_comments WHERE task_id = t.id) as comment_count,
        (SELECT COUNT(*) FROM tasks WHERE parent_task_id = t.id) as subtask_count,
        pt.title as parent_task_title
       FROM tasks t
       INNER JOIN users u ON t.created_by = u.id
       LEFT JOIN task_assignees ta ON t.id = ta.task_id
       LEFT JOIN tasks pt ON t.parent_task_id = pt.id
       WHERE t.project_id = $1
       GROUP BY t.id, u.name, pt.title
       ORDER BY t.depth_level ASC, t.position ASC, t.created_at DESC`,
      [projectId]
    );

    res.json({ tasks: result.rows });
  } catch (error) {
    console.error('Error getting tasks:', error);
    res.status(500).json({
      error: 'Failed to get tasks',
      message: error.message
    });
  }
};

// Get single task by ID
const getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get task with access check
    const result = await pool.query(
      `SELECT t.*, u.name as created_by_name, u.email as created_by_email
       FROM tasks t
       INNER JOIN users u ON t.created_by = u.id
       INNER JOIN projects p ON t.project_id = p.id
       LEFT JOIN project_members pm ON p.id = pm.project_id
       WHERE t.id = $1 AND (p.owner_id = $2 OR pm.user_id = $2)`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found or access denied' });
    }

    const task = result.rows[0];

    // Get assignees
    const assigneesResult = await pool.query(
      'SELECT * FROM task_assignees WHERE task_id = $1',
      [id]
    );
    task.assignees = assigneesResult.rows;

    // Get attachments
    const attachmentsResult = await pool.query(
      'SELECT * FROM task_attachments WHERE task_id = $1 ORDER BY uploaded_at DESC',
      [id]
    );
    task.attachments = attachmentsResult.rows;

    // Get comments
    const commentsResult = await pool.query(
      `SELECT tc.*, u.name, u.email, u.picture
       FROM task_comments tc
       INNER JOIN users u ON tc.user_id = u.id
       WHERE tc.task_id = $1
       ORDER BY tc.created_at ASC`,
      [id]
    );
    task.comments = commentsResult.rows;

    res.json({ task });
  } catch (error) {
    console.error('Error getting task:', error);
    res.status(500).json({
      error: 'Failed to get task',
      message: error.message
    });
  }
};

// Create new task
const createTask = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      project_id,
      title,
      description,
      start_date,
      end_date,
      status,
      priority,
      assignees,
      gmail_message_id,
      gmail_thread_id,
      parent_task_id
    } = req.body;
    const userId = req.user.id;

    if (!project_id || !title) {
      return res.status(400).json({
        error: 'Project ID and title are required'
      });
    }

    // Check if user has access to the project
    const accessCheck = await client.query(
      `SELECT p.owner_id, pm.role FROM projects p
       LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $2
       WHERE p.id = $1`,
      [project_id, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const { owner_id, role } = accessCheck.rows[0];
    if (owner_id !== userId && role === 'viewer') {
      return res.status(403).json({
        error: 'Viewers cannot create tasks'
      });
    }

    await client.query('BEGIN');

    // Calculate depth level if this is a sub-task
    let depth_level = 0;
    if (parent_task_id) {
      // Verify parent task exists and is in the same project
      const parentCheck = await client.query(
        'SELECT depth_level, project_id FROM tasks WHERE id = $1',
        [parent_task_id]
      );

      if (parentCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Parent task not found' });
      }

      if (parentCheck.rows[0].project_id !== project_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Parent task must be in the same project'
        });
      }

      depth_level = parentCheck.rows[0].depth_level + 1;
    }

    // Get max position for ordering (within same parent or root level)
    const positionResult = await client.query(
      `SELECT COALESCE(MAX(position), 0) + 1 as next_position
       FROM tasks
       WHERE project_id = $1 AND COALESCE(parent_task_id, 0) = COALESCE($2, 0)`,
      [project_id, parent_task_id]
    );
    const position = positionResult.rows[0].next_position;

    // Create task
    const result = await client.query(
      `INSERT INTO tasks (
        project_id, title, description, start_date, end_date, status, priority,
        position, gmail_message_id, gmail_thread_id, created_by,
        parent_task_id, depth_level
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        project_id,
        title,
        description,
        start_date,
        end_date,
        status || 'todo',
        priority || 'medium',
        position,
        gmail_message_id,
        gmail_thread_id,
        userId,
        parent_task_id,
        depth_level
      ]
    );

    const task = result.rows[0];

    // Add assignees if provided
    if (assignees && assignees.length > 0) {
      for (const assignee of assignees) {
        await client.query(
          `INSERT INTO task_assignees (task_id, user_id, contact_name, contact_email, contact_google_id, assigned_by)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            task.id,
            assignee.user_id || null,
            assignee.contact_name || null,
            assignee.contact_email || null,
            assignee.contact_google_id || null,
            userId
          ]
        );
      }
    }

    await client.query('COMMIT');

    // Get the task with assignees in the same format as getTasks
    const taskWithDetails = await client.query(
      `SELECT t.*, u.name as created_by_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', ta.id,
              'user_id', ta.user_id,
              'contact_name', ta.contact_name,
              'contact_email', ta.contact_email,
              'contact_google_id', ta.contact_google_id,
              'assigned_at', ta.assigned_at
            )
          ) FILTER (WHERE ta.id IS NOT NULL),
          '[]'::json
        ) as assignees,
        0 as attachment_count,
        0 as comment_count,
        (SELECT COUNT(*) FROM tasks WHERE parent_task_id = t.id) as subtask_count,
        pt.title as parent_task_title
       FROM tasks t
       INNER JOIN users u ON t.created_by = u.id
       LEFT JOIN task_assignees ta ON t.id = ta.task_id
       LEFT JOIN tasks pt ON t.parent_task_id = pt.id
       WHERE t.id = $1
       GROUP BY t.id, u.name, pt.title`,
      [task.id]
    );

    res.status(201).json({ task: taskWithDetails.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating task:', error);
    res.status(500).json({
      error: 'Failed to create task',
      message: error.message
    });
  } finally {
    client.release();
  }
};

// Helper function to calculate parent task status based on sub-tasks
const calculateParentStatus = async (parentTaskId) => {
  const subTasksResult = await pool.query(
    'SELECT status FROM tasks WHERE parent_task_id = $1',
    [parentTaskId]
  );

  if (subTasksResult.rows.length === 0) {
    return 'todo'; // Default if no sub-tasks
  }

  const statuses = subTasksResult.rows.map(row => row.status);

  // All sub-tasks done → Parent = done
  if (statuses.every(s => s === 'done')) {
    return 'done';
  }

  // All sub-tasks done or review (at least one review) → Parent = review
  if (statuses.every(s => s === 'done' || s === 'review') && statuses.some(s => s === 'review')) {
    return 'review';
  }

  // ANY sub-task in_progress → Parent = in_progress
  if (statuses.some(s => s === 'in_progress')) {
    return 'in_progress';
  }

  // Otherwise → Parent = todo
  return 'todo';
};

// Update task
const updateTask = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const {
      title,
      description,
      start_date,
      end_date,
      status,
      priority,
      position
    } = req.body;
    const userId = req.user.id;

    // Check if user has edit access
    const accessCheck = await client.query(
      `SELECT t.parent_task_id, p.owner_id, pm.role,
        (SELECT COUNT(*) FROM tasks WHERE parent_task_id = t.id) as subtask_count
       FROM tasks t
       INNER JOIN projects p ON t.project_id = p.id
       LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $2
       WHERE t.id = $1`,
      [id, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const { parent_task_id, owner_id, role, subtask_count } = accessCheck.rows[0];

    if (owner_id !== userId && role === 'viewer') {
      return res.status(403).json({
        error: 'Viewers cannot edit tasks'
      });
    }

    // Prevent manual status changes for parent tasks with sub-tasks
    if (status && parseInt(subtask_count) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Cannot manually change status of tasks with sub-tasks',
        message: 'Task status is automatically derived from sub-task statuses'
      });
    }

    const completed_at = status === 'done' ? new Date() : null;

    const result = await client.query(
      `UPDATE tasks
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           start_date = COALESCE($3, start_date),
           end_date = COALESCE($4, end_date),
           status = COALESCE($5, status),
           priority = COALESCE($6, priority),
           position = COALESCE($7, position),
           completed_at = COALESCE($8, completed_at),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING *`,
      [title, description, start_date, end_date, status, priority, position, completed_at, id]
    );

    // If this task has a parent and status was changed, update parent status
    if (parent_task_id && status) {
      const newParentStatus = await calculateParentStatus(parent_task_id);
      const parentCompletedAt = newParentStatus === 'done' ? new Date() : null;

      await client.query(
        `UPDATE tasks
         SET status = $1,
             completed_at = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [newParentStatus, parentCompletedAt, parent_task_id]
      );
    }

    await client.query('COMMIT');
    res.json({ task: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating task:', error);
    res.status(500).json({
      error: 'Failed to update task',
      message: error.message
    });
  } finally {
    client.release();
  }
};

// Delete task
const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if user has edit access
    const accessCheck = await pool.query(
      `SELECT p.owner_id, pm.role FROM tasks t
       INNER JOIN projects p ON t.project_id = p.id
       LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $2
       WHERE t.id = $1`,
      [id, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const { owner_id, role } = accessCheck.rows[0];
    if (owner_id !== userId && role === 'viewer') {
      return res.status(403).json({
        error: 'Viewers cannot delete tasks'
      });
    }

    await pool.query('DELETE FROM tasks WHERE id = $1', [id]);

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({
      error: 'Failed to delete task',
      message: error.message
    });
  }
};

// Add comment to task
const addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const userId = req.user.id;

    if (!comment) {
      return res.status(400).json({ error: 'Comment is required' });
    }

    // Check if user has access to the task
    const accessCheck = await pool.query(
      `SELECT t.id FROM tasks t
       INNER JOIN projects p ON t.project_id = p.id
       LEFT JOIN project_members pm ON p.id = pm.project_id
       WHERE t.id = $1 AND (p.owner_id = $2 OR pm.user_id = $2)`,
      [id, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found or access denied' });
    }

    const result = await pool.query(
      `INSERT INTO task_comments (task_id, user_id, comment)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [id, userId, comment]
    );

    res.status(201).json({ comment: result.rows[0] });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({
      error: 'Failed to add comment',
      message: error.message
    });
  }
};

// Delete attachment
const deleteAttachment = async (req, res) => {
  try {
    const { attachmentId } = req.params;
    const userId = req.user.id;

    // Check if user has access to the task that owns this attachment
    const accessCheck = await pool.query(
      `SELECT ta.id FROM task_attachments ta
       INNER JOIN tasks t ON ta.task_id = t.id
       INNER JOIN projects p ON t.project_id = p.id
       LEFT JOIN project_members pm ON p.id = pm.project_id
       WHERE ta.id = $1 AND (p.owner_id = $2 OR pm.user_id = $2)`,
      [attachmentId, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Attachment not found or access denied' });
    }

    await pool.query('DELETE FROM task_attachments WHERE id = $1', [attachmentId]);

    res.json({ message: 'Attachment deleted successfully' });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    res.status(500).json({
      error: 'Failed to delete attachment',
      message: error.message
    });
  }
};

module.exports = {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  addComment,
  deleteAttachment
};
