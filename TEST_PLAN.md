# Comprehensive Test Plan - Project Manager Application

## Overview
This document outlines the complete test plan for the Project Manager application, covering both backend API and frontend UI testing.

## Test Environment
- **Backend**: Node.js/Express on port 5000
- **Frontend**: React development server on port 3000
- **Database**: PostgreSQL (project_manager database)
- **Browser**: Headless Chromium via Puppeteer

---

## Backend API Tests

### 1. Database Connectivity
- [ ] Connect to PostgreSQL database
- [ ] Verify all required tables exist
- [ ] Check table relationships and foreign keys
- [ ] Verify indexes are in place

### 2. Authentication Endpoints
- [ ] POST /api/auth/google - OAuth initiation
- [ ] GET /api/auth/google/callback - OAuth callback
- [ ] POST /api/auth/logout - User logout
- [ ] Token validation and expiration

### 3. Project Management Endpoints
- [ ] GET /api/projects - List all projects (with authorization)
- [ ] POST /api/projects - Create new project
- [ ] GET /api/projects/:id - Get project details
- [ ] PUT /api/projects/:id - Update project
- [ ] DELETE /api/projects/:id - Delete project
- [ ] POST /api/projects/:id/share - Share project

### 4. Task Management Endpoints
- [ ] GET /api/tasks?project_id=X - List tasks for project
- [ ] POST /api/tasks - Create task
- [ ] GET /api/tasks/:id - Get task details
- [ ] PUT /api/tasks/:id - Update task
- [ ] DELETE /api/tasks/:id - Delete task
- [ ] Test hierarchical relationships (parent/child tasks)
- [ ] Test task dependencies
- [ ] Test task assignments

### 5. Google Integration Endpoints
- [ ] GET /api/google/contacts - Fetch contacts
- [ ] POST /api/google/drive/attach - Attach Drive file
- [ ] POST /api/google/gmail/create-task - Create task from email
- [ ] GET /api/google/drive/files - Browse Drive files

### 6. Error Handling
- [ ] Invalid authentication tokens
- [ ] Missing required fields
- [ ] Invalid project/task IDs
- [ ] Database connection errors
- [ ] Rate limiting (if implemented)

---

## Frontend UI Tests

### 1. Application Load
- [ ] Application loads without errors
- [ ] All assets load (CSS, JS, images)
- [ ] No console errors on initial load
- [ ] Proper routing configuration

### 2. Authentication Flow
- [ ] Login page displays correctly
- [ ] Google OAuth button works
- [ ] Redirect to dashboard after login
- [ ] Logout functionality
- [ ] Session persistence

### 3. Dashboard/Project List
- [ ] Projects list displays
- [ ] Create new project button works
- [ ] Project cards render correctly
- [ ] Search/filter functionality (if exists)

### 4. Project Page - Board View
- [ ] Project details header displays
- [ ] Task list renders
- [ ] Hierarchical tasks display correctly
- [ ] Create new task modal opens
- [ ] Task status updates work
- [ ] Task details modal opens
- [ ] Expand/collapse subtasks

### 5. Project Page - Gantt View
- [ ] Switch from Board to Gantt view
- [ ] Gantt chart renders without errors
- [ ] Tasks appear as bars on timeline
- [ ] Dependencies show correctly
- [ ] Date range selector works
- [ ] Zoom controls function
- [ ] Task drag-to-update dates
- [ ] Critical path highlighting

### 6. View Switching (Critical Issue)
- [ ] Board button toggles to Board view
- [ ] Gantt button toggles to Gantt view
- [ ] Active button highlights correctly
- [ ] View state persists during session
- [ ] No console errors during switch
- [ ] Content renders after switch

### 7. Task Management
- [ ] Create task form validation
- [ ] Edit task updates correctly
- [ ] Delete task with confirmation
- [ ] Assign task to contact
- [ ] Attach Drive files
- [ ] Add comments
- [ ] Set dependencies
- [ ] Set priority and status

### 8. Google Integrations
- [ ] Contact picker displays
- [ ] Drive file picker displays
- [ ] Gmail email picker displays
- [ ] File attachments show correctly
- [ ] Email links work

### 9. Responsive Design
- [ ] Desktop layout (1920x1080)
- [ ] Tablet layout (768x1024)
- [ ] Mobile layout (375x667)
- [ ] Touch interactions

### 10. Performance
- [ ] Initial load time < 3 seconds
- [ ] View switching < 500ms
- [ ] Task list with 100+ tasks performs well
- [ ] Gantt chart with 50+ tasks renders smoothly

---

## Integration Tests

### 1. End-to-End Workflows
- [ ] Create project → Add tasks → Switch views → Edit task
- [ ] Create task from Gmail → Assign to contact → Attach Drive file
- [ ] Share project → Collaborator views → Collaborator edits
- [ ] Create parent task → Add subtasks → Update parent status

### 2. Data Consistency
- [ ] Task updates reflect in both Board and Gantt views
- [ ] Database changes reflect in UI immediately
- [ ] Multiple tabs/windows stay in sync (if applicable)

---

## Test Execution Plan

1. **Backend Tests**: Run API endpoint tests with mock data
2. **Database Tests**: Verify schema and data integrity
3. **Frontend Unit Tests**: Test individual components
4. **Integration Tests**: Test complete user workflows
5. **View Switch Test**: Specifically test Board ↔ Gantt switching
6. **Performance Tests**: Measure load times and responsiveness
7. **Error Recovery**: Test error handling and edge cases

---

## Success Criteria

- All backend endpoints return expected responses
- All frontend components render without errors
- Board to Gantt view switching works flawlessly
- No console errors during normal operation
- All user workflows complete successfully
- Application performs well with realistic data volumes

---

## Known Issues to Verify

1. **Board to Gantt View Switching**: Previous tests showed authentication blocking automated testing
2. **Gantt Chart Rendering**: Verify Frappe Gantt library initializes correctly
3. **Task Dependencies**: Ensure dependency logic works across views

---

## Test Results

Results will be documented in `TEST_RESULTS.md` after execution.
