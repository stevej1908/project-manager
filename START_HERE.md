# 🚀 Easy Start Guide

## Quick Start Options

I've created several ways to start your Project Manager app easily:

### Option 1: Double-Click Batch File (Windows - RECOMMENDED)

**Just double-click one of these files:**

1. **`start-and-browse.bat`** - Starts everything AND opens your browser automatically
   - This is the easiest option!
   - Wait 8 seconds and your browser will open to the app

2. **`start.bat`** - Starts both servers (you manually open browser)
   - Use this if you want more control
   - Manually navigate to http://localhost:3000

### Option 2: Use NPM Command

Open a terminal in the project folder and run:

```bash
npm run dev
```

This starts both frontend and backend together with nice colored output.

### Option 3: Mac/Linux Shell Scripts

```bash
# Make executable (first time only)
chmod +x start-and-browse.sh

# Then run
./start-and-browse.sh
```

## What Happens When You Start?

1. ✅ Checks if dependencies are installed (installs if missing)
2. ✅ Starts the backend server on http://localhost:5000
3. ✅ Starts the frontend app on http://localhost:3000
4. ✅ Opens your browser automatically (if using browse version)

## Before First Run

Make sure you've completed these setup steps:

### 1. Database Setup ✓
```bash
createdb project_manager
psql -U postgres -d project_manager -f database\schema.sql
```

### 2. Environment Variables ✓
- Copy `server/.env.example` to `server/.env`
- Add your database credentials
- Add your Google OAuth credentials (see GOOGLE_SETUP_GUIDE.md)

### 3. Install Dependencies (Optional)
The start scripts will automatically install dependencies if needed, but you can do it manually:

```bash
npm run install-all
```

## Stopping the Servers

Press **Ctrl+C** in the terminal window to stop both servers.

## Troubleshooting

### "Port 3000 already in use"

Another app is using port 3000. Kill it:

**Windows:**
```bash
netstat -ano | findstr :3000
taskkill /PID <process_id> /F
```

**Mac/Linux:**
```bash
lsof -ti:3000 | xargs kill -9
```

### "Port 5000 already in use"

Same as above but replace 3000 with 5000.

### Dependencies Not Installing

Manually install:
```bash
npm install
cd server
npm install
cd ..
```

### Scripts Not Working on Windows

If you get "cannot be loaded because running scripts is disabled", run PowerShell as Administrator:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## Creating a Desktop Shortcut (Windows)

Want to start the app from your desktop?

1. Right-click on `start-and-browse.bat`
2. Click "Send to" → "Desktop (create shortcut)"
3. Rename the shortcut to "Project Manager"
4. (Optional) Right-click the shortcut → Properties → Change Icon

Now you can double-click from your desktop!

## What's Running?

When started, you'll see:

```
[SERVER] ╔═══════════════════════════════════════════════╗
[SERVER] ║   Project Manager - API Server                ║
[SERVER] ║   Server running on port 5000                 ║
[SERVER] ╚═══════════════════════════════════════════════╝

[CLIENT] Compiled successfully!
[CLIENT] You can now view project-manager in the browser.
[CLIENT] Local: http://localhost:3000
```

## First Time Using the App?

1. Click "Sign in with Google"
2. Authorize the permissions
3. Create your first project
4. Start adding tasks!

## Need More Help?

- **Quick Setup**: See QUICK_START.md
- **Google Setup**: See GOOGLE_SETUP_GUIDE.md
- **Full Docs**: See README.md

---

**Ready to go?** Just double-click `start-and-browse.bat` and you're all set! 🎉
