@echo off
echo ================================================
echo   Creating Desktop Shortcut for Project Manager
echo ================================================
echo.

REM Get the current directory
set CURRENT_DIR=%~dp0

REM Create shortcut on desktop using PowerShell
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%USERPROFILE%\Desktop\Project Manager.lnk'); $s.TargetPath = '%CURRENT_DIR%start-and-browse.bat'; $s.WorkingDirectory = '%CURRENT_DIR%'; $s.IconLocation = '%CURRENT_DIR%app-icon.ico'; $s.Description = 'Launch Project Manager App'; $s.Save()"

echo.
echo ✓ Desktop shortcut created successfully with custom icon!
echo.
echo You can now launch Project Manager from your desktop.
echo.
pause
