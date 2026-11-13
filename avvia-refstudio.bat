@echo off
title REFSTUDIO - Server Autonomo Headless
cd /d "%~dp0"

:: Assicura che Node.js e Git siano nel PATH
if exist "C:\Program Files\nodejs" set "PATH=C:\Program Files\nodejs;%APPDATA%\npm;%PATH%"
if exist "C:\Program Files\Git\cmd" set "PATH=C:\Program Files\Git\cmd;%PATH%"

:: Lancia il server autonomo con auto-update continuo via PowerShell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\auto-server.ps1"

pause
