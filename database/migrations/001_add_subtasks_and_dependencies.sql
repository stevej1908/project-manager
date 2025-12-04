-- Migration: Add Sub-tasks and Task Dependencies
-- Created: 2025-12-04

-- ============================================
-- ADD SUB-TASK SUPPORT TO TASKS TABLE
-- ============================================

-- Add parent_task_id column to support hierarchical tasks
ALTER TABLE tasks ADD COLUMN parent_task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE;

-- Add index for parent_task_id queries
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id);

-- Add depth level for nested sub-tasks (optional, for limiting nesting)
ALTER TABLE tasks ADD COLUMN depth_level INTEGER DEFAULT 0;

-- ============================================
-- CREATE TASK_DEPENDENCIES TABLE
-- ============================================

CREATE TABLE task_dependencies (
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
    -- Example: +2 means Task B starts 2 days after Task A finishes
    lag_days INTEGER DEFAULT 0,

    -- Link point percentages (for Gantt chart visual linking)
    -- from_point: 0 = start, 50 = middle, 100 = end of source task
    -- to_point: 0 = start, 50 = middle, 100 = end of target task
    from_point INTEGER DEFAULT 100, -- Default: end of source task
    to_point INTEGER DEFAULT 0,     -- Default: start of target task

    -- Metadata
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Prevent circular dependencies (enforced at application level)
    -- Prevent duplicate dependencies
    UNIQUE(dependent_task_id, depends_on_task_id),

    -- Prevent self-dependencies
    CONSTRAINT no_self_dependency CHECK (dependent_task_id != depends_on_task_id)
);

-- Indexes for dependency queries
CREATE INDEX idx_task_dependencies_dependent ON task_dependencies(dependent_task_id);
CREATE INDEX idx_task_dependencies_depends_on ON task_dependencies(depends_on_task_id);

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
-- FUNCTION: Check for circular dependencies
-- ============================================

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

-- ============================================
-- FUNCTION: Get all sub-tasks recursively
-- ============================================

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
-- COMMENTS
-- ============================================

COMMENT ON COLUMN tasks.parent_task_id IS 'Reference to parent task for sub-tasks';
COMMENT ON COLUMN tasks.depth_level IS 'Nesting level (0=root, 1=first level sub-task, etc)';
COMMENT ON TABLE task_dependencies IS 'Stores task dependency relationships for project scheduling';
COMMENT ON COLUMN task_dependencies.dependency_type IS 'FS=Finish-to-Start, SS=Start-to-Start, FF=Finish-to-Finish, SF=Start-to-Finish';
COMMENT ON COLUMN task_dependencies.lag_days IS 'Number of days lag (positive) or lead (negative) between tasks';
COMMENT ON COLUMN task_dependencies.from_point IS 'Percentage point on source task (0=start, 50=middle, 100=end)';
COMMENT ON COLUMN task_dependencies.to_point IS 'Percentage point on target task (0=start, 50=middle, 100=end)';
