# 001 — Commit the Project-Manager working tree, safely

**Status: READY**

Steve, 12 September 2026: *"Create a handoff task to commit project management."*

This repo has not had a handoff queue before. The convention is borrowed from the CRM repo:
instructions arrive as numbered files in `docs/handoff/tasks/`; do the lowest-numbered task whose
`Status:` line says READY; report back as a file and commit it.

**Steve is not a developer.** Report outcomes, not code. Say what changed, what you left alone, and
what he should check. If you make a judgement call, say so in one plain sentence and give him the
option to reverse it.

Work on `master`, in `C:\Users\steve\Project-Manager`. Do not create branches. Do not create
worktrees. Do not push unless Steve asks.

---

## The situation

`git status` on `master` (in sync with `origin/master`) shows:

```
 M .claude/settings.local.json
?? .claude/launch.json
?? .claude/worktrees/
?? _t1.js
?? _to_delete/
?? docs/plans/2026-03-22-task-import-design.md
?? playwright-report/
?? setup-sbir-project.js
?? test-results/
?? tests/e2e/.auth/
?? tests/e2e/project-hierarchy.spec.js
```

The goal is that nothing of value is lost. The goal is **not** to commit all of it — two of those
entries should never be committed.

---

## Do these in order

### 1. Check `.claude/worktrees/` first, before anything else

Worktrees have previously been a source of lost work in Steve's repos: uncommitted changes sitting
in prunable directories, invisible from the main checkout. The CRM repo bans them outright for this
reason.

List what is in there. For each, report whether it has uncommitted changes or unmerged commits.
**Delete nothing.** If there is real work in a worktree, stop and tell Steve before going further —
that is the whole point of doing this step first.

### 2. Do not commit `tests/e2e/.auth/`

Playwright writes saved authentication state there — session tokens. Committing it puts credentials
into git history, where removing them is painful.

`.gitignore` already covers `auth-state.json`, `auth-token.txt`, `save-auth-session.js`,
`find-auth-data.html` and `copy-auth-token.md` (lines 29–42). It does **not** cover this directory.
That is the gap.

### 3. Extend `.gitignore`

Add, with a short comment for each:

```
tests/e2e/.auth/
.claude/worktrees/
test-results/
playwright-report/
```

`.claude/settings.local.json` is local machine settings and is already tracked and modified. Ask
Steve whether he wants it ignored going forward or the current change committed — do not decide
that one alone.

### 4. Commit the real work

- `setup-sbir-project.js`
- `docs/plans/2026-03-22-task-import-design.md`
- `tests/e2e/project-hierarchy.spec.js`
- `.claude/launch.json` — only if it is machine-independent; if it contains local paths, ignore it
  instead

Look at each one briefly and say in the report what it actually is. A one-line description each is
enough.

### 5. Leave alone and ask

- `_to_delete/` — files someone moved aside for deletion. Do not remove and do not commit. Report
  what is in there so Steve can decide.
- `_t1.js` — looks like scratch. Ask rather than assume.

---

## Report

Write `docs/handoff/REPORT-2026-09-13.md` (use the real date) and **commit it**.

It should say: what you committed and why; what you deliberately excluded and why; what you found in
`.claude/worktrees/`; what is in `_to_delete/`; anything you could not verify; and any judgement call
you made so it can be reversed.

Then give Steve a few lines in chat so he knows where things stand. The file is the record; the chat
is the courtesy.
