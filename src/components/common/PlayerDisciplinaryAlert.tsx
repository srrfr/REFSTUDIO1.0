'use client';

import React from 'react';
import {
  AlertTriangle,
  Gavel,
  Ban,
  ShieldAlert,
  FileText,
  ExternalLink,
  History,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { Player, PlayerDisciplinaryDetail } from '@/types/refstudio';

export interface DisciplinaryInfo {
  isDiffidato: boolean;
  isSqualificato: boolean;
  sanction: string;
  reason: string;
  bulletin: string;
  bulletinUrl?: string;
  competition: string;
  giornateResidue?: number;
  giornateSqualifica?: number;
  giornateScontate?: number;
  pastSanctions: PlayerDisciplinaryDetail[];
}

/**
 * Ricava in modo sicuro e uniforme le informazioni disciplinari del calciatore
 * analizzando sia i dettagli strutturati (disciplinaryDetails, pastSanctions)
 * che le note ufficiali e i cartellini.
 */
export function getPlayerDisciplinaryInfo(player: Player): DisciplinaryInfo {
  const isDiffidato = player.disciplinaryStatus === 'DIFFIDATO';
  const isSqualificato = player.disciplinaryStatus === 'SQUALIFICATO';

  let sanction = '';
  let reason = '';
  let bulletin = '';
  let bulletinUrl = player.disciplinaryDetails?.urlComunicato || '';
  let competition = player.disciplinaryDetails?.competizione || 'Campionato Eccellenza';
  let giornateResidue = player.disciplinaryDetails?.giornateResidue;
  let giornateSqualifica = player.disciplinaryDetails?.giornateSqualifica;
  let giornateScontate = player.disciplinaryDetails?.giornateScontate;

  if (player.disciplinaryDetails) {
    sanction = player.disciplinaryDetails.sanzione || '';
    reason = player.disciplinaryDetails.motivo || '';
    bulletin = player.disciplinaryDetails.comunicato || '';
  }

  // Se non presente in disciplinaryDetails, estrai dalle refereeNotes formattate
  if ((!sanction || !bulletin) && player.refereeNotes) {
    const match = player.refereeNotes.match(
      /\[Giudice Sportivo\s+([^\]]+)\]:\s*([^-|]+)(?:-\s*Motivo:\s*([^|]+))?/i
    );
    if (match) {
      if (!bulletin) bulletin = match[1].trim();
      if (!sanction) sanction = match[2].trim();
      if (!reason && match[3]) reason = match[3].trim();
    }
  }

  // Estrazione squalifiche pregresse (scontate)
  const pastSanctions: PlayerDisciplinaryDetail[] = [];

  // 1. Dati già salvati in player.pastSanctions
  if (Array.isArray(player.pastSanctions)) {
    for (const ps of player.pastSanctions) {
      pastSanctions.push(ps);
    }
  }

  // 2. Integrazione dalle refereeNotes formattate per squalifiche pregresse/scontate
  if (player.refereeNotes) {
    const regex = /\[Giudice Sportivo\s+([^\]]+?)\s*-\s*Scontata\]:\s*([^-|]+)(?:-\s*Motivo:\s*([^|]+))?/gi;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(player.refereeNotes)) !== null) {
      const bulletinText = m[1].trim();
      const sanctionText = m[2].trim();
      const reasonText = m[3] ? m[3].trim() : '';

      const alreadyExists = pastSanctions.some(
        (p) =>
          p.comunicato?.toLowerCase() === bulletinText.toLowerCase() &&
          p.sanzione?.toLowerCase() === sanctionText.toLowerCase()
      );

      if (!alreadyExists) {
        pastSanctions.push({
          tipo: 'SQUALIFICA',
          sanzione: sanctionText,
          motivo: reasonText,
          comunicato: bulletinText,
          competizione: 'Campionato Eccellenza',
          scontata: true,
        });
      }
    }
  }

  // Motivazioni e descrizioni contestuali predefinite se mancanti
  if (isSqualificato) {
    if (!sanction) {
      sanction =
        player.redCards > 0
          ? 'Squalifica per espulsione sul campo'
          : 'Squalifica deliberata dal Giudice Sportivo';
    }
    if (!reason) {
      reason =
        player.redCards > 0
          ? 'Cartellino rosso diretto o doppia ammonizione durante la gara'
          : 'Provvedimento disciplinare emesso dal Giudice Sportivo Regionale';
    }
  } else if (isDiffidato) {
    if (!sanction) {
      sanction = 'Ammonizione con diffida (IV infrazione)';
    }
    if (!reason) {
      reason =
        'Cumulo di 4 ammonizioni nel Campionato di Eccellenza (al prossimo giallo scatta 1 turno di squalifica)';
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
    giornateResidue,
    giornateSqualifica,
    giornateScontate,
    pastSanctions,
  };
}

