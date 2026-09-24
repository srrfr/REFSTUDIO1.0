'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  ClipboardCheck,
  Trophy,
  Edit3,
  X,
  ChevronLeft,
  ChevronRight,
  Shield,
  ArrowRight,
  Award,
  Layers,
  Clock,
} from 'lucide-react';
import Link from 'next/link';
import { DbService } from '@/lib/repository/db-service';
import { Match, StandingRow } from '@/types/refstudio';
import { PreparaGaraModal } from '@/components/modals/PreparaGaraModal';
import { useRealtimeSync } from '@/lib/supabase/realtime-context';

type ViewStep = 'CATEGORY' | 'GIRONE' | 'MATCHES';

// Estrae esclusivamente l'orario della gara (es. "17:30", "15:00", "18:00")
// eliminando qualsiasi prefisso come "Giornata 1 17:30" o simili
function extractMatchTime(dateText?: string): string {
  if (!dateText) return '15:30';
  const m = dateText.match(/(\d{1,2}:\d{2})/);
  return m ? m[1] : dateText;
}

// Calcola la prima giornata senza risultati registrati (la prossima da disputare)
function getFirstUpcomingDay(girone: 'A' | 'B', allMatches: Match[]): number {
  const gironeMatches = allMatches.filter((m) => m.girone === girone);
  if (gironeMatches.length === 0) return 1;

  for (let day = 1; day <= 34; day++) {
    const dayMatches = gironeMatches.filter((m) => m.matchDay === day);
    if (dayMatches.length === 0) continue;

    // Controlla se questa giornata ha partite già giocate o con punteggio inserito
    const hasResults = dayMatches.some(
      (m) => m.played || (m.homeScore !== undefined && m.homeScore !== null)
    );

    // Se non ha alcun risultato, è la prima giornata da disputare
    if (!hasResults) {
      return day;
    }
  }

  return 34;
}

