-- Migration: 005_seed_app2care_data.sql
-- Seeds the App2Care Incorporation project hierarchy with tasks and dependencies
-- Safe to run multiple times (uses ON CONFLICT DO NOTHING)

-- ============================================
-- 1. Create/upsert team users
-- ============================================

INSERT INTO users (google_id, email, name, picture)
VALUES
  ('seed_steve', 'stevejennings@app2care.com', 'Steve Jennings', NULL),
  ('seed_deb', 'debshawver@app2care.com', 'Deb Shawver', NULL),
  ('seed_bob', 'bobcarenas@app2care.com', 'Bob Carenas', NULL),
  ('seed_john', 'johnfon@app2care.com', 'John Fon', NULL)
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- 2. Create the App2Care master project + sub-projects
-- ============================================

DO $$
DECLARE
  v_steve_id INTEGER;
  v_deb_id INTEGER;
  v_bob_id INTEGER;
  v_john_id INTEGER;
  v_master_id INTEGER;
  v_pre_inc_id INTEGER;
  v_clerky_id INTEGER;
  v_tax_id INTEGER;
  v_fda_id INTEGER;
  v_qms_id INTEGER;
  v_ops_id INTEGER;
  -- Task IDs needed for dependencies
  v_llc_dist_id INTEGER;
  v_confirm_ip_id INTEGER;
  v_sign_plan_id INTEGER;
  v_post_inc_setup_id INTEGER;
  v_sign_founders_id INTEGER;
  v_ratify_val_id INTEGER;
  v_83b_steve_id INTEGER;
  v_83b_deb_id INTEGER;
  v_83b_bob_id INTEGER;
  v_john_clo_id INTEGER;
  v_duns_id INTEGER;
  v_fda_code_id INTEGER;
  v_reg_pathway_id INTEGER;
  v_reg_establish_id INTEGER;
  v_qms_assess_id INTEGER;
  v_quality_manual_id INTEGER;
  v_design_control_id INTEGER;
  v_risk_mgmt_id INTEGER;
  v_complaint_id INTEGER;
  v_capa_id INTEGER;
  v_doc_control_id INTEGER;
  v_design_history_id INTEGER;
  v_ai_dev_id INTEGER;
  v_hipaa_id INTEGER;
  v_bank_id INTEGER;
  v_domains_id INTEGER;
  v_repos_id INTEGER;
  v_contracts_id INTEGER;
