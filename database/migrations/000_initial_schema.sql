-- ============================================
-- INITIAL SCHEMA - Project Manager
-- ============================================
-- This migration creates the complete initial database schema
-- Safe to run multiple times (idempotent with IF NOT EXISTS)
-- Created: 2025-12-26

-- ============================================
-- USERS TABLE
-- Stores user information from Google OAuth
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    google_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    picture VARCHAR(500),

    -- Google OAuth tokens (encrypted in production)
    access_token TEXT,
    refresh_token TEXT,
    token_expiry TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PROJECTS TABLE
-- Stores project information
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Project settings
    color VARCHAR(7) DEFAULT '#0ea5e9', -- Hex color code
    is_archived BOOLEAN DEFAULT FALSE,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PROJECT_MEMBERS TABLE
-- Manages project sharing and team members
-- ============================================
CREATE TABLE IF NOT EXISTS project_members (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Role can be: 'owner', 'editor', 'viewer'
    role VARCHAR(20) NOT NULL DEFAULT 'editor',

    -- Metadata
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    added_by INTEGER REFERENCES users(id),

    UNIQUE(project_id, user_id)
);

-- ============================================
-- TASKS TABLE
-- Stores task information
-- ============================================
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    -- Task details
    title VARCHAR(500) NOT NULL,
    description TEXT,

    -- Dates
    start_date DATE,
    end_date DATE,

    -- Status: 'todo', 'in_progress', 'review', 'done'
    status VARCHAR(20) DEFAULT 'todo',

    -- Priority: 'low', 'medium', 'high', 'urgent'
    priority VARCHAR(20) DEFAULT 'medium',

    -- Task ordering for drag and drop
    position INTEGER,

    -- Gmail integration - store email ID if task was created from email
    gmail_message_id VARCHAR(255),
    gmail_thread_id VARCHAR(255),

    -- Hierarchical task support (sub-tasks)
    parent_task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    depth_level INTEGER DEFAULT 0,

    -- Metadata
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- ============================================
-- TASK_ASSIGNEES TABLE
-- Manages task assignments (multiple people per task)
-- ============================================
CREATE TABLE IF NOT EXISTS task_assignees (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

    -- Can be a system user or external contact from Google Contacts
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

    -- Google Contact information (for non-system users)
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_google_id VARCHAR(255),

    -- Metadata
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INTEGER REFERENCES users(id),

    -- Either user_id or contact_email must be present
    CONSTRAINT assignee_check CHECK (
        user_id IS NOT NULL OR contact_email IS NOT NULL
    )
);

-- ============================================
-- TASK_ATTACHMENTS TABLE
-- Stores Google Drive file attachments
-- ============================================
CREATE TABLE IF NOT EXISTS task_attachments (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

    -- Google Drive file information
    drive_file_id VARCHAR(255) NOT NULL,
    file_name VARCHAR(500) NOT NULL,
    file_type VARCHAR(100), -- MIME type
    file_size BIGINT, -- Size in bytes
    drive_url TEXT NOT NULL,
    thumbnail_url TEXT,

    -- Metadata
    uploaded_by INTEGER NOT NULL REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TASK_COMMENTS TABLE
-- Stores comments on tasks
-- ============================================
CREATE TABLE IF NOT EXISTS task_comments (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    comment TEXT NOT NULL,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_edited BOOLEAN DEFAULT FALSE
);

-- ============================================
-- TASK_DEPENDENCIES TABLE
-- Stores task dependency relationships
-- ============================================
CREATE TABLE IF NOT EXISTS task_dependencies (
    id SERIAL PRIMARY KEY,

    -- The task that is dependent (blocked task)
    dependent_task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

    -- The task that must be completed first (blocking task)
    depends_on_task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

    -- Dependency type:
    -- 'finish_to_start' (FS): Task B starts when Task A finishes (most common)
    -- 'start_to_start' (SS): Task B starts when Task A starts
    -- 'finish_to_finish' (FF): Task B finishes when Task A finishes
    -- 'start_to_finish' (SF): Task B finishes when Task A starts (rare)
    dependency_type VARCHAR(20) DEFAULT 'finish_to_start',

    -- Lag time in days (can be negative for lead time)
    lag_days INTEGER DEFAULT 0,

    -- Link point percentages (for Gantt chart visual linking)
    from_point INTEGER DEFAULT 100, -- end of source task
    to_point INTEGER DEFAULT 0,     -- start of target task

    -- Metadata
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Prevent circular dependencies (enforced at application level)
    -- Prevent duplicate dependencies
    UNIQUE(dependent_task_id, depends_on_task_id),

    -- Prevent self-dependencies
    CONSTRAINT no_self_dependency CHECK (dependent_task_id != depends_on_task_id)
);

-- ============================================
-- TASK_EMAILS TABLE
-- Stores Gmail messages attached to tasks
-- ============================================
CREATE TABLE IF NOT EXISTS task_emails (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

    -- Gmail message information
    message_id VARCHAR(255) NOT NULL,
    thread_id VARCHAR(255),
    subject TEXT,
    sender VARCHAR(500),
    recipient VARCHAR(500),
    email_date TIMESTAMP,
    snippet TEXT,
    has_attachments BOOLEAN DEFAULT FALSE,

    -- Metadata
    attached_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Prevent duplicate emails on same task
    UNIQUE(task_id, message_id)
);

-- ============================================
-- INDEXES for Performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_archived ON projects(is_archived);

CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_position ON tasks(project_id, position);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);