export interface SeverePastSanctionInfo {
  hasSevere: boolean;
  sanction: PlayerDisciplinaryDetail;
  giornate?: number;
  isTimeInhibition: boolean;
  sanzione: string;
  motivo?: string;
  comunicato?: string;
  badgeLabel: string;
}

/**
 * Verifica se il calciatore ha subito espulsioni passate di almeno 2 giornate
 * oppure inibizioni/sanzioni a tempo.
 */
export function getPlayerSeverePastSanction(player: Player): SeverePastSanctionInfo | null {
  const info = getPlayerDisciplinaryInfo(player);

  for (const ps of info.pastSanctions) {
    const sanzUp = String(ps.sanzione || '').toUpperCase();
    const isTimeInhibition =
      sanzUp.includes('INIBIZIONE') ||
      sanzUp.includes('A TEMPO') ||
      sanzUp.includes('A MESI') ||
      sanzUp.includes('FINO AL');

    let gare = ps.giornateSqualifica || 0;
    if (!gare) {
      if (sanzUp.includes('TRE GARE')) gare = 3;
      else if (sanzUp.includes('DUE GARE')) gare = 2;
      else {
        const m = sanzUp.match(/(\d+)\s*GARE/);
        gare = m ? parseInt(m[1], 10) : 0;
      }
    }

    if (gare >= 2 || isTimeInhibition) {
      return {
        hasSevere: true,
        sanction: ps,
        giornate: gare || undefined,
        isTimeInhibition,
        sanzione: ps.sanzione,
        motivo: ps.motivo,
        comunicato: ps.comunicato,
        badgeLabel: isTimeInhibition ? 'Inibizione' : `${gare}G`,
      };
    }
  }

  return null;
}

export interface PlayerSevereHistoryIconProps {
  player: Player;
  className?: string;
  showText?: boolean;
}

/**
 * Piccola icona non invadente che segnala se il calciatore ha ricevuto
 * espulsioni passate di almeno 2 giornate (oppure inibizioni a tempo).
 */
