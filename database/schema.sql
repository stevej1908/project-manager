-- Project Manager Database Schema
-- PostgreSQL 12+
-- Created: 2025-12-03

-- ============================================
-- DROP EXISTING TABLES (for clean setup)
-- ============================================
DROP TABLE IF EXISTS task_attachments CASCADE;
DROP TABLE IF EXISTS task_assignees CASCADE;
DROP TABLE IF EXISTS task_comments CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS project_members CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================
-- USERS TABLE
-- Stores user information from Google OAuth
-- ============================================
CREATE TABLE users (
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
CREATE TABLE projects (
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
CREATE TABLE project_members (
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
CREATE TABLE tasks (
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
CREATE TABLE task_assignees (
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
CREATE TABLE task_attachments (
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
CREATE TABLE task_comments (
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
-- INDEXES for Performance
-- ============================================
CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_projects_archived ON projects(is_archived);

CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);

CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_created_by ON tasks(created_by);
CREATE INDEX idx_tasks_position ON tasks(project_id, position);

CREATE INDEX idx_task_assignees_task ON task_assignees(task_id);
CREATE INDEX idx_task_assignees_user ON task_assignees(user_id);
CREATE INDEX idx_task_assignees_email ON task_assignees(contact_email);

CREATE INDEX idx_task_attachments_task ON task_attachments(task_id);
CREATE INDEX idx_task_attachments_drive_file ON task_attachments(drive_file_id);

CREATE INDEX idx_task_comments_task ON task_comments(task_id);
CREATE INDEX idx_task_comments_user ON task_comments(user_id);

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

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_task_comments_updated_at BEFORE UPDATE ON task_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================
-- Uncomment to insert sample data
-- INSERT INTO users (google_id, email, name) VALUES
-- ('google_123', 'user@example.com', 'Test User');
