@echo off
cd /d "%~dp0"
title JIBI Control Center - keep this window open
where node >nul 2>nul || (echo [X] Node.js is not installed. Download LTS from nodejs.org & pause & exit /b)
if not exist node_modules (
  echo Installing for the first time, please wait...
  call npm install --no-fund --no-audit
)
echo Closing old JIBI app if it is still running...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3939" ^| findstr "LISTENING"') do taskkill /f /t /pid %%p >nul 2>nul
echo Starting JIBI Control Center... (closing this window closes the app and the bot)
node app\server.js
pause
