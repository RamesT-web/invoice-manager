@echo off
echo ============================================
echo   Invoice Manager - Stopping...
echo ============================================
echo.

:: Kill any Node.js process on port 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo [INFO] Killing process PID %%a on port 3000...
    taskkill /PID %%a /F >nul 2>&1
)

:: Also kill any remaining next-server processes
taskkill /IM "node.exe" /FI "WINDOWTITLE eq Invoice Manager" /F >nul 2>&1

echo [OK] Invoice Manager stopped.
timeout /t 3 >nul
