# Hierarchy e2e flow

End-to-end test of the task/project hierarchy UX (design: `docs/plans/2026-07-08-task-project-hierarchy-ux-design.md`), driving the real frontend and backend against a test database in Chromium.

`playwright.config.e2e.js` starts both servers itself (backend `:5000`, CRA dev server `:3000`) — you don't start them by hand. Auth is programmatic: `hierarchy.setup.js` seeds a test user, mints a JWT with `JWT_SECRET`, and pre-loads it into `localStorage` (no interactive Google OAuth).

## Prerequisites

- A local, **disposable** Postgres whose database name contains `test`/`dev` (the helper refuses anything else, so it can never touch the Neon URL in `server/.env`). Create one, e.g. `project_manager_test`. Migrations `000–004` are applied automatically by the setup.
- `npm ci` at the repo root and in `server/`.
- `npx playwright install chromium`.

## Run

```bash
JWT_SECRET=<any-local-secret> \
E2E_DATABASE_URL=postgres://<user>:<pw>@localhost:5432/project_manager_test \
npm run test:e2e:flow
```

`JWT_SECRET` just has to be the same value the minted token and the backend share — the config passes it to both. On Windows, the readiness probes use `127.0.0.1` (not `localhost`) on purpose; do not set `HOST` for the CRA server (it trips a CRA 5 dev-server bug).

## CI

`.github/workflows/e2e-tests.yml` runs this on PRs to `master` with a `postgres:16` service; Playwright starts the servers inside the job.
