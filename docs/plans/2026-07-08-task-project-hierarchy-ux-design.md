# Task & Project Hierarchy UX

**Date:** 2026-07-08
**Status:** Design complete — pending implementation

## Problem

The CRM assigns emails into PM as tasks. The data model + most of the API already support hierarchy, but the app doesn't let a user *create* or *rearrange* it from where they work, so it's effectively unreachable. Steve (reviewing email, creating tasks in a project) could not find how to make a subtask or a sub-project.

## Verified current state

- **DB:** `tasks.parent_task_id` + `depth_level` (no cap); `projects.parent_project_id` + `depth` (capped at 3 levels).
- **API:**
  - `createTask` **accepts `parent_task_id`** and computes `depth_level = parent.depth_level + 1`. ✅
  - `createProject` **accepts `parent_project_id`**, computes depth, and enforces **max depth 3**. ✅
  - `updateTask` does **NOT** accept `parent_task_id` — so a task's parent can't be changed. ❌ (this is the real backend gap)
- **Frontend:**
  - `CreateTaskModal` accepts `parentTaskId` (renders "Create New Sub-Task"); missing a **status** field vs edit.
  - `CreateProjectModal` fully supports sub-projects (`parentProjectId` → "Create Sub-Project"), but the **launch button is only reachable from limited spots**.
  - "Add subtask" affordance exists only on **Board (kanban) cards**, and only at `depth === 0` — not in List view or Task Details, which is where Steve works.
  - List/Board render nested tasks recursively.

## Changes (scope)

1. **Backend — `updateTask` re-parent/promote.** Accept optional `parent_task_id` (value = new parent, `null` = promote to top-level). Validate: new parent is in the same project and is **not the task itself or one of its descendants** (cycle guard). On change, recompute `depth_level` for the task **and its entire subtree** (recursive CTE or app-side walk). No project change.

2. **Frontend — surface "Add subtask"** in **TaskListView** rows and **TaskDetailsModal**, at **any depth** (drop the `depth === 0` restriction), launching `CreateTaskModal` with the parent.

3. **Frontend — re-parent + promote** in **TaskDetailsModal**: "Make subtask of…" (searchable picker of other tasks in the same project, excluding self + descendants) and "Promote to top-level task". Wired to the extended `updateTask`.

4. **Frontend — "Add sub-project" button** on a project (projects list / overview), launching the existing `CreateProjectModal` with `parentProjectId` (respects the 3-level cap; hide/disable at max depth).

5. **Frontend — create-task field parity:** add the **status** selector (and any other edit-only fields found) to `CreateTaskModal`.

## Testing

Dev PM stack: local PM API on `:5001` against `project_manager_dev`, plus the PM frontend dev server pointed at it. Verify: create subtask (list + details, nested), re-parent an existing task (incl. one with its own subtasks), promote back, create sub-project, create task with status. Then deploy PM to prod (`vercel redeploy` for the API per the Root-Directory quirk; standard deploy for the frontend).

## Out of scope

Drawing/dragging dependencies on the Gantt (separate, larger feature). Dependencies remain available via the existing dialog.