BEGIN
  -- Get user IDs
  SELECT id INTO v_steve_id FROM users WHERE email = 'stevejennings@app2care.com';
  SELECT id INTO v_deb_id FROM users WHERE email = 'debshawver@app2care.com';
  SELECT id INTO v_bob_id FROM users WHERE email = 'bobcarenas@app2care.com';
  SELECT id INTO v_john_id FROM users WHERE email = 'johnfon@app2care.com';

  -- Exit if users don't exist
  IF v_steve_id IS NULL THEN
    RAISE NOTICE 'Seed users not found, skipping seed data';
    RETURN;
  END IF;

  -- Check if master project already exists
  SELECT id INTO v_master_id FROM projects WHERE name = 'App2Care Incorporation' AND owner_id = v_steve_id;

  IF v_master_id IS NOT NULL THEN
    RAISE NOTICE 'App2Care Incorporation project already exists (id=%)', v_master_id;
    RETURN;
  END IF;

  -- Create master project
  INSERT INTO projects (name, description, color, owner_id, parent_project_id, depth, position)
  VALUES ('App2Care Incorporation', 'Master project for App2Care LLC to C-Corp incorporation', '#1a3c5e', v_steve_id, NULL, 0, 0)
  RETURNING id INTO v_master_id;

  -- Create sub-projects
  INSERT INTO projects (name, description, color, owner_id, parent_project_id, depth, position)
  VALUES ('Pre-Incorporation', 'LLC IP distribution and Plan of Incorporation', '#ef4444', v_steve_id, v_master_id, 1, 0)
  RETURNING id INTO v_pre_inc_id;

  INSERT INTO projects (name, description, color, owner_id, parent_project_id, depth, position)
  VALUES ('Clerky Workflow', 'Post-incorporation legal setup via Clerky', '#8b5cf6', v_steve_id, v_master_id, 1, 1)
  RETURNING id INTO v_clerky_id;

  INSERT INTO projects (name, description, color, owner_id, parent_project_id, depth, position)
  VALUES ('Tax & Compliance', '83(b) elections and CLO terms', '#f59e0b', v_steve_id, v_master_id, 1, 2)
  RETURNING id INTO v_tax_id;

  INSERT INTO projects (name, description, color, owner_id, parent_project_id, depth, position)
  VALUES ('FDA Regulatory', 'DUNS, product code, regulatory pathway, establishment registration', '#10b981', v_steve_id, v_master_id, 1, 3)
  RETURNING id INTO v_fda_id;

  INSERT INTO projects (name, description, color, owner_id, parent_project_id, depth, position)
  VALUES ('QMS Setup', 'Quality Management System documentation', '#0ea5e9', v_steve_id, v_master_id, 1, 4)
  RETURNING id INTO v_qms_id;

  INSERT INTO projects (name, description, color, owner_id, parent_project_id, depth, position)
  VALUES ('Operations', 'BAAs, bank account, domain/repo transfers, contracts', '#ec4899', v_steve_id, v_master_id, 1, 5)
  RETURNING id INTO v_ops_id;

  -- Add all team members to master and sub-projects
  INSERT INTO project_members (project_id, user_id, role, added_by)
  SELECT p.id, u.id, 'editor', v_steve_id
  FROM projects p
  CROSS JOIN (SELECT id FROM users WHERE id IN (v_deb_id, v_bob_id, v_john_id)) u
  WHERE p.id IN (v_master_id, v_pre_inc_id, v_clerky_id, v_tax_id, v_fda_id, v_qms_id, v_ops_id)
  ON CONFLICT (project_id, user_id) DO NOTHING;

  -- ============================================
  -- 3. Create tasks for each sub-project
  -- ============================================

  -- Pre-Incorporation tasks
  INSERT INTO tasks (project_id, title, status, priority, position, created_by, start_date, end_date)
  VALUES (v_pre_inc_id, 'LLC-to-Deb IP Distribution', 'todo', 'urgent', 0, v_steve_id, CURRENT_DATE, CURRENT_DATE + 7)
  RETURNING id INTO v_llc_dist_id;
  INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (v_llc_dist_id, v_deb_id, v_steve_id);

  INSERT INTO tasks (project_id, title, status, priority, position, created_by, start_date, end_date)
  VALUES (v_pre_inc_id, 'Confirm Bob & Steve IP Ownership', 'todo', 'high', 1, v_steve_id, CURRENT_DATE, CURRENT_DATE + 14)
  RETURNING id INTO v_confirm_ip_id;
  INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (v_confirm_ip_id, v_bob_id, v_steve_id);
  INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (v_confirm_ip_id, v_steve_id, v_steve_id);

  INSERT INTO tasks (project_id, title, status, priority, position, created_by, start_date, end_date)
  VALUES (v_pre_inc_id, 'Sign Plan of Incorporation', 'todo', 'high', 2, v_steve_id, CURRENT_DATE + 7, CURRENT_DATE + 14)
  RETURNING id INTO v_sign_plan_id;
  INSERT INTO task_assignees (task_id, user_id, assigned_by)
  SELECT v_sign_plan_id, id, v_steve_id FROM users WHERE id IN (v_steve_id, v_deb_id, v_bob_id, v_john_id);

  -- Clerky Workflow tasks
  INSERT INTO tasks (project_id, title, status, priority, position, created_by, start_date, end_date)
  VALUES (v_clerky_id, 'Complete Post-Incorporation Setup', 'todo', 'urgent', 0, v_steve_id, CURRENT_DATE + 14, CURRENT_DATE + 21)
  RETURNING id INTO v_post_inc_setup_id;
  INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (v_post_inc_setup_id, v_bob_id, v_steve_id);

  -- Subtasks for Post-Incorporation Setup
  INSERT INTO tasks (project_id, title, status, priority, position, parent_task_id, depth_level, created_by, start_date, end_date)
  VALUES
    (v_clerky_id, 'Adopt Bylaws', 'todo', 'high', 0, v_post_inc_setup_id, 1, v_steve_id, CURRENT_DATE + 14, CURRENT_DATE + 16),
    (v_clerky_id, 'Appoint Initial Board', 'todo', 'high', 1, v_post_inc_setup_id, 1, v_steve_id, CURRENT_DATE + 14, CURRENT_DATE + 16),
    (v_clerky_id, 'Enter IP Descriptions in Clerky', 'todo', 'high', 2, v_post_inc_setup_id, 1, v_steve_id, CURRENT_DATE + 16, CURRENT_DATE + 19),
    (v_clerky_id, 'Adopt CIIAA', 'todo', 'high', 3, v_post_inc_setup_id, 1, v_steve_id, CURRENT_DATE + 19, CURRENT_DATE + 21);

  INSERT INTO tasks (project_id, title, status, priority, position, created_by, start_date, end_date)
  VALUES (v_clerky_id, 'Sign Founders'' Agreement', 'todo', 'urgent', 1, v_steve_id, CURRENT_DATE + 21, CURRENT_DATE + 28)
  RETURNING id INTO v_sign_founders_id;
  INSERT INTO task_assignees (task_id, user_id, assigned_by)
  SELECT v_sign_founders_id, id, v_steve_id FROM users WHERE id IN (v_steve_id, v_deb_id, v_bob_id, v_john_id);

  INSERT INTO tasks (project_id, title, status, priority, position, created_by, start_date, end_date)
  VALUES (v_clerky_id, 'Ratify Valuation Memorandum', 'todo', 'high', 2, v_steve_id, CURRENT_DATE + 28, CURRENT_DATE + 35)
  RETURNING id INTO v_ratify_val_id;
  INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (v_ratify_val_id, v_bob_id, v_steve_id);

  -- Tax & Compliance tasks
  INSERT INTO tasks (project_id, title, status, priority, position, created_by, start_date, end_date)
  VALUES (v_tax_id, 'File 83(b) Election - Steve', 'todo', 'urgent', 0, v_steve_id, CURRENT_DATE + 28, CURRENT_DATE + 58)
  RETURNING id INTO v_83b_steve_id;
  INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (v_83b_steve_id, v_steve_id, v_steve_id);

  INSERT INTO tasks (project_id, title, status, priority, position, created_by, start_date, end_date)
  VALUES (v_tax_id, 'File 83(b) Election - Deb', 'todo', 'urgent', 1, v_steve_id, CURRENT_DATE + 28, CURRENT_DATE + 58)
  RETURNING id INTO v_83b_deb_id;
  INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (v_83b_deb_id, v_deb_id, v_steve_id);

  INSERT INTO tasks (project_id, title, status, priority, position, created_by, start_date, end_date)
  VALUES (v_tax_id, 'File 83(b) Election - Bob', 'todo', 'urgent', 2, v_steve_id, CURRENT_DATE + 28, CURRENT_DATE + 58)
  RETURNING id INTO v_83b_bob_id;
  INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (v_83b_bob_id, v_bob_id, v_steve_id);

  INSERT INTO tasks (project_id, title, status, priority, position, created_by, start_date, end_date)
  VALUES (v_tax_id, 'Finalize John Fons CLO Terms', 'todo', 'medium', 3, v_steve_id, CURRENT_DATE + 14, CURRENT_DATE + 42)
  RETURNING id INTO v_john_clo_id;
  INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (v_john_clo_id, v_bob_id, v_steve_id);
  INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (v_john_clo_id, v_john_id, v_steve_id);

  -- FDA Regulatory tasks
  INSERT INTO tasks (project_id, title, status, priority, position, created_by, start_date, end_date)
  VALUES (v_fda_id, 'Obtain DUNS Number', 'todo', 'high', 0, v_steve_id, CURRENT_DATE, CURRENT_DATE + 14)
  RETURNING id INTO v_duns_id;
  INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (v_duns_id, v_steve_id, v_steve_id);

  INSERT INTO tasks (project_id, title, status, priority, position, created_by, start_date, end_date)
  VALUES (v_fda_id, 'Confirm FDA Product Code', 'todo', 'high', 1, v_steve_id, CURRENT_DATE, CURRENT_DATE + 21)
  RETURNING id INTO v_fda_code_id;
  INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (v_fda_code_id, v_steve_id, v_steve_id);
  INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (v_fda_code_id, v_deb_id, v_steve_id);

  INSERT INTO tasks (project_id, title, status, priority, position, created_by, start_date, end_date)
  VALUES (v_fda_id, 'Determine Regulatory Pathway', 'todo', 'high', 2, v_steve_id, CURRENT_DATE + 7, CURRENT_DATE + 35)
  RETURNING id INTO v_reg_pathway_id;
  INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (v_reg_pathway_id, v_steve_id, v_steve_id);
  INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (v_reg_pathway_id, v_deb_id, v_steve_id);

  -- Subtasks for Determine Regulatory Pathway
  INSERT INTO tasks (project_id, title, status, priority, position, parent_task_id, depth_level, created_by, start_date, end_date)
  VALUES
    (v_fda_id, 'Evaluate General Wellness path', 'todo', 'high', 0, v_reg_pathway_id, 1, v_steve_id, CURRENT_DATE + 7, CURRENT_DATE + 21),
    (v_fda_id, 'Evaluate Class II / 510(k) path', 'todo', 'high', 1, v_reg_pathway_id, 1, v_steve_id, CURRENT_DATE + 7, CURRENT_DATE + 28),
    (v_fda_id, 'Decide if Q-Sub needed', 'todo', 'high', 2, v_reg_pathway_id, 1, v_steve_id, CURRENT_DATE + 28, CURRENT_DATE + 35);

  INSERT INTO tasks (project_id, title, status, priority, position, created_by, start_date, end_date)
  VALUES (v_fda_id, 'Register Establishment & List Device', 'todo', 'medium', 3, v_steve_id, CURRENT_DATE + 60, CURRENT_DATE + 90)
  RETURNING id INTO v_reg_establish_id;
  INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (v_reg_establish_id, v_steve_id, v_steve_id);

  -- QMS Setup tasks
  INSERT INTO tasks (project_id, title, status, priority, position, created_by, start_date, end_date)
  VALUES (v_qms_id, 'Assess Current QMS Maturity', 'todo', 'high', 0, v_steve_id, CURRENT_DATE, CURRENT_DATE + 14)
  RETURNING id INTO v_qms_assess_id;
  INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (v_qms_assess_id, v_deb_id, v_steve_id);

  INSERT INTO tasks (project_id, title, status, priority, position, created_by, start_date, end_date)
  VALUES (v_qms_id, 'Write Quality Manual', 'todo', 'medium', 1, v_steve_id, CURRENT_DATE + 14, CURRENT_DATE + 42)
  RETURNING id INTO v_quality_manual_id;
  INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (v_quality_manual_id, v_deb_id, v_steve_id);

  INSERT INTO tasks (project_id, title, status, priority, position, created_by, start_date, end_date)
  VALUES (v_qms_id, 'Write Design Control SOP', 'todo', 'medium', 2, v_steve_id, CURRENT_DATE + 14, CURRENT_DATE + 42)
  RETURNING id INTO v_design_control_id;
  INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (v_design_control_id, v_deb_id, v_steve_id);

  INSERT INTO tasks (project_id, title, status, priority, position, created_by, start_date, end_date)
  VALUES (v_qms_id, 'Complete Risk Management File', 'todo', 'medium', 3, v_steve_id, CURRENT_DATE + 14, CURRENT_DATE + 56)
  RETURNING id INTO v_risk_mgmt_id;
  INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (v_risk_mgmt_id, v_deb_id, v_steve_id);

  INSERT INTO tasks (project_id, title, status, priority, position, created_by, start_date, end_date)
  VALUES (v_qms_id, 'Write Complaint Handling SOP', 'todo', 'medium', 4, v_steve_id, CURRENT_DATE + 28, CURRENT_DATE + 49)
  RETURNING id INTO v_complaint_id;
  INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (v_complaint_id, v_deb_id, v_steve_id);

  INSERT INTO tasks (project_id, title, status, priority, position, created_by, start_date, end_date)
  VALUES (v_qms_id, 'Write CAPA SOP', 'todo', 'medium', 5, v_steve_id, CURRENT_DATE + 28, CURRENT_DATE + 49)
  RETURNING id INTO v_capa_id;
  INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (v_capa_id, v_deb_id, v_steve_id);

  INSERT INTO tasks (project_id, title, status, priority, position, created_by, start_date, end_date)
  VALUES (v_qms_id, 'Write Document Control SOP', 'todo', 'low', 6, v_steve_id, CURRENT_DATE + 14, CURRENT_DATE + 35)
  RETURNING id INTO v_doc_control_id;
  INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (v_doc_control_id, v_deb_id, v_steve_id);

  INSERT INTO tasks (project_id, title, status, priority, position, created_by, start_date, end_date)
  VALUES (v_qms_id, 'Complete Design History File', 'todo', 'medium', 7, v_steve_id, CURRENT_DATE + 42, CURRENT_DATE + 63)
  RETURNING id INTO v_design_history_id;
  INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (v_design_history_id, v_deb_id, v_steve_id);

  INSERT INTO tasks (project_id, title, status, priority, position, created_by, start_date, end_date)
  VALUES (v_qms_id, 'Document AI Development in QMS', 'todo', 'medium', 8, v_steve_id, CURRENT_DATE + 42, CURRENT_DATE + 63)
  RETURNING id INTO v_ai_dev_id;
  INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (v_ai_dev_id, v_steve_id, v_steve_id);
  INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (v_ai_dev_id, v_deb_id, v_steve_id);

  -- Operations tasks
  INSERT INTO tasks (project_id, title, status, priority, position, created_by, start_date, end_date)
  VALUES (v_ops_id, 'Execute New HIPAA BAAs', 'todo', 'high', 0, v_steve_id, CURRENT_DATE + 28, CURRENT_DATE + 42)
  RETURNING id INTO v_hipaa_id;
  INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (v_hipaa_id, v_steve_id, v_steve_id);

  INSERT INTO tasks (project_id, title, status, priority, position, created_by, start_date, end_date)
  VALUES (v_ops_id, 'Open Corporate Bank Account', 'todo', 'high', 1, v_steve_id, CURRENT_DATE + 28, CURRENT_DATE + 35)
  RETURNING id INTO v_bank_id;
  INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (v_bank_id, v_bob_id, v_steve_id);

  INSERT INTO tasks (project_id, title, status, priority, position, created_by, start_date, end_date)
  VALUES (v_ops_id, 'Transfer Domains & Trademarks', 'todo', 'medium', 2, v_steve_id, CURRENT_DATE + 35, CURRENT_DATE + 49)
  RETURNING id INTO v_domains_id;
  INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (v_domains_id, v_bob_id, v_steve_id);
  INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (v_domains_id, v_steve_id, v_steve_id);

  INSERT INTO tasks (project_id, title, status, priority, position, created_by, start_date, end_date)
  VALUES (v_ops_id, 'Transfer Source Code Repos', 'todo', 'medium', 3, v_steve_id, CURRENT_DATE + 35, CURRENT_DATE + 42)
  RETURNING id INTO v_repos_id;
  INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (v_repos_id, v_steve_id, v_steve_id);

  INSERT INTO tasks (project_id, title, status, priority, position, created_by, start_date, end_date)
  VALUES (v_ops_id, 'Assign Existing Contracts', 'todo', 'low', 4, v_steve_id, CURRENT_DATE + 42, CURRENT_DATE + 56)
  RETURNING id INTO v_contracts_id;
  INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (v_contracts_id, v_bob_id, v_steve_id);

  -- ============================================
  -- 4. Project-level dependencies
  -- ============================================

  INSERT INTO project_dependencies (source_project_id, target_project_id, dependency_type, description, created_by)
  VALUES
    (v_clerky_id, v_pre_inc_id, 'finish_to_start', 'LLC distribution and Plan of Incorporation must be signed before Clerky signing', v_steve_id),
    (v_tax_id, v_clerky_id, 'finish_to_start', '83(b) elections can only be filed after shares are issued via Clerky', v_steve_id),
    (v_fda_id, v_qms_id, 'finish_to_start', 'QMS must be in place before FDA establishment registration', v_steve_id),
    (v_ops_id, v_clerky_id, 'finish_to_start', 'BAAs and account transfers happen after incorporation is complete', v_steve_id)
  ON CONFLICT (source_project_id, target_project_id) DO NOTHING;

  -- ============================================
  -- 5. Cross-project task dependencies
  -- ============================================

  -- Sign Founders' Agreement (Clerky) blocked by LLC-to-Deb IP Distribution (Pre-Inc)
  INSERT INTO task_dependencies (dependent_task_id, depends_on_task_id, dependency_type, is_cross_project, created_by)
  VALUES (v_sign_founders_id, v_llc_dist_id, 'finish_to_start', true, v_steve_id)
  ON CONFLICT (dependent_task_id, depends_on_task_id) DO NOTHING;

  -- File 83(b) Election - Steve (Tax) blocked by Sign Founders' Agreement (Clerky)
  INSERT INTO task_dependencies (dependent_task_id, depends_on_task_id, dependency_type, is_cross_project, created_by)
  VALUES (v_83b_steve_id, v_sign_founders_id, 'finish_to_start', true, v_steve_id)
  ON CONFLICT (dependent_task_id, depends_on_task_id) DO NOTHING;

  -- File 83(b) Election - Deb (Tax) blocked by Sign Founders' Agreement (Clerky)
  INSERT INTO task_dependencies (dependent_task_id, depends_on_task_id, dependency_type, is_cross_project, created_by)
  VALUES (v_83b_deb_id, v_sign_founders_id, 'finish_to_start', true, v_steve_id)
  ON CONFLICT (dependent_task_id, depends_on_task_id) DO NOTHING;

  -- File 83(b) Election - Bob (Tax) blocked by Sign Founders' Agreement (Clerky)
  INSERT INTO task_dependencies (dependent_task_id, depends_on_task_id, dependency_type, is_cross_project, created_by)
  VALUES (v_83b_bob_id, v_sign_founders_id, 'finish_to_start', true, v_steve_id)
  ON CONFLICT (dependent_task_id, depends_on_task_id) DO NOTHING;

  -- Register Establishment (FDA) blocked by Obtain DUNS Number (FDA) - same project, not cross-project
  INSERT INTO task_dependencies (dependent_task_id, depends_on_task_id, dependency_type, is_cross_project, created_by)
  VALUES (v_reg_establish_id, v_duns_id, 'finish_to_start', false, v_steve_id)
  ON CONFLICT (dependent_task_id, depends_on_task_id) DO NOTHING;

  -- Register Establishment (FDA) blocked by Complete Risk Management File (QMS)
  INSERT INTO task_dependencies (dependent_task_id, depends_on_task_id, dependency_type, is_cross_project, created_by)
  VALUES (v_reg_establish_id, v_risk_mgmt_id, 'finish_to_start', true, v_steve_id)
  ON CONFLICT (dependent_task_id, depends_on_task_id) DO NOTHING;

  -- Execute New HIPAA BAAs (Ops) blocked by Sign Founders' Agreement (Clerky)
  INSERT INTO task_dependencies (dependent_task_id, depends_on_task_id, dependency_type, is_cross_project, created_by)
  VALUES (v_hipaa_id, v_sign_founders_id, 'finish_to_start', true, v_steve_id)
  ON CONFLICT (dependent_task_id, depends_on_task_id) DO NOTHING;

  RAISE NOTICE 'App2Care seed data created successfully!';
END$$;
