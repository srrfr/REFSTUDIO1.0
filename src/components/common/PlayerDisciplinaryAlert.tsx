'use client';

import React from 'react';
import { AlertTriangle, Gavel, Ban, ShieldAlert, FileText, ExternalLink } from 'lucide-react';
import { Player } from '@/types/refstudio';

export interface DisciplinaryInfo {
  isDiffidato: boolean;
  isSqualificato: boolean;
  sanction: string;
  reason: string;
  bulletin: string;
  bulletinUrl?: string;
  competition: string;
}

/**
 * Ricava in modo sicuro e uniforme le informazioni disciplinari del calciatore
 * analizzando sia i dettagli strutturati (disciplinaryDetails) che le note ufficiali e i cartellini.
 */
export function getPlayerDisciplinaryInfo(player: Player): DisciplinaryInfo {
  const isDiffidato = player.disciplinaryStatus === 'DIFFIDATO';
  const isSqualificato = player.disciplinaryStatus === 'SQUALIFICATO';

  let sanction = '';
  let reason = '';
  let bulletin = '';
  let bulletinUrl = player.disciplinaryDetails?.urlComunicato || '';
  let competition = player.disciplinaryDetails?.competizione || 'Campionato Eccellenza';

  if (player.disciplinaryDetails) {
    sanction = player.disciplinaryDetails.sanzione || '';
    reason = player.disciplinaryDetails.motivo || '';
    bulletin = player.disciplinaryDetails.comunicato || '';
  }

  // Se non presente in disciplinaryDetails, estrai dalle refereeNotes formattate
  if ((!sanction || !bulletin) && player.refereeNotes) {
    const match = player.refereeNotes.match(/\[Giudice Sportivo\s+([^\]]+)\]:\s*([^-|]+)(?:-\s*Motivo:\s*([^|]+))?/i);
    if (match) {
      if (!bulletin) bulletin = match[1].trim();
      if (!sanction) sanction = match[2].trim();
      if (!reason && match[3]) reason = match[3].trim();
    }
  }

  // Motivazioni e descrizioni contestuali predefinite se mancanti
  if (isSqualificato) {
    if (!sanction) {
      sanction = player.redCards > 0 ? 'Squalifica per espulsione sul campo' : 'Squalifica deliberata dal Giudice Sportivo';
    }
    if (!reason) {
      reason = player.redCards > 0
        ? 'Cartellino rosso diretto o doppia ammonizione durante la gara'
        : 'Provvedimento disciplinare emesso dal Giudice Sportivo Regionale';
    }
  } else if (isDiffidato) {
    if (!sanction) {
      sanction = 'Ammonizione con diffida (IV infrazione)';
    }
    if (!reason) {
      reason = 'Cumulo di 4 ammonizioni nel Campionato di Eccellenza (al prossimo giallo scatta 1 turno di squalifica)';
    }
  }

  return {
    isDiffidato,
    isSqualificato,
    sanction,
    reason,
    bulletin,
    bulletinUrl,
    competition,
  };
}

interface PlayerDisciplinaryAlertProps {
  player: Player;
  variant?: 'banner' | 'badge' | 'compact' | 'note';
  className?: string;
}

