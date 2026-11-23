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

  const hasRefereeNotes = Boolean(
    player.refereeNotes &&
    player.refereeNotes.trim() &&
    !player.refereeNotes.includes('[Giudice Sportivo')
  );
  const refereeNotesText = hasRefereeNotes ? player.refereeNotes!.trim() : undefined;

  // L'icona gialla delle note deve essere presente solo ed esclusivamente se sono registrate note testuali inserite da utenti per quel calciatore
  const textCount = matchedNotes.length;
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
 * Ottimizzata con indici invertiti per evitare ricerche lineari O(P * N).
 */
export function buildPlayersMediaMap(
  players: Player[],
  allNotes: Note[],
  allVideos: VideoClip[]
): Map<string, PlayerMediaSummary> {
  const map = new Map<string, PlayerMediaSummary>();

  // Indici veloci per targetId O(1)
  const notesByTargetId = new Map<string, Note[]>();
  const nameMatchedNotes: Note[] = [];

  for (let i = 0; i < allNotes.length; i++) {
    const n = allNotes[i];
    if (n.targetType !== 'giocatore') continue;
    if (n.targetId) {
      const tid = String(n.targetId).trim().toLowerCase();
      let arr = notesByTargetId.get(tid);
      if (!arr) {
        arr = [];
        notesByTargetId.set(tid, arr);
      }
      arr.push(n);
    }
    if (n.targetName) {
      nameMatchedNotes.push(n);
    }
  }

  const videosByTargetId = new Map<string, VideoClip[]>();
  const nameMatchedVideos: VideoClip[] = [];

  for (let i = 0; i < allVideos.length; i++) {
    const v = allVideos[i];
    const vType = (v.targetType || '').toLowerCase().trim();
    if (vType !== 'giocatore') continue;
    if (v.targetId) {
      const tid = String(v.targetId).trim().toLowerCase();
      let arr = videosByTargetId.get(tid);
      if (!arr) {
        arr = [];
        videosByTargetId.set(tid, arr);
      }
      arr.push(v);
    }
    if (v.targetName) {
      nameMatchedVideos.push(v);
    }
  }

  players.forEach((player) => {
    const pId = String(player.id || '').trim().toLowerCase();
    const directNotes = notesByTargetId.get(pId) || [];
    const directVideos = videosByTargetId.get(pId) || [];

    const matchedNotesSet = new Set<Note>(directNotes);
    const matchedVideosSet = new Set<VideoClip>(directVideos);

    // Controlla il sottoinsieme di note che usano matching per targetName
    if (nameMatchedNotes.length > 0) {
      for (let i = 0; i < nameMatchedNotes.length; i++) {
        const n = nameMatchedNotes[i];
        if (matchNoteToPlayer(n, player)) {
          matchedNotesSet.add(n);
        }
      }
    }

    if (nameMatchedVideos.length > 0) {
      for (let i = 0; i < nameMatchedVideos.length; i++) {
        const v = nameMatchedVideos[i];
        if (matchVideoToPlayer(v, player)) {
          matchedVideosSet.add(v);
        }
      }
    }

    const matchedNotes = Array.from(matchedNotesSet);
    const matchedVideos = Array.from(matchedVideosSet);

    const hasRefereeNotes = Boolean(
      player.refereeNotes &&
      player.refereeNotes.trim() &&
      !player.refereeNotes.includes('[Giudice Sportivo')
    );
    const refereeNotesText = hasRefereeNotes ? player.refereeNotes!.trim() : undefined;

    const textCount = matchedNotes.length;
    const videoCount = matchedVideos.length;
    const totalCount = textCount + videoCount;

    map.set(player.id, {
      hasMedia: totalCount > 0,
      textCount,
      videoCount,
      totalCount,
      textNotes: matchedNotes,
      videoNotes: matchedVideos,
      refereeNotes: refereeNotesText,
    });
  });

  return map;
}
