# Task Import Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add CSV and JSON import for tasks/subtasks into existing projects, with field mapping and preview before import.

**Architecture:** New import route + controller on the backend handles file upload, parsing, and bulk task creation. A new multi-step modal on the frontend guides users through upload, field mapping, preview/selection, and import execution. Uses papaparse for CSV parsing.

**Tech Stack:** Express.js, PostgreSQL, papaparse (new dep), React, Tailwind CSS, Lucide icons

---

### Task 1: Install papaparse in server

**Files:**
- Modify: `server/package.json`

**Step 1: Install papaparse**

Run: `cd /c/Users/steve/Project-Manager/server && npm install papaparse`
Expected: papaparse added to dependencies in package.json

**Step 2: Commit**

```bash
cd /c/Users/steve/Project-Manager
git add server/package.json server/package-lock.json
git commit -m "feat: add papaparse dependency for task import"
```

---

### Task 2: Create import controller (backend)

**Files:**
- Create: `server/controllers/importController.js`

**Step 1: Create the import controller**

Create `server/controllers/importController.js` with two exported functions:

```javascript
const { pool } = require('../config/database');
const Papa = require('papaparse');

// System fields that can be mapped to
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

// Suggest field mappings based on column names
function suggestMapping(columnName) {
  const lower = columnName.toLowerCase().trim();
  const mappings = {
    'title': 'title', 'task': 'title', 'task title': 'title', 'task name': 'title', 'name': 'title', 'subject': 'title',
    'description': 'description', 'desc': 'description', 'details': 'description', 'notes': 'description',
    'priority': 'priority', 'prio': 'priority', 'importance': 'priority',
    'status': 'status', 'state': 'status', 'task status': 'status',
    'start date': 'start_date', 'start_date': 'start_date', 'start': 'start_date', 'begin': 'start_date', 'from': 'start_date',
    'end date': 'end_date', 'end_date': 'end_date', 'end': 'end_date', 'due date': 'end_date', 'due': 'end_date', 'deadline': 'end_date', 'to': 'end_date',
    'parent': 'parent_task', 'parent task': 'parent_task', 'parent_task': 'parent_task', 'parent_task_title': 'parent_task',
    'assignees': 'assignees', 'assignee': 'assignees', 'assigned to': 'assignees', 'assigned': 'assignees', 'owner': 'assignees',
  };
  return mappings[lower] || null;
}

// POST /api/import/parse
// Accepts file upload (CSV or JSON), parses it, returns detected columns + suggested mappings + parsed rows
const parseImportFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileContent = req.file.buffer.toString('utf-8');
    const fileName = req.file.originalname.toLowerCase();
    let columns = [];
    let rows = [];

    if (fileName.endsWith('.csv')) {
      // Parse CSV with papaparse
      const parsed = Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
      });

      if (parsed.errors.length > 0 && parsed.data.length === 0) {
        return res.status(400).json({
          error: 'Failed to parse CSV',
          details: parsed.errors.map(e => e.message),
        });
      }

      columns = parsed.meta.fields || [];
      rows = parsed.data;
    } else if (fileName.endsWith('.json')) {
      // Parse JSON
      let jsonData;
      try {
        jsonData = JSON.parse(fileContent);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON file' });
      }

      // Expect { tasks: [...] } or just [...]
      const tasksArray = Array.isArray(jsonData) ? jsonData : jsonData.tasks;
      if (!Array.isArray(tasksArray)) {
        return res.status(400).json({
          error: 'JSON must contain a "tasks" array or be an array of tasks',
        });
      }

      // Flatten JSON tasks (expand subtasks into rows with parent_task reference)
      for (const task of tasksArray) {
        const row = {};
        for (const [key, value] of Object.entries(task)) {
          if (key === 'subtasks') continue;
          if (key === 'assignees' && Array.isArray(value)) {
            row[key] = value.join(';');
          } else {
            row[key] = value;
          }
        }
        rows.push(row);

        // Flatten subtasks
        if (task.subtasks && Array.isArray(task.subtasks)) {
          for (const subtask of task.subtasks) {
            const subRow = {};
            for (const [key, value] of Object.entries(subtask)) {
              if (key === 'assignees' && Array.isArray(value)) {
                subRow[key] = value.join(';');
              } else {
                subRow[key] = value;
              }
            }
            subRow.parent_task = task.title;
            rows.push(subRow);
          }
        }
      }

      // Collect all unique keys across all rows as columns
      const columnSet = new Set();
      rows.forEach(row => Object.keys(row).forEach(k => columnSet.add(k)));
      columns = Array.from(columnSet);
    } else {
      return res.status(400).json({
        error: 'Unsupported file format. Please upload a CSV or JSON file.',
      });
    }

    // Generate suggested mappings
    const suggestedMappings = {};
    columns.forEach(col => {
      const suggestion = suggestMapping(col);
      if (suggestion) {
        suggestedMappings[col] = suggestion;
      }
    });

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

// POST /api/import/execute
// Receives mapped rows + field mappings, creates tasks in the project
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

    // Verify title mapping exists
    const titleColumn = Object.entries(mappings).find(([, val]) => val === 'title');
    if (!titleColumn) {
      return res.status(400).json({
        error: 'A column must be mapped to "Title"',
      });
    }

    // Check project access
    const accessCheck = await client.query(
      `SELECT p.owner_id, pm.role FROM projects p
       LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $2
       WHERE p.id = $1`,
      [projectId, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const { owner_id, role } = accessCheck.rows[0];
    if (owner_id !== userId && role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot import tasks' });
    }

    await client.query('BEGIN');

    // Helper to get mapped value from a row
    const getMappedValue = (row, systemField) => {
      const col = Object.entries(mappings).find(([, val]) => val === systemField);
      if (!col) return null;
      const value = row[col[0]];
      return value !== undefined && value !== '' ? value : null;
    };

    // First pass: create parent tasks (rows without parent_task mapping)
    // Second pass: create subtasks (rows with parent_task mapping)
    const parentTasks = [];
    const subtaskRows = [];
    const createdTaskMap = {}; // title -> task id

    let created = 0;
    let failed = 0;
    const errors = [];

    // Separate parents and subtasks
    for (const row of rows) {
      const parentRef = getMappedValue(row, 'parent_task');
      if (parentRef) {
        subtaskRows.push(row);
      } else {
        parentTasks.push(row);
      }
    }

    // Get current max position for root tasks
    const posResult = await client.query(
      `SELECT COALESCE(MAX(position), 0) as max_pos FROM tasks
       WHERE project_id = $1 AND parent_task_id IS NULL`,
      [projectId]
    );
    let nextPosition = posResult.rows[0].max_pos + 1;

    // Create parent tasks
    for (const row of parentTasks) {
      try {
        const title = getMappedValue(row, 'title');
        if (!title) {
          errors.push({ row, error: 'Missing title' });
          failed++;
          continue;
        }

        const description = getMappedValue(row, 'description');
        let priority = getMappedValue(row, 'priority');
        let status = getMappedValue(row, 'status');
        const startDate = getMappedValue(row, 'start_date');
        const endDate = getMappedValue(row, 'end_date');
        const assigneesStr = getMappedValue(row, 'assignees');

        // Validate/default priority
        if (priority) {
          priority = priority.toLowerCase().trim();
          if (!VALID_PRIORITIES.includes(priority)) priority = 'medium';
        } else {
          priority = 'medium';
        }

        // Validate/default status
        if (status) {
          status = status.toLowerCase().trim().replace(/\s+/g, '_');
          if (!VALID_STATUSES.includes(status)) status = 'todo';
        } else {
          status = 'todo';
        }

        const result = await client.query(
          `INSERT INTO tasks (project_id, title, description, start_date, end_date, status, priority, position, created_by, parent_task_id, depth_level)
           VALUES ($1, $2, $3, $4::date, $5::date, $6, $7, $8, $9, NULL, 0)
           RETURNING *`,
          [projectId, title, description, startDate, endDate, status, priority, nextPosition, userId]
        );

        const task = result.rows[0];
        createdTaskMap[title] = task.id;
        nextPosition++;

        // Add assignees
        if (assigneesStr) {
          const emails = assigneesStr.split(';').map(e => e.trim()).filter(Boolean);
          for (const email of emails) {
            await client.query(
              `INSERT INTO task_assignees (task_id, contact_email, assigned_by)
               VALUES ($1, $2, $3)`,
              [task.id, email, userId]
            );
          }
        }

        created++;
      } catch (err) {
        errors.push({ row, error: err.message });
        failed++;
      }
    }

    // Create subtasks
    for (const row of subtaskRows) {
      try {
        const title = getMappedValue(row, 'title');
        if (!title) {
          errors.push({ row, error: 'Missing title' });
          failed++;
          continue;
        }

        const parentRef = getMappedValue(row, 'parent_task');
        const parentId = createdTaskMap[parentRef];

        if (!parentId) {
          // Try to find parent by title in existing project tasks
          const existingParent = await client.query(
            `SELECT id FROM tasks WHERE project_id = $1 AND title = $2 AND parent_task_id IS NULL`,
            [projectId, parentRef]
          );
          if (existingParent.rows.length === 0) {
            errors.push({ row, error: `Parent task "${parentRef}" not found` });
            failed++;
            continue;
          }
          createdTaskMap[parentRef] = existingParent.rows[0].id;
        }

        const finalParentId = createdTaskMap[parentRef];

        const description = getMappedValue(row, 'description');
        let priority = getMappedValue(row, 'priority');
        let status = getMappedValue(row, 'status');
        const startDate = getMappedValue(row, 'start_date');
        const endDate = getMappedValue(row, 'end_date');
        const assigneesStr = getMappedValue(row, 'assignees');

        if (priority) {
          priority = priority.toLowerCase().trim();
          if (!VALID_PRIORITIES.includes(priority)) priority = 'medium';
        } else {
          priority = 'medium';
        }

        if (status) {
          status = status.toLowerCase().trim().replace(/\s+/g, '_');
          if (!VALID_STATUSES.includes(status)) status = 'todo';
        } else {
          status = 'todo';
        }

        // Get next position within parent
        const subPosResult = await client.query(
          `SELECT COALESCE(MAX(position), 0) + 1 as next_pos FROM tasks WHERE parent_task_id = $1`,
          [finalParentId]
        );
        const subPosition = subPosResult.rows[0].next_pos;

        const result = await client.query(
          `INSERT INTO tasks (project_id, title, description, start_date, end_date, status, priority, position, created_by, parent_task_id, depth_level)
           VALUES ($1, $2, $3, $4::date, $5::date, $6, $7, $8, $9, $10, 1)
           RETURNING *`,
          [projectId, title, description, startDate, endDate, status, priority, subPosition, userId, finalParentId]
        );

        const task = result.rows[0];

        // Add assignees
        if (assigneesStr) {
          const emails = assigneesStr.split(';').map(e => e.trim()).filter(Boolean);
          for (const email of emails) {
            await client.query(
              `INSERT INTO task_assignees (task_id, contact_email, assigned_by)
               VALUES ($1, $2, $3)`,
              [task.id, email, userId]
            );
          }
        }

        created++;
      } catch (err) {
        errors.push({ row, error: err.message });
        failed++;
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      created,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error executing import:', error);
    res.status(500).json({
      error: 'Failed to import tasks',
      message: error.message,
    });
  } finally {
    client.release();
  }
};

module.exports = { parseImportFile, executeImport };
```

