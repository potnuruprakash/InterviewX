@echo off
echo ===================================================
echo   Starting MongoDB Service for Adaptive AI Interviewer
echo ===================================================
echo.
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] Administrator privileges required.
    echo Requesting administrator privileges...
    powershell -Command "Start-Process cmd -ArgumentList '/c net start MongoDB & pause' -Verb RunAs"
    exit /b
)

net start MongoDB
echo.
echo MongoDB service status:
sc query MongoDB
echo.
pause
