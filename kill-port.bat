@echo off
REM Kill process using a specific port
REM Usage: kill-port.bat [port_number]
REM Example: kill-port.bat 5000

setlocal

REM Default to port 5000 if no argument provided
set PORT=%1
if "%PORT%"=="" set PORT=5000

echo ================================================
echo   Killing Process on Port %PORT%
echo ================================================
echo.

REM Find the process using the port
echo Searching for process using port %PORT%...
echo.

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% "') do (
    set PID=%%a
    goto :found
)

echo No process found using port %PORT%
echo.
goto :end

:found
if "%PID%"=="" (
    echo No process found using port %PORT%
    echo.
    goto :end
)

echo Found process with PID: %PID%
echo Attempting to kill process...
echo.

taskkill /F /PID %PID% 2>nul

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✓ SUCCESS: Process killed successfully!
    echo Port %PORT% is now available.
) else (
    echo.
    echo ✗ ERROR: Could not kill process.
    echo You may need to run this script as Administrator.
)

echo.

:end
pause
