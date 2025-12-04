# Project Manager

A comprehensive project management application with Google integrations for contacts, drive, and gmail.

## 🚀 Quick Start

**Want to get started fast?** See **[START_HERE.md](./START_HERE.md)** for easy startup options!

**Windows Users:** Just double-click `start-and-browse.bat` to start everything and open your browser automatically!

---

## Features

- **Task Management**: Create, edit, and track tasks with detailed fields
- **Google Contacts**: Assign tasks to people from your Google contacts
- **Google Drive**: Attach documents and drag-and-drop files from Google Drive
- **Gmail Integration**: Drag-and-drop emails to create tasks
- **Project Sharing**: Collaborate with your team by sharing projects
- **Real-time Updates**: Track project progress in real-time

## Tech Stack

- **Frontend**: React 18, Tailwind CSS, Lucide React icons
- **Backend**: Node.js, Express
- **Database**: PostgreSQL
- **Authentication**: JWT with Google OAuth 2.0
- **APIs**: Google Contacts, Google Drive, Gmail

## Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- Google Cloud Platform account

## Getting Started

### 1. Google Cloud Platform Setup

See [GOOGLE_SETUP_GUIDE.md](./GOOGLE_SETUP_GUIDE.md) for detailed instructions on:
- Creating a Google Cloud project
- Enabling required APIs
- Setting up OAuth 2.0 credentials

### 2. Database Setup

```bash
# Create PostgreSQL database
createdb project_manager

# Run the schema
psql project_manager < database/schema.sql
```

### 3. Environment Configuration

```bash
# Copy example env files
cp .env.example .env
cp server/.env.example server/.env

# Edit .env files with your configuration
# - Database credentials
# - JWT secret
# - Google OAuth credentials
```

### 4. Install Dependencies

```bash
# Install root dependencies
npm install

# Install server dependencies
cd server && npm install && cd ..
```

### 5. Run the Application

```bash
# Development mode (runs both frontend and backend)
npm start          # Frontend on http://localhost:3000
cd server && npm run dev  # Backend on http://localhost:5000
```

## Project Structure

```
project-manager/
├── src/                    # React frontend
│   ├── components/        # React components
│   ├── services/          # API service layer
│   ├── context/           # React context providers
│   └── utils/             # Utility functions
├── server/                # Express backend
│   ├── config/           # Configuration files
│   ├── controllers/      # Route controllers
│   ├── routes/           # API routes
│   ├── middleware/       # Custom middleware
│   ├── services/         # Business logic
│   └── server.js         # Entry point
├── database/             # Database schemas
└── public/               # Static assets
```

## API Endpoints

### Authentication
- `POST /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/google/callback` - OAuth callback
- `POST /api/auth/logout` - Logout user

### Projects
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get project details
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project
- `POST /api/projects/:id/share` - Share project with team

### Tasks
- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create task
- `GET /api/tasks/:id` - Get task details
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Google Integrations
- `GET /api/google/contacts` - Fetch Google contacts
- `POST /api/google/drive/attach` - Attach Drive file to task
- `POST /api/google/gmail/create-task` - Create task from email

## Development

```bash
# Run tests
npm test

# Build for production
npm run build
```

## License

MIT
