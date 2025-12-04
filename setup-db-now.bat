@echo off
echo ================================================
echo   PostgreSQL Database Setup
echo ================================================
echo.

SET PGPASSWORD=b4c8d09184fd3f09221efa7071f66f06

echo Creating database 'project_manager'...
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -c "CREATE DATABASE project_manager;" 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✓ Database created successfully
) else (
    echo Note: Database may already exist, continuing...
)

echo.
echo Loading database schema...
echo.

"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d project_manager -f database\schema.sql

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
) else (
    echo.
    echo ================================================
    echo   ERROR: Failed to create schema
    echo ================================================
    echo.
)

SET PGPASSWORD=
pause
