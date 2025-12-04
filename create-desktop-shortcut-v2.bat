@echo off
echo ================================================
echo   Creating Desktop Shortcut for Project Manager
echo ================================================
echo.

REM Get the current directory
set CURRENT_DIR=%~dp0

echo Detecting Desktop location...
echo.

REM Try multiple possible Desktop locations
powershell -Command "$desktopPaths = @('%USERPROFILE%\Desktop', '%USERPROFILE%\OneDrive\Desktop', '%PUBLIC%\Desktop'); $desktopPath = $null; foreach ($path in $desktopPaths) { if (Test-Path $path) { $desktopPath = $path; break; } }; if ($desktopPath) { Write-Host \"Desktop found at: $desktopPath\"; $ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut(\"$desktopPath\Project Manager.lnk\"); $s.TargetPath = '%CURRENT_DIR%start-and-browse.bat'; $s.WorkingDirectory = '%CURRENT_DIR%'; $s.IconLocation = '%CURRENT_DIR%app-icon.ico'; $s.Description = 'Launch Project Manager App'; $s.Save(); Write-Host 'SUCCESS: Shortcut created with custom icon!' -ForegroundColor Green; } else { Write-Host 'ERROR: Could not find Desktop folder' -ForegroundColor Red; exit 1; }"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ================================================
    echo   SUCCESS! Desktop shortcut created!
    echo ================================================
    echo.
    echo You can now launch Project Manager from your desktop.
    echo The shortcut has been created with a custom icon!
    echo.
) else (
    echo.
    echo ================================================
    echo   Could not create shortcut automatically
    echo ================================================
    echo.
    echo Please create manually:
    echo 1. Right-click on your Desktop
    echo 2. New - Shortcut
    echo 3. Location: %CURRENT_DIR%start-and-browse.bat
    echo 4. Name: Project Manager
    echo.
)

pause
