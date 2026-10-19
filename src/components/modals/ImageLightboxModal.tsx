'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ZoomIn,
  ZoomOut,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  User,
  Shield,
  Award,
} from 'lucide-react';
import { RoleBadge } from '@/components/common/RoleBadge';

export interface ImageLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title: string;
  subtitle?: string;
  role?: string;
  category?: 'player' | 'coach' | 'team';
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  title,
  subtitle,
  role,
  category = 'player',
}) => {
  const [mounted, setMounted] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Resetta lo stato di zoom e caricamento quando cambia l'immagine o si apre la modale
  useEffect(() => {
    if (isOpen) {
      setIsZoomed(false);
      setIsLoading(true);
      setHasError(false);
      setIsCopied(false);
    }
  }, [isOpen, imageUrl]);

  // Gestione tastiera: ESC per chiudere, tasti + e - per zoom
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        setIsZoomed(true);
      } else if (e.key === '-') {
        setIsZoomed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Blocca lo scroll del body durante l'apertura
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!mounted || !isOpen || !imageUrl) return null;

  const handleCopyUrl = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(imageUrl);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      }
    } catch {
      // Ignora errori clipboard
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Foto ingrandita di ${title}`}
    >
      <div
        className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl bg-[#0D0F16]/95 border border-[#212638] shadow-[0_20px_50px_rgba(0,0,0,0.85)] overflow-hidden backdrop-blur-xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#1E2333] bg-[#0A0D15]/80">
          <div className="flex items-center gap-3 min-w-0 pr-3">
            {category === 'player' && role && (
              <RoleBadge role={role} />
            )}
            {category === 'coach' && (
              <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1 shrink-0">
                <Award className="w-3.5 h-3.5" /> Mister
              </span>
            )}
            {category === 'team' && (
              <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/30 flex items-center gap-1 shrink-0">
                <Shield className="w-3.5 h-3.5" /> Squadra
              </span>
            )}

            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black text-white truncate">
                {title}
              </h3>
              {subtitle && (
                <p className="text-xs text-slate-400 truncate mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Toggle Zoom button */}
            <button
              type="button"
              onClick={() => setIsZoomed((prev) => !prev)}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isZoomed
                  ? 'bg-[#CCFF00]/20 text-[#CCFF00] border-[#CCFF00]/40'
                  : 'bg-[#141824] hover:bg-[#1C2232] text-slate-300 border-[#252B3C]'
              }`}
              title={isZoomed ? 'Riduci zoom (1x)' : 'Ingrandisci zoom'}
              aria-label={isZoomed ? 'Riduci zoom' : 'Ingrandisci zoom'}
            >
              {isZoomed ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
            </button>

            {/* Copy URL */}
            <button
              type="button"
              onClick={handleCopyUrl}
              className="p-2 rounded-xl bg-[#141824] hover:bg-[#1C2232] text-slate-300 border border-[#252B3C] transition-all cursor-pointer"
              title="Copia link immagine"
              aria-label="Copia link immagine"
            >
              {isCopied ? (
                <Check className="w-4 h-4 text-[#CCFF00]" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>

            {/* Open Original in New Tab */}
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl bg-[#141824] hover:bg-[#1C2232] text-slate-300 border border-[#252B3C] transition-all cursor-pointer"
              title="Apri immagine originale in una nuova scheda"
              aria-label="Apri immagine originale"
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-[#141824] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-[#252B3C] hover:border-rose-500/40 transition-all cursor-pointer ml-1"
              title="Chiudi visualizzatore (Esc)"
              aria-label="Chiudi visualizzatore"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Image Canvas */}
        <div className="relative flex-1 min-h-[300px] max-h-[70vh] flex items-center justify-center p-3 sm:p-5 bg-[#06080D] overflow-auto select-none rounded-2xl m-3 border border-[#191E2C]">
          {/* Loading state */}
          {isLoading && !hasError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#06080D] z-10">
              <Loader2 className="w-8 h-8 text-[#CCFF00] animate-spin" />
              <span className="text-xs text-slate-400 font-mono">Caricamento foto in alta risoluzione...</span>
            </div>
          )}

          {/* Error fallback */}
          {hasError ? (
            <div className="flex flex-col items-center justify-center gap-3 p-6 text-center max-w-sm">
              <AlertCircle className="w-10 h-10 text-rose-400" />
              <p className="text-sm font-bold text-white">Impossibile caricare l&apos;immagine</p>
              <p className="text-xs text-slate-400">
                Il link potrebbe essere scaduto o non consentire l&apos;incorporamento diretto.
              </p>
              <a
                href={imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#CCFF00] text-black font-bold text-xs hover:bg-[#D9FF33] transition-colors mt-2"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Apri URL sorgente
              </a>
            </div>
          ) : (
            <div className="relative flex items-center justify-center w-full h-full">
              <img
                key={imageUrl}
                src={imageUrl}
                alt={title}
                referrerPolicy="no-referrer"
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setHasError(true);
                }}
                onClick={() => setIsZoomed((prev) => !prev)}
                className={`max-h-[66vh] max-w-full object-contain rounded-xl transition-all duration-300 ease-out shadow-2xl ${
                  isZoomed
                    ? 'scale-125 sm:scale-150 cursor-zoom-out'
                    : 'cursor-zoom-in hover:opacity-95'
                }`}
                title={isZoomed ? 'Clicca per ridurre' : 'Clicca per ingrandire'}
              />
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#1E2333] bg-[#0A0D15]/80 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-[#CCFF00] animate-pulse" />
            <span className="font-mono">
              {category === 'player'
                ? 'Foto Calciatore'
                : category === 'coach'
                ? 'Foto Allenatore'
                : 'Stemma Squadra'}
            </span>
          </div>
          <div className="text-slate-500 hidden sm:block">
            Clicca sulla foto per zoomare • Premi <kbd className="px-1.5 py-0.5 rounded bg-[#181D2B] border border-[#2B3448] text-slate-300 font-mono text-[10px]">Esc</kbd> per chiudere
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
