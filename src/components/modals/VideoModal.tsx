'use client';

import React, { useState, useEffect } from 'react';
import { VideoSource } from '@/types/refstudio';
import { Video, X, AlertCircle, UploadCloud, Link as LinkIcon, Film, Image as ImageIcon } from 'lucide-react';
import { MediaDropzone, UploadResult } from '@/components/media/MediaDropzone';

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
    mediaType?: 'video' | 'image';
  }) => void;
  initialTargetType?: 'squadra' | 'giocatore' | 'partita';
  initialTargetId?: string;
  initialTargetName?: string;
  initialUploadedMedia?: UploadResult | null;
}

export const VideoModal: React.FC<VideoModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTargetType = 'squadra',
  initialTargetId = '',
  initialTargetName = '',
  initialUploadedMedia = null,
}) => {
  const [mode, setMode] = useState<'UPLOAD' | 'URL'>('UPLOAD');
  const [targetType, setTargetType] = useState<'squadra' | 'giocatore' | 'partita'>(initialTargetType);
  const [targetId, setTargetId] = useState(initialTargetId);
  const [targetName, setTargetName] = useState(initialTargetName);
  const [videoSource, setVideoSource] = useState<VideoSource>('LOCAL');
  const [externalUrl, setExternalUrl] = useState('');
  const [storagePath, setStoragePath] = useState('');
  const [mediaType, setMediaType] = useState<'video' | 'image'>('video');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timestampMark, setTimestampMark] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTargetType(initialTargetType);
      setTargetId(initialTargetId);
      setTargetName(initialTargetName);
      setError('');

      if (initialUploadedMedia) {
        setMode('UPLOAD');
        setExternalUrl(initialUploadedMedia.url);
        setStoragePath(initialUploadedMedia.localUrl);
        setMediaType(initialUploadedMedia.mediaType);
        setVideoSource('LOCAL');
        if (!title) {
          setTitle(initialUploadedMedia.originalName.replace(/\.[^/.]+$/, ''));
        }
      }
    }
  }, [isOpen, initialTargetType, initialTargetId, initialTargetName, initialUploadedMedia]);

  if (!isOpen) return null;

  const handleMediaUploaded = (result: UploadResult) => {
    setExternalUrl(result.url);
    setStoragePath(result.localUrl);
    setMediaType(result.mediaType);
    setVideoSource('LOCAL');
    setError('');

    // Pre-compila il titolo se vuoto
    if (!title.trim()) {
      setTitle(result.originalName.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleClearMedia = () => {
    setExternalUrl('');
    setStoragePath('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError('Inserisci un titolo per il contenuto multimediale.');
      return;
    }

    if (!targetName.trim()) {
      setError('Indica il soggetto o la partita a cui associare il contenuto.');
      return;
    }

    if (!externalUrl.trim()) {
      setError(
        mode === 'UPLOAD'
          ? 'Trascina o seleziona un file video o immagine dal tuo PC.'
          : 'Inserisci un URL valido (YouTube o file web).'
      );
      return;
    }

    const effectiveSource =
      mode === 'UPLOAD'
        ? 'LOCAL'
        : externalUrl.includes('youtube') || externalUrl.includes('youtu.be')
        ? 'YOUTUBE'
        : videoSource;

    onSave({
      targetType,
      targetId: targetId.trim() || targetName.toLowerCase().replace(/\s+/g, '-'),
      targetName: targetName.trim(),
      videoSource: effectiveSource,
      externalUrl: externalUrl.trim(),
      storagePath: storagePath.trim() || undefined,
      title: title.trim(),
      description: description.trim(),
      timestampMark: timestampMark.trim(),
      mediaType,
    });

    // Reset state
    setTitle('');
    setExternalUrl('');
    setStoragePath('');
    setDescription('');
    setTimestampMark('');
    onClose();
  };

  // Chiudi con tasto Escape
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-lg max-h-[94vh] overflow-y-auto rounded-2xl bg-[#0D0F16] border border-[#212638] shadow-2xl p-4 sm:p-6 text-slate-100"
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
          <div className="p-3 bg-[#FF334B]/10 border border-[#FF334B]/30 rounded-xl text-[#FF334B] shadow-[0_0_12px_rgba(255,51,75,0.2)]">
            <Video className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">Aggiungi Contenuto Multimediale</h3>
            <p className="text-xs text-slate-400">
              Carica video/immagini dal PC o collega un link YouTube per l&apos;analisi arbitrale
            </p>
          </div>
        </div>

        {/* Tab Switcher: Carica da PC vs Link Esterno */}
        <div className="flex p-1 mb-5 rounded-xl bg-[#11141D] border border-[#212638]">
          <button
            type="button"
            onClick={() => {
              setMode('UPLOAD');
              setVideoSource('LOCAL');
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-black rounded-lg transition-all ${
              mode === 'UPLOAD'
                ? 'bg-[#CCFF00] text-black shadow-[0_0_12px_rgba(204,255,0,0.3)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UploadCloud className="w-4 h-4" /> Carica dal PC (Drag & Drop)
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('URL');
              setVideoSource('YOUTUBE');
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-black rounded-lg transition-all ${
              mode === 'URL'
                ? 'bg-[#CCFF00] text-black shadow-[0_0_12px_rgba(204,255,0,0.3)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LinkIcon className="w-4 h-4" /> Link Esterno (YouTube / URL)
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Area Upload o Input URL in base alla modalità */}
          {mode === 'UPLOAD' ? (
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">
                Trascina il tuo file video o immagine
              </label>
              <MediaDropzone
                onUploaded={handleMediaUploaded}
                accept="all"
                currentPreviewUrl={externalUrl}
                onClear={handleClearMedia}
                helperText="Trascina file MP4, WebM, MOV o immagini JPG, PNG dal computer"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">
                    Sorgente Link
                  </label>
                  <select
                    value={videoSource}
                    onChange={(e) => setVideoSource(e.target.value as any)}
                    className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/40 transition-all font-medium"
                  >
                    <option value="YOUTUBE">YouTube (URL / Embed)</option>
                    <option value="LOCAL">URL Diretto (MP4 / WebM / Immagine)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">
                    Tipo Media
                  </label>
                  <select
                    value={mediaType}
                    onChange={(e) => setMediaType(e.target.value as any)}
                    className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/40 transition-all font-medium"
                  >
                    <option value="video">Video</option>
                    <option value="image">Immagine</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">
                  {videoSource === 'YOUTUBE' ? 'URL Video YouTube' : 'URL File Web'}
                </label>
                <input
                  type="text"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... o https://..."
                  className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/40 transition-all font-medium"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">
                Associa a
              </label>
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
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">
                Minuto Episodio
              </label>
              <input
                type="text"
                value={timestampMark}
                onChange={(e) => setTimestampMark(e.target.value)}
                placeholder="Es. 14:20"
                className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/40 transition-all font-medium font-mono"
              />
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
            <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">
              Titolo del Contenuto
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Es. Calci d'angolo difensivi, Simulazione secondo tempo..."
              className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/40 transition-all font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">
              Note Didattiche / Descrizione
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Cosa osservare (movimento difensivo, gomito alto, trattenuta, posizionamento)..."
              className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/40 transition-all font-medium leading-relaxed"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl animate-in fade-in">
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
              Salva Contenuto
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
