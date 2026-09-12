import { Team, Player, Match, StandingRow, Note, VideoClip, UserAccount } from '@/types/refstudio';
import defaultDataset from '@/data/dataset.json';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { SupabaseService } from '@/lib/supabase/supabase-service';

const STORAGE_KEY = 'refstudio_persistent_db_v3';

export const DEFAULT_USERS: UserAccount[] = [
  {
    username: 'samueleromini',
    password: 'samueleromini1',
    displayName: 'Samuele Romini',
    email: 'samuele.romini@refstudio.internal',
    role: 'admin',
    refereeRole: 'AE',
    sectionAia: 'Sezione AIA Bologna',
    categoryAia: 'Eccellenza',
    avatarUrl: '',
  },
  {
    username: 'lucaghirardi',
    password: 'lucaghirardi1',
    displayName: 'Luca Ghirardi',
    email: 'luca.ghirardi@refstudio.internal',
    role: 'arbitro',
    refereeRole: 'AA',
    sectionAia: 'Sezione AIA Parma',
    categoryAia: 'Eccellenza',
    avatarUrl: '',
  },
  {
    username: 'simoneclemente',
    password: 'simoneclemente1',
    displayName: 'Simone Clemente',
    email: 'simone.clemente@refstudio.internal',
    role: 'arbitro',
    refereeRole: 'AE',
    sectionAia: 'Sezione AIA Forlì',
    categoryAia: 'Eccellenza',
    avatarUrl: '',
  },
  {
    username: 'karimpalombo',
    password: 'karimpalombo1',
    displayName: 'Karim Palombo',
    email: 'karim.palombo@refstudio.internal',
    role: 'arbitro',
    refereeRole: 'AA',
    sectionAia: 'Sezione AIA Ravenna',
    categoryAia: 'Eccellenza',
    avatarUrl: '',
  },
  {
    username: 'riccardosamaritani',
    password: 'riccardosamaritani1',
    displayName: 'Riccardo Samaritani',
    email: 'riccardo.samaritani@refstudio.internal',
    role: 'arbitro',
    refereeRole: 'OA',
    sectionAia: 'Sezione AIA Ferrara',
    categoryAia: 'Eccellenza',
    avatarUrl: '',
  },
];

export interface DatabaseState {
  teams: Team[];
  players: Player[];
  matches: Match[];
  standingsA: StandingRow[];
  standingsB: StandingRow[];
  notes: Note[];
  videos: VideoClip[];
  profiles: UserAccount[];
}

