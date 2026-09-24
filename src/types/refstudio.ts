/**
 * REFSTUDIO - TypeScript Core Domain Models
 * Specifiche modellate per il gestionale arbitri di calcio.
 */

export type RoleCategory = 'POR' | 'DIF' | 'CEN' | 'ATT' | 'SCONOSCIUTO';

export type DisciplinaryStatus = 'REGOLARE' | 'DIFFIDATO' | 'SQUALIFICATO' | 'IN_DUBBIO';

export type RefereeCustomTag =
  | 'proteste frequenti'
  | 'simulatore'
  | 'corretto'
  | 'leader squadra'
  | 'aggressivo'
  | 'osservare';

export interface Championship {
  id: string; // e.g. "eccellenza-er-girone-a"
  name: string; // "Eccellenza"
  season: string; // "2024/2025"
  region: string; // "Emilia-Romagna"
  category: string; // "Eccellenza"
  girone: 'A' | 'B' | string;
  totalTeams: number;
  lastSyncedAt?: string;
}

export interface Team {
  id: string; // slug-id, e.g. "vianese-calcio"
  championshipId: string;
  name: string;
  normalizedName?: string;
  girone: 'A' | 'B' | string;
  city?: string;
  logoUrl?: string;
  stadium?: string;
  stadiumAddress?: string;
  pitchSurface?: string; // "Erba naturale", "Sintetico", "Terra"
  tuttocampoUrl?: string;
  // Valutazioni arbitro (1-5)
  technicalLevel: number; // default 3
  aggressionLevel: number; // default 3
  benchAttitude?: string; // "Polemica", "Serena", "Rumorosa"
  coachAttitude?: string; // "Rispettoso", "Costantemente fuori dall'area tecnica"
  coachName?: string;
  coachPhotoUrl?: string;
  managerName?: string;
  refereeNotes?: string;
  // Statistiche da classifica
  stats?: {
    position?: number;
    points: number;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
  };
  updatedAt?: string;
}

export interface Player {
  id: string; // slug, e.g. "vianese-calcio-ascone-salvatore"
  teamId: string;
  teamName: string;
  championshipId: string;
  girone: 'A' | 'B' | string;
  firstName: string;
  lastName: string;
  photoUrl?: string;
  birthDate?: string; // "DD-MM-YYYY"
  age?: number;
  role: RoleCategory;
  kitNumber?: number;
  heightCm?: number;
  preferredFoot?: 'Destro' | 'Sinistro' | 'Ambidestro';
  // Statistiche importate
  goals: number;
  appearances: number;
  yellowCards: number;
  redCards: number;
  // Campi arbitrali
  disciplinaryStatus: DisciplinaryStatus;
  customTags: RefereeCustomTag[];
  refereeNotes?: string;
  updatedAt?: string;
}

export interface Match {
  id: string; // "girone-a-giornata-1-home-away"
  championshipId: string;
  girone: 'A' | 'B' | string;
  matchDay: number; // Numero giornata
  dateText: string; // "Giornata 1" o data reale ISO
  matchDate?: string;
  played: boolean;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  homeScore?: number;
  awayScore?: number;
  refereeName?: string;
  matchField?: string;
  observations?: string;
  updatedAt?: string;
}

export interface StandingRow {
  position: number;
  teamName: string;
  teamId?: string;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

export type NoteTargetType = 'squadra' | 'giocatore' | 'allenatore' | 'dirigente' | 'partita';

export type RefereeRole = 'AE' | 'AA' | 'OA';

export interface Note {
  id: string;
  authorId: string;
  authorName?: string;
  authorRole?: RefereeRole | string;
  authorAvatar?: string;
  authorSection?: string;
  isPublic: boolean; // true = pubblica (visibile a tutti), false = privata (visibile solo al creatore)
  targetType: NoteTargetType;
  targetId: string; // ID della squadra/giocatore/partita
  targetName: string;
  content: string;
  priority?: 'LOW' | 'NORMAL' | 'HIGH';
  attachments?: string[]; // URLs delle immagini/file
  createdAt: string;
  updatedAt?: string;
}

export type VideoSource = 'YOUTUBE' | 'LOCAL' | 'STORAGE';

export interface VideoClip {
  id: string;
  authorId: string;
  targetType: 'squadra' | 'giocatore' | 'partita';
  targetId: string;
  targetName: string;
  videoSource: VideoSource;
  externalUrl?: string; // es. https://www.youtube.com/watch?v=...
  storagePath?: string; // percorso in Storage
  title: string;
  description?: string;
  timestampMark?: string; // "14:20" (minuto dell'episodio)
  mediaType?: 'video' | 'image'; // tipo media per visualizzazione immediata
  createdAt: string;
  updatedAt?: string;
}

export interface UserAccount {
  username: string; // e.g. "samueleromini"
  password?: string;
  displayName: string;
  email?: string;
  role: 'admin' | 'arbitro';
  refereeRole: RefereeRole; // AE = Arbitro Effettivo, AA = Assistente Arbitrale, OA = Osservatore Arbitrale
  sectionAia: string; // Sezione AIA (es. "Bologna", "Parma")
  categoryAia: string; // Categoria arbitrata (es. "Eccellenza", "Promozione", "CAN D")
  avatarUrl?: string; // Immagine profilo URL o data-URL
  updatedAt?: string;
}

export type RefereeProfile = UserAccount;

export interface PreMatchBriefing {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  executiveSummary: string;
  tacticalTensionRating: number; // 1-10
  keyWatchPlayers: {
    playerName: string;
    teamName: string;
    role: string;
    reason: string;
    tags: string[];
  }[];
  benchDisciplineGuidance: string;
  refereeAdvice: string[];
  generatedAt: string;
}
