@echo off
title BetterNote Pro Studio Server
echo Starting BetterNote Local Server and Google Drive Auto-Sync...
cd /d "c:\Users\ADMIN\Desktop\Antigravity"
start "" "http://localhost:3000/"
call npm.cmd run dev
pause