export const PlayerSevereHistoryIcon: React.FC<PlayerSevereHistoryIconProps> = ({
  player,
  className = '',
  showText = true,
}) => {
  const severe = getPlayerSeverePastSanction(player);
  if (!severe) return null;

  const tooltip = `Precedente disciplinare grave: ${severe.sanzione}${
    severe.comunicato ? ` (${severe.comunicato})` : ''
  }${severe.motivo ? ` • Motivo: ${severe.motivo}` : ''}`;

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[10px] font-bold tracking-tight shadow-sm transition-all cursor-help shrink-0 select-none ${className}`}
      title={tooltip}
      aria-label={tooltip}
    >
      <ShieldAlert className="w-3 h-3 text-amber-400 shrink-0" />
      {showText && (
        <span className="font-mono text-[9px] uppercase font-bold text-amber-300">
          {severe.badgeLabel}
        </span>
      )}
    </span>
  );
};

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

  // 1. VARIANTE BADGE (Compatto per tabelle, liste rapide e griglia)
  if (variant === 'badge') {
    const severe = getPlayerSeverePastSanction(player);
    const severeIcon = severe ? (
      <PlayerSevereHistoryIcon player={player} showText={true} />
    ) : null;

    if (info.isSqualificato) {
      const label =
        info.giornateResidue && info.giornateSqualifica && info.giornateResidue < info.giornateSqualifica
          ? `Squalificato (${info.giornateResidue} residua)`
          : 'Squalificato';
      return (
        <span className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.35)] shrink-0 select-none"
            title={`${info.sanction}${info.reason ? ` - ${info.reason}` : ''}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
            <Ban className="w-3 h-3 text-rose-400" />
            <span>{label}</span>
          </span>
          {severeIcon}
        </span>
      );
    }

    if (info.isDiffidato) {
      return (
        <span className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.35)] shrink-0 select-none animate-pulse"
            title="Calciatore diffidato: al prossimo cartellino giallo scatterà 1 turno di squalifica"
          >
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span>Diffidato</span>
          </span>
          {severeIcon}
        </span>
      );
    }

    // Se il calciatore non ha sanzioni attive ma ha un precedente grave (>=2 giornate o inibizione):
    if (severeIcon) {
      return severeIcon;
    }

    return null;
  }

  // 2. VARIANTE COMPACT / NOTE INLINE (Per le card e i preview)
  if (variant === 'compact' || variant === 'note') {
    if (info.isSqualificato) {
      const headerTitle =
        info.giornateResidue && info.giornateSqualifica && info.giornateResidue < info.giornateSqualifica
          ? `Squalifica Attiva (${info.giornateResidue} gara residua su ${info.giornateSqualifica})`
          : 'Squalifica Attiva';
      return (
        <div
          className={`p-2.5 rounded-xl bg-gradient-to-r from-rose-950/60 via-rose-900/30 to-[#0F111A] border-2 border-rose-500/60 text-xs space-y-1.5 shadow-[0_0_15px_rgba(244,63,94,0.25)] ${className}`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-black text-rose-400 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <Ban className="w-3.5 h-3.5 text-rose-400" />
              {headerTitle}
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

    return null;
  }

  // 3. VARIANTE BANNER COMPLETA (Per la modale / scheda dettagliata del calciatore)
  // Se non ci sono né provvedimenti attivi né sanzioni pregresse, non mostrare nulla
  if (!info.isDiffidato && !info.isSqualificato && info.pastSanctions.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* 3A. Squalifica Attiva (Banner Rosso) */}
      {info.isSqualificato && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-950/70 via-[#181118] to-[#0D0F16] border border-rose-500/60 shadow-[0_0_20px_rgba(244,63,94,0.25)] space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-sm">
                <Gavel className="w-4 h-4 text-rose-400" />
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  {info.giornateResidue && info.giornateSqualifica && info.giornateResidue < info.giornateSqualifica
                    ? `Provvedimento Disciplinare: Squalifica (${info.giornateResidue} gara residua su ${info.giornateSqualifica})`
                    : 'Provvedimento Disciplinare: Squalifica Attiva'}
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
      )}

      {/* 3B. Diffida Attiva (Banner Giallo/Ambra) */}
      {info.isDiffidato && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/60 via-[#1C1810] to-[#0D0F16] border border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.25)] flex items-start gap-3">
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
              {info.reason ||
                'Attenzione durante la direzione di gara: al prossimo cartellino giallo scatterà automaticamente 1 turno di squalifica nel Campionato di Eccellenza.'}
            </p>
          </div>
        </div>
      )}

      {/* 3C. Storico Squalifiche Pregresse (Scontate) */}
      {info.pastSanctions.length > 0 && (
        <div className="p-4 rounded-2xl bg-[#0F121C] border border-emerald-500/30 shadow-lg space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1C2232] pb-2.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <History className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                  Storico Squalifiche Pregresse
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    {info.pastSanctions.length} {info.pastSanctions.length === 1 ? 'scontata' : 'scontate'}
                  </span>
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Provvedimenti del Giudice Sportivo regolarmente scontati nelle gare successive
                </p>
              </div>
            </div>

            {!info.isSqualificato && !info.isDiffidato && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 self-start sm:self-auto">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Status: Regolare (Nessun alert attivo)
              </span>
            )}
          </div>

          <div className="space-y-2.5">
            {info.pastSanctions.map((past, idx) => {
              const sanzUp = String(past.sanzione || '').toUpperCase();
              const isTimeInh =
                sanzUp.includes('INIBIZIONE') ||
                sanzUp.includes('A TEMPO') ||
                sanzUp.includes('A MESI') ||
                sanzUp.includes('FINO AL');
              let g = past.giornateSqualifica || 0;
              if (!g) {
                if (sanzUp.includes('TRE GARE')) g = 3;
                else if (sanzUp.includes('DUE GARE')) g = 2;
                else {
                  const m = sanzUp.match(/(\d+)\s*GARE/);
                  g = m ? parseInt(m[1], 10) : 0;
                }
              }
              const isSevere = g >= 2 || isTimeInh;

              return (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-[#090C14] border border-[#1E2536] hover:border-emerald-500/40 transition-all space-y-1.5 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        Squalifica Scontata
                      </span>
                      {isSevere && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          <ShieldAlert className="w-3 h-3 text-amber-400" />
                          Precedente Grave ({isTimeInh ? 'Inibizione' : `≥${g}G`})
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 font-medium">
                        {past.competizione || 'Campionato Eccellenza'}
                      </span>
                    </div>

                    {past.comunicato && (
                      <span className="text-[10px] font-mono font-bold text-slate-300 bg-[#141A28] border border-slate-700/60 px-2 py-0.5 rounded flex items-center gap-1">
                        <FileText className="w-3 h-3 text-slate-400" />
                        {past.comunicato}
                      </span>
                    )}
                  </div>

                <div className="text-white font-bold text-xs pt-0.5">
                  {past.sanzione}
                </div>

                {past.motivo && (
                  <p className="text-[11px] text-slate-300/90 italic leading-relaxed pt-1 border-t border-[#161B28]">
                    <span className="text-slate-400 not-italic font-semibold">Motivazione: </span>
                    &ldquo;{past.motivo}&rdquo;
                  </p>
                )}

                {past.urlComunicato && (
                  <div className="pt-0.5 flex justify-end">
                    <a
                      href={past.urlComunicato}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-[#CCFF00] hover:underline flex items-center gap-1 font-mono"
                    >
                      <span>Consulta comunicato PDF</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        </div>
      )}
    </div>
  );
};

