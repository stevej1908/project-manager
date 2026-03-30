-- Migration: 004_add_project_hierarchy.sql
-- Adds parent/child project relationships and cross-project dependencies
-- Safe to run multiple times (idempotent with IF NOT EXISTS / DO blocks)

-- ============================================
-- 1. Add hierarchy columns to projects table
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'projects' AND column_name = 'parent_project_id'
    ) THEN
        ALTER TABLE projects ADD COLUMN parent_project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'projects' AND column_name = 'depth'
    ) THEN
        ALTER TABLE projects ADD COLUMN depth INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'projects' AND column_name = 'position'
    ) THEN
        ALTER TABLE projects ADD COLUMN position INTEGER DEFAULT 0;
    END IF;
END$$;

-- Max depth constraint (0=top-level, 1=child, 2=grandchild)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE table_name = 'projects' AND constraint_name = 'max_project_depth'
    ) THEN
        ALTER TABLE projects ADD CONSTRAINT max_project_depth CHECK (depth < 3);
    END IF;
END$$;

-- ============================================
-- 2. Indexes for hierarchy queries
-- ============================================

CREATE INDEX IF NOT EXISTS idx_projects_parent ON projects(parent_project_id);
CREATE INDEX IF NOT EXISTS idx_projects_parent_position ON projects(parent_project_id, position);

-- ============================================
-- 3. Project dependencies table
-- ============================================

CREATE TABLE IF NOT EXISTS project_dependencies (
    id SERIAL PRIMARY KEY,
    source_project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    target_project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    dependency_type VARCHAR(20) DEFAULT 'finish_to_start',
    description TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT no_self_project_dep CHECK (source_project_id != target_project_id),
    CONSTRAINT unique_project_dep UNIQUE (source_project_id, target_project_id)
);

CREATE INDEX IF NOT EXISTS idx_project_deps_source ON project_dependencies(source_project_id);
CREATE INDEX IF NOT EXISTS idx_project_deps_target ON project_dependencies(target_project_id);

-- ============================================
-- 4. Add is_cross_project flag to task_dependencies
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'task_dependencies' AND column_name = 'is_cross_project'
    ) THEN
        ALTER TABLE task_dependencies ADD COLUMN is_cross_project BOOLEAN DEFAULT FALSE;
    END IF;
END$$;

-- ============================================
-- 5. Circular dependency check for projects
-- ============================================

CREATE OR REPLACE FUNCTION check_project_circular_dependency(
    p_source INTEGER,
    p_target INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_has_cycle BOOLEAN;
BEGIN
    -- Check if adding source -> target would create a cycle
    -- by walking forward from target to see if we reach source
    WITH RECURSIVE dep_chain AS (
        SELECT target_project_id AS project_id
        FROM project_dependencies
        WHERE source_project_id = p_target

        UNION

        SELECT pd.target_project_id
        FROM project_dependencies pd
        INNER JOIN dep_chain dc ON pd.source_project_id = dc.project_id
    )
    SELECT EXISTS(
        SELECT 1 FROM dep_chain WHERE project_id = p_source
    ) INTO v_has_cycle;

    RETURN v_has_cycle;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. Project hierarchy recursive view
-- ============================================

CREATE OR REPLACE VIEW project_hierarchy AS
WITH RECURSIVE tree AS (
    SELECT id, name, parent_project_id, depth, position, color,
           id AS root_project_id
    FROM projects
    WHERE parent_project_id IS NULL

    UNION ALL

    SELECT p.id, p.name, p.parent_project_id, p.depth, p.position, p.color,
           t.root_project_id
    FROM projects p
    JOIN tree t ON p.parent_project_id = t.id
)
SELECT * FROM tree;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN projects.parent_project_id IS 'Reference to parent project for hierarchy (NULL = top-level)';
COMMENT ON COLUMN projects.depth IS 'Nesting level (0=top-level, 1=child, 2=grandchild, max 2)';
COMMENT ON COLUMN projects.position IS 'Ordering position among siblings with same parent';
COMMENT ON TABLE project_dependencies IS 'Stores project-level dependency relationships between sibling projects';
COMMENT ON COLUMN task_dependencies.is_cross_project IS 'True when dependent and blocking tasks are in different projects';
