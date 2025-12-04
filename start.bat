@echo off
echo ================================================
echo   Project Manager - Starting Application
echo ================================================
echo.

REM Check if node_modules exists in root
if not exist "node_modules" (
    echo Installing root dependencies...
    call npm install
)

REM Check if node_modules exists in server
if not exist "server\node_modules" (
    echo Installing server dependencies...
    cd server
    call npm install
    cd ..
)

echo.
echo Starting servers...
echo - Backend API: http://localhost:5000
echo - Frontend App: http://localhost:3000
echo.
echo Press Ctrl+C to stop both servers
echo.

REM Start both servers using concurrently
call npm run dev
