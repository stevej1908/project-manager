# Quick Start Guide

Get your Project Manager app up and running in minutes!

## Prerequisites

Before you begin, ensure you have:
- Node.js (v16+) installed
- PostgreSQL (v12+) installed and running
- A Google Cloud Platform account

## Step 1: Database Setup

Create the database and run the schema:

```bash
# Create database
createdb project_manager

# Run the schema (Windows)
psql -U postgres -d project_manager -f database\schema.sql

# Run the schema (Mac/Linux)
psql -U postgres -d project_manager -f database/schema.sql
```

## Step 2: Google Cloud Platform Setup

Follow the detailed guide in [GOOGLE_SETUP_GUIDE.md](./GOOGLE_SETUP_GUIDE.md) to:
1. Create a Google Cloud project
2. Enable required APIs (People, Drive, Gmail)
3. Set up OAuth 2.0 credentials
4. Configure OAuth consent screen

**Important**: Save your Client ID and Client Secret!

## Step 3: Configure Environment Variables

### Backend Configuration

```bash
cd server
cp .env.example .env
```

Edit `server/.env` and add your credentials:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=project_manager
DB_USER=postgres
DB_PASSWORD=your_postgres_password

# Server
PORT=5000
NODE_ENV=development

# JWT Secret (generate a random string)
JWT_SECRET=your_very_secure_random_string_here

# Frontend
FRONTEND_URL=http://localhost:3000

# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback
```

## Step 4: Install Dependencies

```bash
# Install root dependencies
npm install

# Install server dependencies
cd server
npm install
cd ..
```

## Step 5: Start the Application

### Option 1: Run Both at Once (Recommended)

```bash
# Terminal 1 - Start backend
cd server
npm run dev

# Terminal 2 - Start frontend
npm start
```

### Option 2: Run Separately

Backend (in one terminal):
```bash
cd server
npm run dev
```

Frontend (in another terminal):
```bash
npm start
```

## Step 6: Access the Application

1. Open your browser to `http://localhost:3000`
2. Click "Sign in with Google"
3. Authorize the required permissions
4. Start creating projects and tasks!

## Common Issues

### Database Connection Error

**Error**: `ECONNREFUSED ::1:5432`

**Solution**: Make sure PostgreSQL is running:
```bash
# Windows
pg_ctl -D "C:\Program Files\PostgreSQL\15\data" start

# Mac (Homebrew)
brew services start postgresql

# Linux
sudo systemctl start postgresql
```

### Google OAuth Error: "redirect_uri_mismatch"

**Solution**: Verify that `http://localhost:5000/api/auth/google/callback` is added to your authorized redirect URIs in Google Cloud Console.

### Port Already in Use

**Error**: `Port 3000 is already in use`

**Solution**: Kill the process using the port or change the port:
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <process_id> /F

# Mac/Linux
lsof -ti:3000 | xargs kill -9
```

## Features Overview

### Projects
- Create and organize multiple projects
- Customize with colors and descriptions
- Archive completed projects

### Tasks
- Drag and drop tasks between status columns (To Do, In Progress, Review, Done)
- Set priorities (Low, Medium, High, Urgent)
- Add start and end dates
- Add descriptions and comments

### Google Integrations
- **Contacts**: Assign tasks to people from your Google Contacts
- **Gmail**: Create tasks from emails with one click
- **Drive**: Attach files from Google Drive to tasks

### Collaboration
- Share projects with team members
- Set permissions (Editor or Viewer)
- Track who created and is assigned to tasks

## Next Steps

1. **Create Your First Project**: Click "New Project" on the dashboard
2. **Add Some Tasks**: Open a project and click "New Task"
3. **Try Drag and Drop**: Move tasks between columns
4. **Invite Your Team**: Click "Share" to add collaborators
5. **Explore Google Features**: Try creating a task from Gmail

## Development Tips

### Running Tests

```bash
npm test
```

### Building for Production

```bash
# Build frontend
npm run build

# The build folder will contain optimized production files
```

### Database Migrations

If you need to modify the database schema:

1. Edit `database/schema.sql`
2. Drop and recreate the database:
```bash
dropdb project_manager
createdb project_manager
psql -U postgres -d project_manager -f database/schema.sql
```

## Need Help?

- Check the [GOOGLE_SETUP_GUIDE.md](./GOOGLE_SETUP_GUIDE.md) for Google OAuth issues
- Review the [README.md](./README.md) for detailed documentation
- Check the browser console and server logs for error messages

## API Documentation

The backend API runs on `http://localhost:5000/api`

Health check: `http://localhost:5000/api/health`

See [README.md](./README.md) for full API endpoint documentation.

Happy project managing! 🚀
