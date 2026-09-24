'use client';

import React, { useState, useEffect } from 'react';
import { Camera } from 'lucide-react';

/**
 * Pulisce e normalizza gli URL delle immagini incollate dagli utenti:
 * - Rimuove spazi vuoti, apici e virgolette
 * - Converte i link di condivisione di Google Drive in link diretti visualizzabili
 * - Converte i link di condivisione di Dropbox in link diretti visualizzabili
 */
export function formatImageUrl(url?: string): string {
  if (!url) return '';
  let clean = url.trim();
  if (!clean) return '';

  // Rimuovi eventuali apici o virgolette iniziali/finali
  if (
    (clean.startsWith('"') && clean.endsWith('"')) ||
    (clean.startsWith("'") && clean.endsWith("'"))
  ) {
    clean = clean.slice(1, -1).trim();
  }

  // Supporto link Google Drive (es. drive.google.com/file/d/ID/view...)
  const gdriveMatch = clean.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (gdriveMatch) {
    return `https://drive.google.com/uc?export=view&id=${gdriveMatch[1]}`;
  }

  // Supporto link Dropbox
  if (clean.includes('dropbox.com') && clean.includes('dl=0')) {
    clean = clean.replace('dl=0', 'raw=1');
  }

  return clean;
}

interface TeamBadgeProps {
  name: string;
  logoUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  onClick?: () => void;
  showEditOverlay?: boolean;
}

export const TeamBadge: React.FC<TeamBadgeProps> = ({
  name,
  logoUrl,
  size = 'md',
  className = '',
  onClick,
  showEditOverlay = false,
}) => {
  const [imageError, setImageError] = useState(false);
  const formattedUrl = formatImageUrl(logoUrl);

  // Resetta lo stato di errore ogni volta che l'URL cambia o viene aggiornato
  useEffect(() => {
    setImageError(false);
  }, [formattedUrl]);

  const sizeClasses = {
    sm: 'w-7 h-7 text-[10px] rounded-lg',
    md: 'w-9 h-9 text-xs rounded-xl',
    lg: 'w-10 h-10 text-sm rounded-xl',
    xl: 'w-14 h-14 text-xl rounded-2xl',
  };

  const cleanName = name || 'Squadra';
  const initialsCount = size === 'xl' ? 3 : 2;
  const initials = cleanName.substring(0, initialsCount).toUpperCase();

  const hasImage = Boolean(formattedUrl && !imageError);

  return (
    <div
      onClick={onClick}
      className={`relative flex items-center justify-center font-black shrink-0 overflow-hidden select-none border transition-all ${
        onClick ? 'cursor-pointer hover:border-[#CCFF00] group/teambadge active:scale-95' : ''
      } ${
        hasImage
          ? 'bg-[#0E1118] border-[#252B3C] p-1'
          : 'bg-[#141824] border-[#242A3C] text-[#CCFF00]'
      } ${sizeClasses[size]} ${className}`}
      title={cleanName}
    >
      {hasImage ? (
        <img
          key={formattedUrl}
          src={formattedUrl}
          alt={cleanName}
          referrerPolicy="no-referrer"
          className="w-full h-full object-contain"
          onError={() => setImageError(true)}
          loading="lazy"
        />
      ) : (
        <span>{initials}</span>
      )}

      {showEditOverlay && (
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/teambadge:opacity-100 flex items-center justify-center transition-opacity text-white rounded-[inherit]">
          <Camera className="w-3.5 h-3.5 text-[#CCFF00]" />
        </div>
      )}
    </div>
  );
};

interface PlayerBadgeProps {
  firstName?: string;
  lastName: string;
  photoUrl?: string;
  role?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  onClick?: () => void;
  showEditOverlay?: boolean;
}

