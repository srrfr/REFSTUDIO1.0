@echo off
title REFSTUDIO - Server Locale
echo ========================================================
echo          AVVIO DI REFSTUDIO IN CORSO...
echo ========================================================
echo.

:: Vai nella cartella in cui si trova questo file .bat
cd /d "%~dp0"

:: Controlla se node_modules esiste
if not exist "node_modules\" (
    echo [INFO] Installazione dipendenze in corso (richiede qualche istante)...
    call npm install
    echo.
)

:: Controlla se la build esiste, altrimenti la esegue
if not exist ".next\" (
    echo [INFO] Prima compilazione in corso...
    call npm run build
    echo.
)

echo ========================================================
echo REFSTUDIO e' ora ATTIVO!
echo Puoi accedere da qualsiasi dispositivo della rete locale.
echo ========================================================
echo.

call npm run serve

pause
