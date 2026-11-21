const { pool } = require('../config/database');
const privacy = require('../lib/privacy');

// Get all tasks for a project
const getTasks = async (req, res) => {
  try {
    const { projectId } = req.query;
    const userId = req.user.id;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    // Task 042: a project this user may not see answers exactly like one that does not exist.
    const access = await privacy.projectAccess(projectId, userId);
    if (!access.visible) {
      return res.status(404).json({ error: privacy.NOT_FOUND.project });
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
        (SELECT COUNT(*) FROM tasks st WHERE st.parent_task_id = t.id AND pm_task_visible(st.id, $2)) as subtask_count,
        pt.title as parent_task_title
       FROM tasks t
       INNER JOIN users u ON t.created_by = u.id
       LEFT JOIN task_assignees ta ON t.id = ta.task_id
       LEFT JOIN tasks pt ON t.parent_task_id = pt.id
       WHERE t.project_id = $1 AND pm_task_visible(t.id, $2)
       GROUP BY t.id, u.name, pt.title
       ORDER BY t.depth_level ASC, t.position ASC, t.created_at DESC`,
      [projectId, userId]
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
       WHERE t.id = $1 AND pm_task_visible(t.id, $2)`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: privacy.NOT_FOUND.task });
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

    // Task 042: only on a project this user can see (before, anyone signed in could add tasks
    // to any project), and not as a viewer.
    const access = await privacy.projectAccess(project_id, userId, client);
    if (!access.visible) {
      return res.status(404).json({ error: privacy.NOT_FOUND.project });
    }
    if (!privacy.canEdit(access.role)) {
      return res.status(403).json({
        error: 'Viewers cannot create tasks'
      });
    }
    // Business or Private, as chosen on save; left out = Private inside a Private project or
    // under a Private task, else Business.
    if (req.body.privacy !== undefined && req.body.privacy !== null && !privacy.parseLevel(req.body.privacy)) {
      return res.status(400).json({ error: 'privacy must be business or private' });
    }
    if (parent_task_id) {
      const parentAccess = await privacy.taskAccess(parent_task_id, userId, client);
      if (!parentAccess.visible) return res.status(404).json({ error: 'Parent task not found' });
    }
    const level = privacy.parseLevel(req.body.privacy)
      || ((await privacy.projectChainPrivate(project_id, client)) || (await privacy.taskChainPrivate(parent_task_id, client)) ? 'private' : 'business');
    if (level === 'private' && await privacy.otherUserAssignees(userId, assignees, client)) {
      return res.status(400).json({ error: privacy.PRIVATE_ASSIGN });
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
        parent_task_id, depth_level, privacy
      )
       VALUES ($1, $2, $3, $4::date, $5::date, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
        depth_level,
        level
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
        (SELECT COUNT(*) FROM tasks st WHERE st.parent_task_id = t.id AND pm_task_visible(st.id, $2)) as subtask_count,
        pt.title as parent_task_title
       FROM tasks t
       INNER JOIN users u ON t.created_by = u.id
       LEFT JOIN task_assignees ta ON t.id = ta.task_id
       LEFT JOIN tasks pt ON t.parent_task_id = pt.id
       WHERE t.id = $1
       GROUP BY t.id, u.name, pt.title`,
      [task.id, userId]
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
// Task 042: a Business parent's status follows only its Business sub-tasks, so a Private
// sub-task never shows through to others (unless every sub-task is Private).
const calculateParentStatus = async (parentTaskId) => {
  let subTasksResult = await pool.query(
    `SELECT c.status FROM tasks c JOIN tasks p ON p.id = c.parent_task_id
      WHERE c.parent_task_id = $1 AND (p.privacy <> 'business' OR c.privacy = 'business')`,
    [parentTaskId]
  );
  if (subTasksResult.rows.length === 0) {
    subTasksResult = await pool.query('SELECT status FROM tasks WHERE parent_task_id = $1', [parentTaskId]);
  }

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

    // Re-parent / promote intent. Presence of the key (even null) signals a
    // change: an id moves the task under a new parent; null promotes it to a
    // top-level task. Absent = leave the parent unchanged.
    const reparent = Object.prototype.hasOwnProperty.call(req.body, 'parent_task_id');
    const newParentId = reparent ? (req.body.parent_task_id || null) : undefined;

    // Task 042: only a task this user can see (before, anyone signed in could edit any task).
    const access = await privacy.taskAccess(id, userId, client);
    if (!access.visible) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: privacy.NOT_FOUND.task });
    }
    const { parent_task_id, project_id } = access.row;
    const subtask_count = access.row.subtask_count_all;

    if (!privacy.canEdit(access.role)) {
      await client.query('ROLLBACK');
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
           start_date = CASE WHEN $3::text IS NOT NULL THEN $3::date ELSE start_date END,
           end_date = CASE WHEN $4::text IS NOT NULL THEN $4::date ELSE end_date END,
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

    // Re-parent / promote: move this task (and its whole subtree) under a new
    // parent, or to the top level (newParentId === null).
    let reparented = false;
    let parentsToRefresh = [];
    if (reparent && (newParentId || null) !== (parent_task_id || null)) {
      let newBase = 0;
      if (newParentId !== null) {
        if (Number(newParentId) === Number(id)) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'A task cannot be its own parent' });
        }
        const pc = await client.query(
          'SELECT depth_level, project_id FROM tasks WHERE id = $1 AND pm_task_visible(id, $2)',
          [newParentId, userId]
        );
        if (pc.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Parent task not found' });
        }
        if (pc.rows[0].project_id !== project_id) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Parent task must be in the same project' });
        }
        // Cycle guard: the new parent must not be inside this task's own subtree.
        const cycle = await client.query(
          `WITH RECURSIVE sub AS (
             SELECT id FROM tasks WHERE id = $1
             UNION ALL
             SELECT t.id FROM tasks t JOIN sub ON t.parent_task_id = sub.id
           )
           SELECT 1 FROM sub WHERE id = $2 LIMIT 1`,
          [id, newParentId]
        );
        if (cycle.rows.length > 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Cannot move a task under one of its own subtasks' });
        }
        newBase = pc.rows[0].depth_level + 1;
      }

      await client.query(
        'UPDATE tasks SET parent_task_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newParentId, id]
      );

      // Recompute depth_level for the moved task and every descendant.
      await client.query(
        `WITH RECURSIVE sub AS (
           SELECT id, $2::int AS d FROM tasks WHERE id = $1
           UNION ALL
           SELECT t.id, sub.d + 1 FROM tasks t JOIN sub ON t.parent_task_id = sub.id
         )
         UPDATE tasks SET depth_level = sub.d FROM sub WHERE tasks.id = sub.id`,
        [id, newBase]
      );

      // The old and new parents' child sets changed — remember them so we can
      // recompute their derived status AFTER commit (calculateParentStatus reads
      // the pool, which can't see this still-open transaction).
      parentsToRefresh = [parent_task_id, newParentId];
      reparented = true;
    }

    await client.query('COMMIT');

    // Post-commit: refresh derived status on the affected parents against
    // committed data. Skip a parent that is now childless — don't force a leaf
    // task to 'todo'.
    for (const pid of parentsToRefresh) {
      if (!pid) continue;
      const cc = await pool.query('SELECT COUNT(*)::int AS n FROM tasks WHERE parent_task_id = $1', [pid]);
      if (cc.rows[0].n === 0) continue;
      const st = await calculateParentStatus(pid);
      await pool.query(
        `UPDATE tasks SET status = $1, completed_at = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
        [st, st === 'done' ? new Date() : null, pid]
      );
    }

    // If we re-parented, return the fresh row (parent/depth changed post-update).
    if (reparented) {
      const fresh = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
      return res.json({ task: fresh.rows[0] });
    }
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

    // Task 042: only a task this user can see (before, anyone signed in could delete any task).
    const access = await privacy.taskAccess(id, userId);
    if (!access.visible) {
      return res.status(404).json({ error: privacy.NOT_FOUND.task });
    }
    if (!privacy.canEdit(access.role)) {
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
      `SELECT t.id FROM tasks t WHERE t.id = $1 AND pm_task_visible(t.id, $2)`,
      [id, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ error: privacy.NOT_FOUND.task });
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
       WHERE ta.id = $1 AND pm_task_visible(t.id, $2) AND pm_project_role(t.project_id, $2) IN ('owner', 'editor')`,
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

// Add assignee to task
const addAssignee = async (req, res) => {
  try {
    const { id } = req.params;
    const { contact_name, contact_email, contact_google_id } = req.body;
    const userId = req.user.id;

    // Task 048 (WES CRM handoff): an owner may be a name with no email, e.g. an AI assistant
    // ("Duet (AI assistant)") that owns tasks but has no mailbox. Nobody invents an email for it.
    const name = contact_name && String(contact_name).trim();
    const email = contact_email && String(contact_email).trim();
    if (!email && !name) {
      return res.status(400).json({ error: 'A name or an email is required' });
    }

    // Task 042: only a task this user can see; a Private task only to its owner.
    const access = await privacy.taskAccess(id, userId);
    if (!access.visible) {
      return res.status(404).json({ error: privacy.NOT_FOUND.task });
    }
    if (!privacy.canEdit(access.role)) {
      return res.status(403).json({ error: 'Viewers cannot add assignees' });
    }
    // A Private task stays with its owner: no other user, and no name-only owner either (task 048).
    if (access.row.privacy === 'private' && (!email || await privacy.otherUserAssignees(access.row.created_by, [{ contact_email: email }]))) {
      return res.status(400).json({ error: privacy.PRIVATE_ASSIGN });
    }

    // Check if this contact is already assigned (by email; a name-only owner by name)
    const existingAssignee = email
      ? await pool.query('SELECT id FROM task_assignees WHERE task_id = $1 AND contact_email = $2', [id, email])
      : await pool.query(`SELECT id FROM task_assignees WHERE task_id = $1 AND contact_email IS NULL AND user_id IS NULL
                           AND LOWER(TRIM(contact_name)) = LOWER($2)`, [id, name]);

    if (existingAssignee.rows.length > 0) {
      return res.status(400).json({ error: 'This contact is already assigned to this task' });
    }

    // Add the assignee
    const result = await pool.query(
      `INSERT INTO task_assignees (task_id, contact_name, contact_email, contact_google_id, assigned_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, name || email, email || null, contact_google_id || null, userId]
    );

    res.status(201).json({ assignee: result.rows[0] });
  } catch (error) {
    console.error('Error adding assignee:', error);
    res.status(500).json({
      error: 'Failed to add assignee',
      message: error.message
    });
  }
};

// Remove assignee from task
const removeAssignee = async (req, res) => {
  try {
    const { id, assigneeId } = req.params;
    const userId = req.user.id;

    // Check if user has access to the task
    const accessCheck = await pool.query(
      `SELECT t.id, pm_project_role(t.project_id, $3) AS role FROM tasks t
       INNER JOIN task_assignees ta ON ta.task_id = t.id
       WHERE t.id = $1 AND ta.id = $2 AND pm_task_visible(t.id, $3)`,
      [id, assigneeId, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Assignee not found' });
    }

    const { role } = accessCheck.rows[0];
    if (!privacy.canEdit(role)) {
      return res.status(403).json({ error: 'Viewers cannot remove assignees' });
    }

    // Delete the assignee
    await pool.query('DELETE FROM task_assignees WHERE id = $1', [assigneeId]);

    res.json({ message: 'Assignee removed successfully' });
  } catch (error) {
    console.error('Error removing assignee:', error);
    res.status(500).json({
      error: 'Failed to remove assignee',
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
  deleteAttachment,
  addAssignee,
  removeAssignee
};