**Step 2: Commit**

```bash
cd /c/Users/steve/Project-Manager
git add server/controllers/importController.js
git commit -m "feat: add import controller with CSV/JSON parsing and bulk task creation"
```

---

### Task 3: Create import route (backend)

**Files:**
- Create: `server/routes/import.js`
- Modify: `server/server.js`

**Step 1: Create the import route file**

Create `server/routes/import.js`:

```javascript
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const { parseImportFile, executeImport } = require('../controllers/importController');

// Configure multer for memory storage (file kept in buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['text/csv', 'application/json', 'application/vnd.ms-excel'];
    const allowedExtensions = ['.csv', '.json'];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));

    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and JSON files are supported'));
    }
  },
});

// All routes require authentication
router.use(authenticate);

// Parse uploaded file and return columns + rows + suggested mappings
router.post('/parse', upload.single('file'), parseImportFile);

// Execute import with mapped fields and selected rows
router.post('/execute', executeImport);

module.exports = router;
```

**Step 2: Register the route in server.js**

In `server/server.js`, add after line 15 (the dependencyRoutes import):

```javascript
const importRoutes = require('./routes/import');
```

And add after line 88 (the dependencies route registration):

```javascript
app.use('/api/import', importRoutes);
```

**Step 3: Commit**

```bash
cd /c/Users/steve/Project-Manager
git add server/routes/import.js server/server.js
git commit -m "feat: add import API routes with file upload support"
```