export const PlayerDisciplinaryAlert: React.FC<PlayerDisciplinaryAlertProps> = ({
  player,
  variant = 'banner',
  className = '',
}) => {
  const info = getPlayerDisciplinaryInfo(player);

  if (!info.isDiffidato && !info.isSqualificato) {
    return null;
  }

  // 1. VARIANTE BADGE (Compatto per tabelle, liste rapide e griglia)
  if (variant === 'badge') {
    if (info.isSqualificato) {
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.35)] shrink-0 select-none ${className}`}
          title={`${info.sanction}${info.reason ? ` - ${info.reason}` : ''}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
          <Ban className="w-3 h-3 text-rose-400" />
          <span>Squalificato</span>
        </span>
      );
    }

    if (info.isDiffidato) {
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.35)] shrink-0 select-none animate-pulse ${className}`}
          title="Calciatore diffidato: al prossimo cartellino giallo scatterà 1 turno di squalifica"
        >
          <AlertTriangle className="w-3 h-3 text-amber-400" />
          <span>Diffidato</span>
        </span>
      );
    }
  }

  // 2. VARIANTE COMPACT / NOTE INLINE (Per le card e i preview)
  if (variant === 'compact' || variant === 'note') {
    if (info.isSqualificato) {
      return (
        <div
          className={`p-2.5 rounded-xl bg-gradient-to-r from-rose-950/60 via-rose-900/30 to-[#0F111A] border-2 border-rose-500/60 text-xs space-y-1.5 shadow-[0_0_15px_rgba(244,63,94,0.25)] ${className}`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-black text-rose-400 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <Ban className="w-3.5 h-3.5 text-rose-400" />
              Squalifica Attiva
            </span>
            {info.bulletin && (
              <span className="text-[10px] font-mono text-rose-200 bg-rose-950 border border-rose-600/60 px-2 py-0.5 rounded font-bold">
                {info.bulletin}
              </span>
            )}
          </div>
          <p className="text-[11px] text-white font-extrabold leading-snug">
            {info.sanction}
          </p>
          {info.reason && (
            <div className="pt-1 border-t border-rose-500/25 text-[11px] leading-snug">
              <span className="text-rose-300 font-bold">Nota motivazione: </span>
              <span className="text-slate-200 italic">&ldquo;{info.reason}&rdquo;</span>
            </div>
          )}
        </div>
      );
    }

    if (info.isDiffidato) {
      return (
        <div
          className={`p-2.5 rounded-xl bg-gradient-to-r from-amber-500/25 via-amber-950/40 to-[#121622] border-2 border-amber-400 text-xs shadow-[0_0_16px_rgba(245,158,11,0.35)] ${className}`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-amber-400 text-black shrink-0 animate-bounce">
                <AlertTriangle className="w-3.5 h-3.5 stroke-[3]" />
              </span>
              <div>
                <span className="font-black text-amber-300 uppercase tracking-wider text-[11px] flex items-center gap-1">
                  ⚠️ ALERT DIFFIDA ATTIVA
                </span>
                <span className="text-[10px] text-amber-100 font-medium block">
                  Prossima ammonizione: 1 turno di squalifica
                </span>
              </div>
            </div>
            {info.bulletin && (
              <span className="text-[10px] font-mono text-amber-300 bg-black/60 border border-amber-500/50 px-2 py-0.5 rounded font-bold shrink-0">
                {info.bulletin}
              </span>
            )}
          </div>
        </div>
      );
    }
  }

  // 3. VARIANTE BANNER COMPLETA (Per la modale / scheda dettagliata del calciatore)
  if (info.isSqualificato) {
    return (
      <div
        className={`p-4 rounded-2xl bg-gradient-to-r from-rose-950/70 via-[#181118] to-[#0D0F16] border border-rose-500/60 shadow-[0_0_20px_rgba(244,63,94,0.25)] space-y-2.5 ${className}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-sm">
              <Gavel className="w-4 h-4 text-rose-400" />
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                Provvedimento Disciplinare: Squalifica
              </span>
              <span className="text-[10px] text-slate-400 block">
                {info.competition} • Delibera Ufficiale
              </span>
            </div>
          </div>

          {info.bulletin && (
            <span className="text-[11px] font-mono font-bold text-rose-300 bg-rose-950 border border-rose-600/50 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
              <FileText className="w-3 h-3 text-rose-400" />
              {info.bulletin}
            </span>
          )}
        </div>

        {/* Nota Principale con Sanzione e Motivazione */}
        <div className="p-3 bg-[#0D0F16]/90 rounded-xl border border-rose-500/30 text-xs space-y-1.5">
          <div className="flex items-start gap-2">
            <span className="text-rose-400 font-bold shrink-0">Sanzione:</span>
            <span className="text-white font-black text-sm">{info.sanction}</span>
          </div>

          {info.reason && (
            <div className="flex items-start gap-2 pt-1 border-t border-rose-500/20">
              <span className="text-slate-400 font-bold shrink-0">Motivazione:</span>
              <p className="text-rose-100/90 italic leading-relaxed">
                &ldquo;{info.reason}&rdquo;
              </p>
            </div>
          )}

          {info.bulletinUrl && (
            <div className="pt-1 flex justify-end">
              <a
                href={info.bulletinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-[#CCFF00] hover:underline flex items-center gap-1 font-mono"
              >
                <span>Consulta comunicato ufficiale PDF</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Alert Evidente Diffidato per Scheda Calciatore
  return (
    <div
      className={`p-4 rounded-2xl bg-gradient-to-r from-amber-950/60 via-[#1C1810] to-[#0D0F16] border border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.25)] flex items-start gap-3 ${className}`}
    >
      <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shrink-0 mt-0.5">
        <AlertTriangle className="w-5 h-5 text-amber-400 animate-bounce" />
      </div>

      <div className="flex-1 space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            ⚠️ ALERT: CALCIATORE DIFFIDATO
          </span>
          {info.bulletin ? (
            <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-950/80 border border-amber-600/50 px-2 py-0.5 rounded">
              {info.bulletin}
            </span>
          ) : (
            <span className="text-[10px] font-mono font-bold text-amber-300/80 bg-amber-950/50 border border-amber-700/40 px-2 py-0.5 rounded">
              IV Ammonizione
            </span>
          )}
        </div>

        <p className="text-xs text-white font-bold leading-relaxed">
          {info.sanction || 'Ammonizione con diffida per recidività (IV infrazione)'}
        </p>

        <p className="text-[11px] text-amber-200/80 leading-relaxed">
          {info.reason || 'Attenzione durante la direzione di gara: al prossimo cartellino giallo scatterà automaticamente 1 turno di squalifica nel Campionato di Eccellenza.'}
        </p>
      </div>
    </div>
  );
};
