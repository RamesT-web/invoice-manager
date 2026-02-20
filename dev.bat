@echo off
title Invoice Manager (Dev)
echo ============================================
echo   Invoice Manager - Development Mode
echo ============================================
echo.

:: Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Download from https://nodejs.org
    pause
    exit /b 1
)

:: Check if .env exists
if not exist ".env" (
    echo [ERROR] .env file not found.
    echo Copy .env.example to .env and configure your database URL.
    pause
    exit /b 1
)

:: Check if node_modules exists
if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    call npm install --legacy-peer-deps
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

:: Generate Prisma client
call npx prisma generate

echo.
echo [OK] Starting dev server on http://localhost:3000
echo      Press Ctrl+C to stop.
echo.
call npm run dev
