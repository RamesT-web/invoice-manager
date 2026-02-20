@echo off
title Invoice Manager
echo ============================================
echo   Invoice Manager - Starting...
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
    if exist ".env.example" (
        echo [INFO] Creating .env from .env.example...
        copy .env.example .env >nul
        echo [INFO] Edit .env if your database credentials differ from defaults.
    ) else (
        echo [ERROR] .env file not found.
        pause
        exit /b 1
    )
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
if not exist "node_modules\.prisma\client" (
    echo [INFO] Generating Prisma client...
    call npx prisma generate
)

:: Run database migrations
echo [INFO] Applying database migrations...
call npx prisma migrate deploy
if %errorlevel% neq 0 (
    echo.
    echo [WARN] Migration failed - is PostgreSQL running?
    echo   - Docker: docker compose up -d
    echo   - Local:  ensure PostgreSQL is running on port 5432
    echo.
    pause
    exit /b 1
)

:: Build if needed
if not exist ".next" (
    echo [INFO] Building the app (first run)...
    call npm run build
    if %errorlevel% neq 0 (
        echo [ERROR] Build failed. Check for errors above.
        pause
        exit /b 1
    )
)

:: Start in production mode
echo.
echo [OK] Starting Invoice Manager on http://localhost:3000
echo      Press Ctrl+C to stop.
echo.
call npm run start
