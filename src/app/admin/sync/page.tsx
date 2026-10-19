'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Database,
  Layers,
  Upload,
  Shield,
  Cloud,
  Radio,
  Zap,
  Globe,
  Server,
  Activity,
  Users,
  Terminal,
  Play,
  ExternalLink,
  Calendar,
  Scale,
  FileText,
  Download,
  Gavel,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { useRealtime } from '@/lib/supabase/realtime-context';
import { DbService } from '@/lib/repository/db-service';
import { ClientExcelParser } from '@/lib/data-provider/client-excel-parser';

export default function AdminSyncPage() {
  const { user, isAdmin } = useAuth();
  const { isConnected: isRealtimeConnected, onlineRefereesCount, lastEvent, syncNow } = useRealtime();
  const [loading, setLoading] = useState(false);
  const [syncResponse, setSyncResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // File upload state
  const [fileDatabaseCompleto, setFileDatabaseCompleto] = useState<File | null>(null);
  const [fileGironeA, setFileGironeA] = useState<File | null>(null);
  const [fileGironeB, setFileGironeB] = useState<File | null>(null);
  const [fileGare, setFileGare] = useState<File | null>(null);

  // Scraper Python State
  const [scraperStatus, setScraperStatus] = useState<{
    isRunning: boolean;
    lastRunTime: string | null;
    lastRunStatus: string;
    isVercel: boolean;
    logSummary: string;
  } | null>(null);
  const [scraperLoading, setScraperLoading] = useState(false);

  // Giudice Sportivo FIGC CRER State
  const [giudiceStatus, setGiudiceStatus] = useState<{
    isRunning: boolean;
    lastRunTime: string | null;
    lastRunStatus: string;
    pdfExists: boolean;
    pdfSize: number;
    pdfUrl: string;
    csvUrl: string;
    jsonUrl: string;
    counts: { total: number; squalifiche: number; diffide: number; diffideCoppa?: number; staff: number };
    recentSanctions: any[];
    logSummary: string;
  } | null>(null);
  const [giudiceLoading, setGiudiceLoading] = useState(false);
  const [showSanctionsTable, setShowSanctionsTable] = useState(false);
  const [sanctionFilter, setSanctionFilter] = useState<'ALL' | 'SQUALIFICA' | 'DIFFIDA' | 'DIFFIDA_COPPA' | 'STAFF'>('ALL');

  // Supabase Cloud State
  const [supabaseStatus, setSupabaseStatus] = useState<{
    loading: boolean;
    configured: boolean;
    connected?: boolean;
    counts?: { teams: number; players: number; matches: number; notes: number; videos: number };
    error?: string;
  }>({ loading: true, configured: false });
  const [supabaseMigrating, setSupabaseMigrating] = useState(false);
  const [supabaseResult, setSupabaseResult] = useState<any>(null);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);

  useEffect(() => {
    checkSupabaseStatus();
    checkScraperStatus();
    checkGiudiceStatus();
  }, []);

  const checkGiudiceStatus = async () => {
    try {
      const res = await fetch('/api/sync/giudice');
      const data = await res.json();
      setGiudiceStatus(data);
    } catch {}
  };

  const handleRunGiudice = async () => {
    setGiudiceLoading(true);
    try {
      const res = await fetch('/api/sync/giudice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!data.success && data.message) {
        setError(data.message);
      }
      await checkGiudiceStatus();
    } catch (err: any) {
      setError(err.message || 'Errore durante l\'avvio della raccolta comunicati');
    } finally {
      setGiudiceLoading(false);
    }
  };

  const checkScraperStatus = async () => {
    try {
      const res = await fetch('/api/sync/scraper');
      const data = await res.json();
      setScraperStatus(data);
    } catch {}
  };

  const handleRunScraper = async () => {
    setScraperLoading(true);
    try {
      const res = await fetch('/api/sync/scraper', { method: 'POST' });
      const data = await res.json();
      if (data.isVercel) {
        window.open(data.githubActionsUrl || 'https://github.com/srrfr/REFSTUDIO1.0/actions', '_blank');
      } else {
        await checkScraperStatus();
      }
    } catch (err: any) {
      setError(err.message || 'Errore durante l\'avvio dello scraper');
    } finally {
      setScraperLoading(false);
    }
  };

  const checkSupabaseStatus = async () => {
    try {
      const res = await fetch('/api/sync/supabase');
      const data = await res.json();
      setSupabaseStatus({ loading: false, ...data });
    } catch {
      setSupabaseStatus({
        loading: false,
        configured: false,
        connected: false,
        error: 'Impossibile verificare lo stato di Supabase',
      });
    }
  };

  const handleMigrateToSupabase = async () => {
    setSupabaseMigrating(true);
    setSupabaseError(null);
    setSupabaseResult(null);

    try {
      const res = await fetch('/api/sync/supabase', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSupabaseResult(data);
        checkSupabaseStatus();
      } else {
        setSupabaseError(data.message || 'Errore durante la migrazione a Supabase');
      }
    } catch (err: any) {
      setSupabaseError(err.message || 'Errore di connessione durante la migrazione');
    } finally {
      setSupabaseMigrating(false);
    }
  };

  const handleRunSync = async (useFiles = false) => {
    setLoading(true);
    setError(null);
    setSyncResponse(null);

    try {
      // 1. Elaborazione istantanea client-side se è stato selezionato il file Excel completo
      if (useFiles && fileDatabaseCompleto) {
        try {
          const XLSX = await import('xlsx');
          const arrayBuffer = await fileDatabaseCompleto.arrayBuffer();
          const wb = XLSX.read(arrayBuffer, { type: 'array' });
          const currentState = DbService.getState();
          const clientParsed = ClientExcelParser.parseWorkbook(wb, currentState);
          if (clientParsed.success && clientParsed.dataset) {
            DbService.replaceFullDataset(clientParsed.dataset);
            setSyncResponse({
              success: true,
              message: '✓ Dati applicati istantaneamente in locale! Sincronizzazione Cloud in corso...',
              summary: clientParsed.summary,
            });
          }
        } catch (clientErr: any) {
          console.warn('Avviso parsing locale client:', clientErr);
        }
      }

      // 2. Invio multipart al server per persistenza e sincronizzazione Supabase Cloud
      let res: Response;
      if (useFiles && (fileDatabaseCompleto || fileGironeA || fileGironeB || fileGare)) {
        const formData = new FormData();
        if (fileDatabaseCompleto) formData.append('fileDatabaseCompleto', fileDatabaseCompleto);
        if (fileGironeA) formData.append('fileGironeA', fileGironeA);
        if (fileGironeB) formData.append('fileGironeB', fileGironeB);
        if (fileGare) formData.append('fileGareClassifica', fileGare);
        res = await fetch('/api/sync', { method: 'POST', body: formData });
      } else {
        res = await fetch('/api/sync', { method: 'POST' });
      }

      const data = await res.json();
      if (data.success) {
        if (data.dataset) {
          DbService.replaceFullDataset(data.dataset);
        }
        await syncNow();
        setSyncResponse(data);
        checkSupabaseStatus();
      } else {
        setError(data.message || 'Errore durante la sincronizzazione');
      }
    } catch (err: any) {
      setError(err.message || 'Errore di connessione al server');
    } finally {
      setLoading(false);
    }
  };


  if (!isAdmin) {
    return (
      <div className="py-24 px-4 text-center max-w-lg mx-auto space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 mx-auto shadow-[0_0_25px_rgba(244,63,94,0.2)]">
          <Shield className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-white">Accesso Riservato</h1>
        <p className="text-xs text-slate-400 leading-relaxed">
          La sezione <strong>Data Provider Sync</strong> e l&apos;aggiornamento del database sono riservati esclusivamente all&apos;amministratore (<strong>@samueleromini</strong>).
        </p>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#141824] hover:bg-[#1E2435] text-xs font-bold text-[#CCFF00] rounded-xl border border-[#212638] transition-all"
          >
            Torna alla Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#CCFF00]/10 border border-[#CCFF00]/30 text-[#CCFF00] text-xs font-black uppercase tracking-wider mb-3 shadow-[0_0_12px_rgba(204,255,0,0.2)]">
          <Layers className="w-3.5 h-3.5" />
          Data Provider Abstraction Layer
        </div>
        <h1 className="text-2xl font-black text-white">Centro di Sincronizzazione Dati</h1>
        <p className="text-xs text-slate-400">
          Aggiorna l&apos;intero ecosistema caricando o rielaborando i fogli Excel ufficiali senza intaccare note e tag arbitrali
        </p>
      </div>

      {/* TUTTOCAMPO SCRAPER AUTOMATICO */}
      <div className="rounded-2xl bg-[#0D0F16] border border-[#212638] p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-black text-base text-white flex items-center gap-2">
                <Terminal className="w-5 h-5 text-[#CCFF00]" />
                Tuttocampo Scraper & Schedulazione Automatica
              </h3>
              {scraperStatus?.isRunning ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  Scraping in corso...
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#141824] text-[#CCFF00] border border-[#212638]">
                  <CheckCircle2 className="w-3 h-3 text-[#CCFF00]" />
                  Scraper Pronto
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Estrae automaticamente rose, gare, ammonizioni, espulsioni e classifiche con codici ufficiali ID Giocatore e ID Rosa
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleRunScraper}
              disabled={scraperLoading || scraperStatus?.isRunning}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#CCFF00] hover:bg-[#D8FF33] disabled:bg-[#141824] disabled:text-slate-600 text-black font-black text-xs shadow-[0_0_15px_rgba(204,255,0,0.3)] transition-all"
            >
              <Play className={`w-3.5 h-3.5 fill-black ${scraperLoading ? 'animate-spin' : ''}`} />
              <span>{scraperStatus?.isRunning ? 'Scraping Attivo...' : 'Avvia Scraper Tuttocampo'}</span>
            </button>

            <a
              href="https://github.com/srrfr/REFSTUDIO1.0/actions"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#141824] hover:bg-[#1E2435] text-slate-200 border border-[#212638] text-xs font-bold transition-all"
            >
              <span>GitHub Actions</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>
          </div>
        </div>

        {/* Automatismo & Cron Info Box */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-4 rounded-xl bg-[#11141D] border border-[#212638] space-y-2">
            <div className="flex items-center gap-2 text-white font-bold">
              <Calendar className="w-4 h-4 text-[#CCFF00]" />
              <span>Schedulazione Cloud Automatica (Zero Intervento)</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Il workflow GitHub Actions esegue automaticamente lo scraper ogni <strong className="text-white">Domenica alle 21:00 UTC</strong> (dopo le gare) e ogni <strong className="text-white">Lunedì alle 08:00 UTC</strong>. I dati aggiornati vengono inviati all&apos;istante a Supabase e visibili su tutti i dispositivi.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#11141D] border border-[#212638] space-y-2">
            <div className="flex items-center gap-2 text-white font-bold">
              <Terminal className="w-4 h-4 text-[#CCFF00]" />
              <span>Comando Rapido da Terminale</span>
            </div>
            <div className="bg-[#0A0C12] p-2.5 rounded-lg font-mono text-[11px] text-[#CCFF00] border border-[#212638]">
              npm run scrape:sync
            </div>
            <p className="text-[10px] text-slate-500">
              Esegue lo scraper Playwright in locale, ricostruisce il database Excel e aggiorna Supabase Cloud in un unico comando.
            </p>
          </div>
        </div>
      </div>

      {/* GIUDICE SPORTIVO FIGC CRER */}
      <div className="rounded-2xl bg-[#0D0F16] border border-[#212638] p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-black text-base text-white flex items-center gap-2">
                <Scale className="w-5 h-5 text-[#CCFF00]" />
                Giudice Sportivo FIGC CRER (Eccellenza)
              </h3>
              {giudiceStatus?.isRunning ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  Raccolta in corso...
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#141824] text-[#CCFF00] border border-[#212638]">
                  <CheckCircle2 className="w-3 h-3 text-[#CCFF00]" />
                  {giudiceStatus?.pdfExists ? 'Comunicati Consolidati' : 'Pronto'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Scansiona il portale figccrer.it, isola le decisioni per l&apos;Eccellenza, crea il PDF unico e ricava espulsioni, diffide e inibizioni staff
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleRunGiudice}
              disabled={giudiceLoading || giudiceStatus?.isRunning}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#CCFF00] hover:bg-[#D8FF33] disabled:bg-[#141824] disabled:text-slate-600 text-black font-black text-xs shadow-[0_0_15px_rgba(204,255,0,0.3)] transition-all"
            >
              <Play className={`w-3.5 h-3.5 fill-black ${giudiceLoading ? 'animate-spin' : ''}`} />
              <span>{giudiceStatus?.isRunning ? 'Elaborazione in corso...' : 'Aggiorna Comunicati'}</span>
            </button>

            {giudiceStatus?.pdfExists && (
              <a
                href={giudiceStatus.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#141824] hover:bg-[#1E2435] text-[#CCFF00] border border-[#212638] text-xs font-bold transition-all"
                title="Apri o scarica il PDF consolidato"
              >
                <Download className="w-3.5 h-3.5" />
                <span>PDF Unificato ({((giudiceStatus.pdfSize || 0) / (1024 * 1024)).toFixed(1)} MB)</span>
              </a>
            )}

            {giudiceStatus?.csvUrl && (
              <a
                href={giudiceStatus.csvUrl}
                download
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#141824] hover:bg-[#1E2435] text-slate-300 border border-[#212638] text-xs font-bold transition-all"
                title="Scarica log estrazioni CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
                <span>CSV</span>
              </a>
            )}
          </div>
        </div>

        {/* Statistiche Sanzioni Rilevate */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3.5 bg-[#11141D] rounded-xl border border-[#212638]">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Totale Sanzioni</span>
            <span className="text-xl font-black text-white font-mono">
              {giudiceStatus?.counts?.total ?? 0}
            </span>
          </div>
          <div className="p-3.5 bg-[#11141D] rounded-xl border border-[#212638]">
            <span className="text-[10px] uppercase font-bold text-rose-400 block">Squalifiche Calciatori</span>
            <span className="text-xl font-black text-rose-400 font-mono">
              {giudiceStatus?.counts?.squalifiche ?? 0}
            </span>
          </div>
          <div className="p-3.5 bg-[#11141D] rounded-xl border border-[#212638]">
            <span className="text-[10px] uppercase font-bold text-amber-400 block">Diffide Campionato (IV Infr.)</span>
            <span className="text-xl font-black text-amber-400 font-mono">
              {giudiceStatus?.counts?.diffide ?? 0}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              +{giudiceStatus?.counts?.diffideCoppa ?? 0} in Coppa (escluse)
            </span>
          </div>
          <div className="p-3.5 bg-[#11141D] rounded-xl border border-[#212638]">
            <span className="text-[10px] uppercase font-bold text-purple-400 block">Inibizioni Staff</span>
            <span className="text-xl font-black text-purple-400 font-mono">
              {giudiceStatus?.counts?.staff ?? 0}
            </span>
          </div>
        </div>

        {/* Info & Terminal Command */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-4 rounded-xl bg-[#11141D] border border-[#212638] space-y-2">
            <div className="flex items-center gap-2 text-white font-bold">
              <Calendar className="w-4 h-4 text-[#CCFF00]" />
              <span>Sincronizzazione Automatica Disciplinare</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Il parser abbina automaticamente i nominativi sanzionati alle rose delle squadre, aggiornando lo stato disciplinare (<strong className="text-rose-400">Squalificato</strong> e <strong className="text-amber-400">Diffidato</strong>). Come richiesto dal regolamento sportivo, la dicitura <strong className="text-amber-400">DIFFIDATO</strong> viene inserita e considerata <strong>esclusivamente</strong> per i provvedimenti del <strong className="text-white">Campionato Eccellenza</strong> (escludendo le diffide a parte maturate in Coppa Italia).
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#11141D] border border-[#212638] space-y-2">
            <div className="flex items-center gap-2 text-white font-bold">
              <Terminal className="w-4 h-4 text-[#CCFF00]" />
              <span>Comando Rapido da Terminale</span>
            </div>
            <div className="bg-[#0A0C12] p-2.5 rounded-lg font-mono text-[11px] text-[#CCFF00] border border-[#212638]">
              npm run sync:giudice
            </div>
            <p className="text-[10px] text-slate-500">
              Scarica i nuovi comunicati da figccrer.it, aggiorna il file PDF GiudiceSportivo_Eccellenza.pdf e ricarica i provvedimenti.
            </p>
          </div>
        </div>

        {/* Elenco Provvedimenti Recenti Accordion */}
        {giudiceStatus && giudiceStatus.recentSanctions && giudiceStatus.recentSanctions.length > 0 && (
          <div className="pt-2">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setShowSanctionsTable(!showSanctionsTable)}
                className="flex items-center gap-2 text-xs font-bold text-white hover:text-[#CCFF00] transition-colors"
              >
                <span>{showSanctionsTable ? 'Nascondi Registro Sanzioni' : 'Mostra Registro Sanzioni Recenti Estratte'}</span>
                <span className="text-[10px] font-mono text-[#CCFF00] bg-[#141824] px-2 py-0.5 rounded-full border border-[#212638]">
                  {giudiceStatus.recentSanctions.length} provvedimenti
                </span>
              </button>

              {showSanctionsTable && (
                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                  {(['ALL', 'SQUALIFICA', 'DIFFIDA', 'DIFFIDA_COPPA', 'STAFF'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setSanctionFilter(f)}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                        sanctionFilter === f
                          ? 'bg-[#CCFF00] text-black shadow-[0_0_10px_rgba(204,255,0,0.2)]'
                          : 'bg-[#141824] text-slate-400 hover:text-white border border-[#212638]'
                      }`}
                    >
                      {f === 'ALL'
                        ? 'Tutte'
                        : f === 'DIFFIDA'
                        ? 'Diffide Campionato'
                        : f === 'DIFFIDA_COPPA'
                        ? 'Diffide Coppa Italia'
                        : f === 'STAFF'
                        ? 'Staff'
                        : 'Squalifiche'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {showSanctionsTable && (
              <div className="max-h-80 overflow-y-auto rounded-xl border border-[#212638] bg-[#0A0C12]">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-[#11141D] text-slate-400 sticky top-0 border-b border-[#212638]">
                    <tr>
                      <th className="p-2.5 font-bold">Tipo</th>
                      <th className="p-2.5 font-bold">Competizione</th>
                      <th className="p-2.5 font-bold">Nominativo</th>
                      <th className="p-2.5 font-bold">Squadra</th>
                      <th className="p-2.5 font-bold">Provvedimento Deliberato</th>
                      <th className="p-2.5 font-bold">Comunicato</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1B2030] text-slate-300">
                    {giudiceStatus.recentSanctions
                      .filter((s) => {
                        if (sanctionFilter === 'ALL') return true;
                        if (sanctionFilter === 'SQUALIFICA') return s.tipo === 'SQUALIFICA' || s.tipo === 'CALCIATORE_ESPULSO';
                        if (sanctionFilter === 'DIFFIDA') return s.tipo === 'DIFFIDA';
                        if (sanctionFilter === 'DIFFIDA_COPPA') return s.tipo === 'DIFFIDA_COPPA';
                        if (sanctionFilter === 'STAFF') return s.tipo === 'STAFF_INIBIZIONE' || s.tipo === 'STAFF';
                        return true;
                      })
                      .map((s, idx) => (
                        <tr key={idx} className="hover:bg-[#141824]/50 transition-colors">
                          <td className="p-2.5 font-bold whitespace-nowrap">
                            {s.tipo === 'SQUALIFICA' || s.tipo === 'CALCIATORE_ESPULSO' ? (
                              <span className="text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded text-[10px]">
                                Squalifica
                              </span>
                            ) : s.tipo === 'DIFFIDA' ? (
                              <span className="text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded text-[10px]">
                                Diffida (Campionato)
                              </span>
                            ) : s.tipo === 'DIFFIDA_COPPA' ? (
                              <span className="text-amber-300/70 bg-amber-500/5 border border-amber-500/20 px-2 py-0.5 rounded text-[10px]">
                                Diffida (Coppa Italia)
                              </span>
                            ) : (
                              <span className="text-purple-400 bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 rounded text-[10px]">
                                Staff Inibito
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 whitespace-nowrap">
                            {s.competizione === 'CAMPIONATO ECCELLENZA' ? (
                              <span className="text-[#CCFF00] font-bold text-[10px]">Campionato</span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">Coppa Italia</span>
                            )}
                          </td>
                          <td className="p-2.5 font-bold text-white whitespace-nowrap">
                            {s.nome}
                            <span className="block text-[10px] text-slate-500 font-normal">{s.ruolo}</span>
                          </td>
                          <td className="p-2.5 text-slate-300 whitespace-nowrap">{s.squadra}</td>
                          <td className="p-2.5 text-slate-300">
                            <div>{s.sanzione}</div>
                            {s.motivo && <div className="text-[10px] text-slate-500 italic mt-0.5">{s.motivo}</div>}
                          </td>
                          <td className="p-2.5 font-mono text-[10px] text-[#CCFF00] whitespace-nowrap">
                            {s.url_comunicato ? (
                              <a
                                href={s.url_comunicato}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline flex items-center gap-1"
                              >
                                <span>{s.comunicato}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            ) : (
                              s.comunicato
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sync Execution Section */}
      <div className="rounded-2xl bg-[#0D0F16] border border-[#212638] p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-black text-base text-white">Ricarica Database da File Excel Master</h3>
            <p className="text-xs text-slate-400">
              Rielabora il file completo master salvato sul server preservando tutte le note confidenziali e i tag arbitrali
            </p>
          </div>

          <button
            onClick={() => handleRunSync(false)}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#CCFF00] hover:bg-[#D8FF33] disabled:bg-[#141824] disabled:text-slate-600 text-black font-black text-xs shadow-[0_0_20px_rgba(204,255,0,0.35)] transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Sincronizzazione in corso...' : 'Aggiorna Database da Excel'}</span>
          </button>
        </div>

        {/* Upload Custom Files Accordion / Box */}
        <div className="p-5 rounded-2xl bg-[#11141D] border border-[#212638] space-y-4">
          {/* Primary Unified File Upload */}
          <div className="p-4 bg-[#0D0F16] rounded-xl border border-[#CCFF00]/30 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[#CCFF00] font-black block text-xs uppercase tracking-wider">
                File Excel Master Completo (.xlsx)
              </label>
              <span className="text-[10px] font-mono text-slate-400">
                Eccellenza_Emilia_Romagna_Database_Completo.xlsx
              </span>
            </div>
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => setFileDatabaseCompleto(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-black file:bg-[#CCFF00] file:text-black hover:file:bg-[#D8FF33] cursor-pointer"
            />
            {fileDatabaseCompleto && (
              <p className="text-xs text-[#CCFF00] font-mono font-bold">
                ✓ Selezionato: {fileDatabaseCompleto.name} ({(fileDatabaseCompleto.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {/* Secondary Legacy Files */}
          <details className="text-xs text-slate-400">
            <summary className="cursor-pointer font-bold text-slate-300 hover:text-[#CCFF00] transition-colors">
              + Oppure carica file separati per singolo girone (opzionale)
            </summary>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3">
              <div className="p-3 bg-[#0D0F16] rounded-xl border border-[#212638] space-y-1.5">
                <label className="text-slate-400 font-bold block text-[10px] uppercase">Girone A (.xlsx)</label>
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => setFileGironeA(e.target.files?.[0] || null)}
                  className="w-full text-[11px] text-slate-300 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:bg-[#161B28] file:text-[#CCFF00] cursor-pointer"
                />
              </div>

              <div className="p-3 bg-[#0D0F16] rounded-xl border border-[#212638] space-y-1.5">
                <label className="text-slate-400 font-bold block text-[10px] uppercase">Girone B (.xlsx)</label>
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => setFileGironeB(e.target.files?.[0] || null)}
                  className="w-full text-[11px] text-slate-300 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:bg-[#161B28] file:text-[#CCFF00] cursor-pointer"
                />
              </div>

              <div className="p-3 bg-[#0D0F16] rounded-xl border border-[#212638] space-y-1.5">
                <label className="text-slate-400 font-bold block text-[10px] uppercase">Gare & Classifiche (.xlsx)</label>
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => setFileGare(e.target.files?.[0] || null)}
                  className="w-full text-[11px] text-slate-300 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:bg-[#161B28] file:text-[#CCFF00] cursor-pointer"
                />
              </div>
            </div>
          </details>

          {(fileDatabaseCompleto || fileGironeA || fileGironeB || fileGare) && (
            <button
              onClick={() => handleRunSync(true)}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-[#CCFF00] hover:bg-[#D8FF33] text-black text-xs font-black transition-all shadow-[0_0_15px_rgba(204,255,0,0.25)]"
            >
              Carica ed Elabora File Selezionati
            </button>
          )}
        </div>

        {/* Sync Success Feedback */}
        {syncResponse && (
          <div className="p-5 rounded-2xl bg-[#0D0F16] border border-[#CCFF00]/40 text-slate-100 space-y-3.5 shadow-[0_0_20px_rgba(204,255,0,0.15)]">
            <div className="flex items-center gap-2 font-black text-sm text-[#CCFF00]">
              <CheckCircle2 className="w-5 h-5" />
              <span>{syncResponse.message}</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-1 text-xs">
              <div className="bg-[#11141D] border border-[#212638] p-3 rounded-xl">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Squadre</span>
                <span className="font-mono font-black text-xl text-white">
                  {syncResponse.summary.teams}
                </span>
              </div>
              <div className="bg-[#11141D] border border-[#212638] p-3 rounded-xl">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Calciatori</span>
                <span className="font-mono font-black text-xl text-white">
                  {syncResponse.summary.players}
                </span>
              </div>
              <div className="bg-[#11141D] border border-[#212638] p-3 rounded-xl">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Partite</span>
                <span className="font-mono font-black text-xl text-white">
                  {syncResponse.summary.matches}
                </span>
              </div>
              <div className="bg-[#11141D] border border-[#212638] p-3 rounded-xl">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Classifiche</span>
                <span className="font-mono font-black text-sm text-[#CCFF00] mt-1 block">
                  A ({syncResponse.summary.standingsA}) + B ({syncResponse.summary.standingsB})
                </span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-2">
            <div className="flex items-center gap-2 font-bold text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
            <p className="text-[11px] text-rose-300/80">
              Suggerimento: se i file Excel sono aperti in Microsoft Excel, chiudili o caricali direttamente usando il box di upload in alto.
            </p>
          </div>
        )}
      </div>

      {/* Supabase Cloud Section */}
      <div className="rounded-2xl bg-[#0D0F16] border border-[#212638] p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h3 className="font-black text-base text-white flex items-center gap-2">
                <Cloud className="w-5 h-5 text-[#CCFF00]" />
                Supabase Cloud Database & Rete
              </h3>

              {supabaseStatus.loading ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#141824] text-slate-400 border border-[#212638] animate-pulse">
                  Verifica...
                </span>
              ) : supabaseStatus.connected ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/30 shadow-[0_0_10px_rgba(204,255,0,0.2)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#CCFF00] animate-ping" />
                  Cloud Online
                </span>
              ) : supabaseStatus.configured ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  Tabelle da Creare
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#141824] text-slate-400 border border-[#212638]">
                  Configurazione Richiesta
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Garantisce il funzionamento in rete multi-dispositivo, sincronizzazione Realtime e persistenza remota PostgreSQL
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleMigrateToSupabase}
              disabled={supabaseMigrating || !supabaseStatus.configured}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#CCFF00] hover:bg-[#D8FF33] disabled:bg-[#141824] disabled:text-slate-600 text-black font-black text-xs shadow-[0_0_15px_rgba(204,255,0,0.3)] transition-all"
            >
              <Zap className={`w-4 h-4 ${supabaseMigrating ? 'animate-spin' : ''}`} />
              <span>{supabaseMigrating ? 'Migrazione in corso...' : 'Migra Tutti i Dati su Supabase'}</span>
            </button>
            <button
              onClick={checkSupabaseStatus}
              title="Aggiorna stato Supabase"
              className="p-2.5 rounded-xl bg-[#141824] hover:bg-[#1E2435] text-slate-300 border border-[#212638] transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status Details / Counts */}
        {supabaseStatus.connected && supabaseStatus.counts && (
          <div className="p-4 rounded-xl bg-[#11141D] border border-[#212638] space-y-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#CCFF00] block">
              Dati Attualmente Presenti in Rete su Supabase:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
              <div className="bg-[#0D0F16] border border-[#212638] p-2.5 rounded-lg">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Squadre</span>
                <span className="font-mono font-black text-white text-base">{supabaseStatus.counts.teams}</span>
              </div>
              <div className="bg-[#0D0F16] border border-[#212638] p-2.5 rounded-lg">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Calciatori</span>
                <span className="font-mono font-black text-white text-base">{supabaseStatus.counts.players}</span>
              </div>
              <div className="bg-[#0D0F16] border border-[#212638] p-2.5 rounded-lg">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Partite</span>
                <span className="font-mono font-black text-white text-base">{supabaseStatus.counts.matches}</span>
              </div>
              <div className="bg-[#0D0F16] border border-[#212638] p-2.5 rounded-lg">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Note</span>
                <span className="font-mono font-black text-white text-base">{supabaseStatus.counts.notes}</span>
              </div>
              <div className="bg-[#0D0F16] border border-[#212638] p-2.5 rounded-lg">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Video</span>
                <span className="font-mono font-black text-white text-base">{supabaseStatus.counts.videos}</span>
              </div>
            </div>
          </div>
        )}

        {/* Realtime Live Engine Status */}
        <div className="p-4 rounded-xl bg-[#11141D] border border-[#212638] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#CCFF00]" />
              <span className="text-xs font-black text-white uppercase tracking-wider">
                Motore Sincronizzazione Realtime Multi-Dispositivo
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                isRealtimeConnected
                  ? 'bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/30 shadow-[0_0_10px_rgba(204,255,0,0.2)]'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isRealtimeConnected ? 'bg-[#CCFF00] animate-ping' : 'bg-slate-500'}`} />
                {isRealtimeConnected ? 'WEBSOCKET ATTIVO' : 'OFFLINE / STANDBY'}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#161B28] text-slate-300 border border-[#252B3B]">
                <Users className="w-3 h-3 text-[#CCFF00]" />
                {onlineRefereesCount} {onlineRefereesCount === 1 ? 'dispositivo connesso' : 'dispositivi connessi'}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            Ogni nota inserita, cartellino registrato, video collegato o risultato partita aggiornato da un arbitro o osservatore su PC, tablet o smartphone viene trasmesso a tutti i dispositivi attivi in pochi millisecondi via Supabase Realtime Channels e sincronizzato anche tra schede aperte sullo stesso browser.
          </p>

          {lastEvent && (
            <div className="p-2.5 rounded-lg bg-[#0D0F16] border border-[#212638] flex items-center justify-between text-[11px]">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Radio className="w-3 h-3 text-[#CCFF00] animate-pulse" />
                Ultimo evento propagato in rete:
              </span>
              <span className="font-bold text-[#CCFF00] truncate max-w-[60%]">
                {lastEvent.summary}
              </span>
            </div>
          )}
        </div>

        {/* Configuration Guide if not configured */}
        {!supabaseStatus.configured && (
          <div className="p-4 rounded-xl bg-[#11141D] border border-[#212638] space-y-2.5 text-xs">
            <h4 className="font-bold text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-[#CCFF00]" />
              Come Collegare Supabase a REFSTUDIO:
            </h4>
            <ol className="list-decimal list-inside space-y-1 text-slate-300">
              <li>
                Crea un progetto gratuito su <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-[#CCFF00] font-bold hover:underline">supabase.com</a>
              </li>
              <li>
                Nello <strong>SQL Editor</strong> di Supabase, esegui il file <code className="bg-[#0D0F16] px-1.5 py-0.5 rounded text-[#CCFF00] font-mono">supabase/schema.sql</code> già generato nel progetto
              </li>
              <li>
                Copia <code className="text-slate-400 font-mono">URL</code> e <code className="text-slate-400 font-mono">anon public key</code> da <em>Project Settings → API</em> e incollale in <code className="bg-[#0D0F16] px-1.5 py-0.5 rounded text-[#CCFF00] font-mono">.env.local</code>
              </li>
              <li>
                Ricarica la pagina e clicca su <strong>Migra Tutti i Dati su Supabase</strong> (oppure esegui <code className="text-slate-400 font-mono">npm run seed-supabase</code>)
              </li>
            </ol>
          </div>
        )}

        {/* Migration Success Feedback */}
        {supabaseResult && (
          <div className="p-4 rounded-xl bg-[#CCFF00]/10 border border-[#CCFF00]/30 text-white space-y-2">
            <div className="flex items-center gap-2 font-black text-xs text-[#CCFF00]">
              <CheckCircle2 className="w-4 h-4" />
              <span>{supabaseResult.message}</span>
            </div>
            {supabaseResult.summary && (
              <p className="text-[11px] text-slate-300">
                Sincronizzati con successo: {supabaseResult.summary.teams} squadre, {supabaseResult.summary.players} calciatori, {supabaseResult.summary.matches} partite, {supabaseResult.summary.notes} note e {supabaseResult.summary.videos} video clip.
              </p>
            )}
          </div>
        )}

        {/* Migration Error */}
        {supabaseError && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-1">
            <div className="flex items-center gap-2 font-bold text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{supabaseError}</span>
            </div>
          </div>
        )}
      </div>

      {/* Architecture Card */}
      <div className="rounded-2xl bg-[#0D0F16] border border-[#212638] p-6 space-y-4">
        <h3 className="font-black text-base text-white flex items-center gap-2">
          <Database className="w-5 h-5 text-[#CCFF00]" />
          Data Provider Pattern & Integrità Dati
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed">
          RefStudio non dipende direttamente da file fisici cablati nel codice. L&apos;interfaccia{' '}
          <code className="bg-[#11141D] border border-[#212638] px-2 py-0.5 rounded-md text-[#CCFF00] font-mono text-[11px] font-bold">
            IDataProvider
          </code>{' '}
          estrae i dati dai fogli Excel garantendo che le note confidenziali, i video collegati e i tag arbitrali non vengano mai sovrascritti.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div className="p-4 rounded-xl bg-[#11141D] border border-[#212638] text-xs space-y-1">
            <div className="flex items-center gap-2 font-bold text-white mb-2">
              <FileSpreadsheet className="w-4 h-4 text-[#CCFF00]" />
              <span>Girone A Eccellenza</span>
            </div>
            <p className="text-slate-400">18 Squadre • Rose complete</p>
            <p className="text-[10px] text-slate-500 font-mono truncate">Eccellenza_Emilia_Romagna_Girone_A.xlsx</p>
          </div>

          <div className="p-4 rounded-xl bg-[#11141D] border border-[#212638] text-xs space-y-1">
            <div className="flex items-center gap-2 font-bold text-white mb-2">
              <FileSpreadsheet className="w-4 h-4 text-[#CCFF00]" />
              <span>Girone B Eccellenza</span>
            </div>
            <p className="text-slate-400">18 Squadre • Rose complete</p>
            <p className="text-[10px] text-slate-500 font-mono truncate">Eccellenza_Emilia_Romagna_Girone_B.xlsx</p>
          </div>

          <div className="p-4 rounded-xl bg-[#11141D] border border-[#212638] text-xs space-y-1">
            <div className="flex items-center gap-2 font-bold text-white mb-2">
              <FileSpreadsheet className="w-4 h-4 text-[#CCFF00]" />
              <span>Gare & Classifiche</span>
            </div>
            <p className="text-slate-400">603 Partite • 34 Giornate A/B</p>
            <p className="text-[10px] text-slate-500 font-mono truncate">Eccellenza_Emilia_Romagna_Gare_Classifica.xlsx</p>
          </div>
        </div>
      </div>
    </div>
  );
}
