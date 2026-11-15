-- Task 042 (WES CRM handoff, 15 Nov 2026): "Private" inside Project Manager.
--
--   projects.privacy, tasks.privacy   'business' (everyone the project is shared with sees it, as
--                                      before) | 'private' (only its owner: projects.owner_id,
--                                      tasks.created_by). Every existing row starts as 'business'.
--   privacy_change_log                every switch Business <-> Private (who, when).
--
--   pm_project_role(project, user)    'owner' | 'editor' | 'viewer' | NULL: the user's role on the
--                                      project, taken from the project or the nearest parent
--                                      project (members are copied down to sub-projects, but a
--                                      member of a parent always counted as able to see its
--                                      sub-projects).
--   pm_project_visible(project, user) the user has a role there AND neither the project nor any
--                                      parent project is someone else's Private project.
--   pm_task_visible(task, user)       its project is visible AND neither the task nor any parent
--                                      task is someone else's Private task.
--
-- Safe to run more than once (the migration runner re-runs every file).

ALTER TABLE projects ADD COLUMN IF NOT EXISTS privacy TEXT NOT NULL DEFAULT 'business';
ALTER TABLE tasks    ADD COLUMN IF NOT EXISTS privacy TEXT NOT NULL DEFAULT 'business';

DO $$ BEGIN
  ALTER TABLE projects ADD CONSTRAINT projects_privacy_check CHECK (privacy IN ('business', 'private'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE tasks ADD CONSTRAINT tasks_privacy_check CHECK (privacy IN ('business', 'private'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_projects_not_business ON projects (owner_id) WHERE privacy <> 'business';
CREATE INDEX IF NOT EXISTS idx_tasks_not_business ON tasks (created_by) WHERE privacy <> 'business';

CREATE TABLE IF NOT EXISTS privacy_change_log (
  id           SERIAL PRIMARY KEY,
  record_type  TEXT NOT NULL,              -- project | task
  record_id    INTEGER NOT NULL,
  record_name  TEXT,
  old_privacy  TEXT,
  new_privacy  TEXT NOT NULL,
  changed_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  changed_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  via          TEXT,                       -- switch | follows_parent | crm
  parent_type  TEXT,
  parent_id    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_privacy_change_log_record ON privacy_change_log (record_type, record_id, changed_at DESC);

CREATE OR REPLACE FUNCTION pm_project_role(p_id INTEGER, u_id INTEGER) RETURNS TEXT
LANGUAGE sql STABLE AS $fn$
  WITH RECURSIVE chain AS (
    SELECT id, parent_project_id, owner_id, 0 AS lvl FROM projects WHERE id = p_id
    UNION ALL
    SELECT p.id, p.parent_project_id, p.owner_id, c.lvl + 1
      FROM projects p JOIN chain c ON p.id = c.parent_project_id
     WHERE c.lvl < 10
  )
  SELECT CASE
           WHEN (SELECT owner_id FROM projects WHERE id = p_id) = u_id THEN 'owner'
           ELSE (SELECT CASE WHEN c.owner_id = u_id THEN 'owner' ELSE m.role END
                   FROM chain c
                   LEFT JOIN project_members m ON m.project_id = c.id AND m.user_id = u_id
                  WHERE c.owner_id = u_id OR m.user_id IS NOT NULL
                  ORDER BY c.lvl
                  LIMIT 1)
         END
$fn$;

CREATE OR REPLACE FUNCTION pm_project_visible(p_id INTEGER, u_id INTEGER) RETURNS BOOLEAN
LANGUAGE sql STABLE AS $fn$
  WITH RECURSIVE chain AS (
    SELECT id, parent_project_id, owner_id, privacy, 0 AS lvl FROM projects WHERE id = p_id
    UNION ALL
    SELECT p.id, p.parent_project_id, p.owner_id, p.privacy, c.lvl + 1
      FROM projects p JOIN chain c ON p.id = c.parent_project_id
     WHERE c.lvl < 10
  )
  SELECT pm_project_role(p_id, u_id) IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM chain WHERE privacy <> 'business' AND owner_id IS DISTINCT FROM u_id)
$fn$;

CREATE OR REPLACE FUNCTION pm_task_visible(t_id INTEGER, u_id INTEGER) RETURNS BOOLEAN
LANGUAGE sql STABLE AS $fn$
  WITH RECURSIVE chain AS (
    SELECT id, parent_task_id, created_by, privacy, project_id, 0 AS lvl FROM tasks WHERE id = t_id
    UNION ALL
    SELECT t.id, t.parent_task_id, t.created_by, t.privacy, t.project_id, c.lvl + 1
      FROM tasks t JOIN chain c ON t.id = c.parent_task_id
     WHERE c.lvl < 20
  )
  SELECT EXISTS (SELECT 1 FROM chain WHERE lvl = 0)
     AND pm_project_visible((SELECT project_id FROM chain WHERE lvl = 0), u_id)
     AND NOT EXISTS (SELECT 1 FROM chain WHERE privacy <> 'business' AND created_by IS DISTINCT FROM u_id)
$fn$;
