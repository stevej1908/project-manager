-- Migration 007 (task 048, WES CRM handoff, 21 Nov 2026): a task owner may be a name with no email.
--
-- AI assistants (Cowork, Duet, Claude Code) own tasks but have no mailbox, and nobody may invent
-- an email for them. Until now an assignee needed a Project Manager user or an email
-- (constraint assignee_check). Now a non-empty name is enough too.
-- Changes no rows. Idempotent: safe to run twice.

ALTER TABLE task_assignees DROP CONSTRAINT IF EXISTS assignee_check;
ALTER TABLE task_assignees ADD CONSTRAINT assignee_check CHECK (
    user_id IS NOT NULL
    OR contact_email IS NOT NULL
    OR NULLIF(TRIM(contact_name), '') IS NOT NULL
);
