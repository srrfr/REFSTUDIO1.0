# ==============================================================================
# REFSTUDIO - Motore di Auto-Aggiornamento e Gestione Server Headless
# ==============================================================================
$ErrorActionPreference = "Continue"

$PROJECT_DIR = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $PROJECT_DIR

Write-Host "========================================================" -ForegroundColor Green
Write-Host "   REFSTUDIO - SERVER AUTONOMO & AUTO-UPDATE ATTIVO" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host "Directory progetto: $PROJECT_DIR"
Write-Host "Link Fisso: https://scientist-try-wildcat.ngrok-free.dev" -ForegroundColor Yellow
Write-Host ""

# 1. Avvia ngrok se non e' gia' in esecuzione
$ngrokRunning = Get-Process -Name "ngrok" -ErrorAction SilentlyContinue
if (-not $ngrokRunning) {
    Write-Host "[1/3] Avvio Tunnel Permanente ngrok..." -ForegroundColor Cyan
    Start-Process ngrok -ArgumentList "http --domain=scientist-try-wildcat.ngrok-free.dev 3000" -WindowStyle Minimized
    Start-Sleep -Seconds 2
} else {
    Write-Host "[1/3] Tunnel ngrok gia' in esecuzione." -ForegroundColor DarkGray
}

# Funzione per liberare la porta 3000
function Stop-Port3000 {
    $connections = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
    foreach ($conn in $connections) {
        if ($conn.OwningProcess -gt 0) {
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    }
}

# Funzione per avviare il server Next.js
function Start-NextServer {
    Stop-Port3000
    Write-Host "[Server] Avvio di REFSTUDIO sulla porta 3000..." -ForegroundColor Green
    $process = Start-Process "npm.cmd" -ArgumentList "run serve" -PassThru -NoNewWindow
    return $process
}

# 2. Prima build se manca
if (-not (Test-Path ".next")) {
    Write-Host "[2/3] Prima compilazione in corso..." -ForegroundColor Cyan
    & npm.cmd run build
}

# 3. Avvio iniziale del server
$serverProc = Start-NextServer

Write-Host ""
Write-Host ">>> REFSTUDIO E' ONLINE E IN ASCOLTO DI MODIFICHE GITHUB <<<" -ForegroundColor Green
Write-Host "Ogni volta che farai 'git push' dal tuo PC, questo server si aggiornera' da solo!" -ForegroundColor Gray
Write-Host ""

$checkCount = 0

# 4. Loop di controllo automatico (ogni 30 secondi)
while ($true) {
    Start-Sleep -Seconds 30
    $checkCount++

    try {
        # Esegui fetch per aggiornare FETCH_HEAD con lo stato remoto
        & git.exe fetch origin main 2>$null
        $localCommit = (& git.exe rev-parse HEAD 2>$null).Trim()
        $remoteCommit = (& git.exe rev-parse FETCH_HEAD 2>$null).Trim()

        if ($localCommit -and $remoteCommit -and ($localCommit -ne $remoteCommit)) {
            $timestamp = Get-Date -Format "HH:mm:ss"
            Write-Host ""
            Write-Host "[$timestamp] [AutoSync] >>> Nuove modifiche rilevate su GitHub! ($($remoteCommit.Substring(0,7))) <<<" -ForegroundColor Yellow
            Write-Host "[$timestamp] [AutoSync] Allineamento pulito repository (reset hard a $remoteCommit)..." -ForegroundColor Cyan
            
            # Annulla eventuali modifiche automatiche locali (come db-state.json generato a runtime) e allinea a GitHub
            & git.exe reset --hard $remoteCommit

            Write-Host "[$timestamp] [AutoSync] Ricompilazione applicazione (npm run build)..." -ForegroundColor Cyan
            & npm.cmd run build

            Write-Host "[$timestamp] [AutoSync] Riavvio del server..." -ForegroundColor Green
            $serverProc = Start-NextServer
            Write-Host "[$timestamp] [AutoSync] Aggiornamento completato con successo!" -ForegroundColor Green
            Write-Host ""
        } elseif ($checkCount % 10 -eq 0) {
            # Heartbeat ogni 5 minuti per confermare che e' attivo
            $timestamp = Get-Date -Format "HH:mm:ss"
            Write-Host "[$timestamp] [Heartbeat] Server attivo e sincronizzato (Commit: $($localCommit.Substring(0,7)))" -ForegroundColor DarkGray
        }
    } catch {
        # Continua silenziosamente in caso di timeout rete momentaneo
    }
}
