'use client';

import React, { useState, useEffect } from 'react';
import { Note } from '@/types/refstudio';
import {
  Users,
  Award,
  X,
  Check,
  AlertCircle,
  Globe,
  Lock,
  User,
  Shield,
  FileText,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';

export interface StaffNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  teamName: string;
  coachName?: string;
  existingNote?: Note | null;
  onSave: (noteData: {
    id?: string;
    targetType: 'allenatore' | 'dirigente';
    targetId: string;
    targetName: string;
    content: string;
    priority: 'LOW' | 'NORMAL' | 'HIGH';
    isPublic: boolean;
  }) => void;
}

export const StaffNoteModal: React.FC<StaffNoteModalProps> = ({
  isOpen,
  onClose,
  teamId,
  teamName,
  coachName,
  existingNote = null,
  onSave,
}) => {
  const { user } = useAuth();

  const [staffRole, setStaffRole] = useState<'allenatore' | 'dirigente'>('allenatore');
  const [managerSurname, setManagerSurname] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH'>('NORMAL');
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState('');

  // Inizializza i campi quando la modale si apre o cambia la nota in modifica
  useEffect(() => {
    if (!isOpen) return;

    if (existingNote) {
      const isCoach = existingNote.targetType === 'allenatore';
      setStaffRole(isCoach ? 'allenatore' : 'dirigente');

      if (!isCoach) {
        // Estrai il cognome del dirigente da targetName o dal contenuto
        let cleanName = existingNote.targetName || '';
        cleanName = cleanName
          .replace(`(${teamName})`, '')
          .replace('Dirigente', '')
          .replace('Dir.', '')
          .trim();
        setManagerSurname(cleanName);
      } else {
        setManagerSurname('');
      }

      // Se il contenuto inizia con [Dirigente: ...], pulisci il prefisso per l'editing
      let cleanContent = existingNote.content || '';
      const dirMatch = cleanContent.match(/^\[Dirigente:\s*([^\]]+)\]\s*/i);
      if (dirMatch && !isCoach) {
        if (!managerSurname) setManagerSurname(dirMatch[1].trim());
        cleanContent = cleanContent.replace(/^\[Dirigente:\s*[^\]]+\]\s*/i, '');
      }

      setContent(cleanContent);
      setPriority(existingNote.priority || 'NORMAL');
      setIsPublic(existingNote.isPublic !== false);
    } else {
      setStaffRole('allenatore');
      setManagerSurname('');
      setContent('');
      setPriority('NORMAL');
      setIsPublic(true);
    }
    setError('');
  }, [isOpen, existingNote, teamName]);

  // Listener tasto Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      setError('Inserisci il testo della nota o osservazione.');
      return;
    }

    if (staffRole === 'dirigente' && !managerSurname.trim()) {
      setError('Inserisci il cognome del dirigente o membro dello staff.');
      return;
    }

    let targetName = '';
    let finalContent = content.trim();

    if (staffRole === 'allenatore') {
      const cName = coachName?.trim() || 'Allenatore';
      targetName = `Mister ${cName} (${teamName})`;
    } else {
      const surname = managerSurname.trim();
      targetName = `Dir. ${surname} (${teamName})`;
      // Inserisci il cognome del dirigente direttamente nella nota
      finalContent = `[Dirigente: ${surname}]\n${finalContent}`;
    }

    onSave({
      id: existingNote?.id,
      targetType: staffRole,
      targetId: teamId,
      targetName,
      content: finalContent,
      priority,
      isPublic,
    });

    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl bg-[#0D0F16] border border-[#212638] shadow-2xl p-5 sm:p-6 text-slate-100 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#1E2333] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#CCFF00]/10 border border-[#CCFF00]/30 text-[#CCFF00]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">
                {existingNote ? 'Modifica Nota Staff / Allenatore' : 'Nuova Nota Staff / Allenatore'}
              </h3>
              <p className="text-xs text-slate-400">
                Profilo arbitrale • <strong className="text-white">{teamName}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-[#141824] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-[#212638] transition-colors cursor-pointer"
            title="Chiudi (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Selettore Soggetto: Allenatore vs Dirigente */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-wider">
              Chi riguarda la nota?
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {/* Opzione 1: Allenatore */}
              <button
                type="button"
                onClick={() => {
                  setStaffRole('allenatore');
                  setError('');
                }}
                className={`p-3 rounded-2xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                  staffRole === 'allenatore'
                    ? 'bg-amber-500/15 border-amber-400 text-white shadow-[0_0_12px_rgba(245,158,11,0.2)] ring-1 ring-amber-400'
                    : 'bg-[#12151E] border-[#212638] text-slate-400 hover:border-slate-600'
                }`}
              >
                <Award className={`w-4 h-4 mt-0.5 shrink-0 ${staffRole === 'allenatore' ? 'text-amber-400' : 'text-slate-500'}`} />
                <div>
                  <div className="font-black text-xs text-white">Allenatore (Mister)</div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">
                    {coachName ? `Mister ${coachName}` : 'Guida tecnica'}
                  </div>
                </div>
              </button>

              {/* Opzione 2: Membro dello Staff / Dirigente */}
              <button
                type="button"
                onClick={() => {
                  setStaffRole('dirigente');
                  setError('');
                }}
                className={`p-3 rounded-2xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                  staffRole === 'dirigente'
                    ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-[0_0_12px_rgba(6,182,212,0.2)] ring-1 ring-cyan-400'
                    : 'bg-[#12151E] border-[#212638] text-slate-400 hover:border-slate-600'
                }`}
              >
                <Users className={`w-4 h-4 mt-0.5 shrink-0 ${staffRole === 'dirigente' ? 'text-cyan-400' : 'text-slate-500'}`} />
                <div>
                  <div className="font-black text-xs text-white">Membro dello Staff</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Dirigente, Prep., Medico...
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Campo Cognome Dirigente (se dirigente selezionato) */}
          {staffRole === 'dirigente' && (
            <div className="p-3.5 rounded-2xl bg-[#090C13] border border-cyan-500/30 space-y-1.5 animate-in fade-in duration-150">
              <label className="block text-[11px] font-bold text-cyan-300 uppercase tracking-wider">
                Cognome del Dirigente / Ruolo nello Staff *
              </label>
              <input
                type="text"
                value={managerSurname}
                onChange={(e) => {
                  setManagerSurname(e.target.value);
                  if (error) setError('');
                }}
                placeholder="es. Rossi (Dirigente Accompagnatore) o Bianchi (Prep. Atletico)"
                className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 transition-all font-medium"
                autoFocus
              />
              <p className="text-[10px] text-slate-400">
                Il cognome del dirigente verrà anteposto direttamente alla nota arbitrale.
              </p>
            </div>
          )}

          {/* Livello di Priorità / Rilevanza Disciplinare */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
              Rilevanza Disciplinare
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPriority('NORMAL')}
                className={`py-2 px-2.5 rounded-xl border text-center font-bold text-[11px] transition-all cursor-pointer ${
                  priority === 'NORMAL'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                    : 'bg-[#11141D] text-slate-400 border-[#212638] hover:border-slate-600'
                }`}
              >
                🟡 Normale
              </button>
              <button
                type="button"
                onClick={() => setPriority('HIGH')}
                className={`py-2 px-2.5 rounded-xl border text-center font-bold text-[11px] transition-all cursor-pointer ${
                  priority === 'HIGH'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-sm'
                    : 'bg-[#11141D] text-slate-400 border-[#212638] hover:border-slate-600'
                }`}
              >
                🔴 Alta (Attenzione)
              </button>
              <button
                type="button"
                onClick={() => setPriority('LOW')}
                className={`py-2 px-2.5 rounded-xl border text-center font-bold text-[11px] transition-all cursor-pointer ${
                  priority === 'LOW'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                    : 'bg-[#11141D] text-slate-400 border-[#212638] hover:border-slate-600'
                }`}
              >
                🟢 Bassa (Info)
              </button>
            </div>
          </div>

          {/* Contenuto della Nota */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
              Note e Osservazioni Comportamentali *
            </label>
            <textarea
              rows={4}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (error) setError('');
              }}
              placeholder={
                staffRole === 'allenatore'
                  ? 'es. Protesta spesso sulle decisioni dell\'assistente n.1. Tende ad uscire dall\'area tecnica nei minuti finali; collaborativo nei chiarimenti a fine gara.'
                  : 'es. Molto polemico dalla panchina sulle rimesse laterali. Richiamato più volte per gesti plateali verso la terna arbitrale.'
              }
              className="w-full bg-[#11141D] border border-[#212638] rounded-xl p-3 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/40 transition-all font-medium resize-none leading-relaxed"
            />
          </div>

          {/* Visibilità */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
              Visibilità
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                  isPublic
                    ? 'bg-[#CCFF00]/10 border-[#CCFF00] text-white shadow-sm'
                    : 'bg-[#11141D] border-[#212638] text-slate-400 hover:border-slate-600'
                }`}
              >
                <Globe className={`w-3.5 h-3.5 shrink-0 ${isPublic ? 'text-[#CCFF00]' : 'text-slate-500'}`} />
                <div>
                  <span className="font-bold text-[11px] block">Pubblica</span>
                  <span className="text-[10px] text-slate-400 block">Condivisa con la rete arbitri</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsPublic(false)}
                className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                  !isPublic
                    ? 'bg-amber-500/10 border-amber-400 text-white shadow-sm'
                    : 'bg-[#11141D] border-[#212638] text-slate-400 hover:border-slate-600'
                }`}
              >
                <Lock className={`w-3.5 h-3.5 shrink-0 ${!isPublic ? 'text-amber-400' : 'text-slate-500'}`} />
                <div>
                  <span className="font-bold text-[11px] block">Privata</span>
                  <span className="text-[10px] text-slate-400 block">Visibile solo a te</span>
                </div>
              </button>
            </div>
          </div>

          {/* Bottoni Salva / Annulla */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#1E2333]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#141824] hover:bg-[#1C2232] text-slate-300 font-bold rounded-xl border border-[#212638] transition-all cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 bg-[#CCFF00] hover:bg-[#D8FF33] text-black font-black rounded-xl shadow-[0_0_12px_rgba(204,255,0,0.35)] transition-all cursor-pointer active:scale-95"
            >
              <Check className="w-4 h-4" /> Salva Nota
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
