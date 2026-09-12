'use client';

import React, { useState } from 'react';
import { VideoSource } from '@/types/refstudio';
import { Video, X, AlertCircle } from 'lucide-react';

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (videoData: {
    targetType: 'squadra' | 'giocatore' | 'partita';
    targetId: string;
    targetName: string;
    videoSource: VideoSource;
    externalUrl?: string;
    storagePath?: string;
    title: string;
    description?: string;
    timestampMark?: string;
  }) => void;
  initialTargetType?: 'squadra' | 'giocatore' | 'partita';
  initialTargetId?: string;
  initialTargetName?: string;
}

export const VideoModal: React.FC<VideoModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTargetType = 'squadra',
  initialTargetId = '',
  initialTargetName = '',
}) => {
  const [targetType, setTargetType] = useState<'squadra' | 'giocatore' | 'partita'>(initialTargetType);
  const [targetId, setTargetId] = useState(initialTargetId);
  const [targetName, setTargetName] = useState(initialTargetName);
  const [videoSource, setVideoSource] = useState<VideoSource>('YOUTUBE');
  const [externalUrl, setExternalUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timestampMark, setTimestampMark] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !targetName.trim() || (!externalUrl.trim() && videoSource === 'YOUTUBE')) {
      setError('Compila tutti i campi obbligatori (titolo, soggetto, link video).');
      return;
    }

    onSave({
      targetType,
      targetId: targetId.trim() || targetName.toLowerCase().replace(/\s+/g, '-'),
      targetName: targetName.trim(),
      videoSource,
      externalUrl: externalUrl.trim(),
      title: title.trim(),
      description: description.trim(),
      timestampMark: timestampMark.trim(),
    });

    setTitle('');
    setExternalUrl('');
    setDescription('');
    setTimestampMark('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-[#0D0F16] border border-[#212638] shadow-2xl p-4 sm:p-6 text-slate-100">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-[#CCFF00] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-3 bg-[#CCFF00]/10 border border-[#CCFF00]/30 rounded-xl text-[#CCFF00] shadow-[0_0_12px_rgba(204,255,0,0.15)]">
            <Video className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">Aggiungi Clip / Video</h3>
            <p className="text-xs text-slate-400">Collega video YouTube o clip locali per analisi visiva</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">Associa a</label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as any)}
                className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/40 transition-all font-medium"
              >
                <option value="squadra">Squadra</option>
                <option value="giocatore">Giocatore</option>
                <option value="partita">Partita</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">Sorgente Video</label>
              <select
                value={videoSource}
                onChange={(e) => setVideoSource(e.target.value as any)}
                className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/40 transition-all font-medium"
              >
                <option value="YOUTUBE">YouTube (URL / Embed)</option>
                <option value="LOCAL">File Locale (MP4 / WebM)</option>
                <option value="STORAGE">Firebase Storage</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">
              Nome Soggetto / Match
            </label>
            <input
              type="text"
              value={targetName}
              onChange={(e) => {
                setTargetName(e.target.value);
                if (!targetId) setTargetId(e.target.value.toLowerCase().replace(/\s+/g, '-'));
              }}
              placeholder="Es. Vianese Calcio, Fallo di mano al 60..."
              className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/40 transition-all font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">Titolo del Video</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Es. Calci d'angolo difensivi, Simulazione secondo tempo..."
              className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/40 transition-all font-medium"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">
                {videoSource === 'YOUTUBE' ? 'URL Video YouTube' : 'Percorso / URL File'}
              </label>
              <input
                type="text"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/40 transition-all font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">Minuto Episodio</label>
              <input
                type="text"
                value={timestampMark}
                onChange={(e) => setTimestampMark(e.target.value)}
                placeholder="Es. 04:15"
                className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/40 transition-all font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">Note Didattiche / Descrizione</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Cosa osservare nel video (movimento difensivo, fallo con gomito, ecc.)..."
              className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/40 transition-all font-medium leading-relaxed"
            />
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
              className="px-5 py-2 text-xs font-black bg-[#CCFF00] hover:bg-[#D8FF33] text-black rounded-xl shadow-[0_0_15px_rgba(204,255,0,0.35)] transition-all"
            >
              Salva Video
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
