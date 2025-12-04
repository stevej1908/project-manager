@echo off
echo ================================================
echo   PostgreSQL Database Setup
echo ================================================
echo.

REM Check if psql is available
psql --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: PostgreSQL is not installed or not in PATH
    echo.
    echo Please install PostgreSQL first:
    echo 1. Download from: https://www.postgresql.org/download/windows/
    echo 2. Or see DATABASE_SETUP.md for detailed instructions
    echo.
    pause
    exit /b 1
)

echo PostgreSQL is installed!
echo.
echo Creating database 'project_manager'...
echo.

REM Create database
psql -U postgres -c "CREATE DATABASE project_manager;" 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✓ Database created successfully
) else (
    echo Note: Database may already exist, continuing...
)

echo.
echo Loading database schema...
echo.

REM Run schema
psql -U postgres -d project_manager -f database\schema.sql

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ================================================
    echo   SUCCESS! Database is ready!
    echo ================================================
    echo.
    echo Database: project_manager
    echo User: postgres
    echo Host: localhost:5432
    echo.
    echo You can now start the server:
    echo   cd server
    echo   npm run dev
    echo.
) else (
    echo.
    echo ================================================
    echo   ERROR: Failed to create schema
    echo ================================================
    echo.
    echo Please check:
    echo 1. PostgreSQL service is running
    echo 2. Password is set correctly in server\.env
    echo 3. You have the correct credentials
    echo.
    echo See DATABASE_SETUP.md for troubleshooting.
    echo.
)

pause
