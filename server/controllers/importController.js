const Papa = require('papaparse');
const { pool } = require('../config/database');

const SYSTEM_FIELDS = [
  { key: 'title', label: 'Title', required: true },
  { key: 'description', label: 'Description', required: false },
  { key: 'priority', label: 'Priority', required: false },
  { key: 'status', label: 'Status', required: false },
  { key: 'start_date', label: 'Start Date', required: false },
  { key: 'end_date', label: 'End Date', required: false },
  { key: 'parent_task', label: 'Parent Task', required: false },
  { key: 'assignees', label: 'Assignees', required: false },
];

const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const VALID_STATUSES = ['todo', 'in_progress', 'review', 'done'];

/**
 * Maps common column names to system field keys
 */
function suggestMapping(columnName) {
  const normalized = columnName.toLowerCase().trim().replace(/[\s_-]+/g, '_');

  const mappings = {
    // Title
    title: 'title',
    task_title: 'title',
    task_name: 'title',
    name: 'title',
    summary: 'title',
    subject: 'title',
    // Description
    description: 'description',
    details: 'description',
    notes: 'description',
    body: 'description',
    content: 'description',
    // Priority
    priority: 'priority',
    importance: 'priority',
    urgency: 'priority',
    // Status
    status: 'status',
    state: 'status',
    task_status: 'status',
    // Start date
    start_date: 'start_date',
    start: 'start_date',
    begin_date: 'start_date',
    from: 'start_date',
    start_time: 'start_date',
    // End date
    end_date: 'end_date',
    due_date: 'end_date',
    due: 'end_date',
    deadline: 'end_date',
    end: 'end_date',
    finish_date: 'end_date',
    end_time: 'end_date',
    // Parent task
    parent_task: 'parent_task',
    parent: 'parent_task',
    parent_name: 'parent_task',
    parent_title: 'parent_task',
    group: 'parent_task',
    category: 'parent_task',
    // Assignees
    assignees: 'assignees',
    assignee: 'assignees',
    assigned_to: 'assignees',
    owner: 'assignees',
    owners: 'assignees',
    responsible: 'assignees',
  };

  return mappings[normalized] || null;
}

/**
 * Flatten nested JSON tasks into rows, expanding subtasks with parent_task reference
 */
function flattenJsonTasks(tasks, parentTitle = null) {
  const rows = [];

  for (const task of tasks) {
    const row = {};

    for (const [key, value] of Object.entries(task)) {
      if (key === 'subtasks' || key === 'children' || key === 'sub_tasks') {
        continue;
      }
      if (Array.isArray(value) && key !== 'subtasks' && key !== 'children' && key !== 'sub_tasks') {
        // Join arrays (like assignees) with semicolons
        row[key] = value.join(';');
      } else {
        row[key] = value;
      }
    }

    if (parentTitle) {
      row['parent_task'] = parentTitle;
    }

    rows.push(row);

    // Process subtasks recursively
    const subtasks = task.subtasks || task.children || task.sub_tasks;
    if (Array.isArray(subtasks) && subtasks.length > 0) {
      const taskTitle = task.title || task.name || task.summary || '';
      rows.push(...flattenJsonTasks(subtasks, taskTitle));
    }
  }

  return rows;
}

/**
 * POST /api/import/parse
 * Parse an uploaded CSV or JSON file and return columns, rows, and suggested mappings
 */
const parseImportFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { originalname, buffer } = req.file;
    const extension = originalname.split('.').pop().toLowerCase();
    const content = buffer.toString('utf-8');

    let columns = [];
    let rows = [];

    if (extension === 'csv') {
      const parsed = Papa.parse(content, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
      });

      if (parsed.errors.length > 0) {
        const criticalErrors = parsed.errors.filter(e => e.type === 'Delimiter' || e.type === 'FieldMismatch');
        if (criticalErrors.length > 0) {
          return res.status(400).json({
            error: 'CSV parsing failed',
            details: criticalErrors.map(e => e.message),
          });
        }
      }

      columns = parsed.meta.fields || [];
      rows = parsed.data;
    } else if (extension === 'json') {
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON file' });
      }

      let tasks;
      if (Array.isArray(parsed)) {
        tasks = parsed;
      } else if (parsed.tasks && Array.isArray(parsed.tasks)) {
        tasks = parsed.tasks;
      } else {
        return res.status(400).json({
          error: 'JSON must be an array of tasks or an object with a "tasks" array',
        });
      }

      rows = flattenJsonTasks(tasks);

      // Collect all unique column names from rows
      const columnSet = new Set();
      for (const row of rows) {
        Object.keys(row).forEach(key => columnSet.add(key));
      }
      columns = Array.from(columnSet);
    } else {
      return res.status(400).json({ error: 'Unsupported file type. Use .csv or .json' });
    }

    // Build suggested mappings
    const suggestedMappings = {};
    for (const col of columns) {
      const mapped = suggestMapping(col);
      if (mapped) {
        suggestedMappings[col] = mapped;
      }
    }

    res.json({
      columns,
      rows,
      suggestedMappings,
      systemFields: SYSTEM_FIELDS,
      rowCount: rows.length,
    });
  } catch (error) {
    console.error('Error parsing import file:', error);
    res.status(500).json({
      error: 'Failed to parse import file',
      message: error.message,
    });
  }
};

/**
 * POST /api/import/execute
 * Execute the import: create tasks and subtasks in the database
 */
