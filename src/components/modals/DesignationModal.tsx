'use client';

import React, { useState, useEffect } from 'react';
import {
  Award,
  X,
  Check,
  Trash2,
  Calendar,
  Clock,
  MapPin,
  Users,
  Shield,
  FileText,
  DollarSign,
  Navigation,
  Star,
} from 'lucide-react';
import { Match, MatchDesignation, DesignationRole } from '@/types/refstudio';
import { TeamBadge } from '@/components/common/AvatarBadge';

export interface DesignationModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match | null;
  existingDesignation?: MatchDesignation | null;
  onSave: (data: Partial<MatchDesignation>) => void;
  onRemove?: () => void;
}

export const DesignationModal: React.FC<DesignationModalProps> = ({
  isOpen,
  onClose,
  match,
  existingDesignation,
  onSave,
  onRemove,
}) => {
  const [role, setRole] = useState<DesignationRole>('AE');
  const [assistant1, setAssistant1] = useState('');
  const [assistant2, setAssistant2] = useState('');
  const [observer, setObserver] = useState('');
  const [customDateText, setCustomDateText] = useState('');
  const [customField, setCustomField] = useState('');
  const [notes, setNotes] = useState('');

  // Dati post-gara
  const [yellowCardsGiven, setYellowCardsGiven] = useState<number | undefined>(undefined);
  const [redCardsGiven, setRedCardsGiven] = useState<number | undefined>(undefined);
  const [penaltiesAwarded, setPenaltiesAwarded] = useState<number | undefined>(undefined);
  const [refereeScore, setRefereeScore] = useState<string>('');
  const [diariaEuro, setDiariaEuro] = useState<string>('');
  const [travelKm, setTravelKm] = useState<string>('');

  useEffect(() => {
    if (!isOpen || !match) return;

    if (existingDesignation) {
      setRole((existingDesignation.role as DesignationRole) || 'AE');
      setAssistant1(existingDesignation.assistant1 || '');
      setAssistant2(existingDesignation.assistant2 || '');
      setObserver(existingDesignation.observer || '');
      setCustomDateText(existingDesignation.customDateText || match.dateText || '');
      setCustomField(existingDesignation.customField || match.matchField || '');
      setNotes(existingDesignation.notes || '');
      setYellowCardsGiven(existingDesignation.yellowCardsGiven);
      setRedCardsGiven(existingDesignation.redCardsGiven);
      setPenaltiesAwarded(existingDesignation.penaltiesAwarded);
      setRefereeScore(existingDesignation.refereeScore ? String(existingDesignation.refereeScore) : '');
      setDiariaEuro(existingDesignation.diariaEuro ? String(existingDesignation.diariaEuro) : '');
      setTravelKm(existingDesignation.travelKm ? String(existingDesignation.travelKm) : '');
    } else {
      setRole('AE');
      setAssistant1('');
      setAssistant2('');
      setObserver('');
      setCustomDateText(match.dateText || '');
      setCustomField(match.matchField || '');
      setNotes('');
      setYellowCardsGiven(undefined);
      setRedCardsGiven(undefined);
      setPenaltiesAwarded(undefined);
      setRefereeScore('');
      setDiariaEuro('');
      setTravelKm('');
    }
  }, [isOpen, match, existingDesignation]);

  // Supporto chiusura con Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !match) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      role,
      assistant1: assistant1.trim() || undefined,
      assistant2: assistant2.trim() || undefined,
      observer: observer.trim() || undefined,
      customDateText: customDateText.trim() || match.dateText,
      customField: customField.trim() || match.matchField,
      notes: notes.trim() || undefined,
      yellowCardsGiven: yellowCardsGiven !== undefined ? Number(yellowCardsGiven) : undefined,
      redCardsGiven: redCardsGiven !== undefined ? Number(redCardsGiven) : undefined,
      penaltiesAwarded: penaltiesAwarded !== undefined ? Number(penaltiesAwarded) : undefined,
      refereeScore: refereeScore ? parseFloat(refereeScore) : undefined,
      diariaEuro: diariaEuro ? parseFloat(diariaEuro) : undefined,
      travelKm: travelKm ? parseFloat(travelKm) : undefined,
    });
    onClose();
  };

  const ROLES: { id: DesignationRole; label: string; desc: string }[] = [
    { id: 'AE', label: 'AE - Arbitro', desc: 'Direttore di gara effettivo' },
    { id: 'AA1', label: 'AA1 - 1° Assistente', desc: 'Primo assistente di linea' },
    { id: 'AA2', label: 'AA2 - 2° Assistente', desc: 'Secondo assistente di linea' },
    { id: 'OA', label: 'OA - Osservatore', desc: 'Osservatore arbitrale / Tutor' },
  ];

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-5 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-[#0D0F16] border border-[#212638] shadow-2xl p-5 sm:p-7 text-slate-100 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1E2333] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#141824] border border-[#242A3C] flex items-center justify-center text-[#CCFF00] shadow-inner shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#161B26] text-[#CCFF00] border border-[#CCFF00]/30 uppercase">
                  Designazione Gara
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Girone {match.girone} • Giornata {match.matchDay}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white mt-0.5">
                {match.homeTeamName} vs {match.awayTeamName}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-[#141824] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-[#212638] transition-all cursor-pointer shrink-0"
            title="Chiudi (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Match Info Bar */}
        <div className="p-3.5 rounded-2xl bg-[#12151F] border border-[#212638] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <TeamBadge name={match.homeTeamName} size="sm" />
            <span className="font-bold text-sm text-white">{match.homeTeamName}</span>
          </div>

          <div className="px-3 py-1 rounded-xl bg-[#090A0E] border border-[#1E2333] font-mono font-black text-xs text-[#CCFF00]">
            {match.played && match.homeScore !== undefined
              ? `${match.homeScore} - ${match.awayScore}`
              : 'VS'}
          </div>

          <div className="flex items-center gap-2.5">
            <span className="font-bold text-sm text-white">{match.awayTeamName}</span>
            <TeamBadge name={match.awayTeamName} size="sm" />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          {/* Selettore Ruolo */}
          <div className="space-y-2">
            <label className="font-black uppercase tracking-wider text-slate-400 block">
              Tuo Ruolo nella Gara
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ROLES.map((r) => {
                const isSelected = role === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#CCFF00]/15 border-[#CCFF00] text-white shadow-[0_0_15px_rgba(204,255,0,0.2)]'
                        : 'bg-[#12151E] border-[#212638] text-slate-400 hover:text-white hover:border-[#2D354A]'
                    }`}
                  >
                    <span className={`font-black text-sm block ${isSelected ? 'text-[#CCFF00]' : 'text-slate-200'}`}>
                      {r.label}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-1 block leading-tight">
                      {r.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dettagli Gara: Data, Orario, Campo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#CCFF00]" />
                Data & Orario Convocazione
              </label>
              <input
                type="text"
                value={customDateText}
                onChange={(e) => setCustomDateText(e.target.value)}
                placeholder="es. Domenica ore 15:30 (Ritrovo ore 13:45)"
                className="w-full bg-[#12151E] border border-[#23293D] focus:border-[#CCFF00] rounded-xl p-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#CCFF00]" />
                Campo / Impianto Sportivo
              </label>
              <input
                type="text"
                value={customField}
                onChange={(e) => setCustomField(e.target.value)}
                placeholder="es. Stadio Comunale, Erba Naturale"
                className="w-full bg-[#12151E] border border-[#23293D] focus:border-[#CCFF00] rounded-xl p-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Terna Arbitrale & Ufficiali di Gara */}
          <div className="p-4 rounded-2xl bg-[#11141D] border border-[#212638] space-y-3">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#CCFF00]" />
              Terna Arbitrale & Osservatore
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1 font-semibold">
                  1° Assistente (AA1)
                </label>
                <input
                  type="text"
                  value={assistant1}
                  onChange={(e) => setAssistant1(e.target.value)}
                  placeholder="Nome e Sezione AIA"
                  className="w-full bg-[#0D0F16] border border-[#212638] focus:border-[#CCFF00] rounded-xl p-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1 font-semibold">
                  2° Assistente (AA2)
                </label>
                <input
                  type="text"
                  value={assistant2}
                  onChange={(e) => setAssistant2(e.target.value)}
                  placeholder="Nome e Sezione AIA"
                  className="w-full bg-[#0D0F16] border border-[#212638] focus:border-[#CCFF00] rounded-xl p-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1 font-semibold">
                  Osservatore Arbitrale (OA)
                </label>
                <input
                  type="text"
                  value={observer}
                  onChange={(e) => setObserver(e.target.value)}
                  placeholder="Nome e Sezione AIA"
                  className="w-full bg-[#0D0F16] border border-[#212638] focus:border-[#CCFF00] rounded-xl p-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Note Personali Pre-Gara */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#CCFF00]" />
              Note Personali & Direttive Tattiche Pre-Gara
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="es. Attenzione alle partenze dell'ala sinistra, campo stretto, colloquio con i capitani prima del riscaldamento..."
              className="w-full bg-[#12151E] border border-[#23293D] focus:border-[#CCFF00] rounded-xl p-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none transition-colors"
            />
          </div>

          {/* Dati Consuntivi Gara Disputata */}
          <details className="rounded-2xl bg-[#11141D] border border-[#212638] overflow-hidden group/consuntivo">
            <summary className="p-3.5 cursor-pointer select-none font-black uppercase tracking-wider text-slate-300 flex items-center justify-between hover:bg-[#141824] transition-colors">
              <span className="flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-400" />
                Statistiche Post-Gara & Rimborsi (Opzionale)
              </span>
              <span className="text-[11px] font-mono text-[#CCFF00]">Mostra / Nascondi ▾</span>
            </summary>

            <div className="p-4 border-t border-[#1C2130] space-y-3.5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div>
                  <label className="text-[10px] text-slate-400 block font-bold uppercase mb-1">
                    Ammonizioni 🟨
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={yellowCardsGiven !== undefined ? yellowCardsGiven : ''}
                    onChange={(e) => setYellowCardsGiven(e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
                    placeholder="es. 4"
                    className="w-full bg-[#0D0F16] border border-[#212638] rounded-xl p-2 text-center text-xs font-mono font-bold text-yellow-400 focus:outline-none focus:border-yellow-400"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block font-bold uppercase mb-1">
                    Espulsioni 🟥
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={redCardsGiven !== undefined ? redCardsGiven : ''}
                    onChange={(e) => setRedCardsGiven(e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
                    placeholder="es. 0"
                    className="w-full bg-[#0D0F16] border border-[#212638] rounded-xl p-2 text-center text-xs font-mono font-bold text-rose-400 focus:outline-none focus:border-rose-400"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block font-bold uppercase mb-1">
                    Rigori Assegnati ⚽
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={penaltiesAwarded !== undefined ? penaltiesAwarded : ''}
                    onChange={(e) => setPenaltiesAwarded(e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
                    placeholder="es. 1"
                    className="w-full bg-[#0D0F16] border border-[#212638] rounded-xl p-2 text-center text-xs font-mono font-bold text-white focus:outline-none focus:border-[#CCFF00]"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block font-bold uppercase mb-1">
                    Voto OA ⭐
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min={6}
                    max={10}
                    value={refereeScore}
                    onChange={(e) => setRefereeScore(e.target.value)}
                    placeholder="es. 8.40"
                    className="w-full bg-[#0D0F16] border border-[#212638] rounded-xl p-2 text-center text-xs font-mono font-bold text-[#CCFF00] focus:outline-none focus:border-[#CCFF00]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-[#1C2130]">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 block font-semibold">
                      Diaria / Rimborso (€)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={diariaEuro}
                      onChange={(e) => setDiariaEuro(e.target.value)}
                      placeholder="es. 75"
                      className="w-full bg-[#0D0F16] border border-[#212638] rounded-xl p-2 text-xs text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-sky-400 shrink-0" />
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 block font-semibold">
                      Chilometri Percorsi (Km)
                    </label>
                    <input
                      type="number"
                      value={travelKm}
                      onChange={(e) => setTravelKm(e.target.value)}
                      placeholder="es. 95"
                      className="w-full bg-[#0D0F16] border border-[#212638] rounded-xl p-2 text-xs text-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </details>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-[#1C2130] flex flex-wrap items-center justify-between gap-2">
            {existingDesignation && onRemove ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Sei sicuro di voler rimuovere questa partita dalle tue gare designate?')) {
                    onRemove();
                    onClose();
                  }
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Rimuovi Designazione
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-[#141824] hover:bg-[#1E2435] text-slate-300 font-bold rounded-xl border border-[#212638] transition-all cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2 bg-[#CCFF00] hover:bg-[#D8FF33] text-black font-black rounded-xl shadow-[0_0_15px_rgba(204,255,0,0.35)] transition-all cursor-pointer active:scale-95"
              >
                <Check className="w-4 h-4" /> Salva Designazione
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
