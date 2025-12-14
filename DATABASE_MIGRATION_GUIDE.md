# Database Migration Guide

**Last Updated**: December 14, 2025

## Overview

This guide explains the database setup and migration strategy for the Project Manager application.

---

## Database Setup Options

### Option 1: Fresh Install (Recommended for New Installations)

Use the complete schema file that includes all tables, views, and functions:

```bash
psql -U postgres -d project_manager -f database/schema.sql
```

This will create:
- ✅ All base tables (users, projects, tasks, etc.)
- ✅ Task hierarchy support (parent_task_id, depth_level)
- ✅ Task dependencies table
- ✅ Task emails table (Gmail integration)
- ✅ All indexes and constraints
- ✅ Helper views (task_hierarchy, task_dependency_details)
- ✅ Helper functions (check_circular_dependency, get_all_subtasks)

### Option 2: Incremental Migrations (For Existing Databases)

If you already have a database from an earlier version, run migrations incrementally:

```bash
# Migration 1: Add sub-tasks and dependencies (if not applied)
psql -U postgres -d project_manager -f database/migrations/001_add_subtasks_and_dependencies.sql

# Migration 2: Add email attachments (if not applied)
psql -U postgres -d project_manager -f database/migrations/002_add_task_emails.sql
```

---

## Database Schema Summary

### Tables (11 total)

| Table | Description | Key Features |
|-------|-------------|--------------|
| **users** | User accounts from Google OAuth | Stores tokens, profile info |
| **projects** | Project containers | Archiving, colors, ownership |
| **project_members** | Project sharing/collaboration | Role-based access (owner/editor/viewer) |
| **tasks** | Task items | Hierarchical support, Gmail integration |
| **task_assignees** | Task assignments | Users or Google Contacts |
| **task_attachments** | Google Drive files | File metadata, thumbnails |
| **task_comments** | Task discussions | Edit tracking |
| **task_dependencies** | Task relationships | 4 dependency types, lag days |
| **task_emails** | Gmail message attachments | Message metadata, snippets |

### Views (2 total)

- **task_hierarchy**: Parent-child task relationships
- **task_dependency_details**: Dependency details with task info

### Functions (2 total)

- **check_circular_dependency**: Prevents circular task dependencies
- **get_all_subtasks**: Recursively fetches all sub-tasks

---

## Migration Files

### `database/schema.sql` (Complete Schema)
**Purpose**: Full database setup for fresh installations
**Contains**: All tables, indexes, views, functions, and triggers
**Updated**: December 14, 2025 (now includes all features)

### `database/migrations/001_add_subtasks_and_dependencies.sql`
**Created**: December 4, 2025
**Adds**:
- `parent_task_id` and `depth_level` to tasks table
- `task_dependencies` table
- Helper views and functions

### `database/migrations/002_add_task_emails.sql`
**Created**: December 7, 2025
**Adds**:
- `task_emails` table for Gmail integration
- Indexes for performance

---

## Checking Your Current Schema

To see which tables exist in your database:

```bash
psql -U postgres -d project_manager -c "\dt"
```

To check if specific features are available:

```bash
# Check for sub-tasks support
psql -U postgres -d project_manager -c "\d tasks" | grep parent_task_id

# Check for task_dependencies table
psql -U postgres -d project_manager -c "\d task_dependencies"

# Check for task_emails table
psql -U postgres -d project_manager -c "\d task_emails"
```

---

## Rolling Back Migrations

If you need to undo a migration:

### Rollback Migration 2 (Email Attachments)
```sql
DROP TABLE IF EXISTS task_emails CASCADE;
```

### Rollback Migration 1 (Sub-tasks & Dependencies)
```sql
DROP TABLE IF EXISTS task_dependencies CASCADE;
DROP VIEW IF EXISTS task_hierarchy CASCADE;
DROP VIEW IF EXISTS task_dependency_details CASCADE;
DROP FUNCTION IF EXISTS check_circular_dependency(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_all_subtasks(INTEGER);
ALTER TABLE tasks DROP COLUMN IF EXISTS parent_task_id;
ALTER TABLE tasks DROP COLUMN IF EXISTS depth_level;
```

---

## Database Backup & Restore

### Create Backup
```bash
pg_dump -U postgres project_manager > backup_$(date +%Y%m%d).sql
```

### Restore from Backup
```bash
psql -U postgres -d project_manager < backup_20251214.sql
```

---

## Environment Variables

All required environment variables are documented in `.env.example` and `server/.env.example`:

### Database Variables
- `DB_HOST` - PostgreSQL host (default: localhost)
- `DB_PORT` - PostgreSQL port (default: 5432)
- `DB_NAME` - Database name (default: project_manager)
- `DB_USER` - Database user (default: postgres)
- `DB_PASSWORD` - Database password

### Application Variables
- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Environment (development/production)
- `JWT_SECRET` - JWT signing secret
- `FRONTEND_URL` - Frontend URL for CORS

### Google OAuth Variables
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `GOOGLE_REDIRECT_URI` - OAuth callback URL
- `GOOGLE_SCOPES` - Required API scopes (Gmail, Drive, Contacts)

**Note**: Both `.env.example` files are now complete and synchronized.

---

## Migration Best Practices

1. **Always backup** before running migrations
2. **Test migrations** on a development database first
3. **Run migrations** in order (001, 002, etc.)
4. **Document changes** when creating new migrations
5. **Use transactions** for complex migrations (BEGIN/COMMIT/ROLLBACK)

---

## Need Help?

- Check `TEST_REPORT.md` for current database health status
- Review migration SQL files for detailed changes
- Consult PostgreSQL documentation for advanced features

---

**Database Version**: v1.2 (includes all features through December 2025)
