'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Sparkles, Trophy, Edit3, Check, X, MapPin, User, FileText } from 'lucide-react';
import { DbService } from '@/lib/repository/db-service';
import { Match, StandingRow, PreMatchBriefing } from '@/types/refstudio';
import { useAuth } from '@/lib/auth/auth-context';
import { AiBriefingModal } from '@/components/modals/AiBriefingModal';
import { useRealtimeSync } from '@/lib/supabase/realtime-context';

export default function MatchesPage() {
  const { isAdmin } = useAuth();
  const [activeGirone, setActiveGirone] = useState<'A' | 'B'>('A');
  const [activeTab, setActiveTab] = useState<'CALENDARIO' | 'CLASSIFICA'>('CALENDARIO');
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [matches, setMatches] = useState<Match[]>([]);
  const [standings, setStandings] = useState<StandingRow[]>([]);

  // Editing match (Admin)
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [editMatchForm, setEditMatchForm] = useState<Partial<Match>>({});

  // AI Briefing
  const [isAiBriefingOpen, setIsAiBriefingOpen] = useState(false);
  const [currentBriefing, setCurrentBriefing] = useState<PreMatchBriefing | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const loadData = React.useCallback(() => {
    const m = DbService.getMatches(activeGirone, selectedDay);
    setMatches(m);
    const s = DbService.getStandings(activeGirone);
    setStandings(s);
  }, [activeGirone, selectedDay]);

  // Sottoscrizione Realtime multi-dispositivo
  useRealtimeSync(loadData);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenAiBriefing = async (match: Match) => {
    setIsAiLoading(true);
    setIsAiBriefingOpen(true);
    setCurrentBriefing(null);

    try {
      const res = await fetch('/api/ai/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: match.id }),
      });
      const data = await res.json();
      if (data.success) {
        setCurrentBriefing(data.data);
      }
    } catch (err) {
      console.error('Failed to generate briefing:', err);
    } finally {
      setIsAiLoading(false);
    }
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
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Calendar className="w-6 h-6 text-[#CCFF00]" />
            Calendario & Classifica Eccellenza
          </h1>
          <p className="text-xs text-slate-400">
            Consultazione gare, designazioni arbitrali, referti e briefing Gemini AI
          </p>
        </div>

        {/* Girone & Tab switchers */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl bg-[#0D0F16] border border-[#1F2433] p-1">
            <button
              onClick={() => setActiveGirone('A')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                activeGirone === 'A'
                  ? 'bg-[#CCFF00] text-black shadow-[0_0_12px_rgba(204,255,0,0.35)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Girone A
            </button>
            <button
              onClick={() => setActiveGirone('B')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                activeGirone === 'B'
                  ? 'bg-[#CCFF00] text-black shadow-[0_0_12px_rgba(204,255,0,0.35)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Girone B
            </button>
          </div>

          <div className="flex rounded-xl bg-[#0D0F16] border border-[#1F2433] p-1">
            <button
              onClick={() => setActiveTab('CALENDARIO')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'CALENDARIO'
                  ? 'bg-[#181C28] text-[#CCFF00] border border-[#2B3245]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Calendario Gare
            </button>
            <button
              onClick={() => setActiveTab('CLASSIFICA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'CLASSIFICA'
                  ? 'bg-[#181C28] text-[#CCFF00] border border-[#2B3245]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Classifica Ufficiale
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'CALENDARIO' ? (
        <div className="space-y-6">
          {/* Days Carousel Selector */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {daysList.map((day) => (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`px-3.5 py-2 rounded-xl text-xs font-black shrink-0 transition-all ${
                  selectedDay === day
                    ? 'bg-[#CCFF00] text-black shadow-[0_0_18px_rgba(204,255,0,0.35)]'
                    : 'bg-[#0D0F16] border border-[#1F2433] text-slate-400 hover:text-white hover:border-[#CCFF00]/40'
                }`}
              >
                Giornata {day}
              </button>
            ))}
          </div>

          {/* Matches List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matches.map((match) => (
              <div
                key={match.id}
                className="rounded-2xl bg-[#0D0F16] border border-[#1F2433] p-5 hover:border-[#CCFF00]/40 transition-all flex flex-col justify-between space-y-4 group"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 border-b border-[#1A1F2C] pb-2.5">
                    <span className="font-bold text-[#CCFF00] text-[11px] bg-[#CCFF00]/10 px-2 py-0.5 rounded border border-[#CCFF00]/20">
                      {match.dateText}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-[11px]">🏟️ {match.matchField || 'Campo federale'}</span>
                      {isAdmin && (
                        <button
                          onClick={() => {
                            setEditingMatch(match);
                            setEditMatchForm(match);
                          }}
                          className="text-slate-400 hover:text-[#CCFF00] p-1"
                          title="Modifica Risultato / Arbitro"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Teams & Score */}
                  <div className="py-4 flex items-center justify-between">
                    <div className="flex-1 text-left">
                      <p className="font-bold text-sm md:text-base text-white group-hover:text-[#CCFF00] transition-colors">{match.homeTeamName}</p>
                    </div>

                    <div className="px-4 py-1.5 bg-[#11141D] rounded-xl border border-[#212638] font-mono font-black text-sm text-[#CCFF00] mx-3 shadow-inner">
                      {match.played && match.homeScore !== undefined
                        ? `${match.homeScore} - ${match.awayScore}`
                        : 'VS'}
                    </div>

                    <div className="flex-1 text-right">
                      <p className="font-bold text-sm md:text-base text-white group-hover:text-[#CCFF00] transition-colors">{match.awayTeamName}</p>
                    </div>
                  </div>

                  {/* Referee & Observations */}
                  <div className="text-xs text-slate-400 space-y-1">
                    <p className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span>Arbitro: <strong className="text-slate-200">{match.refereeName || 'Da designare'}</strong></span>
                    </p>
                    {match.observations && (
                      <p className="flex items-center gap-1.5 text-slate-400 italic">
                        <FileText className="w-3.5 h-3.5 text-slate-500" />
                        <span>{match.observations}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* AI Briefing Button */}
                <div className="pt-3 border-t border-[#1A1F2C] flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 font-mono">
                    {match.played ? 'Partita disputata' : 'In programma'}
                  </span>
                  <button
                    onClick={() => handleOpenAiBriefing(match)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#CCFF00]/15 hover:bg-[#CCFF00]/25 text-[#CCFF00] border border-[#CCFF00]/30 text-xs font-bold transition-all shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#CCFF00]" />
                    Briefing AI Gemini
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Standings Table */
        <div className="rounded-2xl bg-[#0D0F16] border border-[#1F2433] overflow-hidden">
          <div className="p-4 border-b border-[#1F2433] flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#CCFF00]" />
            <h3 className="font-black text-white text-sm tracking-wide">
              Classifica Generale - Eccellenza Girone {activeGirone}
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#11141D] uppercase text-[10px] font-bold text-slate-400 tracking-wider border-b border-[#1F2433]">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">Pos</th>
                  <th className="py-3 px-4">Squadra</th>
                  <th className="py-3 px-3 text-center font-bold text-white">Pt</th>
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
                  <tr key={row.teamName} className="hover:bg-[#12151E] transition-colors">
                    <td className="py-3 px-4 text-center font-mono font-bold">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${
                          row.position <= 2
                            ? 'bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/30 shadow-[0_0_8px_rgba(204,255,0,0.2)]'
                            : row.position >= 15
                            ? 'bg-[#FF334B]/15 text-[#FF334B] border border-[#FF334B]/30'
                            : 'text-slate-400'
                        }`}
                      >
                        {row.position}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-white">{row.teamName}</td>
                    <td className="py-3 px-3 text-center font-mono font-black text-sm text-[#CCFF00]">
                      {row.points}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-slate-400">{row.played}</td>
                    <td className="py-3 px-3 text-center font-mono text-slate-400">{row.won}</td>
                    <td className="py-3 px-3 text-center font-mono text-slate-400">{row.drawn}</td>
                    <td className="py-3 px-3 text-center font-mono text-slate-400">{row.lost}</td>
                    <td className="py-3 px-3 text-center font-mono text-slate-400">{row.goalsFor}</td>
                    <td className="py-3 px-3 text-center font-mono text-slate-400">{row.goalsAgainst}</td>
                    <td
                      className={`py-3 px-3 text-center font-mono font-bold ${
                        row.goalDifference > 0
                          ? 'text-[#CCFF00]'
                          : row.goalDifference < 0
                          ? 'text-[#FF334B]'
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
        </div>
      )}

      {/* Admin Match Edit Modal */}
      {editingMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-[#0D0F16] border border-[#212638] shadow-2xl p-6 text-slate-100 space-y-4">
            <button
              onClick={() => setEditingMatch(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white">Modifica Partita (Admin)</h3>
            <p className="text-xs text-slate-400">
              {editingMatch.homeTeamName} vs {editingMatch.awayTeamName}
            </p>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Gol Casa</label>
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
                    className="w-full bg-[#181C28] border border-[#2B3245] rounded p-2 text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Gol Ospite</label>
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
                    className="w-full bg-[#181C28] border border-[#2B3245] rounded p-2 text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Arbitro Designato</label>
                <input
                  type="text"
                  value={editMatchForm.refereeName || ''}
                  onChange={(e) =>
                    setEditMatchForm({ ...editMatchForm, refereeName: e.target.value })
                  }
                  placeholder="Es. Mario Rossi (Sez. Bologna)"
                  className="w-full bg-[#181C28] border border-[#2B3245] rounded p-2 text-slate-200"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Campo / Stadio</label>
                <input
                  type="text"
                  value={editMatchForm.matchField || ''}
                  onChange={(e) =>
                    setEditMatchForm({ ...editMatchForm, matchField: e.target.value })
                  }
                  placeholder="Nome campo di gioco"
                  className="w-full bg-[#181C28] border border-[#2B3245] rounded p-2 text-slate-200"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Osservazioni Arbitro</label>
                <textarea
                  rows={3}
                  value={editMatchForm.observations || ''}
                  onChange={(e) =>
                    setEditMatchForm({ ...editMatchForm, observations: e.target.value })
                  }
                  placeholder="Clima partita, espulsioni, episodi chiave..."
                  className="w-full bg-[#181C28] border border-[#2B3245] rounded p-2 text-slate-200"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingMatch(null)}
                className="px-4 py-2 bg-[#181C28] hover:bg-[#202534] text-xs font-semibold rounded-lg text-slate-300 border border-[#2B3245]"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleSaveMatchEdit}
                className="px-4 py-2 bg-[#CCFF00] hover:bg-[#d8ff33] text-black font-black text-xs rounded-lg shadow-[0_0_12px_rgba(204,255,0,0.3)]"
              >
                Salva Referto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Briefing Modal */}
      <AiBriefingModal
        isOpen={isAiBriefingOpen}
        onClose={() => setIsAiBriefingOpen(false)}
        briefing={currentBriefing}
        loading={isAiLoading}
      />
    </div>
  );
}
