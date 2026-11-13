@echo off
title REFSTUDIO - Server Autonomo Locale
echo ========================================================
echo        REFSTUDIO - AVVIO AUTOMATICO E SINCRONIZZAZIONE
echo ========================================================
echo.

cd /d "%~dp0"

:: 1. Rileva automaticamente il percorso di Node.js e npm
set "NODE_CMD="
set "NPM_CMD="

:: Cerca nei percorsi standard di installazione
if exist "C:\Program Files\nodejs\npm.cmd" (
    set "NODE_DIR=C:\Program Files\nodejs"
    set "NPM_CMD=C:\Program Files\nodejs\npm.cmd"
) else if exist "C:\Program Files (x86)\nodejs\npm.cmd" (
    set "NODE_DIR=C:\Program Files (x86)\nodejs"
    set "NPM_CMD=C:\Program Files (x86)\nodejs\npm.cmd"
) else if exist "%LOCALAPPDATA%\Programs\nodejs\npm.cmd" (
    set "NODE_DIR=%LOCALAPPDATA%\Programs\nodejs"
    set "NPM_CMD=%LOCALAPPDATA%\Programs\nodejs\npm.cmd"
) else (
    :: Tenta tramite comando di sistema
    where npm >nul 2>nul && set "NPM_CMD=npm"
)

:: Aggiorna la variabile PATH per includere Node.js, Git e ngrok
if defined NODE_DIR (
    set "PATH=%NODE_DIR%;%APPDATA%\npm;%PATH%"
)
set "PATH=%PATH%;C:\Program Files\Git\cmd;%LOCALAPPDATA%\Microsoft\WinGet\Packages;%LOCALAPPDATA%\Programs\ngrok"

:: 2. Controllo aggiornamenti da GitHub
echo [1/3] Controllo aggiornamenti da GitHub...
git pull origin main 2>nul

:: Verifica se npm e' stato trovato
if not defined NPM_CMD (
    echo.
    echo [ERRORE] Impossibile trovare Node.js o npm nel computer!
    echo Assicurati di aver installato Node.js da https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: 3. Avvio Tunnel Fisso ngrok in background
echo [2/3] Avvio Tunnel Permanente ngrok...
start /min "REFSTUDIO Tunnel (ngrok)" ngrok http --domain=scientist-try-wildcat.ngrok-free.dev 3000

echo.
echo ========================================================
echo REFSTUDIO e' ATTIVO e accessibile ovunque!
echo.
echo IL TUO LINK FISSO E':
echo https://scientist-try-wildcat.ngrok-free.dev
echo ========================================================
echo.

:: 4. Avvia il server Next.js (finestra principale)
echo [3/3] Avvio del server di produzione Next.js...
call "%NPM_CMD%" run serve

pause
