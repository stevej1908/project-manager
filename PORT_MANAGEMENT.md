# Port Management Utilities

Scripts to help manage ports and kill processes that are blocking your development servers.

## Quick Usage

### Kill Port 5000 (Backend Server)
```bash
npm run kill:5000
```

### Kill Port 3000 (Frontend Server)
```bash
npm run kill:3000
```

## Manual Usage

### Windows

**Double-click the script:**
```
kill-port.bat
```
This will kill the process on port 5000 by default.

**Kill a custom port:**
```cmd
kill-port.bat 3000
```

**Or use the Node.js script:**
```cmd
node kill-port.js 5000
```

### Mac / Linux / Git Bash

**Run the shell script:**
```bash
./kill-port.sh
```
This will kill the process on port 5000 by default.

**Kill a custom port:**
```bash
./kill-port.sh 3000
```

**Or use the Node.js script:**
```bash
node kill-port.js 5000
```

## When to Use

Use these scripts when you see errors like:

```
Error: listen EADDRINUSE: address already in use :::5000
```

This means another process is already using that port. These scripts will:
1. Find the process using the port
2. Kill that process
3. Free up the port for your app

## Common Scenarios

### Starting the dev server fails

If `npm run dev` or `npm start` fails with "address already in use":

1. Run `npm run kill:5000` (for backend)
2. Run `npm run kill:3000` (for frontend if needed)
3. Start the server again

### Multiple terminal sessions

If you started the server in another terminal and forgot about it:

1. Run the kill script instead of hunting for the terminal
2. Restart your server

### Port conflicts with other apps

Sometimes other applications use ports 3000 or 5000:
- Port 5000: Windows may use this for various services
- Port 3000: Other development servers

Use these scripts to quickly free up the port.

## Scripts Available

| Script | Description |
|--------|-------------|
| `kill-port.bat` | Windows batch script (default port 5000) |
| `kill-port.sh` | Unix/Mac shell script (default port 5000) |
| `kill-port.js` | Cross-platform Node.js script |
| `npm run kill:5000` | NPM shortcut for port 5000 |
| `npm run kill:3000` | NPM shortcut for port 3000 |

## Troubleshooting

### "Access Denied" or "Permission Error"

On Windows, you may need to:
- Run as Administrator (right-click script → "Run as administrator")

On Mac/Linux:
- Use sudo: `sudo ./kill-port.sh 5000`

### Script doesn't find the process

- Make sure the port number is correct
- On Mac/Linux, you may need to install `lsof`: `brew install lsof`

### Script kills the wrong process

- Always check what's using the port first:
  - Windows: `netstat -ano | findstr :5000`
  - Mac/Linux: `lsof -i :5000`

## Integration with start-and-browse.bat

The main startup script (`start-and-browse.bat`) already includes port cleanup, so you usually won't need to manually kill ports when using it.

However, these utilities are useful for:
- Quick development workflow
- Testing different ports
- Cleaning up after crashes
- Managing multiple projects

---

**Pro Tip:** Add these to your workflow:
1. `npm run kill:5000` - Clear backend port
2. `npm run kill:3000` - Clear frontend port
3. `npm run dev` - Start both servers
