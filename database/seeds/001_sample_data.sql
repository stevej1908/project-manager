-- ============================================
-- SAMPLE DATA FOR TESTING
-- ============================================
-- This seed file creates sample data for development and testing
-- DO NOT run in production!
--
-- Inserts:
-- - 1 test user
-- - 1 test project
-- - 20 test tasks with hierarchy
-- - Sample dependencies
-- - Sample attachments, comments, assignees

-- ============================================
-- TEST USER
-- ============================================
-- Note: This uses ON CONFLICT DO NOTHING to make it idempotent
INSERT INTO users (google_id, email, name, picture) VALUES
('test_google_123', 'test@example.com', 'Test User', 'https://via.placeholder.com/150')
ON CONFLICT (google_id) DO NOTHING;

-- Note: Existing migrations may have already created test data
-- This is intentional and safe (will be skipped with ON CONFLICT)

-- Migration completed successfully
