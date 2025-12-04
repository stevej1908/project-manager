# PostgreSQL Database Setup Guide

## Current Configuration

Your `server/.env` file has been configured with:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=project_manager
DB_USER=postgres
DB_PASSWORD=b4c8d09184fd3f09221efa7071f66f06
```

## Installation

### Windows

**Option 1: PostgreSQL Official Installer (Recommended)**

1. Download PostgreSQL from: https://www.postgresql.org/download/windows/
2. Run the installer
3. During installation:
   - **Password**: Use `b4c8d09184fd3f09221efa7071f66f06` (or your own)
   - **Port**: Keep default `5432`
   - **Locale**: Default
4. Install pgAdmin (comes with installer) for GUI management

**Option 2: Using Chocolatey**

```cmd
choco install postgresql
```

### Mac

```bash
brew install postgresql@15
brew services start postgresql@15
```

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

## Setup Database

### Step 1: Start PostgreSQL Service

**Windows:**
- The service should start automatically after installation
- Or press `Win + R`, type `services.msc`, find "PostgreSQL", and start it

**Mac:**
```bash
brew services start postgresql@15
```

**Linux:**
```bash
sudo systemctl start postgresql
```

### Step 2: Set PostgreSQL Password

**Windows (Command Prompt as Administrator):**
```cmd
psql -U postgres
```

**Mac/Linux:**
```bash
sudo -u postgres psql
```

Then in the PostgreSQL prompt:
```sql
ALTER USER postgres WITH PASSWORD 'b4c8d09184fd3f09221efa7071f66f06';
\q
```

### Step 3: Create Database

**From Command Line:**
```bash
psql -U postgres -c "CREATE DATABASE project_manager;"
```

**Or from psql prompt:**
```bash
psql -U postgres
```
```sql
CREATE DATABASE project_manager;
\q
```

### Step 4: Run Database Schema

Navigate to your project directory and run:

**Windows:**
```cmd
psql -U postgres -d project_manager -f database\schema.sql
```

**Mac/Linux:**
```bash
psql -U postgres -d project_manager -f database/schema.sql
```

When prompted, enter the password: `b4c8d09184fd3f09221efa7071f66f06`

## Verify Setup

Test your database connection:

```bash
psql -U postgres -d project_manager -c "SELECT * FROM users;"
```

You should see an empty table (no error means success!).

## Quick Setup Script

### Windows (setup-database.bat)

```batch
@echo off
echo Creating database...
psql -U postgres -c "CREATE DATABASE project_manager;"

echo Running schema...
psql -U postgres -d project_manager -f database\schema.sql

echo Done! Database is ready.
pause
```

### Mac/Linux (setup-database.sh)

```bash
#!/bin/bash
echo "Creating database..."
psql -U postgres -c "CREATE DATABASE project_manager;"

echo "Running schema..."
psql -U postgres -d project_manager -f database/schema.sql

echo "Done! Database is ready."
```

## Test Your Application

After database setup, start your server:

```bash
cd server
npm run dev
```

You should see:
```
✓ Database connected successfully
Server running on port 5000
```

## Troubleshooting

### "psql: command not found"

**Windows:**
Add PostgreSQL to PATH:
1. Find PostgreSQL bin directory (usually `C:\Program Files\PostgreSQL\15\bin`)
2. Add to System Environment Variables PATH

**Mac:**
```bash
echo 'export PATH="/usr/local/opt/postgresql@15/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### "password authentication failed"

Make sure you set the password correctly:
```sql
psql -U postgres
ALTER USER postgres WITH PASSWORD 'b4c8d09184fd3f09221efa7071f66f06';
```

### "database does not exist"

Create the database:
```bash
psql -U postgres -c "CREATE DATABASE project_manager;"
```

### Connection timeout

1. Check if PostgreSQL is running:
   - Windows: Check Services for "PostgreSQL"
   - Mac: `brew services list`
   - Linux: `sudo systemctl status postgresql`

2. Check if port 5432 is open:
   ```bash
   netstat -ano | findstr :5432
   ```

### "peer authentication failed" (Linux)

Edit PostgreSQL config:
```bash
sudo nano /etc/postgresql/15/main/pg_hba.conf
```

Change:
```
local   all   postgres   peer
```
To:
```
local   all   postgres   md5
```

Then restart:
```bash
sudo systemctl restart postgresql
```

## Using pgAdmin (GUI)

1. Open pgAdmin 4
2. Right-click "Servers" → "Register" → "Server"
3. General tab:
   - Name: `Project Manager`
4. Connection tab:
   - Host: `localhost`
   - Port: `5432`
   - Database: `project_manager`
   - Username: `postgres`
   - Password: `b4c8d09184fd3f09221efa7071f66f06`
5. Click "Save"

## Database Schema Overview

The database includes these tables:
- **users** - User accounts from Google OAuth
- **projects** - Project information
- **project_members** - Team members and sharing
- **tasks** - Tasks with status, priority, dates
- **task_assignees** - Task assignments
- **task_attachments** - Google Drive file links
- **task_comments** - Task discussions

## Production Considerations

For production deployment:

1. **Change the password** to something more secure
2. Use environment-specific credentials
3. Enable SSL connections
4. Set up automated backups
5. Configure connection pooling (already done in code)
6. Use a managed database service (AWS RDS, Google Cloud SQL, etc.)

## Alternative: SQLite (for Development Only)

If you don't want to install PostgreSQL for development, you could modify the app to use SQLite, but this requires code changes and is not recommended as the schema is designed for PostgreSQL.

---

**Ready?** Install PostgreSQL and run the setup commands above!
