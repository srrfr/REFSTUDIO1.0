import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import * as path from 'path';

let isScraperRunning = false;
let lastRunLog = '';
let lastRunTime: string | null = null;
let lastRunStatus: 'idle' | 'running' | 'success' | 'error' = 'idle';

export async function GET() {
  return NextResponse.json({
    isRunning: isScraperRunning,
    lastRunTime,
    lastRunStatus,
    isVercel: Boolean(process.env.VERCEL),
    logSummary: lastRunLog.slice(-1000),
  });
}

export async function POST() {
  if (process.env.VERCEL) {
    return NextResponse.json({
      success: false,
      isVercel: true,
      message:
        'L\'esecuzione diretta di browser headless (Playwright) supera i limiti di timeout di Vercel (10-60s). Utilizza il workflow automatico programmato su GitHub Actions che aggiorna il database in cloud.',
      githubActionsUrl: 'https://github.com/srrfr/REFSTUDIO1.0/actions',
    });
  }

  if (isScraperRunning) {
    return NextResponse.json({
      success: false,
      message: 'Lo scraper è già in esecuzione in background.',
    });
  }

  isScraperRunning = true;
  lastRunStatus = 'running';
  lastRunTime = new Date().toISOString();
  lastRunLog = 'Avvio scraper Tuttocampo in background...\n';

  const scriptPath = path.resolve(process.cwd(), 'scripts', 'scraper_tuttocampo.py');
  const pyProcess = spawn('python', [scriptPath, '--headless', '--sync'], {
    cwd: process.cwd(),
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
  });

  pyProcess.stdout.on('data', (data) => {
    lastRunLog += data.toString();
  });

  pyProcess.stderr.on('data', (data) => {
    lastRunLog += data.toString();
  });

  pyProcess.on('close', (code) => {
    isScraperRunning = false;
    lastRunStatus = code === 0 ? 'success' : 'error';
    lastRunLog += `\nProcesso terminato con codice: ${code}`;
  });

  return NextResponse.json({
    success: true,
    message: 'Scraper Tuttocampo avviato in background. L\'aggiornamento di rose, gare, classifiche e Supabase è in corso.',
  });
}
