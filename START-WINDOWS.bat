@echo off
cd /d "%~dp0"
echo Starting RiftVault at http://localhost:8000
where py >nul 2>nul
if %errorlevel% equ 0 (
 py -m http.server 8000
) else (
 python -m http.server 8000
)
pause
