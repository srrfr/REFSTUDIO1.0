'use client';

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { useRealtime } from '@/lib/supabase/realtime-context';

export default function AdminSyncPage() {
  const { isAdmin } = useAuth();
  const { isConnected: isRealtimeConnected, onlineRefereesCount, lastEvent } = useRealtime();
  const [loading, setLoading] = useState(false);
  const [syncResponse, setSyncResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // File upload state
  const [fileGironeA, setFileGironeA] = useState<File | null>(null);
  const [fileGironeB, setFileGironeB] = useState<File | null>(null);
  const [fileGare, setFileGare] = useState<File | null>(null);

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
  }, []);

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
      let res: Response;
      if (useFiles && (fileGironeA || fileGironeB || fileGare)) {
        const formData = new FormData();
        if (fileGironeA) formData.append('fileGironeA', fileGironeA);
        if (fileGironeB) formData.append('fileGironeB', fileGironeB);
        if (fileGare) formData.append('fileGareClassifica', fileGare);
        res = await fetch('/api/sync', { method: 'POST', body: formData });
      } else {
        res = await fetch('/api/sync', { method: 'POST' });
      }

      const data = await res.json();
      if (data.success) {
        setSyncResponse(data);
      } else {
        setError(data.message || 'Errore durante la sincronizzazione');
      }
    } catch (err: any) {
      setError(err.message || 'Errore di connessione al server');
    } finally {
      setLoading(false);
    }
  };

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

      {/* Sync Execution Section */}
      <div className="rounded-2xl bg-[#0D0F16] border border-[#212638] p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-black text-base text-white">Sincronizzazione Immediata</h3>
            <p className="text-xs text-slate-400">
              Rielabora istantaneamente i tre file Excel ufficiali presenti nella cartella di sistema
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
          <div className="flex items-center gap-2 font-bold text-xs text-white">
            <Upload className="w-4 h-4 text-[#CCFF00]" />
            <span>Oppure carica manualmente file Excel aggiornati (.xlsx):</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 bg-[#0D0F16] rounded-xl border border-[#212638] space-y-2">
              <label className="text-slate-400 font-bold block text-[11px] uppercase tracking-wider">Girone A (.xlsx)</label>
              <input
                type="file"
                accept=".xlsx"
                onChange={(e) => setFileGironeA(e.target.files?.[0] || null)}
                className="w-full text-[11px] text-slate-300 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#161B28] file:text-[#CCFF00] cursor-pointer"
              />
              {fileGironeA && <p className="text-[10px] text-[#CCFF00] font-mono font-semibold truncate">{fileGironeA.name}</p>}
            </div>

            <div className="p-3.5 bg-[#0D0F16] rounded-xl border border-[#212638] space-y-2">
              <label className="text-slate-400 font-bold block text-[11px] uppercase tracking-wider">Girone B (.xlsx)</label>
              <input
                type="file"
                accept=".xlsx"
                onChange={(e) => setFileGironeB(e.target.files?.[0] || null)}
                className="w-full text-[11px] text-slate-300 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#161B28] file:text-[#CCFF00] cursor-pointer"
              />
              {fileGironeB && <p className="text-[10px] text-[#CCFF00] font-mono font-semibold truncate">{fileGironeB.name}</p>}
            </div>

            <div className="p-3.5 bg-[#0D0F16] rounded-xl border border-[#212638] space-y-2">
              <label className="text-slate-400 font-bold block text-[11px] uppercase tracking-wider">Gare & Classifiche (.xlsx)</label>
              <input
                type="file"
                accept=".xlsx"
                onChange={(e) => setFileGare(e.target.files?.[0] || null)}
                className="w-full text-[11px] text-slate-300 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#161B28] file:text-[#CCFF00] cursor-pointer"
              />
              {fileGare && <p className="text-[10px] text-[#CCFF00] font-mono font-semibold truncate">{fileGare.name}</p>}
            </div>
          </div>

          {(fileGironeA || fileGironeB || fileGare) && (
            <button
              onClick={() => handleRunSync(true)}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl bg-[#161B28] hover:bg-[#1F2538] text-[#CCFF00] border border-[#CCFF00]/40 text-xs font-black transition-all shadow-[0_0_12px_rgba(204,255,0,0.15)]"
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
            <p className="text-slate-400">17 Squadre • Rose complete</p>
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

      {/* Admin Notice */}
      {!isAdmin && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3 text-amber-300 text-xs">
          <Shield className="w-5 h-5 shrink-0 text-amber-400" />
          <span>
            <strong>Nota di Sicurezza:</strong> Per modificare le anagrafiche o forzare il sync, attiva i privilegi Amministratore digitando il PIN <code className="bg-black/60 px-1.5 py-0.5 rounded font-mono text-[#CCFF00] border border-amber-500/30">280899</code> dal pulsante in alto.
          </span>
        </div>
      )}
    </div>
  );
}
