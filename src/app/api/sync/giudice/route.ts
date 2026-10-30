import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { DbService } from '@/lib/repository/db-service';

let isScraperRunning = false;
let lastRunLog = '';
let lastRunTime: string | null = null;
let lastRunStatus: 'idle' | 'running' | 'success' | 'error' = 'idle';

export async function GET() {
  const rootDir = process.cwd();
  const pdfPath = path.resolve(rootDir, 'public', 'comunicati', 'GiudiceSportivo_Eccellenza.pdf');
  const jsonPath = path.resolve(rootDir, 'public', 'comunicati', 'provvedimenti_disciplinari.json');
  const csvPath = path.resolve(rootDir, 'public', 'comunicati', 'estrazioni.csv');

  let pdfExists = fs.existsSync(pdfPath);
  let pdfSize = 0;
  if (pdfExists) {
    try {
      pdfSize = fs.statSync(pdfPath).size;
    } catch {}
  }

  let sanctions: any[] = [];
  if (fs.existsSync(jsonPath)) {
    try {
      sanctions = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } catch {}
  }

  const counts = {
    total: sanctions.length,
    squalifiche: sanctions.filter((s) => s.tipo === 'SQUALIFICA' || s.tipo === 'CALCIATORE_ESPULSO').length,
    diffide: sanctions.filter((s) => s.tipo === 'DIFFIDA').length,
    diffideCoppa: sanctions.filter((s) => s.tipo === 'DIFFIDA_COPPA').length,
    staff: sanctions.filter((s) => s.tipo === 'STAFF_INIBIZIONE' || s.tipo === 'STAFF').length,
  };

  return NextResponse.json({
    isRunning: isScraperRunning,
    lastRunTime,
    lastRunStatus,
    pdfExists,
    pdfSize,
    pdfUrl: '/comunicati/GiudiceSportivo_Eccellenza.pdf',
    csvUrl: '/comunicati/estrazioni.csv',
    jsonUrl: '/comunicati/provvedimenti_disciplinari.json',
    counts,
    recentSanctions: sanctions.slice(-30).reverse(), // Più recenti in alto
    logSummary: lastRunLog.slice(-1500),
  });
}

export async function POST(req: Request) {
  if (isScraperRunning) {
    return NextResponse.json({
      success: false,
      message: 'La raccolta comunicati è già in corso in background.',
    });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {}

  isScraperRunning = true;
  lastRunStatus = 'running';
  lastRunTime = new Date().toISOString();
  lastRunLog = 'Avvio raccolta comunicati FIGC CRER Giudice Sportivo...\n';

  const scriptPath = path.resolve(process.cwd(), 'scripts', 'scraper_giudice_sportivo.py');
  const args = [scriptPath];

  if (body.maxPages) {
    args.push('--max-pages', String(body.maxPages));
  }
  if (body.limitPdfs) {
    args.push('--limit-pdfs', String(body.limitPdfs));
  }
  if (body.force) {
    args.push('--force');
  }

  const pyProcess = spawn('python', args, {
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
    if (code === 0) {
      try {
        DbService.recalculateAllDisciplinaryStatuses();
      } catch {}
    }
    lastRunLog += `\nElaborazione comunicati terminata con codice: ${code}\n`;
  });

  return NextResponse.json({
    success: true,
    message: 'Scraping comunicati Giudice Sportivo avviato con successo in background.',
  });
}