---

### Task 4: Add import API functions (frontend)

**Files:**
- Modify: `src/services/api.js`

**Step 1: Add importAPI to api.js**

Add after the `dependenciesAPI` export (after line 142):

```javascript
// Import API
export const importAPI = {
  parseFile: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('authToken');
    return fetch(`${API_BASE_URL}/import/parse`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || 'Failed to parse file');
      return data;
    });
  },
  execute: (data) =>
    apiRequest('/import/execute', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
```

Note: `parseFile` uses raw `fetch` instead of `apiRequest` because we need to send `FormData` (no `Content-Type: application/json` header — the browser sets the multipart boundary automatically).

**Step 2: Commit**

```bash
cd /c/Users/steve/Project-Manager
git add src/services/api.js
git commit -m "feat: add import API client functions"
```

---

### Task 5: Create ImportTasksModal component (frontend)

**Files:**
- Create: `src/components/ImportTasksModal.js`

**Step 1: Create the multi-step import modal**

Create `src/components/ImportTasksModal.js` — a 4-step modal:

1. **Upload step** — File dropzone/picker accepting .csv and .json
2. **Field Mapping step** — Table of detected columns with dropdowns to map each to a system field
3. **Preview step** — Checkbox table showing parsed tasks with validation warnings, subtasks indented
4. **Results step** — Summary showing created/failed counts

