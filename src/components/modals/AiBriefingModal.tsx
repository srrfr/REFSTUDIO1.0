'use client';

import React from 'react';
import { PreMatchBriefing } from '@/types/refstudio';
import { Sparkles, AlertTriangle, Users, Compass, X, Printer } from 'lucide-react';
import { TagBadge } from '@/components/common/TagBadge';
import { RoleBadge } from '@/components/common/RoleBadge';

interface AiBriefingModalProps {
  isOpen: boolean;
  onClose: () => void;
  briefing: PreMatchBriefing | null;
  loading?: boolean;
}

export const AiBriefingModal: React.FC<AiBriefingModalProps> = ({
  isOpen,
  onClose,
  briefing,
  loading = false,
}) => {
  if (!isOpen) return null;

  const getTensionBadge = (rating: number) => {
    if (rating >= 8) return { label: 'Tensione Estrema (Derby / Playoff)', color: 'bg-[#FF334B]/15 text-[#FF334B] border-[#FF334B]/40' };
    if (rating >= 6) return { label: 'Tensione Medio-Alta', color: 'bg-amber-500/15 text-amber-300 border-amber-500/40' };
    return { label: 'Tensione Ordinaria', color: 'bg-[#CCFF00]/15 text-[#CCFF00] border-[#CCFF00]/40' };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl my-8 rounded-3xl bg-[#0D0F16] border border-[#212638] shadow-2xl p-6 md:p-8 text-slate-100 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {loading ? (
          <div className="py-20 text-center space-y-4">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#CCFF00] border-t-transparent shadow-[0_0_15px_rgba(204,255,0,0.4)]"></div>
            <p className="text-sm font-black text-white">
              Elaborazione del Briefing Pre-Gara con Gemini AI...
            </p>
            <p className="text-xs text-slate-400">
              Analisi incrociata cartellini, storici, panchine e profili disciplinari in corso...
            </p>
          </div>
        ) : briefing ? (
          <div className="space-y-6">
            {/* Header */}
            <div className="border-b border-[#1E2333] pb-5">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#CCFF00] mb-1">
                <Sparkles className="w-4 h-4 text-[#CCFF00]" />
                Dossier Tattico & Disciplinare Arbitro
              </div>
              <h2 className="text-2xl font-black tracking-tight text-white">
                {briefing.homeTeam} <span className="text-slate-500">vs</span> {briefing.awayTeam}
              </h2>
              <div className="flex flex-wrap items-center gap-3 mt-3">
                {(() => {
                  const tension = getTensionBadge(briefing.tacticalTensionRating);
                  return (
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${tension.color}`}>
                      Indice Tensione Gara: {briefing.tacticalTensionRating}/10 ({tension.label})
                    </span>
                  );
                })()}
                <span className="text-xs text-slate-500 font-mono">
                  Generato il {new Date(briefing.generatedAt).toLocaleString('it-IT')}
                </span>
              </div>
            </div>

            {/* Executive Summary */}
            <div className="bg-[#12151E] border border-[#212638] rounded-xl p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
                <Compass className="w-4 h-4 text-[#CCFF00]" />
                Sintesi della Direzione di Gara
              </h4>
              <p className="text-sm text-slate-200 leading-relaxed">{briefing.executiveSummary}</p>
            </div>

            {/* Key Players */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#CCFF00]" />
                Calciatori Sotto Osservazione Arbitrale
              </h4>
              {briefing.keyWatchPlayers.length === 0 ? (
                <p className="text-xs text-slate-500 italic">Nessun calciatore con criticità disciplinari segnalate.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {briefing.keyWatchPlayers.map((p, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-xl bg-[#12151E] border border-[#212638] space-y-2 hover:border-[#CCFF00]/40 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-white">{p.playerName}</span>
                        <RoleBadge role={p.role} />
                      </div>
                      <p className="text-xs text-slate-400 font-medium">{p.teamName}</p>
                      <p className="text-xs text-slate-300 leading-normal">{p.reason}</p>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {p.tags.map((t, idx) => (
                          <TagBadge key={idx} tag={t} size="sm" />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bench guidance */}
            <div className="bg-[#12151E] border border-[#212638] rounded-xl p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#CCFF00]" />
                Collaborazione Assistenti & Gestione Panchine
              </h4>
              <p className="text-sm text-slate-200 leading-relaxed">{briefing.benchDisciplineGuidance}</p>
            </div>

            {/* Referee advice bullets */}
            <div className="bg-[#12151E] border border-[#CCFF00]/30 rounded-xl p-4 shadow-[0_0_15px_rgba(204,255,0,0.1)]">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#CCFF00] mb-2">
                Direttive Operative per la Terna
              </h4>
              <ul className="space-y-2">
                {briefing.refereeAdvice.map((adv, idx) => (
                  <li key={idx} className="text-xs text-slate-200 flex items-start gap-2">
                    <span className="text-[#CCFF00] font-bold">•</span>
                    <span>{adv}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Footer actions */}
            <div className="flex justify-between items-center pt-4 border-t border-[#1E2333]">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl bg-[#181C28] hover:bg-[#202534] text-slate-300 border border-[#282E40] transition-colors"
              >
                <Printer className="w-4 h-4 text-slate-400" />
                Stampa / Esporta PDF
              </button>
              <button
                onClick={onClose}
                className="text-xs font-black px-5 py-2.5 rounded-xl bg-[#CCFF00] hover:bg-[#d8ff33] text-black shadow-[0_0_15px_rgba(204,255,0,0.35)] transition-all"
              >
                Chiudi Briefing
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
