# Manual Testing Checklist - Project Manager Application

**Date:** December 18, 2025
**Tester:** User
**Application:** Project Manager v1.0.0
**Automated Tests Passed:** 23/26 (88.5%)

---

## Prerequisites

- [ ] Backend server running on `http://localhost:5000`
- [ ] Frontend server running on `http://localhost:3000`
- [ ] Browser: Chrome (recommended)
- [ ] Google account ready for login
- [ ] DevTools console open (F12) for monitoring

---

## Test Section 1: Authentication & Initial Load

### 1.1 Login Flow
- [ ] Navigate to `http://localhost:3000`
- [ ] See login page with "Sign in with Google" button
- [ ] Click "Sign in with Google"
- [ ] Google OAuth popup appears
- [ ] Successfully authenticate with your Google account
- [ ] Redirect to dashboard after login
- [ ] No JavaScript errors in console

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Skip
**Notes:**

---

## Test Section 2: Dashboard & Project Access

### 2.1 Dashboard View
- [ ] Dashboard loads successfully
- [ ] See list of projects (at least "App2Care Rollout")
- [ ] Project cards display correctly
- [ ] Click on "App2Care Rollout" project
- [ ] Navigate to project page

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Skip
**Notes:**

---

## Test Section 3: Board View (Task List)

### 3.1 Board View Display
- [ ] Board view is the default view (or click Board button)
- [ ] See 4 status columns: To Do, In Progress, Review, Done
- [ ] Tasks are displayed in appropriate columns
- [ ] Task hierarchy visible (parent/child relationships)
- [ ] Expand/collapse arrows work for tasks with sub-tasks
- [ ] Task cards show: title, priority, assignees, dates

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Skip
**Notes:**

### 3.2 Task Interaction
- [ ] Click on a task to open details modal
- [ ] Modal shows all task information
- [ ] Close modal (X button or click outside)
- [ ] Try changing task status (dropdown or drag-and-drop if enabled)
- [ ] Status updates successfully

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Skip
**Notes:**

### 3.3 Task Creation
- [ ] Click "Add Task" or "+" button
- [ ] Task creation modal opens
- [ ] Fill in task details:
  - Title: "Test Task - Manual Testing"
  - Description: "Testing task creation"
  - Priority: High
  - Start date: Today
  - End date: Tomorrow
- [ ] Save task
- [ ] New task appears in the list
- [ ] No errors in console

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Skip
**Notes:**

### 3.4 Sub-task Creation
- [ ] Select an existing task
- [ ] Create a sub-task under it
- [ ] Sub-task appears indented under parent
- [ ] Expand/collapse parent task works
- [ ] Parent shows subtask count

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Skip
**Notes:**

---

## Test Section 4: Gantt View ✨ (NEWLY FIXED)

### 4.1 Gantt View Display
- [ ] Click Gantt Chart button (chart icon)
- [ ] View switches to Gantt chart
- [ ] **CRITICAL: Task bars are now visible** ✅
- [ ] See timeline with month/week labels
- [ ] See all 17 tasks with dates displayed as horizontal bars
- [ ] Task bars are color-coded by priority:
  - Gray = Low priority
  - Blue = Medium priority
  - Orange = High priority
  - Red = Urgent priority
- [ ] No black screen or blank areas

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Skip
**Notes:**

### 4.2 Gantt View Mode Switching
- [ ] Click "Day" button
- [ ] Timeline updates to day view
- [ ] Click "Week" button
- [ ] Timeline updates to week view
- [ ] Click "Month" button
- [ ] Timeline updates to month view
- [ ] Click "Year" button
- [ ] Timeline updates to year view
- [ ] **All view modes display task bars correctly**

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Skip
**Notes:**

### 4.3 Gantt Interactivity
- [ ] Hover over a task bar
- [ ] Tooltip appears with task details:
  - Task name
  - Status
  - Priority
  - Progress percentage
  - Assignees
  - Start/end dates
  - Parent task (if applicable)
  - Subtask count (if applicable)
- [ ] Click on a task bar
- [ ] Task details modal opens
- [ ] Close modal

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Skip
**Notes:**

### 4.4 Gantt Dependencies
- [ ] Look for arrow lines connecting dependent tasks
- [ ] Dependency arrows are visible
- [ ] Critical path tasks have red border/highlight
- [ ] Hover shows dependency information

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Skip
**Notes:**

### 4.5 Gantt Scrolling
- [ ] Scroll down to bottom of Gantt chart
- [ ] Scroll back up to top
- [ ] **No black screen appears** ✅ (previously reported issue)
- [ ] All task bars remain visible throughout scrolling

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Skip
**Notes:**

---

## Test Section 5: Board ↔ Gantt Switching

### 5.1 View Switching Functionality
- [ ] Start in Board view
- [ ] Click Gantt Chart button
- [ ] View switches immediately to Gantt
- [ ] Gantt button has white background (active state)
- [ ] Click Board button
- [ ] View switches immediately back to Board
- [ ] Board button has white background (active state)
- [ ] No delay or flickering during transitions

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Skip
**Notes:**

### 5.2 Rapid Switching Stress Test
- [ ] Click Board → Gantt → Board → Gantt rapidly 10 times
- [ ] All switches work smoothly
- [ ] No JavaScript errors
- [ ] No performance degradation
- [ ] Data remains consistent

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Skip
**Notes:**

