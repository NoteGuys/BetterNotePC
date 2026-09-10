@echo off
title BetterNote Pro Studio (Offline Standalone)
cd /d "%~dp0"

:: Check if dist bundle exists, build if missing
if not exist "%~dp0dist\index.html" (
    echo [BetterNote] Preparing offline application bundle...
    call npm.cmd run build
)

:: Launch Native Electron App directly (100% Offline, No Localhost, No Internet Required)
if exist "%~dp0node_modules\electron\dist\electron.exe" (
    start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0."
) else (
    start "" npx electron .
)