The component should:
- Accept props: `projectId`, `onClose`, `onImportComplete` (callback to reload tasks)
- Use `importAPI.parseFile()` and `importAPI.execute()`
- Match existing modal styling (same as CreateTaskModal — `fixed inset-0 bg-black bg-opacity-50`, white rounded-lg card, primary-600 buttons)
- Use Lucide icons: `X`, `Upload`, `FileText`, `Check`, `AlertTriangle`, `ChevronRight`
- Show step indicator at top (Step 1 of 4, Step 2 of 4, etc.)
- Allow going back between steps
- In preview step: checkboxes for each row, "Select All" / "Deselect All", subtask rows indented with left padding
- Validation warnings: orange inline text for invalid priority/status values, missing parent references

Full implementation code is in the component file — follow the patterns from `CreateTaskModal.js`:
- Same modal wrapper: `fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50`
- Same card: `bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto` (wider than create modal to fit table)
- Same header pattern: title + X close button with `border-b border-gray-200`
- Same button styles: `bg-primary-600 text-white rounded-lg hover:bg-primary-700` for primary, `border border-gray-300 text-gray-700` for secondary

**Step 2: Commit**

```bash
cd /c/Users/steve/Project-Manager
git add src/components/ImportTasksModal.js
git commit -m "feat: add ImportTasksModal with 4-step import flow"
```

---

### Task 6: Add Import button to ProjectPage

**Files:**
- Modify: `src/pages/ProjectPage.js`

**Step 1: Add import state and button**

In `src/pages/ProjectPage.js`:

1. Add `Upload` to the lucide-react import (line 3)
2. Add `import ImportTasksModal from '../components/ImportTasksModal';` after line 18
3. Add state: `const [showImportModal, setShowImportModal] = useState(false);` after line 26
4. Add the import button in the header toolbar, before the Gmail button (before line 94). Use the same button style as the Gmail/Share/Settings buttons:

```jsx
<button
  onClick={() => setShowImportModal(true)}
  className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
  title="Import tasks"
>
  <Upload className="w-4 h-4" />
  <span className="hidden sm:inline">Import</span>
</button>
```

5. Add the modal render in the modals section (after the GmailPickerModal, before the closing `</div>`):

```jsx
{showImportModal && (
  <ImportTasksModal
    projectId={projectId}
    onClose={() => setShowImportModal(false)}
    onImportComplete={() => loadTasks(projectId)}
  />
)}
```

Note: `loadTasks` comes from `ProjectContext` — it's already destructured at line 21 via `loadProject`, but we need to also destructure `loadTasks`. Update line 21 to:

```javascript
const { currentProject, loadProject, loadTasks, loading } = useContext(ProjectContext);
```

**Step 2: Commit**

```bash
cd /c/Users/steve/Project-Manager
git add src/pages/ProjectPage.js
git commit -m "feat: add Import button to project page header"
```

---

### Task 7: Manual testing and verification

**Step 1: Start the dev server**

Run: `cd /c/Users/steve/Project-Manager && npm run dev`

**Step 2: Test CSV import**

Create a test CSV file at `docs/plans/test-import.csv`:

```csv
Title,Description,Priority,Status,Start Date,End Date,Parent Task,Assignees
Build landing page,Design and build homepage,high,todo,2026-04-01,2026-04-15,,
Header section,Create header component,medium,todo,2026-04-01,2026-04-05,Build landing page,
Footer section,Create footer component,low,todo,2026-04-06,2026-04-10,Build landing page,
```

- Navigate to a project
- Click "Import" button
- Upload the CSV file
- Verify field mapping auto-detection
- Adjust any mappings
- Verify preview shows 3 rows (1 parent, 2 subtasks indented)
- Deselect/reselect a row
- Click Import
- Verify tasks appear in the board

**Step 3: Test JSON import**

Create a test JSON file at `docs/plans/test-import.json`:

```json
{
  "tasks": [
    {
      "title": "API Development",
      "description": "Build REST API endpoints",
      "priority": "high",
      "status": "todo",
      "subtasks": [
        { "title": "Auth endpoints", "priority": "high" },
        { "title": "CRUD endpoints", "priority": "medium" }
      ]
    }
  ]
}
```

- Upload the JSON file
- Verify field mapping works for JSON keys
- Verify subtasks show correctly in preview
- Import and verify

**Step 4: Final commit**

```bash
cd /c/Users/steve/Project-Manager
git add docs/plans/test-import.csv docs/plans/test-import.json
git commit -m "feat: add test import files for CSV and JSON"
```
