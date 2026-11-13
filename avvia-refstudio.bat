@echo off
title REFSTUDIO - Server Autonomo Locale
echo ========================================================
echo        REFSTUDIO - AVVIO AUTOMATICO E SINCRONIZZAZIONE
echo ========================================================
echo.

cd /d "%~dp0"

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

echo [4/4] Avvio server REFSTUDIO e Tunnel in corso...
echo.

:: Avvia il tunnel fisso in una finestra separata ridotta a icona
:: (Se usi ngrok con dominio statico, decommenta la riga sotto inserendo il tuo dominio)
:: start /min cmd /k "ngrok http --domain=IL-TUO-DOMINIO.ngrok-free.app 3000"

:: Avvia il server Next.js
call npm run serve

pause
