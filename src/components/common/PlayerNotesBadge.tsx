'use client';

import React from 'react';
import { FileText, Film } from 'lucide-react';

export interface PlayerNotesBadgeProps {
  textCount?: number;
  videoCount?: number;
  showZero?: boolean;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

/**
 * Badge icona intuitivo per indicare immediatamente se un calciatore
 * ha registrato a suo nome note arbitrali di testo o clip video.
 */
export const PlayerNotesBadge: React.FC<PlayerNotesBadgeProps> = ({
  textCount = 0,
  videoCount = 0,
  showZero = false,
  size = 'sm',
  className = '',
  onClick,
}) => {
  const hasText = textCount > 0;
  const hasVideo = videoCount > 0;
  const hasAny = hasText || hasVideo;

  if (!hasAny && !showZero) {
    return null;
  }

  const tooltipParts: string[] = [];
  if (hasText) {
    tooltipParts.push(`${textCount} ${textCount === 1 ? 'nota testo' : 'note testo'}`);
  }
  if (hasVideo) {
    tooltipParts.push(`${videoCount} ${videoCount === 1 ? 'nota video' : 'note video'}`);
  }
  const tooltip = hasAny
    ? `Appunti registrati sul calciatore: ${tooltipParts.join(' e ')}${onClick ? ' (Clicca per visualizzare)' : ''}`
    : 'Nessuna nota registrata a nome del calciatore';

  const iconSizes = {
    xs: 'w-2.5 h-2.5',
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
  };

  const badgePaddings = {
    xs: 'px-1 py-0.2 text-[9px] gap-0.5',
    sm: 'px-1.5 py-0.5 text-[10px] gap-1',
    md: 'px-2 py-1 text-xs gap-1.5',
  };

  const clickableClasses = onClick
    ? 'cursor-pointer hover:scale-105 active:scale-95 transition-transform'
    : '';

  return (
    <div
      className={`inline-flex items-center gap-1 ${clickableClasses} ${className}`}
      title={tooltip}
      onClick={onClick}
    >
      {/* Icona Nota di Testo */}
      {hasText && (
        <span
          className={`inline-flex items-center font-mono font-black rounded-md bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/35 shadow-[0_0_8px_rgba(204,255,0,0.15)] ${badgePaddings[size]}`}
        >
          <FileText className={`${iconSizes[size]} text-[#CCFF00] shrink-0`} />
          <span>{textCount}</span>
        </span>
      )}

      {/* Icona Nota Video / Clip */}
      {hasVideo && (
        <span
          className={`inline-flex items-center font-mono font-black rounded-md bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/35 shadow-[0_0_8px_rgba(0,229,255,0.15)] ${badgePaddings[size]}`}
        >
          <Film className={`${iconSizes[size]} text-[#00E5FF] shrink-0`} />
          <span>{videoCount}</span>
        </span>
      )}
    </div>
  );
};