const defaultInitialNotes: Note[] = [
  {
    id: 'note-1',
    authorId: 'samueleromini',
    authorName: 'Samuele Romini',
    authorRole: 'AE',
    authorSection: 'Sezione AIA Bologna',
    isPublic: true,
    targetType: 'squadra',
    targetId: 'vianese-calcio',
    targetName: 'Vianese Calcio',
    content: 'Squadra molto organizzata sulle palle inattive; occhio alle provocazioni del capitano nei contrasti a palla lontana.',
    priority: 'HIGH',
    attachments: [],
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
  {
    id: 'note-2',
    authorId: 'lucaghirardi',
    authorName: 'Luca Ghirardi',
    authorRole: 'AA',
    authorSection: 'Sezione AIA Parma',
    isPublic: true,
    targetType: 'giocatore',
    targetId: 'vianese-calcio-ascone-salvatore',
    targetName: 'Salvatore Ascone (Vianese Calcio)',
    content: 'Tendenza a cercare il contatto in area al minimo tocco. Avvertito verbalmente al 15 minuto.',
    priority: 'NORMAL',
    attachments: [],
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
  {
    id: 'note-3',
    authorId: 'riccardosamaritani',
    authorName: 'Riccardo Samaritani',
    authorRole: 'OA',
    authorSection: 'Sezione AIA Ferrara',
    isPublic: true,
    targetType: 'allenatore',
    targetId: 'arcetana',
    targetName: 'Mister Arcetana',
    content: 'Reclama costantemente il fuorigioco. Collaborazione attiva richiesta al secondo assistente.',
    priority: 'NORMAL',
    attachments: [],
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
];

const defaultInitialVideos: VideoClip[] = [
  {
    id: 'vid-1',
    authorId: 'samueleromini',
    targetType: 'squadra',
    targetId: 'vianese-calcio',
    targetName: 'Vianese Calcio',
    videoSource: 'YOUTUBE',
    externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title: 'Analisi transizioni offensive Vianese Calcio',
    description: 'Velocità di ripartenza sulle corsie esterne e inserimenti dei centrocampisti.',
    timestampMark: '03:15',
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
  },
];

let inMemoryData: DatabaseState = {
  teams: [...(defaultDataset.teams as unknown as Team[])],
  players: [...(defaultDataset.players as unknown as Player[])],
  matches: [...(defaultDataset.matches as unknown as Match[])],
  standingsA: [...(defaultDataset.standingsA as unknown as StandingRow[])],
  standingsB: [...(defaultDataset.standingsB as unknown as StandingRow[])],
  notes: (defaultDataset as any).notes && (defaultDataset as any).notes.length > 0
    ? [...((defaultDataset as any).notes as Note[])]
    : [...defaultInitialNotes],
  videos: (defaultDataset as any).videos && (defaultDataset as any).videos.length > 0
    ? [...((defaultDataset as any).videos as VideoClip[])]
    : [...defaultInitialVideos],
  profiles: (defaultDataset as any).profiles && (defaultDataset as any).profiles.length > 0
    ? [...((defaultDataset as any).profiles as UserAccount[])]
    : [...DEFAULT_USERS],
};

let hasInitializedSupabase = false;
let realtimeUnsubscribe: (() => void) | null = null;

// Carica lo stato memorizzato sul server se presente su disco
if (typeof window === 'undefined') {
  try {
    const fs = require('fs');
    const path = require('path');
    const stateFile = path.resolve(process.cwd(), 'data', 'db-state.json');
    if (fs.existsSync(stateFile)) {
      const parsed = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      if (parsed && Array.isArray(parsed.teams) && parsed.teams.length > 0) {
        inMemoryData = parsed;
      }
    }
  } catch {
    // Ignora e usa il fallback
  }
}

export class DbService {
  /**
   * Assicura che i dati siano sincronizzati con il LocalStorage del browser
   * e avvia la sincronizzazione trasparente con Supabase se configurato
   */
  private static ensureLoaded(): void {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && Array.isArray(parsed.teams) && parsed.teams.length > 0) {
            inMemoryData = parsed;
          }
        } else {
          // Salva lo stato iniziale in LocalStorage
          localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemoryData));
        }

        // Avvia la sincronizzazione cloud Supabase in background
        if (!hasInitializedSupabase) {
          this.initSupabaseSync();
        }
      } catch (err) {
        console.warn('Errore lettura LocalStorage:', err);
      }
    }
  }

  /**
   * Inizializza la sincronizzazione automatica bidirezionale con Supabase
   */
  static initSupabaseSync(): void {
    if (typeof window === 'undefined' || hasInitializedSupabase) return;
    hasInitializedSupabase = true;

    if (!isSupabaseConfigured()) {
      return;
    }

    // 1. Idratazione iniziale dai dati Supabase
    this.syncWithSupabase().catch((err) => {
      console.warn('Supabase initial pull non riuscito (modalità offline):', err);
    });

    // 2. Iscrizione agli aggiornamenti Realtime di Supabase
    try {
      if (!realtimeUnsubscribe) {
        realtimeUnsubscribe = SupabaseService.subscribeToChanges((payload) => {
          this.handleRealtimeEvent(payload);
        });
      }
    } catch (err) {
      console.warn('Errore sottoscrizione Supabase Realtime:', err);
    }
  }

  /**
   * Gestisce gli eventi Realtime ricevuti da altri utenti/dispositivi
   */
  private static handleRealtimeEvent(payload: { table: string; eventType: string; newRecord: any }) {
    if (payload.table === 'notes') {
      if (payload.eventType === 'DELETE') {
        const idToDelete = payload.newRecord?.id;
        if (idToDelete) {
          inMemoryData.notes = inMemoryData.notes.filter((n) => n.id !== idToDelete);
        }
      } else if (payload.newRecord) {
        const mapped = SupabaseService.mapNoteFromRow(payload.newRecord);
        const existingIdx = inMemoryData.notes.findIndex((n) => n.id === mapped.id);
        if (existingIdx >= 0) {
          inMemoryData.notes[existingIdx] = mapped;
        } else {
          inMemoryData.notes.unshift(mapped);
        }
      }
    } else if (payload.table === 'videos') {
      if (payload.eventType === 'DELETE') {
        const idToDelete = payload.newRecord?.id;
        if (idToDelete) {
          inMemoryData.videos = inMemoryData.videos.filter((v) => v.id !== idToDelete);
        }
      } else if (payload.newRecord) {
        const mapped = SupabaseService.mapVideoFromRow(payload.newRecord);
        const existingIdx = inMemoryData.videos.findIndex((v) => v.id === mapped.id);
        if (existingIdx >= 0) {
          inMemoryData.videos[existingIdx] = mapped;
        } else {
          inMemoryData.videos.unshift(mapped);
        }
      }
    } else if (payload.table === 'teams' && payload.newRecord) {
      const mapped = SupabaseService.mapTeamFromRow(payload.newRecord);
      const existingIdx = inMemoryData.teams.findIndex((t) => t.id === mapped.id);
      if (existingIdx >= 0) {
        inMemoryData.teams[existingIdx] = mapped;
      }
    } else if (payload.table === 'players' && payload.newRecord) {
      const mapped = SupabaseService.mapPlayerFromRow(payload.newRecord);
      const existingIdx = inMemoryData.players.findIndex((p) => p.id === mapped.id);
      if (existingIdx >= 0) {
        inMemoryData.players[existingIdx] = mapped;
      }
    } else if (payload.table === 'matches' && payload.newRecord) {
      const mapped = SupabaseService.mapMatchFromRow(payload.newRecord);
      const existingIdx = inMemoryData.matches.findIndex((m) => m.id === mapped.id);
      if (existingIdx >= 0) {
        inMemoryData.matches[existingIdx] = mapped;
      }
    } else if (payload.table === 'profiles' && payload.newRecord) {
      const mapped = SupabaseService.mapProfileFromRow(payload.newRecord);
      if (!inMemoryData.profiles) inMemoryData.profiles = [...DEFAULT_USERS];
      const existingIdx = inMemoryData.profiles.findIndex((p) => p.username.toLowerCase() === mapped.username.toLowerCase());
      if (existingIdx >= 0) {
        inMemoryData.profiles[existingIdx] = mapped;
      } else {
        inMemoryData.profiles.push(mapped);
      }
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemoryData));
      window.dispatchEvent(new CustomEvent('refstudio-sync-update', { detail: payload }));
    }
  }

  /**
   * Sincronizza i dati locali con i dati presenti su Supabase Cloud
   */
  static async syncWithSupabase(): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    try {
      const [cloudTeams, cloudPlayers, cloudMatches, cloudStandings, cloudNotes, cloudVideos, cloudProfiles] = await Promise.all([
        SupabaseService.fetchAllTeams(),
        SupabaseService.fetchAllPlayers(),
        SupabaseService.fetchAllMatches(),
        SupabaseService.fetchStandings(),
        SupabaseService.fetchNotes(),
        SupabaseService.fetchVideos(),
        SupabaseService.fetchProfiles(),
      ]);

      // Se il database cloud contiene dati, aggiorna lo stato locale
      if (cloudTeams.length > 0) {
        inMemoryData = {
          teams: cloudTeams,
          players: cloudPlayers.length > 0 ? cloudPlayers : inMemoryData.players,
          matches: cloudMatches.length > 0 ? cloudMatches : inMemoryData.matches,
          standingsA: cloudStandings.standingsA.length > 0 ? cloudStandings.standingsA : inMemoryData.standingsA,
          standingsB: cloudStandings.standingsB.length > 0 ? cloudStandings.standingsB : inMemoryData.standingsB,
          notes: cloudNotes.length > 0 ? cloudNotes : inMemoryData.notes,
          videos: cloudVideos.length > 0 ? cloudVideos : inMemoryData.videos,
          profiles: cloudProfiles.length > 0 ? cloudProfiles : inMemoryData.profiles || [...DEFAULT_USERS],
        };

        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemoryData));
          window.dispatchEvent(new CustomEvent('refstudio-sync-update', { detail: { fullSync: true } }));
        }
        return true;
      }
      return false;
    } catch (err) {
      console.warn('Errore durante syncWithSupabase:', err);
      return false;
    }
  }

  /**
   * Migra l'intero dataset corrente verso il database Supabase
   */
  static async migrateToSupabase(): Promise<{ success: boolean; summary: any; error?: string }> {
    this.ensureLoaded();
    return SupabaseService.migrateFullDataset(inMemoryData);
  }

  /**
   * Salva lo stato sia in LocalStorage (immediato e sincronizzato con F5) sia su file disk del server
   */
  private static persist(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemoryData));
        // Sincronizza anche il server in background
        fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(inMemoryData),
        }).catch(() => {});
      } catch (err) {
        console.warn('Errore salvataggio LocalStorage:', err);
      }
    }

    if (typeof window === 'undefined') {
      try {
        const fs = require('fs');
        const path = require('path');
        const stateFile = path.resolve(process.cwd(), 'data', 'db-state.json');
        const dir = path.dirname(stateFile);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(stateFile, JSON.stringify(inMemoryData, null, 2), 'utf-8');
      } catch (err) {
        console.warn('Errore salvataggio file server:', err);
      }
    }
  }

  static getTeams(girone?: 'A' | 'B'): Team[] {
    this.ensureLoaded();
    if (!girone) return inMemoryData.teams;
    return inMemoryData.teams.filter((t) => t.girone === girone);
  }

  static getTeamById(teamId: string): Team | undefined {
    this.ensureLoaded();
    return inMemoryData.teams.find((t) => t.id === teamId);
  }

  static updateTeam(teamId: string, updates: Partial<Team>): Team {
    this.ensureLoaded();
    const idx = inMemoryData.teams.findIndex((t) => t.id === teamId);
    if (idx === -1) throw new Error('Team not found');
    inMemoryData.teams[idx] = {
      ...inMemoryData.teams[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.persist();

    // Sincronizzazione cloud asincrona verso Supabase
    if (isSupabaseConfigured()) {
      SupabaseService.upsertTeam(inMemoryData.teams[idx]).catch((err) =>
        console.warn('Errore aggiornamento Supabase team:', err)
      );
    }

    return inMemoryData.teams[idx];
  }

  static getPlayers(teamId?: string, girone?: 'A' | 'B'): Player[] {
    this.ensureLoaded();
    let list = inMemoryData.players;
    if (girone) list = list.filter((p) => p.girone === girone);
    if (teamId) list = list.filter((p) => p.teamId === teamId);
    return list;
  }

  static getPlayerById(playerId: string): Player | undefined {
    this.ensureLoaded();
    return inMemoryData.players.find((p) => p.id === playerId);
  }

  static updatePlayer(playerId: string, updates: Partial<Player>): Player {
    this.ensureLoaded();
    const idx = inMemoryData.players.findIndex((p) => p.id === playerId);
    if (idx === -1) throw new Error('Player not found');
    inMemoryData.players[idx] = {
      ...inMemoryData.players[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.persist();

    // Sincronizzazione cloud asincrona verso Supabase
    if (isSupabaseConfigured()) {
      SupabaseService.upsertPlayer(inMemoryData.players[idx]).catch((err) =>
        console.warn('Errore aggiornamento Supabase player:', err)
      );
    }

    return inMemoryData.players[idx];
  }

  static getMatches(girone?: 'A' | 'B', matchDay?: number): Match[] {
    this.ensureLoaded();
    let list = inMemoryData.matches;
    if (girone) list = list.filter((m) => m.girone === girone);
    if (matchDay) list = list.filter((m) => m.matchDay === matchDay);
    return list;
  }

  static getMatchById(matchId: string): Match | undefined {
    this.ensureLoaded();
    return inMemoryData.matches.find((m) => m.id === matchId);
  }

  static updateMatch(matchId: string, updates: Partial<Match>): Match {
    this.ensureLoaded();
    const idx = inMemoryData.matches.findIndex((m) => m.id === matchId);
    if (idx === -1) throw new Error('Match not found');
    inMemoryData.matches[idx] = {
      ...inMemoryData.matches[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.persist();

    // Sincronizzazione cloud asincrona verso Supabase
    if (isSupabaseConfigured()) {
      SupabaseService.upsertMatch(inMemoryData.matches[idx]).catch((err) =>
        console.warn('Errore aggiornamento Supabase match:', err)
      );
    }

    return inMemoryData.matches[idx];
  }

  static getStandings(girone: 'A' | 'B'): StandingRow[] {
    this.ensureLoaded();
    return girone === 'A' ? inMemoryData.standingsA : inMemoryData.standingsB;
  }

  static getNotes(targetType?: string, targetId?: string, currentUsername?: string): Note[] {
    this.ensureLoaded();
    let list = inMemoryData.notes;
    if (targetType) list = list.filter((n) => n.targetType === targetType);
    if (targetId) list = list.filter((n) => n.targetId === targetId);

    // Regola di visibilità:
    // Se la nota è isPublic !== false -> visibile a tutti gli utenti
    // Se isPublic === false -> visibile esclusivamente all'autore proprietario
    list = list.filter((n) => {
      if (n.isPublic !== false) return true;
      if (!currentUsername) return false;
      return n.authorId?.toLowerCase() === currentUsername.toLowerCase();
    });

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  static addNote(note: Omit<Note, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): Note {
    this.ensureLoaded();
    const newNote: Note = {
      ...note,
      authorId: note.authorId || 'samueleromini',
      authorName: note.authorName || 'Arbitro',
      authorRole: note.authorRole || 'AE',
      authorAvatar: note.authorAvatar || '',
      authorSection: note.authorSection || '',
      isPublic: note.isPublic !== false,
      id: note.id || `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: note.createdAt || new Date().toISOString(),
    };
    inMemoryData.notes.unshift(newNote);
    this.persist();

    // Sincronizzazione cloud asincrona verso Supabase
    if (isSupabaseConfigured()) {
      SupabaseService.insertNote(newNote).catch((err) =>
        console.warn('Errore inserimento Supabase note:', err)
      );
    }

    return newNote;
  }

  static updateNote(noteId: string, updates: Partial<Note>, currentUsername?: string): Note {
    this.ensureLoaded();
    const idx = inMemoryData.notes.findIndex((n) => n.id === noteId);
    if (idx === -1) throw new Error('Nota non trovata');

    const existing = inMemoryData.notes[idx];
    if (currentUsername && existing.authorId && existing.authorId.toLowerCase() !== currentUsername.toLowerCase()) {
      throw new Error('Non sei autorizzato a modificare questa nota: solo il proprietario può farlo.');
    }

    inMemoryData.notes[idx] = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.persist();

    // Sincronizzazione cloud asincrona verso Supabase
    if (isSupabaseConfigured()) {
      SupabaseService.updateNote(noteId, updates).catch((err) =>
        console.warn('Errore aggiornamento Supabase note:', err)
      );
    }

    return inMemoryData.notes[idx];
  }

  static deleteNote(noteId: string, currentUsername?: string): boolean {
    this.ensureLoaded();
    const existing = inMemoryData.notes.find((n) => n.id === noteId);
    if (!existing) return false;

    if (currentUsername && existing.authorId && existing.authorId.toLowerCase() !== currentUsername.toLowerCase()) {
      throw new Error('Non sei autorizzato a eliminare questa nota: solo il proprietario può farlo.');
    }

    const lenBefore = inMemoryData.notes.length;
    inMemoryData.notes = inMemoryData.notes.filter((n) => n.id !== noteId);
    const deleted = inMemoryData.notes.length < lenBefore;
    if (deleted) {
      this.persist();
      if (isSupabaseConfigured()) {
        SupabaseService.deleteNote(noteId).catch((err) =>
          console.warn('Errore cancellazione Supabase note:', err)
        );
      }
    }
    return deleted;
  }

  static getProfiles(): UserAccount[] {
    this.ensureLoaded();
    if (!inMemoryData.profiles || inMemoryData.profiles.length === 0) {
      inMemoryData.profiles = [...DEFAULT_USERS];
      this.persist();
    }
    return inMemoryData.profiles;
  }

  static getProfileByUsername(username: string): UserAccount | undefined {
    this.ensureLoaded();
    return this.getProfiles().find((p) => p.username.toLowerCase() === username.toLowerCase());
  }

  static updateProfile(username: string, updates: Partial<UserAccount>): UserAccount {
    this.ensureLoaded();
    const profiles = this.getProfiles();
    const idx = profiles.findIndex((p) => p.username.toLowerCase() === username.toLowerCase());
    if (idx === -1) throw new Error('Profilo utente non trovato');

    profiles[idx] = {
      ...profiles[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    inMemoryData.profiles = profiles;
    this.persist();

    if (isSupabaseConfigured()) {
      SupabaseService.upsertProfile(profiles[idx]).catch((err) =>
        console.warn('Errore aggiornamento Supabase profilo:', err)
      );
    }

    return profiles[idx];
  }

  static getVideos(targetType?: string, targetId?: string): VideoClip[] {
    this.ensureLoaded();
    let list = inMemoryData.videos;
    if (targetType) list = list.filter((v) => v.targetType === targetType);
    if (targetId) list = list.filter((v) => v.targetId === targetId);
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  static addVideo(video: Omit<VideoClip, 'id' | 'createdAt' | 'authorId'> & { authorId?: string }): VideoClip {
    this.ensureLoaded();
    const newVideo: VideoClip = {
      ...video,
      authorId: video.authorId || 'current-referee',
      id: `vid-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    inMemoryData.videos.unshift(newVideo);
    this.persist();

    // Sincronizzazione cloud asincrona verso Supabase
    if (isSupabaseConfigured()) {
      SupabaseService.insertVideo(newVideo).catch((err) =>
        console.warn('Errore inserimento Supabase video:', err)
      );
    }

    return newVideo;
  }

  static deleteVideo(videoId: string): boolean {
    this.ensureLoaded();
    const lenBefore = inMemoryData.videos.length;
    inMemoryData.videos = inMemoryData.videos.filter((v) => v.id !== videoId);
    const deleted = inMemoryData.videos.length < lenBefore;
    if (deleted) {
      this.persist();
      if (isSupabaseConfigured()) {
        SupabaseService.deleteVideo(videoId).catch((err) =>
          console.warn('Errore cancellazione Supabase video:', err)
        );
      }
    }
    return deleted;
  }

  static getStatsSummary() {
    this.ensureLoaded();
    return {
      totalTeams: inMemoryData.teams.length,
      totalPlayers: inMemoryData.players.length,
      totalMatches: inMemoryData.matches.length,
      playedMatches: inMemoryData.matches.filter((m) => m.played).length,
      upcomingMatches: inMemoryData.matches.filter((m) => !m.played).length,
      totalNotes: inMemoryData.notes.length,
      totalVideos: inMemoryData.videos.length,
      highRiskPlayers: inMemoryData.players.filter(
        (p) => p.customTags.includes('aggressivo') || p.customTags.includes('proteste frequenti') || p.yellowCards >= 3
      ).length,
    };
  }

  static replaceFullDataset(newDataset: typeof defaultDataset) {
    this.ensureLoaded();
    inMemoryData = {
      ...inMemoryData,
      teams: [...(newDataset.teams as unknown as Team[])],
      players: [...(newDataset.players as unknown as Player[])],
      matches: [...(newDataset.matches as unknown as Match[])],
      standingsA: [...(newDataset.standingsA as unknown as StandingRow[])],
      standingsB: [...(newDataset.standingsB as unknown as StandingRow[])],
    };
    this.persist();

    if (isSupabaseConfigured()) {
      SupabaseService.migrateFullDataset(inMemoryData).catch((err) =>
        console.warn('Errore sincronizzazione batch Supabase:', err)
      );
    }
  }

  static resetToDefault(): void {
    inMemoryData = {
      teams: [...(defaultDataset.teams as unknown as Team[])],
      players: [...(defaultDataset.players as unknown as Player[])],
      matches: [...(defaultDataset.matches as unknown as Match[])],
      standingsA: [...(defaultDataset.standingsA as unknown as StandingRow[])],
      standingsB: [...(defaultDataset.standingsB as unknown as StandingRow[])],
      notes: (defaultDataset as any).notes && (defaultDataset as any).notes.length > 0
        ? [...((defaultDataset as any).notes as Note[])]
        : [...defaultInitialNotes],
      videos: (defaultDataset as any).videos && (defaultDataset as any).videos.length > 0
        ? [...((defaultDataset as any).videos as VideoClip[])]
        : [...defaultInitialVideos],
      profiles: (defaultDataset as any).profiles && (defaultDataset as any).profiles.length > 0
        ? [...((defaultDataset as any).profiles as UserAccount[])]
        : [...DEFAULT_USERS],
    };
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    this.persist();
  }
}