CREATE INDEX IF NOT EXISTS idx_task_assignees_task ON task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user ON task_assignees(user_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_email ON task_assignees(contact_email);

CREATE INDEX IF NOT EXISTS idx_task_attachments_task ON task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_drive_file ON task_attachments(drive_file_id);

CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_user ON task_comments(user_id);

CREATE INDEX IF NOT EXISTS idx_task_dependencies_dependent ON task_dependencies(dependent_task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on ON task_dependencies(depends_on_task_id);

CREATE INDEX IF NOT EXISTS idx_task_emails_task_id ON task_emails(task_id);
CREATE INDEX IF NOT EXISTS idx_task_emails_message_id ON task_emails(message_id);

-- ============================================
-- TRIGGERS for updated_at timestamps
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at') THEN
        CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_projects_updated_at') THEN
        CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_tasks_updated_at') THEN
        CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_task_comments_updated_at') THEN
        CREATE TRIGGER update_task_comments_updated_at BEFORE UPDATE ON task_comments
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END$$;

-- ============================================
-- HELPER VIEWS
-- ============================================

-- View to get task hierarchy (parent-child relationships)
CREATE OR REPLACE VIEW task_hierarchy AS
SELECT
    t.id,
    t.title,
    t.parent_task_id,
    t.depth_level,
    t.project_id,
    t.status,
    pt.title as parent_title
FROM tasks t
LEFT JOIN tasks pt ON t.parent_task_id = pt.id;

-- View to get all dependencies for a task
CREATE OR REPLACE VIEW task_dependency_details AS
SELECT
    td.id,
    td.dependent_task_id,
    td.depends_on_task_id,
    td.dependency_type,
    td.lag_days,
    td.from_point,
    td.to_point,
    t1.title as dependent_task_title,
    t1.status as dependent_task_status,
    t2.title as depends_on_task_title,
    t2.status as depends_on_task_status,
    t2.completed_at as depends_on_completed_at
FROM task_dependencies td
INNER JOIN tasks t1 ON td.dependent_task_id = t1.id
INNER JOIN tasks t2 ON td.depends_on_task_id = t2.id;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function: Check for circular dependencies
CREATE OR REPLACE FUNCTION check_circular_dependency(
    p_dependent_task_id INTEGER,
    p_depends_on_task_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_has_cycle BOOLEAN;
BEGIN
    -- Use recursive CTE to detect cycles
    WITH RECURSIVE dep_chain AS (
        -- Base case: direct dependency
        SELECT depends_on_task_id as task_id
        FROM task_dependencies
        WHERE dependent_task_id = p_depends_on_task_id

        UNION

        -- Recursive case: follow the chain
        SELECT td.depends_on_task_id
        FROM task_dependencies td
        INNER JOIN dep_chain dc ON td.dependent_task_id = dc.task_id
    )
    SELECT EXISTS(
        SELECT 1 FROM dep_chain WHERE task_id = p_dependent_task_id
    ) INTO v_has_cycle;

    RETURN v_has_cycle;
END;
$$ LANGUAGE plpgsql;

-- Function: Get all sub-tasks recursively
CREATE OR REPLACE FUNCTION get_all_subtasks(p_task_id INTEGER)
RETURNS TABLE(
    task_id INTEGER,
    task_title VARCHAR,
    task_status VARCHAR,
    level INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE subtask_tree AS (
        -- Base case: direct children
        SELECT
            t.id,
            t.title,
            t.status,
            1 as level
        FROM tasks t
        WHERE t.parent_task_id = p_task_id

        UNION ALL

        -- Recursive case: children of children
        SELECT
            t.id,
            t.title,
            t.status,
            st.level + 1
        FROM tasks t
        INNER JOIN subtask_tree st ON t.parent_task_id = st.id
    )
    SELECT id, title, status, level FROM subtask_tree;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TABLE COMMENTS
-- ============================================
COMMENT ON TABLE users IS 'Stores user authentication and profile information from Google OAuth';
COMMENT ON TABLE projects IS 'Stores project information and settings';
COMMENT ON TABLE project_members IS 'Manages project sharing and team member access with roles';
COMMENT ON TABLE tasks IS 'Stores task information with support for hierarchy and dependencies';
COMMENT ON TABLE task_assignees IS 'Manages task assignments to users and Google Contacts';
COMMENT ON TABLE task_attachments IS 'Stores Google Drive file attachments linked to tasks';
COMMENT ON TABLE task_comments IS 'Stores comments and discussions on tasks';
COMMENT ON TABLE task_dependencies IS 'Stores task dependency relationships for project scheduling';
COMMENT ON TABLE task_emails IS 'Stores Gmail messages attached to tasks';

-- Migration completed successfully