export const PlayerBadge: React.FC<PlayerBadgeProps> = ({
  firstName = '',
  lastName,
  photoUrl,
  role,
  size = 'md',
  className = '',
  onClick,
  showEditOverlay = false,
}) => {
  const [imageError, setImageError] = useState(false);
  const formattedUrl = formatImageUrl(photoUrl);

  // Resetta lo stato di errore ogni volta che l'URL cambia o viene aggiornato
  useEffect(() => {
    setImageError(false);
  }, [formattedUrl]);

  const sizeClasses = {
    sm: 'w-7 h-7 text-[10px] rounded-lg',
    md: 'w-9 h-9 text-xs rounded-xl',
    lg: 'w-10 h-10 text-sm rounded-xl',
    xl: 'w-12 h-12 text-lg rounded-2xl',
  };

  const initials = lastName ? lastName.substring(0, 2).toUpperCase() : 'CAL';
  const hasImage = Boolean(formattedUrl && !imageError);

  return (
    <div
      onClick={onClick}
      className={`relative flex items-center justify-center font-black shrink-0 overflow-hidden select-none border transition-all ${
        onClick ? 'cursor-pointer hover:border-[#CCFF00] group/playerbadge active:scale-95' : ''
      } ${
        hasImage
          ? 'bg-[#0A0D15] border-[#252B3C]'
          : 'bg-[#CCFF00]/15 border-[#CCFF00]/30 text-[#CCFF00]'
      } ${sizeClasses[size]} ${className}`}
      title={`${firstName} ${lastName}`.trim()}
    >
      {hasImage ? (
        <img
          key={formattedUrl}
          src={formattedUrl}
          alt={`${firstName} ${lastName}`}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
          loading="lazy"
        />
      ) : (
        <span>{initials}</span>
      )}

      {showEditOverlay && (
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/playerbadge:opacity-100 flex items-center justify-center transition-opacity text-white rounded-[inherit]">
          <Camera className="w-3.5 h-3.5 text-[#CCFF00]" />
        </div>
      )}
    </div>
  );
};

interface CoachBadgeProps {
  coachName?: string;
  coachPhotoUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  onClick?: () => void;
  showEditOverlay?: boolean;
}

export const CoachBadge: React.FC<CoachBadgeProps> = ({
  coachName = 'Allenatore',
  coachPhotoUrl,
  size = 'md',
  className = '',
  onClick,
  showEditOverlay = false,
}) => {
  const [imageError, setImageError] = useState(false);
  const formattedUrl = formatImageUrl(coachPhotoUrl);

  // Resetta lo stato di errore ogni volta che l'URL cambia o viene aggiornato
  useEffect(() => {
    setImageError(false);
  }, [formattedUrl]);

  const sizeClasses = {
    sm: 'w-6 h-6 text-[9px] rounded-md',
    md: 'w-8 h-8 text-[11px] rounded-lg',
    lg: 'w-10 h-10 text-xs rounded-xl',
    xl: 'w-12 h-12 text-sm rounded-2xl',
  };

  const initials = coachName ? coachName.substring(0, 2).toUpperCase() : 'AL';
  const hasImage = Boolean(formattedUrl && !imageError);

  return (
    <div
      onClick={onClick}
      className={`relative flex items-center justify-center font-black shrink-0 overflow-hidden select-none border transition-all ${
        onClick ? 'cursor-pointer hover:border-[#CCFF00] group/coachbadge active:scale-95' : ''
      } ${
        hasImage
          ? 'bg-[#0A0D15] border-[#252B3C]'
          : 'bg-[#181D2B] border-[#2B3349] text-amber-300'
      } ${sizeClasses[size]} ${className}`}
      title={coachName}
    >
      {hasImage ? (
        <img
          key={formattedUrl}
          src={formattedUrl}
          alt={coachName}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
          loading="lazy"
        />
      ) : (
        <span>{initials}</span>
      )}

      {showEditOverlay && (
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/coachbadge:opacity-100 flex items-center justify-center transition-opacity text-white rounded-[inherit]">
          <Camera className="w-3.5 h-3.5 text-[#CCFF00]" />
        </div>
      )}
    </div>
  );
};
