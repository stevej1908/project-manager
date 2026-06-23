-- Migration: Add project_invitations table
-- Stores pending project invitations for users who haven't signed up yet
-- When a user is invited to a project but hasn't created an account,
-- the invitation is stored here. On first login, pending invitations
-- are automatically converted to project_members entries.

CREATE TABLE IF NOT EXISTS project_invitations (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'editor',
    invited_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, email)
);

CREATE INDEX IF NOT EXISTS idx_project_invitations_email ON project_invitations(email);
CREATE INDEX IF NOT EXISTS idx_project_invitations_project ON project_invitations(project_id);
