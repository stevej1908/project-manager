-- Migration: Add Task Emails (Gmail Integration)
-- Created: 2025-12-07

-- ============================================
-- CREATE TASK_EMAILS TABLE
-- Store Gmail messages attached to tasks
-- ============================================

CREATE TABLE IF NOT EXISTS task_emails (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  message_id VARCHAR(255) NOT NULL, -- Gmail message ID
  thread_id VARCHAR(255), -- Gmail thread ID
  subject TEXT,
  sender VARCHAR(500),
  recipient VARCHAR(500),
  email_date TIMESTAMP,
  snippet TEXT,
  has_attachments BOOLEAN DEFAULT FALSE,
  attached_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Prevent duplicate emails on same task
  UNIQUE(task_id, message_id)
);

-- Indexes for email queries
CREATE INDEX idx_task_emails_task_id ON task_emails(task_id);
CREATE INDEX idx_task_emails_message_id ON task_emails(message_id);

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE task_emails IS 'Stores Gmail messages attached to tasks';
COMMENT ON COLUMN task_emails.message_id IS 'Google Gmail message ID';
COMMENT ON COLUMN task_emails.thread_id IS 'Google Gmail thread ID for conversation grouping';