export default function MatchesPage() {
  // Step di Navigazione:
  // 1: 'CATEGORY' -> Selezione Categoria (al momento Eccellenza)
  // 2: 'GIRONE'   -> Selezione Girone (A o B)
  // 3: 'MATCHES'  -> Visualizzazione Gare & Classifiche
  const [viewStep, setViewStep] = useState<ViewStep>('CATEGORY');

  // Parametri di selezione
  const [selectedCategory, setSelectedCategory] = useState<'eccellenza'>('eccellenza');
  const [activeGirone, setActiveGirone] = useState<'A' | 'B'>('A');

  // Tab di visualizzazione (Gare vs Classifica) all'interno dello step MATCHES
  const [activeTab, setActiveTab] = useState<'CALENDARIO' | 'CLASSIFICA'>('CALENDARIO');

  // Giornata selezionata nel carosello
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [dayMatches, setDayMatches] = useState<Match[]>([]);
  const [standings, setStandings] = useState<StandingRow[]>([]);

  // Editing match modal
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [editMatchForm, setEditMatchForm] = useState<Partial<Match>>({});

  // Prepara la Gara State
  const [isPreparaGaraOpen, setIsPreparaGaraOpen] = useState(false);
  const [preparaGaraMatch, setPreparaGaraMatch] = useState<Match | null>(null);

  // Calcola quale sia la prima giornata senza risultati per il girone attivo
  const upcomingDayForGirone = useMemo(() => {
    return getFirstUpcomingDay(activeGirone, allMatches);
  }, [activeGirone, allMatches]);

  // Caricamento e sincronizzazione dati
  const refreshMatchesAndStandings = useCallback(() => {
    const all = DbService.getMatches();
    setAllMatches(all);
    const m = DbService.getMatches(activeGirone, selectedDay);
    setDayMatches(m);
    const s = DbService.getStandings(activeGirone);
    setStandings(s);
  }, [activeGirone, selectedDay]);

  // Sottoscrizione Realtime multi-dispositivo
  useRealtimeSync(refreshMatchesAndStandings);

  // Inizializzazione dati all'avvio
  useEffect(() => {
    const all = DbService.getMatches();
    setAllMatches(all);
    const initialDay = getFirstUpcomingDay('A', all);
    setSelectedDay(initialDay);
    const m = DbService.getMatches('A', initialDay);
    setDayMatches(m);
    const s = DbService.getStandings('A');
    setStandings(s);
  }, []);

  // Aggiorna le partite mostrate e la classifica quando l'utente cambia girone o giornata
  // NOTA: Non reimposta selectedDay per permettere la libera navigazione tra tutte le giornate
  useEffect(() => {
    const m = DbService.getMatches(activeGirone, selectedDay);
    setDayMatches(m);
    const s = DbService.getStandings(activeGirone);
    setStandings(s);
  }, [activeGirone, selectedDay]);

  // Handlers di navigazione Step
  const handleSelectCategory = (cat: 'eccellenza') => {
    setSelectedCategory(cat);
    setViewStep('GIRONE');
  };

  const handleSelectGirone = (girone: 'A' | 'B') => {
    setActiveGirone(girone);
    const matches = allMatches.length > 0 ? allMatches : DbService.getMatches();
    const nextDay = getFirstUpcomingDay(girone, matches);
    setSelectedDay(nextDay);
    setViewStep('MATCHES');
  };

  const handleQuickSwitchGirone = (girone: 'A' | 'B') => {
    if (girone === activeGirone) return;
    setActiveGirone(girone);
    const nextDay = getFirstUpcomingDay(girone, allMatches);
    setSelectedDay(nextDay);
  };

  const handleOpenPreparaGara = (match: Match) => {
    setPreparaGaraMatch(match);
    setIsPreparaGaraOpen(true);
  };

  const handleSaveMatchEdit = () => {
    if (!editingMatch) return;
    try {
      DbService.updateMatch(editingMatch.id, editMatchForm);
      setEditingMatch(null);
      refreshMatchesAndStandings();
    } catch (err) {
      console.error(err);
    }
  };

  const daysList = Array.from({ length: 34 }, (_, i) => i + 1);

  // =========================================================================
  // STEP 1: SCHEDA SELEZIONE CATEGORIA
  // =========================================================================
  if (viewStep === 'CATEGORY') {
    return (
      <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-200">
        {/* Intestazione Fase 1 */}
        <div className="bg-[#0D0F16] border border-[#1F2433] rounded-3xl p-6 sm:p-8 shadow-xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#CCFF00] bg-[#CCFF00]/10 px-2.5 py-0.5 rounded-full border border-[#CCFF00]/30 font-bold">
              Passo 1 di 3 • Selezione Competizione
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-wide flex items-center gap-3">
            <Award className="w-8 h-8 text-[#CCFF00]" />
            Seleziona la Categoria
          </h1>
          <p className="text-sm text-slate-400 mt-2 max-w-2xl">
            Scegli il campionato di riferimento per accedere alla scelta del girone, consultare il calendario gare con la prossima giornata in evidenza e la classifica ufficiale.
          </p>
        </div>

        {/* Griglia Categorie */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Categoria 1: Eccellenza (ATTIVA) */}
          <div
            onClick={() => handleSelectCategory('eccellenza')}
            className="group relative rounded-3xl bg-gradient-to-b from-[#121622] to-[#0D0F16] border-2 border-[#CCFF00]/40 hover:border-[#CCFF00] p-6 shadow-[0_0_25px_rgba(204,255,0,0.08)] hover:shadow-[0_0_35px_rgba(204,255,0,0.2)] transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-[#CCFF00]/15 border border-[#CCFF00]/40 flex items-center justify-center text-[#CCFF00] group-hover:scale-110 transition-transform">
                  <Award className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-mono font-black uppercase text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  Attiva Ora
                </span>
              </div>

              <div>
                <h3 className="text-lg font-black text-white group-hover:text-[#CCFF00] transition-colors">
                  Eccellenza
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  CRER • Emilia-Romagna (FIGC - LND)
                </p>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Massima divisione regionale. Gironi A e B da 18 squadre ciascuno, calendari a 34 giornate e statistiche club.
              </p>

              {/* Statistiche rapide */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1C2232] text-[11px]">
                <div className="bg-[#141824] p-2 rounded-xl border border-[#212638]">
                  <span className="text-slate-400 block text-[10px]">Gironi:</span>
                  <span className="font-mono font-bold text-white">Girone A & B</span>
                </div>
                <div className="bg-[#141824] p-2 rounded-xl border border-[#212638]">
                  <span className="text-slate-400 block text-[10px]">Società:</span>
                  <span className="font-mono font-bold text-[#CCFF00]">36 Squadre</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#1C2232] flex items-center justify-between">
              <span className="text-xs font-black text-[#CCFF00] group-hover:underline">
                Seleziona Categoria
              </span>
              <div className="w-8 h-8 rounded-full bg-[#CCFF00] text-black flex items-center justify-center group-hover:translate-x-1 transition-transform">
                <ArrowRight className="w-4 h-4 font-bold" />
              </div>
            </div>
          </div>

          {/* Categoria 2: Promozione (PROSSIMAMENTE) */}
          <div className="rounded-3xl bg-[#0D0F16]/60 border border-[#1A1F2C] p-6 opacity-60 flex flex-col justify-between cursor-not-allowed">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-[#141824] border border-[#212638] flex items-center justify-center text-slate-500">
                  <Shield className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-mono uppercase text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-full border border-slate-700">
                  In Arrivo
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-300">Promozione</h3>
                <p className="text-xs text-slate-500">Campionato Regionale</p>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Gestione dei gironi regionali di Promozione. La sincronizzazione dei calendari sarà abilitata nei prossimi aggiornamenti.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-[#1A1F2C] text-xs text-slate-500 font-mono">
              Disponibile a breve
            </div>
          </div>

          {/* Categoria 3: Prima Categoria (PROSSIMAMENTE) */}
          <div className="rounded-3xl bg-[#0D0F16]/60 border border-[#1A1F2C] p-6 opacity-60 flex flex-col justify-between cursor-not-allowed">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-[#141824] border border-[#212638] flex items-center justify-center text-slate-500">
                  <Layers className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-mono uppercase text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-full border border-slate-700">
                  In Arrivo
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-300">Prima Categoria</h3>
                <p className="text-xs text-slate-500">Campionati Provinciali / Regionali</p>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Campionati di Prima Categoria con schede informative e designazioni.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-[#1A1F2C] text-xs text-slate-500 font-mono">
              Disponibile a breve
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // STEP 2: SCHEDA SELEZIONE GIRONE (Snella, immediata: click su A o su B)
  // =========================================================================
  if (viewStep === 'GIRONE') {
    return (
      <div className="space-y-6 max-w-3xl mx-auto animate-in fade-in duration-200">
        {/* Barra di Navigazione a Ritroso */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setViewStep('CATEGORY')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0D0F16] hover:bg-[#141824] text-slate-300 hover:text-[#CCFF00] border border-[#1F2433] text-xs font-bold transition-all group shadow-sm"
          >
            <ChevronLeft className="w-4 h-4 text-[#CCFF00] group-hover:-translate-x-0.5 transition-transform" />
            <span>← Torna a Categorie</span>
          </button>

          <span className="text-[10px] font-mono uppercase tracking-wider text-[#CCFF00] bg-[#CCFF00]/10 px-3 py-1 rounded-full border border-[#CCFF00]/30 font-bold">
            Passo 2 di 3 • Selezione Girone
          </span>
        </div>

        {/* Intestazione Rapida */}
        <div className="bg-[#0D0F16] border border-[#1F2433] rounded-3xl p-6 text-center shadow-xl space-y-1">
          <h1 className="text-2xl font-black text-white tracking-wide">
            Seleziona il Girone
          </h1>
          <p className="text-xs text-slate-400">
            Eccellenza Emilia-Romagna • Clicca sul girone desiderato
          </p>
        </div>

        {/* Selezione Rapida A o B (senza informazioni superflue) */}
        <div className="grid grid-cols-2 gap-4 sm:gap-6">
          {/* Pulsante Girone A */}
          <button
            onClick={() => handleSelectGirone('A')}
            className="group relative rounded-3xl bg-gradient-to-b from-[#121622] to-[#0D0F16] border-2 border-[#212638] hover:border-[#CCFF00] p-6 sm:p-10 shadow-xl hover:shadow-[0_0_35px_rgba(204,255,0,0.22)] transition-all flex flex-col items-center justify-center space-y-4 active:scale-95 text-center cursor-pointer"
          >
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-[#CCFF00]/15 border border-[#CCFF00]/40 flex items-center justify-center text-3xl sm:text-4xl font-black text-[#CCFF00] group-hover:scale-110 transition-transform shadow-inner">
              A
            </div>
            <div>
              <span className="text-xl sm:text-2xl font-black text-white group-hover:text-[#CCFF00] transition-colors block">
                Girone A
              </span>
              <span className="text-xs font-mono text-slate-400 font-semibold mt-0.5 block">
                18 Squadre
              </span>
            </div>
            <div className="w-full pt-3 border-t border-[#1C2232] flex items-center justify-center gap-1 text-xs font-bold text-[#CCFF00] group-hover:underline">
              <span>Seleziona</span>
              <ArrowRight className="w-3.5 h-3.5 font-bold group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Pulsante Girone B */}
          <button
            onClick={() => handleSelectGirone('B')}
            className="group relative rounded-3xl bg-gradient-to-b from-[#121622] to-[#0D0F16] border-2 border-[#212638] hover:border-[#CCFF00] p-6 sm:p-10 shadow-xl hover:shadow-[0_0_35px_rgba(204,255,0,0.22)] transition-all flex flex-col items-center justify-center space-y-4 active:scale-95 text-center cursor-pointer"
          >
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-[#CCFF00]/15 border border-[#CCFF00]/40 flex items-center justify-center text-3xl sm:text-4xl font-black text-[#CCFF00] group-hover:scale-110 transition-transform shadow-inner">
              B
            </div>
            <div>
              <span className="text-xl sm:text-2xl font-black text-white group-hover:text-[#CCFF00] transition-colors block">
                Girone B
              </span>
              <span className="text-xs font-mono text-slate-400 font-semibold mt-0.5 block">
                18 Squadre
              </span>
            </div>
            <div className="w-full pt-3 border-t border-[#1C2232] flex items-center justify-center gap-1 text-xs font-bold text-[#CCFF00] group-hover:underline">
              <span>Seleziona</span>
              <ArrowRight className="w-3.5 h-3.5 font-bold group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // STEP 3: SCHEDA GARE & CLASSIFICA (Schermata snella, orario gara pulito)
  // =========================================================================
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* BARRA SUPERIORE: NAVIGAZIONE A RITROSO, BREADCRUMB & SWITCH TAB */}
      <div className="bg-[#0D0F16] border border-[#1F2433] rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        {/* Riga Navigazione Indietro & Switch Rapido */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1A1F2C] pb-4">
          <div className="flex items-center gap-2">
            {/* Piccolo pulsante per muoversi a ritroso alla selezione del girone */}
            <button
              onClick={() => setViewStep('GIRONE')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141824] hover:bg-[#1E2435] text-slate-200 hover:text-[#CCFF00] border border-[#212638] text-xs font-bold transition-all shadow-sm group"
              title="Torna alla selezione del Girone"
            >
              <ChevronLeft className="w-4 h-4 text-[#CCFF00] group-hover:-translate-x-0.5 transition-transform" />
              <span>Cambia Girone</span>
            </button>

            {/* Pulsante rapido per tornare a Categoria */}
            <button
              onClick={() => setViewStep('CATEGORY')}
              className="px-2.5 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-[#141824] transition-colors"
              title="Torna alla selezione Categoria"
            >
              ← Categoria
            </button>

            {/* Breadcrumb info */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 ml-2">
              <span className="text-slate-600">•</span>
              <span className="font-semibold text-slate-300">Eccellenza</span>
              <span className="text-slate-600">/</span>
              <span className="font-black text-[#CCFF00]">Girone {activeGirone}</span>
              <span className="text-slate-500 font-mono text-[11px]">(18 Squadre)</span>
            </div>
          </div>

          {/* Switch rapido tra Girone A e B senza dover tornare indietro */}
          <div className="flex items-center gap-1 bg-[#11141D] border border-[#212638] p-1 rounded-xl">
            <button
              onClick={() => handleQuickSwitchGirone('A')}
              className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                activeGirone === 'A'
                  ? 'bg-[#CCFF00] text-black shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Girone A
            </button>
            <button
              onClick={() => handleQuickSwitchGirone('B')}
              className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                activeGirone === 'B'
                  ? 'bg-[#CCFF00] text-black shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Girone B
            </button>
          </div>
        </div>

        {/* Riga Titolo & Tab Switcher (Calendario Gare vs Classifica) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
          <div>
            <div className="flex items-center gap-2.5">
              <Calendar className="w-6 h-6 text-[#CCFF00]" />
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                Eccellenza • Girone {activeGirone}
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Visualizza le partite, prepara la gara per ogni incontro o consulta la classifica ufficiale.
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex rounded-2xl bg-[#11141D] border border-[#212638] p-1 shrink-0 self-start md:self-auto">
            <button
              onClick={() => setActiveTab('CALENDARIO')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                activeTab === 'CALENDARIO'
                  ? 'bg-[#CCFF00] text-black shadow-[0_0_15px_rgba(204,255,0,0.35)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Calendario Gare</span>
            </button>
            <button
              onClick={() => setActiveTab('CLASSIFICA')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                activeTab === 'CLASSIFICA'
                  ? 'bg-[#CCFF00] text-black shadow-[0_0_15px_rgba(204,255,0,0.35)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Trophy className="w-4 h-4" />
              <span>Classifica</span>
            </button>
          </div>
        </div>
      </div>

      {/* CONTENUTO IN BASE AL TAB: GARE vs CLASSIFICA */}
      {activeTab === 'CALENDARIO' ? (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Barra Selezione Giornata con Evidenza della Prossima Giornata */}
          <div className="bg-[#0D0F16] border border-[#1F2433] rounded-2xl p-4 space-y-3 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-white uppercase tracking-wider">
                  Seleziona Giornata:
                </span>
                <span className="text-xs font-mono font-black text-[#CCFF00] bg-[#CCFF00]/10 px-2 py-0.5 rounded border border-[#CCFF00]/30">
                  Giornata {selectedDay} di 34
                </span>
                {selectedDay === upcomingDayForGirone && (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Prossima in Programma
                  </span>
                )}
              </div>

              {/* Bottoni Navigazione Veloce Precedente / Successiva e Salto Rapido */}
              <div className="flex items-center gap-2">
                {selectedDay !== upcomingDayForGirone && (
                  <button
                    onClick={() => setSelectedDay(upcomingDayForGirone)}
                    className="text-[11px] font-bold text-[#CCFF00] hover:underline flex items-center gap-1 bg-[#141824] border border-[#212638] px-2.5 py-1 rounded-lg transition-colors"
                  >
                    Salta alla Prossima (G{upcomingDayForGirone}) →
                  </button>
                )}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSelectedDay((prev) => Math.max(1, prev - 1))}
                    disabled={selectedDay <= 1}
                    className="p-1.5 rounded-lg bg-[#141824] hover:bg-[#1E2435] text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed border border-[#212638]"
                    title="Giornata Precedente"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSelectedDay((prev) => Math.min(34, prev + 1))}
                    disabled={selectedDay >= 34}
                    className="p-1.5 rounded-lg bg-[#141824] hover:bg-[#1E2435] text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed border border-[#212638]"
                    title="Giornata Successiva"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Carousel Orizzontale Giornate (1 - 34) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {daysList.map((day) => {
                const isSelected = selectedDay === day;
                const isUpcoming = day === upcomingDayForGirone;
                const isPlayed = day < upcomingDayForGirone;

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={`relative px-3.5 py-2 rounded-xl text-xs font-black shrink-0 transition-all flex flex-col items-center min-w-[70px] ${
                      isSelected
                        ? 'bg-[#CCFF00] text-black shadow-[0_0_15px_rgba(204,255,0,0.35)] scale-105'
                        : isUpcoming
                        ? 'bg-[#141824] border border-emerald-500/50 text-emerald-400 hover:border-emerald-400'
                        : 'bg-[#11141D] border border-[#212638] text-slate-400 hover:text-white hover:border-[#CCFF00]/40'
                    }`}
                  >
                    <span>G{day}</span>
                    <span
                      className={`text-[8px] font-mono tracking-tighter uppercase ${
                        isSelected
                          ? 'text-black/80 font-bold'
                          : isUpcoming
                          ? 'text-emerald-400 font-bold'
                          : 'text-slate-500'
                      }`}
                    >
                      {isUpcoming ? 'Prossima' : isPlayed ? 'Disputata' : 'In attesa'}
                    </span>

                    {/* Badge Prossima */}
                    {isUpcoming && !isSelected && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10B981]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Griglia Partite della Giornata Selezionata (SCHERMATA SNELLA) */}
          {dayMatches.length === 0 ? (
            <div className="p-12 text-center bg-[#0D0F16] border border-dashed border-[#212638] rounded-2xl text-slate-500 text-xs">
              Nessun incontro programmato per questa giornata nel calendario ufficiale.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {dayMatches.map((match) => (
                <div
                  key={match.id}
                  className="rounded-2xl bg-[#0D0F16] border border-[#1F2433] p-4 hover:border-[#CCFF00]/40 transition-all flex flex-col justify-between space-y-3 group shadow-md"
                >
                  <div>
                    {/* Header Card Snella: Solo Orario della gara e icona Modifica */}
                    <div className="flex items-center justify-between text-xs border-b border-[#1A1F2C] pb-2">
                      <span className="font-mono font-bold text-[#CCFF00] text-xs bg-[#CCFF00]/10 px-2.5 py-1 rounded-lg border border-[#CCFF00]/25 flex items-center gap-1.5 shadow-sm">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{extractMatchTime(match.dateText)}</span>
                      </span>

                      <button
                        onClick={() => {
                          setEditingMatch(match);
                          setEditMatchForm(match);
                        }}
                        className="text-slate-400 hover:text-[#CCFF00] p-1.5 rounded-lg hover:bg-[#141824] transition-colors"
                        title="Modifica Risultato"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Squadre & Risultato Immediato */}
                    <div className="py-3 flex items-center justify-between gap-3">
                      <div className="flex-1 text-left">
                        <p className="font-bold text-sm md:text-base text-white group-hover:text-[#CCFF00] transition-colors line-clamp-1">
                          {match.homeTeamName}
                        </p>
                      </div>

                      <div className="px-3.5 py-1 bg-[#11141D] rounded-xl border border-[#212638] font-mono font-black text-sm text-[#CCFF00] shrink-0 shadow-inner">
                        {match.played && match.homeScore !== undefined
                          ? `${match.homeScore} - ${match.awayScore}`
                          : 'VS'}
                      </div>

                      <div className="flex-1 text-right">
                        <p className="font-bold text-sm md:text-base text-white group-hover:text-[#CCFF00] transition-colors line-clamp-1">
                          {match.awayTeamName}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Footer Card Snello: Stato & Pulsante Prepara la Gara */}
                  <div className="pt-2.5 border-t border-[#1A1F2C] flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-mono">
                      {match.played ? 'Partita disputata' : 'In programma'}
                    </span>
                    <button
                      onClick={() => handleOpenPreparaGara(match)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#CCFF00] hover:bg-[#d8ff33] text-black text-xs font-black transition-all shadow-[0_0_12px_rgba(204,255,0,0.25)] active:scale-95"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5 text-black" />
                      Prepara la Gara
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* TAB CLASSIFICA UFFICIALE */
        <div className="rounded-3xl bg-[#0D0F16] border border-[#1F2433] overflow-hidden shadow-xl animate-in fade-in duration-200">
          <div className="p-5 border-b border-[#1F2433] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Trophy className="w-5 h-5 text-[#CCFF00]" />
              <div>
                <h3 className="font-black text-white text-base tracking-wide">
                  Classifica Ufficiale • Eccellenza Girone {activeGirone}
                </h3>
                <p className="text-xs text-slate-400">
                  18 Squadre • Aggiornata in tempo reale alle gare disputate fino alla giornata {Math.max(1, upcomingDayForGirone - 1)}
                </p>
              </div>
            </div>

            <Link
              href="/squadre"
              className="text-xs font-bold text-[#CCFF00] hover:underline flex items-center gap-1 self-start sm:self-auto"
            >
              Consulta Rose Squadre <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#11141D] uppercase text-[10px] font-bold text-slate-400 tracking-wider border-b border-[#1F2433]">
                <tr>
                  <th className="py-3 px-4 w-14 text-center">Pos</th>
                  <th className="py-3 px-4">Squadra</th>
                  <th className="py-3 px-3 text-center font-black text-white text-xs">Punti</th>
                  <th className="py-3 px-3 text-center">G</th>
                  <th className="py-3 px-3 text-center">V</th>
                  <th className="py-3 px-3 text-center">N</th>
                  <th className="py-3 px-3 text-center">P</th>
                  <th className="py-3 px-3 text-center">GF</th>
                  <th className="py-3 px-3 text-center">GS</th>
                  <th className="py-3 px-3 text-center">DR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A1F2C]">
                {standings.map((row) => (
                  <tr key={row.teamName} className="hover:bg-[#12151E] transition-colors group">
                    <td className="py-3 px-4 text-center font-mono font-bold">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${
                          row.position === 1
                            ? 'bg-[#CCFF00] text-black shadow-[0_0_10px_rgba(204,255,0,0.5)]'
                            : row.position <= 5
                            ? 'bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/30'
                            : row.position >= 14
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            : 'text-slate-400'
                        }`}
                      >
                        {row.position}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-white group-hover:text-[#CCFF00] transition-colors">
                      <Link href={`/squadre?q=${encodeURIComponent(row.teamName)}`} className="hover:underline">
                        {row.teamName}
                      </Link>
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-black text-sm text-[#CCFF00]">
                      {row.points}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-slate-300 font-semibold">{row.played}</td>
                    <td className="py-3 px-3 text-center font-mono text-emerald-400 font-bold">{row.won}</td>
                    <td className="py-3 px-3 text-center font-mono text-amber-400 font-bold">{row.drawn}</td>
                    <td className="py-3 px-3 text-center font-mono text-rose-400 font-bold">{row.lost}</td>
                    <td className="py-3 px-3 text-center font-mono text-slate-400">{row.goalsFor}</td>
                    <td className="py-3 px-3 text-center font-mono text-slate-400">{row.goalsAgainst}</td>
                    <td
                      className={`py-3 px-3 text-center font-mono font-bold ${
                        row.goalDifference > 0
                          ? 'text-[#CCFF00]'
                          : row.goalDifference < 0
                          ? 'text-rose-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legenda Posizioni Classifica */}
          <div className="p-4 bg-[#11141D] border-t border-[#1F2433] flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#CCFF00]" />
              <span>1° Promozione Diretta in Serie D</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#CCFF00]/30 border border-[#CCFF00]" />
              <span>2°-5° Play-Off Regionali</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500/30 border border-rose-500" />
              <span>Zona Playout / Retrocessione</span>
            </div>
          </div>
        </div>
      )}

      {/* Modale Modifica Partita / Referto */}
      {editingMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl bg-[#0D0F16] border border-[#212638] shadow-2xl p-6 text-slate-100 space-y-4">
            <button
              onClick={() => setEditingMatch(null)}
              className="absolute right-4 top-4 p-1 rounded-lg text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-[#CCFF00]" />
              Modifica Dati Partita & Referto
            </h3>
            <p className="text-xs text-slate-400">
              {editingMatch.homeTeamName} vs {editingMatch.awayTeamName} • Giornata {editingMatch.matchDay}
            </p>

            <div className="space-y-3.5 text-xs pt-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 font-bold">Gol Casa</label>
                  <input
                    type="number"
                    value={editMatchForm.homeScore ?? ''}
                    onChange={(e) =>
                      setEditMatchForm({
                        ...editMatchForm,
                        homeScore: parseInt(e.target.value, 10),
                        played: true,
                      })
                    }
                    className="w-full bg-[#181C28] border border-[#2B3245] rounded-xl p-2.5 text-slate-200 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-bold">Gol Ospite</label>
                  <input
                    type="number"
                    value={editMatchForm.awayScore ?? ''}
                    onChange={(e) =>
                      setEditMatchForm({
                        ...editMatchForm,
                        awayScore: parseInt(e.target.value, 10),
                        played: true,
                      })
                    }
                    className="w-full bg-[#181C28] border border-[#2B3245] rounded-xl p-2.5 text-slate-200 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-bold">Orario Partita</label>
                <input
                  type="text"
                  value={editMatchForm.dateText || ''}
                  onChange={(e) =>
                    setEditMatchForm({ ...editMatchForm, dateText: e.target.value })
                  }
                  placeholder="Es. 15:30"
                  className="w-full bg-[#181C28] border border-[#2B3245] rounded-xl p-2.5 text-slate-200"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-bold">Arbitro Designato</label>
                <input
                  type="text"
                  value={editMatchForm.refereeName || ''}
                  onChange={(e) =>
                    setEditMatchForm({ ...editMatchForm, refereeName: e.target.value })
                  }
                  placeholder="Es. Mario Rossi (Sez. Bologna)"
                  className="w-full bg-[#181C28] border border-[#2B3245] rounded-xl p-2.5 text-slate-200"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-bold">Campo / Stadio</label>
                <input
                  type="text"
                  value={editMatchForm.matchField || ''}
                  onChange={(e) =>
                    setEditMatchForm({ ...editMatchForm, matchField: e.target.value })
                  }
                  placeholder="Nome campo di gioco"
                  className="w-full bg-[#181C28] border border-[#2B3245] rounded-xl p-2.5 text-slate-200"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-bold">Osservazioni Arbitro</label>
                <textarea
                  rows={3}
                  value={editMatchForm.observations || ''}
                  onChange={(e) =>
                    setEditMatchForm({ ...editMatchForm, observations: e.target.value })
                  }
                  placeholder="Clima partita, espulsioni, episodi chiave..."
                  className="w-full bg-[#181C28] border border-[#2B3245] rounded-xl p-2.5 text-slate-200"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#1C2130]">
              <button
                type="button"
                onClick={() => setEditingMatch(null)}
                className="px-4 py-2 bg-[#181C28] hover:bg-[#202534] text-xs font-semibold rounded-xl text-slate-300 border border-[#2B3245]"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleSaveMatchEdit}
                className="px-4 py-2 bg-[#CCFF00] hover:bg-[#d8ff33] text-black font-black text-xs rounded-xl shadow-[0_0_12px_rgba(204,255,0,0.3)] transition-all"
              >
                Salva Referto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scheda Prepara la Gara Modal */}
      <PreparaGaraModal
        isOpen={isPreparaGaraOpen}
        onClose={() => {
          setIsPreparaGaraOpen(false);
          setPreparaGaraMatch(null);
        }}
        match={preparaGaraMatch}
      />
    </div>
  );
}
