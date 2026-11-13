@echo off
title REFSTUDIO - Server Autonomo Locale
echo ========================================================
echo        REFSTUDIO - AVVIO AUTOMATICO E SINCRONIZZAZIONE
echo ========================================================
echo.

:: Forza l'inclusione di Node.js, Git e ngrok nel PATH di questa sessione
set "PATH=%PATH%;C:\Program Files\nodejs;%APPDATA%\npm;C:\Program Files\Git\cmd;%LOCALAPPDATA%\Microsoft\WinGet\Packages;%LOCALAPPDATA%\Programs\ngrok"

cd /d "%~dp0"

:: Configura la cartella come sicura per Git per evitare il blocco "dubious ownership"
git config --global --add safe.directory "%CD%" 2>nul
git config --global --add safe.directory "%~dp0" 2>nul

:: 1. Verifica aggiornamenti automatici da GitHub
echo [1/4] Controllo aggiornamenti da GitHub...
git pull origin main

:: 2. Installa dipendenze se mancano
if not exist "node_modules\" (
    echo [2/4] Installazione dipendenze in corso...
    call npm install
)

:: 3. Se la cartella .next non esiste, fa la prima build
if not exist ".next\" (
    echo [3/4] Creazione della prima build di produzione...
    call npm run build
)

:: 4. Avvio Tunnel Fisso ngrok in background
echo [4/4] Avvio Tunnel Permanente ngrok...
start /min "REFSTUDIO Tunnel (ngrok)" ngrok http --domain=scientist-try-wildcat.ngrok-free.dev 3000

echo.
echo ========================================================
echo REFSTUDIO e' ATTIVO e accessibile ovunque!
echo.
echo IL TUO LINK FISSO E':
echo https://scientist-try-wildcat.ngrok-free.dev
echo ========================================================
echo.

:: Avvia il server Next.js (finestra principale)
call npm run serve

pause