const executeImport = async (req, res) => {
  const client = await pool.connect();

  try {
    const { projectId, mappings, rows } = req.body;
    const userId = req.user.id;

    if (!projectId || !mappings || !rows || !Array.isArray(rows)) {
      return res.status(400).json({
        error: 'projectId, mappings, and rows are required',
      });
    }

    // Check title mapping exists
    const titleColumn = Object.keys(mappings).find(col => mappings[col] === 'title');
    if (!titleColumn) {
      return res.status(400).json({
        error: 'A column must be mapped to Title',
      });
    }

    // Check project access (same pattern as createTask)
    const accessCheck = await client.query(
      `SELECT p.owner_id, pm.role FROM projects p
       LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $2
       WHERE p.id = $1`,
      [projectId, userId]
    );

    if (accessCheck.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Project not found' });
    }

    const { owner_id, role } = accessCheck.rows[0];
    if (owner_id !== userId && role === 'viewer') {
      client.release();
      return res.status(403).json({ error: 'Viewers cannot import tasks' });
    }

    await client.query('BEGIN');

    const parentTaskColumn = Object.keys(mappings).find(col => mappings[col] === 'parent_task');
    const assigneesColumn = Object.keys(mappings).find(col => mappings[col] === 'assignees');

    // Separate parent tasks and subtasks
    const parentRows = [];
    const subtaskRows = [];

    for (const row of rows) {
      const parentValue = parentTaskColumn ? (row[parentTaskColumn] || '').trim() : '';
      if (parentValue) {
        subtaskRows.push(row);
      } else {
        parentRows.push(row);
      }
    }

    const createdTaskMap = {}; // title -> task id
    let created = 0;
    let failed = 0;
    const errors = [];

    // Helper to get mapped value from a row
    function getMappedValue(row, systemField) {
      const col = Object.keys(mappings).find(c => mappings[c] === systemField);
      if (!col) return null;
      const val = row[col];
      return val !== undefined && val !== null && val !== '' ? String(val).trim() : null;
    }

    // Helper to validate and normalize priority
    function normalizePriority(value) {
      if (!value) return 'medium';
      const lower = value.toLowerCase().trim();
      return VALID_PRIORITIES.includes(lower) ? lower : 'medium';
    }

    // Helper to validate and normalize status
    function normalizeStatus(value) {
      if (!value) return 'todo';
      const lower = value.toLowerCase().trim().replace(/[\s-]+/g, '_');
      return VALID_STATUSES.includes(lower) ? lower : 'todo';
    }

    // Helper to parse date
    function parseDate(value) {
      if (!value) return null;
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date.toISOString();
    }

    // Helper to get next position
    async function getNextPosition(parentTaskId) {
      const posResult = await client.query(
        `SELECT COALESCE(MAX(position), 0) + 1 as next_position
         FROM tasks
         WHERE project_id = $1 AND COALESCE(parent_task_id, 0) = COALESCE($2, 0)`,
        [projectId, parentTaskId]
      );
      return posResult.rows[0].next_position;
    }

    // Helper to create a task row
    async function createTask(row, parentTaskId, depthLevel) {
      const title = getMappedValue(row, 'title');
      if (!title) {
        errors.push({ row, error: 'Missing required field: title' });
        failed++;
        return null;
      }

      const priority = normalizePriority(getMappedValue(row, 'priority'));
      const status = normalizeStatus(getMappedValue(row, 'status'));
      const description = getMappedValue(row, 'description');
      const startDate = parseDate(getMappedValue(row, 'start_date'));
      const endDate = parseDate(getMappedValue(row, 'end_date'));
      const position = await getNextPosition(parentTaskId);

      const result = await client.query(
        `INSERT INTO tasks (project_id, title, description, start_date, end_date, status, priority, position, created_by, parent_task_id, depth_level)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [projectId, title, description, startDate, endDate, status, priority, position, userId, parentTaskId, depthLevel]
      );

      const taskId = result.rows[0].id;

      // Handle assignees
      const assigneesValue = assigneesColumn ? (row[assigneesColumn] || '').trim() : '';
      if (assigneesValue) {
        const assigneeList = assigneesValue.split(';').map(a => a.trim()).filter(Boolean);
        for (const email of assigneeList) {
          await client.query(
            `INSERT INTO task_assignees (task_id, contact_email, assigned_by)
             VALUES ($1, $2, $3)`,
            [taskId, email, userId]
          );
        }
      }

      return { id: taskId, title };
    }

    // Pass 1: Create parent tasks (no parent_task value)
    for (const row of parentRows) {
      try {
        const result = await createTask(row, null, 0);
        if (result) {
          createdTaskMap[result.title] = result.id;
          created++;
        }
      } catch (error) {
        const title = getMappedValue(row, 'title') || 'Unknown';
        errors.push({ title, error: error.message });
        failed++;
      }
    }

    // Pass 2: Create subtasks (with parent_task value)
    for (const row of subtaskRows) {
      try {
        const parentTitle = (row[parentTaskColumn] || '').trim();
        let parentTaskId = createdTaskMap[parentTitle] || null;
        let depthLevel = 1;

        // Fall back to existing tasks in the project
        if (!parentTaskId && parentTitle) {
          const existingParent = await client.query(
            'SELECT id, depth_level FROM tasks WHERE project_id = $1 AND title = $2 LIMIT 1',
            [projectId, parentTitle]
          );
          if (existingParent.rows.length > 0) {
            parentTaskId = existingParent.rows[0].id;
            depthLevel = existingParent.rows[0].depth_level + 1;
          }
        }

        // If parent was created in pass 1, depth is 1
        if (parentTaskId && createdTaskMap[parentTitle]) {
          depthLevel = 1;
        }

        const result = await createTask(row, parentTaskId, depthLevel);
        if (result) {
          createdTaskMap[result.title] = result.id;
          created++;
        }
      } catch (error) {
        const title = getMappedValue(row, 'title') || 'Unknown';
        errors.push({ title, error: error.message });
        failed++;
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      created,
      failed,
      errors,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error executing import:', error);
    res.status(500).json({
      error: 'Failed to execute import',
      message: error.message,
    });
  } finally {
    client.release();
  }
};

module.exports = {
  parseImportFile,
  executeImport,
};
