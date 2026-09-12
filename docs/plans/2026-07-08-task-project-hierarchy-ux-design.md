# Task & Project Hierarchy UX

**Date:** 2026-07-08
**Status:** Implemented in `891af93` — all 5 items present in code; behaviour untested (see Verification)

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

## Verification (2026-09-11)

Code review of `891af93` against the five scoped changes. Tier: **presence only** — no
item below was executed. Verdicts use "present" = code exists and reads correct;
nothing here is "verified" in the sense of a test that would fail if it broke.

| # | Verdict | Evidence |
|---|---------|----------|
| 1 | Present | `server/controllers/taskController.js:347-478` |
| 2 | Present | `src/components/TaskListView.js:158`, `src/components/TaskDetailsModal.js:913` |
| 3 | Present, with deviation | `src/components/TaskDetailsModal.js:940-988` |
| 4 | Present, with caveat | `src/pages/ProjectPage.js:178`, `src/pages/DashboardPage.js:249`, `src/components/ProjectOverview.js:93` |
| 5 | Present | `src/components/CreateTaskModal.js:159` |

Item 1 was subsequently promoted from **Present** to **VERIFIED** — see "Item 1 regression
suite" below. Items 2–5 were likewise promoted to **VERIFIED** — see "Items 2–5 frontend
suite" below. (The open items on 3 and 4 — the plain `<select>` and the invariant-not-a-check
depth cap — still stand; the tests pin current behaviour, they don't resolve those notes.)

Item 1 carries every guard the design named — key-presence semantics (`null` promotes,
absent leaves unchanged), self-parent rejection, same-project check, recursive-CTE cycle
guard against the task's own subtree, recursive subtree depth recompute — plus an
unspecified extra: post-commit derived-status refresh on the old and new parents,
skipping now-childless ones.

Item 5 is full parity: create and edit both expose Title, Description, Start Date,
End Date, Priority, Status.

### Open items

- **Item 3 deviates.** The design specifies a *searchable* picker; a plain `<select>`
  shipped. Options are correctly scoped (same project, excludes self + descendants) but
  the control will not scale to a project with many tasks.
- **Item 4's depth cap is an invariant, not a check.** Only `ProjectPage`'s header
  button tests `depth < 2`. The two `DashboardPage` buttons and the two in
  `ProjectOverview` are ungated; they are unreachable at the cap today only because
  Dashboard offers them solely on top-level projects, and `ProjectOverview` renders only
  when `hasChildren` — which a depth-2 project can never be. If either condition
  changes, the button appears and the API rejects the create.

### Item 1 regression suite (added 2026-09-11)

`server/tests/taskHierarchy.test.js` (+ `server/tests/helpers/`) — 9 tests driving the
real `updateTask` controller against a local Postgres. Verdict for item 1: **VERIFIED**
— each test was shown to fail when its guard is broken, then pass when restored.

Covered: re-parent sets depth; promote-to-top on `null`; absent key leaves parent
unchanged; whole-subtree depth recompute; same-project guard; own-descendant cycle
guard; self-parent guard; parent-not-found 404; derived-status refresh on old + new
parent.

Discrimination proof: each guard was individually mutated in the controller and the
targeting test failed as expected; the controller was then restored byte-for-byte from
git. (Bypassing the cycle guard makes the depth-recompute CTE loop on the resulting
cyclic data — the suite's `statement_timeout` turns that into a fast failure rather than
a hang, which is itself evidence the guard is load-bearing.)

**How to run:**
```
cd server && npm install
# TEST_DATABASE_URL must be a LOCAL, disposable db (name contains "test"/"dev");
# the helper refuses anything else, so it can never touch the Neon url in server/.env.
TEST_DATABASE_URL=postgres://<user>:<pw>@localhost:5432/project_manager_test \
  npx jest tests/taskHierarchy.test.js --runInBand
```
The test db needs only the base schema (`database/migrations/000_initial_schema.sql`),
which already includes `tasks.parent_task_id` and `depth_level`.

> **Blocker to committing:** `.gitignore` ignores `*.test.js`, `server/tests/`, and
> `TESTING.md`, so this suite is untracked as written. It must be un-ignored (or the
> files force-added / renamed) before it can land and run in CI. Decision pending.

### Items 2–5 frontend suite (added 2026-09-11)

React Testing Library component tests (jsdom, no backend), run by CRA's jest and
guarded in CI by `.github/workflows/frontend-tests.yml`. Verdict for items 2–5:
**VERIFIED** — each was shown to fail when its production code is broken, then pass
when restored.

- **Item 2** — `src/components/__tests__/TaskListView.subtasks.test.js`: the "Add
  sub-task" control appears on nested rows (any depth), and opening it on a nested row
  uses that row as the parent. Also surfaced in `TaskDetailsModal.test.js`.
- **Item 3** — `src/components/__tests__/TaskDetailsModal.test.js`: promote calls
  `update(id, {parent_task_id: null})`; the re-parent picker excludes the task itself
  and its descendants; choosing a target and Move calls `update(id, {parent_task_id})`.
- **Item 4** — `src/pages/__tests__/ProjectPage.test.js`: the "Add Sub-Project" button
  shows below the depth cap, opens `CreateProjectModal` parented to the project, and is
  hidden at depth 2 (the 3-level cap).
- **Item 5** — `src/components/__tests__/CreateTaskModal.test.js`: the Status selector
  exists with all four statuses, defaults to `todo`, honours `initialStatus`, and the
  chosen status reaches the create payload.

Discrimination: each item's guard/affordance was mutated in the component (gate the
add-button to depth 0; drop the descendant filter; widen the depth cap; drop `status`
from the payload) and the targeting test failed; components were then restored from git.
The pre-existing `TaskListView.test.js` (written against a component API that never
existed — 3/3 failing) was repaired in passing. Full src suite: 16 pass, no act or
console warnings.

`.gitignore` un-ignores `src/**/__tests__/**` (as it already does `server/tests/`) so
these are tracked; root-level `*.test.js` scratch stays ignored.

### Usability tier — e2e flow (added 2026-09-11)

`tests/e2e/flow/hierarchy.spec.js` — a Playwright flow driving the **real frontend and
backend against a test database** in Chromium, guarded in CI by
`.github/workflows/e2e-tests.yml` (a `postgres:16` service; Playwright starts both
servers). This closes the usability gap: it exercises the actual rendered app, not a
mocked context.

The journey: sign in (programmatic — a seeded user + a minted JWT injected into
`localStorage`, no interactive OAuth) → create a project → add a task **with a status**
(item 5) → add a sub-task from a list row (item 2) → open the sub-task's details,
confirm the re-parent picker + promote affordance, and **promote it to top level**
(item 3), verifying it becomes a top-level sibling → create a **sub-project** from the
header button (item 4). Run locally with `npm run test:e2e:flow`; see
`tests/e2e/flow/README.md`.

Notes for whoever touches this next: auth is `tests/e2e/flow/hierarchy.setup.js`
(seed + mint, guarded to a local/disposable DB); on Windows the Playwright readiness
probes must use `127.0.0.1` (Node resolves `localhost` to `::1` first) and the CRA dev
server must not be given `HOST` (trips a CRA 5 `allowedHosts` bug).

### Still not verified

- **Deployment unknown.** Whether the prod deploy in the Testing section above ever
  happened is not determinable from the repository.
