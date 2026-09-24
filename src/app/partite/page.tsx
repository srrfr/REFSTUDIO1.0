'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  ClipboardCheck,
  Trophy,
  Edit3,
  Check,
  X,
  MapPin,
  User,
  FileText,
  ChevronLeft,
  ChevronRight,
  Layers,
  Sparkles,
  Shield,
  ArrowRight,
  Clock,
  Activity,
  Award,
} from 'lucide-react';
import Link from 'next/link';
import { DbService } from '@/lib/repository/db-service';
import { Match, StandingRow } from '@/types/refstudio';
import { PreparaGaraModal } from '@/components/modals/PreparaGaraModal';
import { useRealtimeSync } from '@/lib/supabase/realtime-context';

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

  // Se tutte le 34 giornate hanno risultati (fine campionato), ritorna l'ultima
  return 34;
}

export default function MatchesPage() {
  // Step 1: Selezione Categoria (al momento Eccellenza)
  const [selectedCategory, setSelectedCategory] = useState<'eccellenza'>('eccellenza');

  // Step 2: Selezione Girone (A o B)
  const [activeGirone, setActiveGirone] = useState<'A' | 'B'>('A');

  // Step 3: Tab Visione (Gare vs Classifica)
  const [activeTab, setActiveTab] = useState<'CALENDARIO' | 'CLASSIFICA'>('CALENDARIO');

  // Giornata selezionata (predefinita: la prima senza risultati, ovvero la prossima)
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

  // Caricamento dati
  const loadData = useCallback(() => {
    const all = DbService.getMatches();
    setAllMatches(all);

    const m = DbService.getMatches(activeGirone, selectedDay);
    setDayMatches(m);

    const s = DbService.getStandings(activeGirone);
    setStandings(s);
  }, [activeGirone, selectedDay]);

  // Sottoscrizione Realtime multi-dispositivo
  useRealtimeSync(loadData);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Quando cambia il girone o allMatches viene caricato, imposta la giornata automaticamente alla prossima
  useEffect(() => {
    if (allMatches.length > 0) {
      const nextDay = getFirstUpcomingDay(activeGirone, allMatches);
      setSelectedDay(nextDay);
    }
  }, [activeGirone, allMatches]);

  const handleOpenPreparaGara = (match: Match) => {
    setPreparaGaraMatch(match);
    setIsPreparaGaraOpen(true);
  };

  const handleSaveMatchEdit = () => {
    if (!editingMatch) return;
    try {
      DbService.updateMatch(editingMatch.id, editMatchForm);
      setEditingMatch(null);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const daysList = Array.from({ length: 34 }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      {/* 1. SELEZIONE GERARCHICA: CATEGORIA -> GIRONE -> TAB GARE/CLASSIFICA */}
      <div className="bg-[#0D0F16] border border-[#1F2433] rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
        {/* Titolo Principale */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#1A1F2C] pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <Calendar className="w-6 h-6 text-[#CCFF00]" />
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                Gare & Classifiche Ufficiali
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Imposta la categoria e il girone per consultare il calendario, preparare la gara o verificare la classifica.
            </p>
          </div>

          {/* Tab Switcher Rapido: Calendario Gare vs Classifica */}
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

        {/* CONTROLLI STEP 1 & STEP 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* STEP 1: Selezione Categoria */}
          <div className="p-4 rounded-2xl bg-[#11141D] border border-[#212638] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-[#181C28] border border-[#293044] text-[#CCFF00] text-[9px] flex items-center justify-center font-mono">1</span>
                Seleziona Categoria
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Attiva
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setSelectedCategory('eccellenza')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                  selectedCategory === 'eccellenza'
                    ? 'bg-[#181C28] text-[#CCFF00] border border-[#CCFF00]/40 shadow-sm'
                    : 'bg-[#0D0F16] text-slate-400 border border-[#212638]'
                }`}
              >
                <Award className="w-4 h-4 text-[#CCFF00]" />
                <span>Eccellenza (Emilia-Romagna)</span>
              </button>

              <div
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-500 bg-[#0A0C10] border border-[#1A1F2C] cursor-not-allowed opacity-60"
                title="Promozione disponibile nei prossimi aggiornamenti"
              >
                <span>Promozione</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 uppercase font-mono">Presto</span>
              </div>
            </div>
          </div>

          {/* STEP 2: Selezione Girone */}
          <div className="p-4 rounded-2xl bg-[#11141D] border border-[#212638] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-[#181C28] border border-[#293044] text-[#CCFF00] text-[9px] flex items-center justify-center font-mono">2</span>
                Seleziona Girone
              </span>
              <span className="text-[10px] text-slate-400">
                {activeGirone === 'A' ? '17 Squadre (Reggio, Parma, Piacenza, Modena)' : '18 Squadre (Bologna, Romagna, Ferrara)'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => setActiveGirone('A')}
                className={`py-2 px-3.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                  activeGirone === 'A'
                    ? 'bg-[#CCFF00] text-black shadow-[0_0_15px_rgba(204,255,0,0.3)]'
                    : 'bg-[#141824] text-slate-300 hover:text-white border border-[#212638] hover:border-slate-600'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Girone A (17 Club)</span>
              </button>

              <button
                onClick={() => setActiveGirone('B')}
                className={`py-2 px-3.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                  activeGirone === 'B'
                    ? 'bg-[#CCFF00] text-black shadow-[0_0_15px_rgba(204,255,0,0.3)]'
                    : 'bg-[#141824] text-slate-300 hover:text-white border border-[#212638] hover:border-slate-600'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Girone B (18 Club)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. CONTENUTO TAB: CALENDARIO GARE vs CLASSIFICA */}
      {activeTab === 'CALENDARIO' ? (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Barra Giornate con Evidenza della Prossima Giornata */}
          <div className="bg-[#0D0F16] border border-[#1F2433] rounded-2xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-white uppercase tracking-wider">
                  Seleziona Giornata:
                </span>
                <span className="text-xs font-mono font-black text-[#CCFF00] bg-[#CCFF00]/10 px-2 py-0.5 rounded border border-[#CCFF00]/30">
                  Giornata {selectedDay} di 34
                </span>
                {selectedDay === upcomingDayForGirone && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Prossima in Programma
                  </span>
                )}
              </div>

              {/* Bottoni Navigazione Veloce Precedente / Successiva e Salto a Prossima */}
              <div className="flex items-center gap-2">
                {selectedDay !== upcomingDayForGirone && (
                  <button
                    onClick={() => setSelectedDay(upcomingDayForGirone)}
                    className="text-[11px] font-bold text-[#CCFF00] hover:underline flex items-center gap-1 bg-[#141824] border border-[#212638] px-2.5 py-1 rounded-lg"
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

          {/* Griglia Partite della Giornata Selezionata */}
          {dayMatches.length === 0 ? (
            <div className="p-12 text-center bg-[#0D0F16] border border-dashed border-[#212638] rounded-2xl text-slate-500 text-xs">
              Nessun incontro programmato per questa giornata nel calendario ufficiale.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dayMatches.map((match) => (
                <div
                  key={match.id}
                  className="rounded-2xl bg-[#0D0F16] border border-[#1F2433] p-5 hover:border-[#CCFF00]/40 transition-all flex flex-col justify-between space-y-4 group shadow-md"
                >
                  <div>
                    {/* Header Card: Data, Campo, Modifica */}
                    <div className="flex items-center justify-between text-xs text-slate-400 border-b border-[#1A1F2C] pb-2.5">
                      <span className="font-bold text-[#CCFF00] text-[11px] bg-[#CCFF00]/10 px-2 py-0.5 rounded border border-[#CCFF00]/20 font-mono">
                        {match.dateText || `Giornata ${match.matchDay}`}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-[11px] truncate max-w-[170px]">
                          🏟️ {match.matchField || 'Campo federale'}
                        </span>
                        <button
                          onClick={() => {
                            setEditingMatch(match);
                            setEditMatchForm(match);
                          }}
                          className="text-slate-400 hover:text-[#CCFF00] p-1 transition-colors"
                          title="Modifica Risultato / Arbitro"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Squadre & Risultato */}
                    <div className="py-4 flex items-center justify-between gap-3">
                      <div className="flex-1 text-left">
                        <p className="font-bold text-sm md:text-base text-white group-hover:text-[#CCFF00] transition-colors line-clamp-1">
                          {match.homeTeamName}
                        </p>
                      </div>

                      <div className="px-4 py-1.5 bg-[#11141D] rounded-xl border border-[#212638] font-mono font-black text-sm text-[#CCFF00] shrink-0 shadow-inner">
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

                    {/* Arbitro & Note Osservazioni */}
                    <div className="text-xs text-slate-400 space-y-1">
                      <p className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        <span>Arbitro: <strong className="text-slate-200">{match.refereeName || 'Da designare'}</strong></span>
                      </p>
                      {match.observations && (
                        <p className="flex items-center gap-1.5 text-slate-400 italic">
                          <FileText className="w-3.5 h-3.5 text-slate-500" />
                          <span className="line-clamp-1">{match.observations}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Pulsante Prepara la Gara */}
                  <div className="pt-3 border-t border-[#1A1F2C] flex items-center justify-between">
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
        /* 3. TAB CLASSIFICA UFFICIALE */
        <div className="rounded-3xl bg-[#0D0F16] border border-[#1F2433] overflow-hidden shadow-xl animate-in fade-in duration-200">
          <div className="p-5 border-b border-[#1F2433] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Trophy className="w-5 h-5 text-[#CCFF00]" />
              <div>
                <h3 className="font-black text-white text-base tracking-wide">
                  Classifica Ufficiale • Eccellenza Girone {activeGirone}
                </h3>
                <p className="text-xs text-slate-400">
                  Aggiornata in tempo reale alle gare disputate fino alla giornata {Math.max(1, upcomingDayForGirone - 1)}
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