---

## Test Section 6: Task Details & Management

### 6.1 Task Editing
- [ ] Open any task (from Board or Gantt view)
- [ ] Edit task title
- [ ] Edit description
- [ ] Change priority
- [ ] Update start/end dates
- [ ] Save changes
- [ ] Changes reflect in both Board and Gantt views

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Skip
**Notes:**

### 6.2 Task Assignments
- [ ] Open a task
- [ ] Assign a user or contact
- [ ] Save assignment
- [ ] Assignee name appears on task card
- [ ] Assignee shows in Gantt tooltip

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Skip
**Notes:**

### 6.3 Task Dependencies
- [ ] Open a task
- [ ] Navigate to dependencies section
- [ ] Add a dependency (task A depends on task B)
- [ ] Save dependency
- [ ] Check Gantt view for dependency arrow
- [ ] Verify dependency constraint works

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Skip
**Notes:**

### 6.4 Task Comments
- [ ] Open a task
- [ ] Navigate to comments section
- [ ] Add a comment: "Test comment from manual testing"
- [ ] Save comment
- [ ] Comment appears in comment list
- [ ] Comment shows timestamp and author

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Skip
**Notes:**

---

## Test Section 7: Google Drive Integration

### 7.1 Drive File Attachment
- [ ] Open a task
- [ ] Click "Attach Drive File" or similar button
- [ ] Google Drive file picker opens
- [ ] Browse your Drive files
- [ ] Select a file
- [ ] File attaches to task
- [ ] File appears in attachments list with thumbnail
- [ ] Click file link opens in Google Drive (new tab)

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Skip
**Notes:**

### 7.2 Drive File Management
- [ ] See attached files on task card
- [ ] Attachment count displays correctly
- [ ] Remove an attachment
- [ ] Attachment count decreases

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Skip
**Notes:**

---

## Test Section 8: Gmail Integration

### 8.1 Email Attachment
- [ ] Open a task
- [ ] Click "Attach Email" or similar button
- [ ] Gmail integration opens (or email picker)
- [ ] Select a Gmail message/thread
- [ ] Email attaches to task
- [ ] Email details visible (subject, sender, date)
- [ ] Click email opens in Gmail (new tab)

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Skip
**Notes:**

### 8.2 Email List Display
- [ ] Task shows email attachment count
- [ ] Can view list of attached emails
- [ ] Each email shows key metadata

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Skip
**Notes:**

---

## Test Section 9: Filters & Search

### 9.1 Filter Functionality (if available)
- [ ] Apply status filter (e.g., "In Progress only")
- [ ] Task list updates to show filtered tasks
- [ ] Gantt view also filters (if applicable)
- [ ] Clear filter
- [ ] All tasks reappear

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Skip
**Notes:**

### 9.2 Search (if available)
- [ ] Use search box
- [ ] Search for task: "iOS Requirements"
- [ ] Task appears in results
- [ ] Click result navigates to task

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Skip
**Notes:**

---

## Test Section 10: Project Management

### 10.1 Project Settings
- [ ] Access project settings
- [ ] Edit project name
- [ ] Edit project description
- [ ] Save changes
- [ ] Changes reflected in dashboard

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Skip
**Notes:**

### 10.2 Project Sharing (if available)
- [ ] Access share/members section
- [ ] Add a team member (email)
- [ ] Set member role (owner/editor/viewer)
- [ ] Save sharing settings
- [ ] Member added to project

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Skip
**Notes:**

---

## Test Section 11: Performance & Stability

### 11.1 Page Load Performance
- [ ] Refresh entire page (F5)
- [ ] Page loads in < 3 seconds
- [ ] All data loads correctly
- [ ] No visual glitches

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Skip
**Notes:**

### 11.2 Console Errors
- [ ] Check browser console (F12)
- [ ] **No critical errors (red)**
- [ ] Warnings acceptable (yellow)
- [ ] Note any recurring errors

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Skip
**Console Errors (if any):**

### 11.3 Memory Leaks
- [ ] Use app for 5 minutes (switch views, open tasks, etc.)
- [ ] Check browser memory (DevTools > Performance Monitor)
- [ ] Memory usage stable (not continuously increasing)

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Skip
**Notes:**

---

## Test Section 12: Logout & Session

### 12.1 Logout Flow
- [ ] Click logout/sign out button
- [ ] Successfully logged out
- [ ] Redirect to login page
- [ ] Cannot access protected pages without re-login

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Skip
**Notes:**

### 12.2 Session Persistence
- [ ] Log in
- [ ] Close browser tab (don't logout)
- [ ] Reopen `http://localhost:3000`
- [ ] Still logged in (session persisted)
- [ ] Can access projects immediately

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Skip
**Notes:**

---

## Final Results Summary

### Overall Status
- **Total Tests:** _____ / 50+
- **Passed:** _____
- **Failed:** _____
- **Skipped:** _____
- **Success Rate:** _____%

### Critical Issues Found
1.
2.
3.

### Non-Critical Issues Found
1.
2.
3.

### Recommendations
1.
2.
3.

---

## Sign-off

**Tester Name:** ___________________
**Date Completed:** ___________________
**Overall Assessment:** ⬜ Production Ready / ⬜ Needs Minor Fixes / ⬜ Needs Major Fixes

**Additional Comments:**


---

**END OF MANUAL TEST CHECKLIST**
