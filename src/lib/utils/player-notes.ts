import { Player, Note, VideoClip } from '@/types/refstudio';

export interface PlayerMediaSummary {
  hasMedia: boolean;
  textCount: number;
  videoCount: number;
  totalCount: number;
  textNotes: Note[];
  videoNotes: VideoClip[];
  refereeNotes?: string;
}

/**
 * Verifica se una nota di testo appartiene al calciatore specificato.
 * Il matching supporta sia targetId (ID calciatore o slug) sia targetName contenente nome e cognome.
 */
export function matchNoteToPlayer(note: Note, player: Player): boolean {
  if (note.targetType !== 'giocatore') return false;

  const pId = String(player.id || '').trim();
  const nTargetId = String(note.targetId || '').trim();

  if (pId && nTargetId && pId.toLowerCase() === nTargetId.toLowerCase()) {
    return true;
  }

  // Matching tramite nome e cognome, o cognome e squadra
  if (note.targetName && player.lastName) {
    const tName = note.targetName.toLowerCase();
    const lName = player.lastName.toLowerCase().trim();
    const fName = player.firstName ? player.firstName.toLowerCase().trim() : '';

    if (lName && fName && tName.includes(lName) && tName.includes(fName)) {
      return true;
    }

    if (lName && player.teamName && tName.includes(lName) && tName.includes(player.teamName.toLowerCase().trim())) {
      return true;
    }
  }

  return false;
}

/**
 * Verifica se un video/clip didattico appartiene al calciatore specificato.
 */
export function matchVideoToPlayer(video: VideoClip, player: Player): boolean {
  const vType = (video.targetType || '').toLowerCase().trim();
  if (vType !== 'giocatore') return false;

  const pId = String(player.id || '').trim();
  const vTargetId = String(video.targetId || '').trim();

  if (pId && vTargetId && pId.toLowerCase() === vTargetId.toLowerCase()) {
    return true;
  }

  // Matching tramite nome e cognome, o cognome e squadra
  if (video.targetName && player.lastName) {
    const tName = video.targetName.toLowerCase();
    const lName = player.lastName.toLowerCase().trim();
    const fName = player.firstName ? player.firstName.toLowerCase().trim() : '';

    if (lName && fName && tName.includes(lName) && tName.includes(fName)) {
      return true;
    }

    if (lName && player.teamName && tName.includes(lName) && tName.includes(player.teamName.toLowerCase().trim())) {
      return true;
    }
  }

  return false;
}

/**
 * Calcola il riepilogo completo di note di testo e clip video registrate a nome del calciatore.
 */
export function getPlayerMediaSummary(
  player: Player,
  allNotes: Note[],
  allVideos: VideoClip[]
): PlayerMediaSummary {
  const matchedNotes = allNotes.filter((n) => matchNoteToPlayer(n, player));
  const matchedVideos = allVideos.filter((v) => matchVideoToPlayer(v, player));

  const hasRefereeNotes = Boolean(player.refereeNotes && player.refereeNotes.trim());
  const refereeNotesText = hasRefereeNotes ? player.refereeNotes!.trim() : undefined;

  // Se il calciatore ha refereeNotes direttamente sull'anagrafica e non è già duplicato in matchedNotes
  const isDirectNoteAlreadyInNotes =
    hasRefereeNotes && matchedNotes.some((n) => n.content?.trim() === refereeNotesText);
  const directNoteBonus = hasRefereeNotes && !isDirectNoteAlreadyInNotes ? 1 : 0;

  const textCount = matchedNotes.length + directNoteBonus;
  const videoCount = matchedVideos.length;
  const totalCount = textCount + videoCount;

  return {
    hasMedia: totalCount > 0,
    textCount,
    videoCount,
    totalCount,
    textNotes: matchedNotes,
    videoNotes: matchedVideos,
    refereeNotes: refereeNotesText,
  };
}

/**
 * Crea una mappa efficiente di riepilogo per un array di calciatori.
 */
export function buildPlayersMediaMap(
  players: Player[],
  allNotes: Note[],
  allVideos: VideoClip[]
): Map<string, PlayerMediaSummary> {
  const map = new Map<string, PlayerMediaSummary>();

  players.forEach((player) => {
    map.set(player.id, getPlayerMediaSummary(player, allNotes, allVideos));
  });

  return map;
}
