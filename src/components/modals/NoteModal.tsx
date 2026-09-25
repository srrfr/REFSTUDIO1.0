'use client';

import React, { useState, useEffect } from 'react';
import { NoteTargetType, Note } from '@/types/refstudio';
import { FileText, X, AlertCircle, Globe, Lock, ShieldAlert, Paperclip, Film, Image as ImageIcon, Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { MediaDropzone, UploadResult } from '@/components/media/MediaDropzone';

interface NoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (noteData: {
    id?: string;
    authorId?: string;
    authorName?: string;
    authorRole?: string;
    authorAvatar?: string;
    authorSection?: string;
    isPublic: boolean;
    targetType: NoteTargetType;
    targetId: string;
    targetName: string;
    content: string;
    priority: 'LOW' | 'NORMAL' | 'HIGH';
    attachments: string[];
  }) => void;
  initialTargetType?: NoteTargetType;
  initialTargetId?: string;
  initialTargetName?: string;
  existingNote?: Note | null;
}

export const NoteModal: React.FC<NoteModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTargetType = 'squadra',
  initialTargetId = '',
  initialTargetName = '',
  existingNote = null,
}) => {
  const { user } = useAuth();

  const [targetType, setTargetType] = useState<NoteTargetType>(initialTargetType);
  const [targetId, setTargetId] = useState(initialTargetId);
  const [targetName, setTargetName] = useState(initialTargetName);
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH'>('NORMAL');
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [error, setError] = useState('');

  // Verifica se l'utente corrente è il proprietario della nota in caso di modifica
  const isOwner = Boolean(
    !existingNote ||
    !existingNote.authorId ||
    (user?.username && existingNote.authorId.toLowerCase().trim() === user.username.toLowerCase().trim()) ||
    user?.role === 'admin'
  );

  useEffect(() => {
    if (existingNote) {
      setTargetType(existingNote.targetType || initialTargetType);
      setTargetId(existingNote.targetId || initialTargetId);
      setTargetName(existingNote.targetName || initialTargetName);
      setContent(existingNote.content || '');
      setPriority(existingNote.priority || 'NORMAL');
      setIsPublic(existingNote.isPublic !== false);
      const rawAtts = existingNote.attachments || [];
      const cleanAtts = Array.isArray(rawAtts)
        ? rawAtts
            .map((a: any) => (typeof a === 'string' ? a : a?.url || ''))
            .filter((url: string) => typeof url === 'string' && url.trim().length > 0)
        : [];
      setAttachments(cleanAtts);
    } else {
      setTargetType(initialTargetType);
      setTargetId(initialTargetId);
      setTargetName(initialTargetName);
      setContent('');
      setPriority('NORMAL');
      setIsPublic(true);
      setAttachments([]);
    }
    setError('');
  }, [existingNote, isOpen, initialTargetType, initialTargetId, initialTargetName]);

  // Chiudi con tasto Escape (deve trovarsi PRIMA di qualsiasi early return per rispettare le Rules of Hooks)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAddAttachment = () => {
    if (attachmentUrl.trim()) {
      setAttachments([...attachments, attachmentUrl.trim()]);
      setAttachmentUrl('');
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isOwner) {
      setError('Solo il proprietario autore può modificare questa nota.');
      return;
    }

    if (!content.trim() || !targetName.trim()) {
      setError('Inserisci il nome del destinatario e il testo della nota.');
      return;
    }

    onSave({
      id: existingNote?.id,
      authorId: existingNote ? existingNote.authorId : (user?.username || 'samueleromini'),
      authorName: existingNote ? existingNote.authorName : (user?.displayName || 'Arbitro'),
      authorRole: existingNote ? existingNote.authorRole : (user?.refereeRole || 'AE'),
      authorAvatar: existingNote ? existingNote.authorAvatar : (user?.avatarUrl || ''),
      authorSection: existingNote ? existingNote.authorSection : (user?.sectionAia || ''),
      isPublic,
      targetType,
      targetId: targetId.trim() || targetName.toLowerCase().replace(/\s+/g, '-'),
      targetName: targetName.trim(),
      content: content.trim(),
      priority,
      attachments,
    });

    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-[#0D0F16] border border-[#212638] shadow-2xl p-4 sm:p-6 text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-[#141824] transition-colors cursor-pointer active:scale-95 z-20"
          title="Chiudi (Esc)"
          aria-label="Chiudi"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-3 bg-[#CCFF00]/10 border border-[#CCFF00]/30 rounded-xl text-[#CCFF00] shadow-[0_0_12px_rgba(204,255,0,0.15)]">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">
              {existingNote ? 'Modifica Nota Arbitrale' : 'Nuova Nota Arbitrale'}
            </h3>
            <p className="text-xs text-slate-400">
              {existingNote
                ? 'Aggiorna le osservazioni riservate per questo soggetto'
                : 'Archivia osservazioni confidenziali per la direzione di gara'}
            </p>
          </div>
        </div>

        {/* Author info */}
        {(() => {
          const authorName = existingNote?.authorName || user?.displayName || 'Arbitro';
          const authorRole = existingNote?.authorRole || user?.refereeRole || 'AE';
          const authorSection = existingNote?.authorSection || user?.sectionAia || 'Sezione AIA';
          const authorUsername = existingNote?.authorId || user?.username || 'samueleromini';
          const authorAvatar = existingNote?.authorAvatar || user?.avatarUrl || '';
          const authorInitial = (typeof authorName === 'string' && authorName.trim() ? authorName.trim().charAt(0) : 'A').toUpperCase();

          return (
            <div className="mb-4 p-3 rounded-2xl bg-[#11141D] border border-[#212638] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#181C28] border border-[#CCFF00]/40 flex items-center justify-center text-[#CCFF00] text-xs font-black overflow-hidden shadow-sm">
                  {authorAvatar ? (
                    <img
                      src={authorAvatar}
                      alt={authorName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{authorInitial}</span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">
                      {authorName}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-black bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/30">
                      {authorRole}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    {authorSection} • Proprietario nota
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono text-slate-500">
                @{authorUsername}
              </span>
            </div>
          );
        })()}

        {!isOwner && (
          <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              <strong>Nota di sola lettura:</strong> creata da {existingNote?.authorName || existingNote?.authorId}. Solo il proprietario può modificarla o eliminarla.
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Visibilità Nota: Pubblica vs Privata */}
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">
              Visibilità & Condivisione in Rete
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={!isOwner}
                onClick={() => setIsPublic(true)}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                  isPublic
                    ? 'bg-[#CCFF00]/10 border-[#CCFF00] text-white shadow-[0_0_12px_rgba(204,255,0,0.15)] ring-1 ring-[#CCFF00]'
                    : 'bg-[#11141D] border-[#212638] text-slate-400 hover:border-slate-600'
                }`}
              >
                <Globe className={`w-4 h-4 mt-0.5 shrink-0 ${isPublic ? 'text-[#CCFF00]' : 'text-slate-500'}`} />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-white">Pubblica</span>
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-[#CCFF00]/20 text-[#CCFF00]">
                      Tutti
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                    Visibile a tutti i colleghi arbitri in tempo reale
                  </p>
                </div>
              </button>

              <button
                type="button"
                disabled={!isOwner}
                onClick={() => setIsPublic(false)}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                  !isPublic
                    ? 'bg-amber-500/10 border-amber-400 text-white shadow-[0_0_12px_rgba(245,158,11,0.15)] ring-1 ring-amber-400'
                    : 'bg-[#11141D] border-[#212638] text-slate-400 hover:border-slate-600'
                }`}
              >
                <Lock className={`w-4 h-4 mt-0.5 shrink-0 ${!isPublic ? 'text-amber-400' : 'text-slate-500'}`} />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-white">Privata</span>
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
                      Solo Tu
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                    Visibile esclusivamente a te sul tuo account
                  </p>
                </div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">Tipo Destinatario</label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as NoteTargetType)}
                className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/40 transition-all font-medium"
              >
                <option value="squadra">Squadra</option>
                <option value="giocatore">Giocatore</option>
                <option value="allenatore">Allenatore</option>
                <option value="dirigente">Dirigente</option>
                <option value="partita">Partita</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">Priorità / Rilevanza</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/40 transition-all font-medium"
              >
                <option value="LOW">Bassa (Info di contorno)</option>
                <option value="NORMAL">Normale (Rilevazione di gara)</option>
                <option value="HIGH">Alta (Attenzione disciplinare)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">
              Nome Soggetto / Partita
            </label>
            <input
              type="text"
              value={targetName}
              onChange={(e) => {
                setTargetName(e.target.value);
                if (!targetId) setTargetId(e.target.value.toLowerCase().replace(/\s+/g, '-'));
              }}
              placeholder="Es. Vianese Calcio, Salvatore Ascone..."
              className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/40 transition-all font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">Contenuto Nota</label>
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Descrivi l'episodio, l'atteggiamento verbale o le dinamiche tattiche rilevanti..."
              className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/40 transition-all font-medium leading-relaxed"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                Allegati Multimediali (Foto, Referti o Video)
              </label>
              <span className="text-[10px] text-slate-500 font-mono">
                {attachments.length} {attachments.length === 1 ? 'allegato' : 'allegati'}
              </span>
            </div>

            {/* Drag & Drop uploader */}
            <MediaDropzone
              onUploaded={(res) => {
                setAttachments([...attachments, res.url]);
              }}
              accept="all"
              compact={true}
              helperText="Trascina foto del referto, immagini dell'episodio o clip video dal PC"
            />

            {/* Inserimento manuale link esterno opzionale */}
            <div className="mt-2.5 flex gap-2">
              <input
                type="text"
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
                placeholder="Oppure incolla un URL esterno..."
                className="flex-1 bg-[#11141D] border border-[#212638] rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/40 transition-all font-medium"
              />
              <button
                type="button"
                onClick={handleAddAttachment}
                className="px-3 py-1.5 bg-[#161B28] hover:bg-[#1F2538] border border-[#242C40] rounded-xl text-xs font-bold text-slate-200 transition-all hover:text-white flex-shrink-0 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Aggiungi URL
              </button>
            </div>

            {/* Galleria allegati inseriti */}
            {attachments.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {attachments.map((att, i) => {
                  const attStr = typeof att === 'string' ? att : (att as any)?.url || '';
                  const isImg = Boolean(attStr.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i));
                  const isVid = Boolean(attStr.match(/\.(mp4|webm|mov|mkv)(\?.*)?$/i) || attStr.includes('/videos/'));
                  const fileName = (attStr.split('/').pop() || '').split('?')[0] || `Allegato ${i + 1}`;

                  return (
                    <div
                      key={i}
                      className="relative rounded-xl bg-[#11141D] border border-[#212638] p-2 flex items-center gap-2 group hover:border-[#CCFF00]/40 transition-all"
                    >
                      <div className="w-10 h-10 rounded-lg bg-black/60 border border-[#282F42] overflow-hidden flex items-center justify-center flex-shrink-0">
                        {isImg ? (
                          <img src={attStr} alt="Allegato" className="w-full h-full object-cover" />
                        ) : isVid ? (
                          <Film className="w-4 h-4 text-[#FF334B]" />
                        ) : (
                          <Paperclip className="w-4 h-4 text-[#CCFF00]" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <span className="block text-[11px] font-bold text-white truncate" title={fileName}>
                          {fileName}
                        </span>
                        <span className="text-[9px] font-mono text-slate-400">
                          {isImg ? 'Immagine' : isVid ? 'Video' : 'File'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(i)}
                        className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Rimuovi allegato"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2.5 border-t border-[#1C2130]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold bg-[#141824] hover:bg-[#1E2435] text-slate-300 rounded-xl border border-[#212638] transition-all"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={!isOwner}
              className="px-5 py-2 text-xs font-black bg-[#CCFF00] hover:bg-[#D8FF33] disabled:bg-[#151926] disabled:text-slate-600 disabled:cursor-not-allowed text-black rounded-xl shadow-[0_0_15px_rgba(204,255,0,0.35)] transition-all"
            >
              {existingNote ? 'Salva Modifiche' : 'Salva Nota'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
