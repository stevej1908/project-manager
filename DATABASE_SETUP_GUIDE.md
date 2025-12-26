# Database Setup Guide - Project Manager

Complete guide for setting up your PostgreSQL databases for all 3 environments.

---

## Quick Start

```bash
cd server
node run-all-migrations.js
```

That's it! 🎉

---

## Overview

The Project Manager app uses PostgreSQL with a comprehensive schema that includes:

- **Users** (Google OAuth)
- **Projects** with sharing
- **Tasks** with hierarchical structure
- **Dependencies** between tasks
- **Comments, Attachments, Assignees**
- **Gmail email integration**

---

## Database Structure

### Tables (9 total)

1. `users` - User authentication and profiles
2. `projects` - Project information
3. `project_members` - Project sharing and roles
4. `tasks` - Task information with hierarchy
5. `task_assignees` - Task assignments
6. `task_attachments` - Google Drive files
7. `task_comments` - Task discussions
8. `task_dependencies` - Task relationships
9. `task_emails` - Gmail message attachments

### Views (2)

1. `task_hierarchy` - Parent-child relationships
2. `task_dependency_details` - Dependency information

### Functions (2)

1. `check_circular_dependency()` - Prevent circular dependencies
2. `get_all_subtasks()` - Recursive subtask retrieval

---

## Environment Setup

### Local Development

**Database**: PostgreSQL on localhost

```bash
# 1. Create database
createdb project_manager

# 2. Configure environment
cp .env.example .env
# Edit .env with your database credentials

# 3. Run migrations
cd server
node run-all-migrations.js
```

### TEST Environment (Neon)

**Database**: Neon PostgreSQL (free tier)

```bash
# 1. Get Neon connection string from dashboard
# Example: postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/project_manager_test?sslmode=require

# 2. Set environment variable
export DATABASE_URL="<neon-connection-string>"

# 3. Run migrations
cd server
node run-all-migrations.js
```

### STAGING Environment (Neon)

Same as TEST, but use different database: `project_manager_staging`

### PRODUCTION Environment (Neon)

Same as TEST, but use different database: `project_manager`

**IMPORTANT**: Set `NODE_ENV=production` to prevent test data from being loaded!

---

## Migration Files

Located in `database/migrations/`:

- `000_initial_schema.sql` - Complete initial schema (idempotent)
- `001_add_subtasks_and_dependencies.sql` - Subtasks and dependencies
- `002_add_task_emails.sql` - Gmail integration

### Migration System

- ✅ **Idempotent**: Safe to run multiple times
- ✅ **Ordered**: Runs in alphabetical order (000, 001, 002, ...)
- ✅ **Automatic**: Discovers all .sql files in migrations directory
- ✅ **Safe**: Uses IF NOT EXISTS, ON CONFLICT DO NOTHING

### Running Migrations

```bash
cd server
node run-all-migrations.js
```

**Output:**
```
╔════════════════════════════════════════════════════════════╗
║       PROJECT MANAGER - MIGRATION RUNNER                  ║
╚════════════════════════════════════════════════════════════╝

Environment: development
Database: project_manager

Found 3 migration file(s)

001: 000_initial_schema.sql
   File: 000_initial_schema.sql
   ✓ Applied successfully

002: 001_add_subtasks_and_dependencies.sql
   File: 001_add_subtasks_and_dependencies.sql
   ⊙ Skipped (already exists)

003: 002_add_task_emails.sql
   File: 002_add_task_emails.sql
   ✓ Applied successfully

════════════════════════════════════════════════════════════
Migration Summary:
  ✓ Applied: 2
  ⊙ Skipped (already applied): 1
  ✗ Errors: 0
  Total: 3
════════════════════════════════════════════════════════════

✅ All migrations completed successfully!

DATABASE SCHEMA READY!
```

---

## Seed Data (Optional)

For development and testing, you can load sample data.

**Located in**: `database/seeds/001_sample_data.sql`

**To load**:
```bash
psql $DATABASE_URL < database/seeds/001_sample_data.sql
```

**⚠️ NEVER run seeds in production!**

---

## Database Connection

### Via Environment Variables

**Option 1**: Single DATABASE_URL (Recommended for cloud deployments)

```bash
DATABASE_URL=postgresql://user:pass@host:port/database?sslmode=require
```

**Option 2**: Individual variables (Local development)

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=project_manager
DB_USER=postgres
DB_PASSWORD=your_password
```

The application automatically uses `DATABASE_URL` if present, otherwise falls back to individual variables.

---

## Backup & Restore

### Backup Database

```bash
# Local database
pg_dump project_manager > backup_$(date +%Y%m%d).sql

# Neon database
pg_dump "<neon-connection-string>" > backup_$(date +%Y%m%d).sql
```

### Restore Database

```bash
# Local database
psql project_manager < backup_20251226.sql

# Neon database
psql "<neon-connection-string>" < backup_20251226.sql
```

---

## Database Indexes

**34 indexes** are created automatically for optimal performance:

- Users: google_id, email
- Projects: owner_id, is_archived
- Project Members: project_id, user_id
- Tasks: project_id, status, parent_task_id, position
- Task Assignees: task_id, user_id, contact_email
- Task Attachments: task_id, drive_file_id
- Task Comments: task_id, user_id
- Task Dependencies: dependent_task_id, depends_on_task_id
- Task Emails: task_id, message_id

---

## Troubleshooting

### Error: "relation already exists"

**This is normal!** Migrations are idempotent. The migration will be skipped.

### Error: "database does not exist"

```bash
# Create the database first
createdb project_manager
# Then run migrations
```

### Error: "permission denied"

Check your database user has CREATE privileges:

```sql
GRANT ALL PRIVILEGES ON DATABASE project_manager TO your_user;
```

### Error: "connection refused"

- Check PostgreSQL is running: `pg_isready`
- Verify connection details in .env
- For Neon: Check database is not paused

### Error: "too many connections"

Neon free tier limits:
- Max connections: 100
- Consider connection pooling

---

## Performance Tips

1. **Use indexes** (already created by migrations)
2. **Use EXPLAIN ANALYZE** to optimize slow queries
3. **Connection pooling** (already configured in server)
4. **Paginate large result sets**
5. **Use views** for complex queries (task_hierarchy, task_dependency_details)

---

## Security Best Practices

✅ **DO**:
- Use environment variables for credentials
- Use SSL connections in production (`?sslmode=require`)
- Rotate passwords regularly
- Use different credentials per environment
- Backup regularly

❌ **DON'T**:
- Commit .env files to Git
- Share database credentials
- Use same database for dev/test/prod
- Skip migrations
- Manually modify schema in production

---

## Schema Diagram

```
users
  ↓ (owner_id)
projects ←→ project_members → users
  ↓ (project_id)
tasks
  ├→ task_assignees → users/contacts
  ├→ task_attachments (Google Drive)
  ├→ task_comments → users
  ├→ task_dependencies → tasks
  ├→ task_emails (Gmail)
  └→ tasks (parent_task_id) [hierarchical]
```

---

## Next Steps

1. ✅ Run migrations for all environments
2. ✅ Verify schema in database client
3. ✅ Test CRUD operations
4. ✅ Load sample data for testing
5. ⚠️ Set up automated backups
6. ⚠️ Configure monitoring

---

**Database Setup Complete!** 🎉

Your Project Manager database is ready for use in all environments!
