'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Users, Award, X, Check, Globe, Trash2, Clipboard, Image as ImageIcon } from 'lucide-react';
import { TeamBadge, PlayerBadge, CoachBadge, formatImageUrl } from '@/components/common/AvatarBadge';

export interface AvatarUrlModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'team' | 'player' | 'coach';
  title: string;
  subtitle?: string;
  currentUrl?: string;
  onSave: (newUrl: string) => void;
  role?: string; // per player role (es. ATT, DIF...)
}

export const AvatarUrlModal: React.FC<AvatarUrlModalProps> = ({
  isOpen,
  onClose,
  type,
  title,
  subtitle,
  currentUrl = '',
  onSave,
  role = 'CEN',
}) => {
  const [url, setUrl] = useState(currentUrl);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    setUrl(currentUrl || '');
  }, [currentUrl, isOpen]);

  // Supporto tasto Escape per chiusura
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

  const handlePasteClipboard = async () => {
    try {
      if (navigator.clipboard) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setUrl(text.trim());
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
        }
      }
    } catch {
      // Ignora errori di permesso clipboard
    }
  };

  const handleClear = () => {
    setUrl('');
  };

  const handleConfirmSave = () => {
    onSave(url.trim());
    onClose();
  };

  const cleanPreviewUrl = formatImageUrl(url);
  const hasUrl = Boolean(cleanPreviewUrl);

  const getModalConfig = () => {
    switch (type) {
      case 'team':
        return {
          icon: <Shield className="w-5 h-5 text-[#CCFF00]" />,
          label: 'Logo Club / Squadra',
          typeLabel: 'Squadra',
          placeholder: 'https://esempio.com/logo-squadra.png',
          previewBadge: (size: 'xl' | 'md' | 'sm') => (
            <TeamBadge name={title} logoUrl={cleanPreviewUrl} size={size} />
          ),
        };
      case 'coach':
        return {
          icon: <Award className="w-5 h-5 text-amber-400" />,
          label: 'Foto Profilo Allenatore',
          typeLabel: 'Staff Tecnico',
          placeholder: 'https://esempio.com/foto-mister.jpg',
          previewBadge: (size: 'xl' | 'md' | 'sm') => (
            <CoachBadge coachName={title} coachPhotoUrl={cleanPreviewUrl} size={size} />
          ),
        };
      case 'player':
      default:
        return {
          icon: <Users className="w-5 h-5 text-[#CCFF00]" />,
          label: 'Foto Calciatore',
          typeLabel: 'Calciatore',
          placeholder: 'https://esempio.com/foto-calciatore.jpg',
          previewBadge: (size: 'xl' | 'md' | 'sm') => {
            const parts = title.trim().split(' ');
            const lastName = parts.length > 1 ? parts.slice(1).join(' ') : parts[0] || 'Calciatore';
            const firstName = parts.length > 1 ? parts[0] : '';
            return (
              <PlayerBadge
                firstName={firstName}
                lastName={lastName}
                photoUrl={cleanPreviewUrl}
                role={role}
                size={size}
              />
            );
          },
        };
    }
  };

  const config = getModalConfig();

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl bg-[#0D0F16] border border-[#212638] shadow-2xl p-6 text-slate-100 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1E2333] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#141824] border border-[#242A3C] flex items-center justify-center shadow-inner">
              {config.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#161B26] text-[#CCFF00] border border-[#CCFF00]/30 uppercase">
                  {config.typeLabel}
                </span>
                {subtitle && <span className="text-xs text-slate-400">{subtitle}</span>}
              </div>
              <h3 className="text-lg font-black text-white mt-0.5">{title}</h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-[#141824] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-[#212638] transition-all cursor-pointer"
            title="Chiudi (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form URL Input */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[#CCFF00]" />
              {config.label} (URL immagine web)
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePasteClipboard}
                className="text-[11px] font-semibold text-slate-400 hover:text-[#CCFF00] flex items-center gap-1 px-2 py-1 rounded bg-[#141824] border border-[#212638] hover:border-[#CCFF00]/40 transition-colors"
                title="Incolla dagli appunti"
              >
                <Clipboard className="w-3 h-3" />
                {isCopied ? 'Incollato!' : 'Incolla'}
              </button>
              {url && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-[11px] font-semibold text-slate-400 hover:text-rose-400 flex items-center gap-1 px-2 py-1 rounded bg-[#141824] border border-[#212638] hover:border-rose-500/40 transition-colors"
                  title="Pulisci campo"
                >
                  <Trash2 className="w-3 h-3" />
                  Svuota
                </button>
              )}
            </div>
          </div>

          <div className="relative">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleConfirmSave();
                }
              }}
              placeholder={config.placeholder}
              className="w-full bg-[#12151E] border border-[#23293D] focus:border-[#CCFF00] rounded-xl p-3 text-xs text-white placeholder:text-slate-600 focus:outline-none transition-colors shadow-inner"
              autoFocus
            />
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            💡 <strong>Suggerimento:</strong> Puoi copiare l&apos;indirizzo di qualsiasi immagine dal web
            (tasto destro sull&apos;immagine &gt; <em>&quot;Copia indirizzo immagine&quot;</em>). Formati supportati: PNG, JPG, WebP, SVG e link Google Drive/Dropbox.
          </p>
        </div>

        {/* Live Multi-Size Preview */}
        <div className="p-4 rounded-2xl bg-[#11141D] border border-[#212638] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-[#CCFF00]" />
              Anteprima Immediata nel Riquadro
            </span>
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                hasUrl
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-[#181D2B] text-slate-400 border border-[#2B3349]'
              }`}
            >
              {hasUrl ? '✓ Immagine Caricata' : 'Iniziali Predefinite'}
            </span>
          </div>

          {/* Render Badges in XL, MD, SM sizes */}
          <div className="flex items-center justify-around p-3 bg-[#0A0D15] rounded-xl border border-[#1A1F2C]">
            <div className="flex flex-col items-center gap-1.5">
              <div className="p-1 rounded-2xl bg-[#141824]/50 border border-[#212638]">
                {config.previewBadge('xl')}
              </div>
              <span className="text-[10px] font-mono text-slate-500 uppercase font-bold">Grande (XL)</span>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <div className="p-1 rounded-xl bg-[#141824]/50 border border-[#212638]">
                {config.previewBadge('md')}
              </div>
              <span className="text-[10px] font-mono text-slate-500 uppercase font-bold">Medio (MD)</span>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <div className="p-1 rounded-lg bg-[#141824]/50 border border-[#212638]">
                {config.previewBadge('sm')}
              </div>
              <span className="text-[10px] font-mono text-slate-500 uppercase font-bold">Piccolo (SM)</span>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="pt-2 border-t border-[#1C2130] flex flex-wrap items-center justify-between gap-2">
          {currentUrl ? (
            <button
              type="button"
              onClick={() => {
                onSave('');
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Rimuovi e usa Iniziali
            </button>
          ) : (
            <span className="text-[11px] text-slate-500 italic">
              Se non viene impostata alcuna foto, verranno mostrate le iniziali.
            </span>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#141824] hover:bg-[#1E2435] text-slate-300 text-xs font-bold rounded-xl border border-[#212638] transition-all cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleConfirmSave}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#CCFF00] hover:bg-[#D8FF33] text-black text-xs font-black rounded-xl shadow-[0_0_15px_rgba(204,255,0,0.35)] transition-all cursor-pointer active:scale-95"
            >
              <Check className="w-4 h-4" /> Salva Immagine
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
