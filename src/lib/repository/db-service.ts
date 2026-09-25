import { Team, Player, Match, StandingRow, Note, VideoClip, UserAccount, MatchDesignation, RefereePersonalStats, DesignationRole } from '@/types/refstudio';
import defaultDataset from '@/data/dataset.json';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { SupabaseService } from '@/lib/supabase/supabase-service';

const STORAGE_KEY = 'refstudio_persistent_db_v4';

export const DEFAULT_USERS: UserAccount[] = [
  {
    username: 'samueleromini',
    password: 'samueleromini1',
    displayName: 'Samuele Romini',
    email: 'rominisamuele@gmail.com',
    role: 'admin',
    refereeRole: 'AE',
    sectionAia: 'Sezione AIA Bologna',
    categoryAia: 'Eccellenza',
    avatarUrl: '',
    isApproved: true,
    status: 'APPROVED',
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
    isApproved: true,
    status: 'APPROVED',
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
    isApproved: true,
    status: 'APPROVED',
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
    isApproved: true,
    status: 'APPROVED',
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
    isApproved: true,
    status: 'APPROVED',
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
  designations?: MatchDesignation[];
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
  {
    id: 'vid-1790239097495-ytun',
    authorId: 'samueleromini',
    targetType: 'giocatore',
    targetId: '7279022',
    targetName: 'Manuel Ricci (Ars Et Labor Ferrara)',
    videoSource: 'YOUTUBE',
    externalUrl: 'https://www.youtube.com/watch?v=ZoVHlwtFNLI&t=46s',
    title: 'Gestione del calciatore',
    description: 'Calciatore estremamente fumantino e provocatorio, in questo CDA AE lo richiama insieme al suo avversario per delle trattenute e delle parole di troppo tra i due. Ricci, nonostante la presenza di AE insulta il calciatore davanti a se costingendo AE ad alzare i toni e ad imporsi con decisione.',
    timestampMark: '35:27',
    createdAt: '2026-09-24T08:38:17.519Z',
    updatedAt: '2026-09-24T08:38:17.519Z',
  },
];

const defaultInitialDesignations: MatchDesignation[] = [];

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
  designations: [],
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
        inMemoryData = {
          ...inMemoryData,
          ...parsed,
          designations: Array.isArray(parsed.designations) ? parsed.designations : (inMemoryData.designations || []),
        };
      }
    }
  } catch {
    // Ignora e usa il fallback
  }
}

export class DbService {
  /**
   * Propaga le designazioni correnti ai rispettivi oggetti Match in memoria
   */
  private static applyDesignationsToMatches(): void {
    if (!inMemoryData.matches) return;
    const designations = inMemoryData.designations || [];
    const desMap = new Map<string, MatchDesignation>();
    designations.forEach((d) => {
      if (d && d.matchId) {
        desMap.set(d.matchId, d);
      }
    });

    inMemoryData.matches = inMemoryData.matches.map((m) => {
      const des = desMap.get(m.id);
      if (des) {
        const profile = inMemoryData.profiles?.find((p) => p.username.toLowerCase() === des.userId.toLowerCase());
        return {
          ...m,
          designatedRefereeId: des.userId,
          refereeRole: des.role,
          refereeName: profile?.displayName || m.refereeName || 'Arbitro Designato',
          assistant1: des.assistant1,
          assistant2: des.assistant2,
          observer: des.observer,
          designationNotes: des.notes,
        };
      } else if (m.designatedRefereeId) {
        const {
          designatedRefereeId,
          refereeRole,
          assistant1,
          assistant2,
          observer,
          designationNotes,
          ...cleanMatch
        } = m;
        return cleanMatch as Match;
      }
      return m;
    });
  }

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
            // Filtriamo via in modo permanente i mock des-1 e des-2 se risiedono nella cache del browser
            let cleanDesignations: MatchDesignation[] = [];
            if (Array.isArray(parsed.designations)) {
              cleanDesignations = parsed.designations.filter(
                (d: any) =>
                  d &&
                  d.id !== 'des-1' &&
                  d.id !== 'des-2' &&
                  !(d.matchId === 'match-A-5-1281681-1000471' && (d.id === 'des-1' || d.notes?.includes('Scontro al vertice'))) &&
                  !(d.matchId === 'match-A-1-68499-1000471' && (d.id === 'des-2' || d.notes?.includes('Gara diretta con autorità')))
              );
            } else if (Array.isArray(inMemoryData.designations)) {
              cleanDesignations = inMemoryData.designations.filter(
                (d: any) =>
                  d &&
                  d.id !== 'des-1' &&
                  d.id !== 'des-2' &&
                  !(d.matchId === 'match-A-5-1281681-1000471' && (d.id === 'des-1' || d.notes?.includes('Scontro al vertice'))) &&
                  !(d.matchId === 'match-A-1-68499-1000471' && (d.id === 'des-2' || d.notes?.includes('Gara diretta con autorità')))
              );
            }

            inMemoryData = {
              ...inMemoryData,
              ...parsed,
              designations: cleanDesignations,
            };

            // Propaga le designazioni ai match
            this.applyDesignationsToMatches();
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
        // Preserva accuratamente le designazioni correnti
        const currentDesignations = Array.isArray(inMemoryData.designations)
          ? inMemoryData.designations.filter(
              (d: any) =>
                d &&
                d.id !== 'des-1' &&
                d.id !== 'des-2' &&
                !(d.matchId === 'match-A-5-1281681-1000471' && d.id === 'des-1') &&
                !(d.matchId === 'match-A-1-68499-1000471' && d.id === 'des-2')
            )
          : [];

        inMemoryData = {
          teams: cloudTeams,
          players: cloudPlayers.length > 0 ? cloudPlayers : inMemoryData.players,
          matches: cloudMatches.length > 0 ? cloudMatches : inMemoryData.matches,
          standingsA: cloudStandings.standingsA.length > 0 ? cloudStandings.standingsA : inMemoryData.standingsA,
          standingsB: cloudStandings.standingsB.length > 0 ? cloudStandings.standingsB : inMemoryData.standingsB,
          notes: cloudNotes.length > 0 ? cloudNotes : inMemoryData.notes,
          videos: cloudVideos.length > 0 ? cloudVideos : inMemoryData.videos,
          profiles: cloudProfiles.length > 0 ? cloudProfiles : inMemoryData.profiles || [...DEFAULT_USERS],
          designations: currentDesignations,
        };

        // Riapplica le designazioni ai cloudMatches scaricati
        this.applyDesignationsToMatches();

        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemoryData));
          window.dispatchEvent(new CustomEvent('refstudio-sync-update', { detail: { fullSync: true } }));
          window.dispatchEvent(new CustomEvent('refstudio-designations-update', { detail: { fullSync: true } }));
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

    // Deduplica difensiva per evitare doppioni da vecchi ID partita
    const uniqueMap = new Map<string, Match>();
    list.forEach((m) => {
      const key = `${m.girone}-${m.matchDay}-${m.homeTeamName.toLowerCase().trim()}-vs-${m.awayTeamName.toLowerCase().trim()}`;
      if (!uniqueMap.has(key) || (m.played && !uniqueMap.get(key)!.played)) {
        uniqueMap.set(key, m);
      }
    });
    return Array.from(uniqueMap.values());
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

  // =========================================================================
  // METODI DESIGNAZIONI ARBITRALI
  // =========================================================================

  static getDesignations(userId?: string): MatchDesignation[] {
    this.ensureLoaded();
    const list = inMemoryData.designations || [];
    if (!userId) return list;
    return list.filter((d) => d.userId.toLowerCase() === userId.toLowerCase());
  }

  static getDesignatedMatches(userId?: string): { match: Match; designation: MatchDesignation }[] {
    this.ensureLoaded();
    const designations = this.getDesignations(userId);
    const matchesMap = new Map<string, Match>();
    inMemoryData.matches.forEach((m) => matchesMap.set(m.id, m));

    const result: { match: Match; designation: MatchDesignation }[] = [];
    designations.forEach((des) => {
      const match = matchesMap.get(des.matchId);
      if (match) {
        result.push({ match, designation: des });
      }
    });

    // Ordina: prima le gare in programma (giornata crescente), poi quelle disputate (giornata decrescente)
    return result.sort((a, b) => {
      if (a.match.played !== b.match.played) {
        return a.match.played ? 1 : -1;
      }
      return a.match.played
        ? (b.match.matchDay || 0) - (a.match.matchDay || 0)
        : (a.match.matchDay || 0) - (b.match.matchDay || 0);
    });
  }

  static isMatchDesignated(matchId: string, userId?: string): boolean {
    this.ensureLoaded();
    const designations = this.getDesignations(userId);
    return designations.some((d) => d.matchId === matchId);
  }

  static getMatchDesignation(matchId: string, userId?: string): MatchDesignation | undefined {
    this.ensureLoaded();
    const designations = this.getDesignations(userId);
    return designations.find((d) => d.matchId === matchId);
  }

  static setMatchDesignation(
    matchId: string,
    userId: string,
    data: Partial<MatchDesignation>
  ): MatchDesignation {
    this.ensureLoaded();
    if (!inMemoryData.designations) {
      inMemoryData.designations = [];
    }

    const matchIdx = inMemoryData.matches.findIndex((m) => m.id === matchId);
    if (matchIdx === -1) throw new Error('Partita non trovata');

    const desIdx = inMemoryData.designations.findIndex(
      (d) => d.matchId === matchId && d.userId.toLowerCase() === userId.toLowerCase()
    );

    const now = new Date().toISOString();
    let designation: MatchDesignation;

    if (desIdx >= 0) {
      designation = {
        ...inMemoryData.designations[desIdx],
        ...data,
        updatedAt: now,
      };
      inMemoryData.designations[desIdx] = designation;
    } else {
      designation = {
        id: `des-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        matchId,
        userId,
        role: data.role || 'AE',
        assistant1: data.assistant1 || '',
        assistant2: data.assistant2 || '',
        observer: data.observer || '',
        customDateText: data.customDateText || inMemoryData.matches[matchIdx].dateText,
        customField: data.customField || inMemoryData.matches[matchIdx].matchField,
        notes: data.notes || '',
        yellowCardsGiven: data.yellowCardsGiven,
        redCardsGiven: data.redCardsGiven,
        penaltiesAwarded: data.penaltiesAwarded,
        refereeScore: data.refereeScore,
        diariaEuro: data.diariaEuro,
        travelKm: data.travelKm,
        designatedAt: now,
        updatedAt: now,
        ...data,
      };
      inMemoryData.designations.unshift(designation);
    }

    // Aggiorna anche il match corrispondente
    const profile = inMemoryData.profiles.find((p) => p.username === userId);
    inMemoryData.matches[matchIdx] = {
      ...inMemoryData.matches[matchIdx],
      designatedRefereeId: userId,
      refereeRole: designation.role,
      refereeName: profile?.displayName || inMemoryData.matches[matchIdx].refereeName || 'Samuele Romini',
      assistant1: designation.assistant1,
      assistant2: designation.assistant2,
      observer: designation.observer,
      designationNotes: designation.notes,
      updatedAt: now,
    };

    this.persist();

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('refstudio-designations-update', { detail: { matchId, userId } }));
    }

    return designation;
  }

  static removeMatchDesignation(matchId: string, userId?: string): boolean {
    this.ensureLoaded();
    if (!inMemoryData.designations) {
      inMemoryData.designations = [];
    }

    const lenBefore = inMemoryData.designations.length;
    inMemoryData.designations = inMemoryData.designations.filter((d) => {
      if (d.id === matchId) return false;
      if (d.matchId === matchId) {
        if (!userId) return false;
        return d.userId.toLowerCase() !== userId.toLowerCase();
      }
      return true;
    });

    const removed = inMemoryData.designations.length < lenBefore;

    const matchIdx = inMemoryData.matches.findIndex((m) => m.id === matchId);
    if (matchIdx >= 0) {
      if (!userId || inMemoryData.matches[matchIdx].designatedRefereeId?.toLowerCase() === userId.toLowerCase()) {
        inMemoryData.matches[matchIdx] = {
          ...inMemoryData.matches[matchIdx],
          designatedRefereeId: undefined,
          refereeRole: undefined,
          designationNotes: undefined,
          assistant1: undefined,
          assistant2: undefined,
          observer: undefined,
        };
      }
    }

    this.persist();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('refstudio-designations-update', { detail: { matchId, userId } }));
    }

    return removed;
  }

  static deleteDesignationById(designationId: string): boolean {
    this.ensureLoaded();
    if (!inMemoryData.designations) return false;
    const target = inMemoryData.designations.find((d) => d.id === designationId);
    if (!target) return false;
    return this.removeMatchDesignation(target.matchId, target.userId);
  }

  static getNextOrLatestDesignatedMatch(userId: string = 'samueleromini'): {
    match: Match;
    isUpcoming: boolean;
    designation: MatchDesignation;
  } | null {
    this.ensureLoaded();
    const designatedList = this.getDesignatedMatches(userId);
    if (designatedList.length === 0) return null;

    // 1. Prossima partita non ancora giocata (upcoming), ordinata per giornata crescente
    const upcoming = designatedList
      .filter((d) => !d.match.played)
      .sort((a, b) => (a.match.matchDay || 0) - (b.match.matchDay || 0));

    if (upcoming.length > 0) {
      return {
        match: upcoming[0].match,
        isUpcoming: true,
        designation: upcoming[0].designation,
      };
    }

    // 2. Se non ci sono gare future, restituisce l'ultima disputata (giornata decrescente)
    const played = designatedList
      .filter((d) => d.match.played)
      .sort((a, b) => (b.match.matchDay || 0) - (a.match.matchDay || 0));

    if (played.length > 0) {
      return {
        match: played[0].match,
        isUpcoming: false,
        designation: played[0].designation,
      };
    }

    return null;
  }

  static getRefereePersonalStats(userId: string = 'samueleromini'): RefereePersonalStats {
    this.ensureLoaded();
    const designatedList = this.getDesignatedMatches(userId);

    const totalDesignations = designatedList.length;
    const playedMatches = designatedList.filter((d) => d.match.played).length;
    const upcomingMatches = totalDesignations - playedMatches;

    const roleCounts = {
      ae: designatedList.filter((d) => d.designation.role === 'AE' || !d.designation.role).length,
      aa: designatedList.filter(
        (d) => d.designation.role === 'AA' || d.designation.role === 'AA1' || d.designation.role === 'AA2'
      ).length,
      oa: designatedList.filter((d) => d.designation.role === 'OA').length,
    };

    let totalYellowCards = 0;
    let totalRedCards = 0;
    let totalGoals = 0;
    let totalPenalties = 0;
    let totalScores = 0;
    let scoreCount = 0;
    const teamCounts = new Map<string, number>();

    designatedList.forEach((d) => {
      const m = d.match;
      const des = d.designation;

      if (des.yellowCardsGiven !== undefined) {
        totalYellowCards += des.yellowCardsGiven;
      }

      if (des.redCardsGiven !== undefined) {
        totalRedCards += des.redCardsGiven;
      }

      if (des.penaltiesAwarded !== undefined) {
        totalPenalties += des.penaltiesAwarded;
      }

      if (des.refereeScore) {
        totalScores += des.refereeScore;
        scoreCount++;
      }

      if (m.played && m.homeScore !== undefined && m.awayScore !== undefined) {
        totalGoals += m.homeScore + m.awayScore;
      }

      if (m.homeTeamName) {
        teamCounts.set(m.homeTeamName, (teamCounts.get(m.homeTeamName) || 0) + 1);
      }
      if (m.awayTeamName) {
        teamCounts.set(m.awayTeamName, (teamCounts.get(m.awayTeamName) || 0) + 1);
      }
    });

    const avgCardsPerMatch = playedMatches > 0 ? Number((totalYellowCards / playedMatches).toFixed(1)) : 0;
    const avgGoalsPerMatch = playedMatches > 0 ? Number((totalGoals / playedMatches).toFixed(1)) : 0;
    const avgRefereeScore = scoreCount > 0 ? Number((totalScores / scoreCount).toFixed(2)) : undefined;

    const mostFrequentTeams = Array.from(teamCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalDesignations,
      playedMatches,
      upcomingMatches,
      roleCounts,
      totalYellowCards,
      totalRedCards,
      avgCardsPerMatch,
      totalGoals,
      avgGoalsPerMatch,
      totalPenalties,
      avgRefereeScore,
      teamsOfficiatedCount: teamCounts.size,
      mostFrequentTeams,
    };
  }

  static getStandings(girone: 'A' | 'B'): StandingRow[] {
    this.ensureLoaded();
    const raw = girone === 'A' ? inMemoryData.standingsA : inMemoryData.standingsB;

    // Deduplicazione difensiva: garantisce che ogni squadra compaia UNA SOLA VOLTA
    const map = new Map<string, StandingRow>();
    const sorted = [...raw].sort((a, b) => (b.played || 0) - (a.played || 0) || (b.points || 0) - (a.points || 0));
    sorted.forEach((r) => {
      const key = (r.teamName || r.teamId || '').toLowerCase().trim();
      if (key && !map.has(key)) {
        map.set(key, r);
      }
    });

    return Array.from(map.values())
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
        return (a.position || 0) - (b.position || 0);
      })
      .map((r, idx) => ({
        ...r,
        position: idx + 1,
      }));
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

  static registerProfile(data: {
    username: string;
    password?: string;
    displayName: string;
    email?: string;
    sectionAia: string;
    refereeRole: any;
    categoryAia?: string;
  }): UserAccount {
    this.ensureLoaded();
    const cleanUser = data.username.trim().toLowerCase();
    const existing = this.getProfileByUsername(cleanUser);
    if (existing) {
      throw new Error(`Lo username '${cleanUser}' è già registrato.`);
    }

    const now = new Date().toISOString();
    const newProfile: UserAccount = {
      username: cleanUser,
      password: data.password ? data.password.trim() : undefined,
      displayName: data.displayName.trim(),
      email: data.email ? data.email.trim() : undefined,
      role: 'arbitro',
      refereeRole: data.refereeRole || 'AE',
      sectionAia: data.sectionAia.trim() || 'AIA Emilia-Romagna',
      categoryAia: data.categoryAia?.trim() || 'Eccellenza',
      avatarUrl: '',
      isApproved: false, // In attesa di validazione da parte di rominisamuele@gmail.com
      status: 'PENDING',
      requestedAt: now,
      updatedAt: now,
    };

    inMemoryData.profiles.push(newProfile);
    this.persist();

    if (isSupabaseConfigured()) {
      SupabaseService.upsertProfile(newProfile).catch((err) =>
        console.warn('Errore salvataggio profilo su Supabase:', err)
      );
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('refstudio-sync-update', { detail: { profileRegistered: cleanUser } }));
    }

    return newProfile;
  }

  static approveProfile(username: string): UserAccount {
    this.ensureLoaded();
    const profile = this.getProfileByUsername(username);
    if (!profile) throw new Error('Profilo non trovato');

    return this.updateProfile(username, {
      isApproved: true,
      status: 'APPROVED',
      approvedAt: new Date().toISOString(),
    });
  }

  static rejectProfile(username: string): UserAccount {
    this.ensureLoaded();
    const profile = this.getProfileByUsername(username);
    if (!profile) throw new Error('Profilo non trovato');

    return this.updateProfile(username, {
      isApproved: false,
      status: 'REJECTED',
    });
  }

  static getPendingProfiles(): UserAccount[] {
    this.ensureLoaded();
    return this.getProfiles().filter((p) => p.status === 'PENDING' || p.isApproved === false);
  }

  static getVideos(targetType?: string, targetId?: string, targetName?: string): VideoClip[] {
    this.ensureLoaded();
    let list = inMemoryData.videos || [];
    if (targetType) {
      const cleanType = targetType.toLowerCase().trim();
      list = list.filter((v) => v.targetType && v.targetType.toLowerCase().trim() === cleanType);
    }
    if (targetId) {
      const cleanId = String(targetId).toLowerCase().trim();
      const cleanName = targetName ? targetName.toLowerCase().trim() : '';
      list = list.filter((v) => {
        if (v.targetId && String(v.targetId).toLowerCase().trim() === cleanId) {
          return true;
        }
        if (cleanName && v.targetName && (v.targetName.toLowerCase().includes(cleanName) || cleanName.includes(v.targetName.toLowerCase()))) {
          return true;
        }
        return false;
      });
    }
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

  static getState(): DatabaseState {
    this.ensureLoaded();
    return inMemoryData;
  }

  static replaceFullDataset(newDataset: typeof defaultDataset | any) {
    this.ensureLoaded();
    inMemoryData = {
      ...inMemoryData,
      teams: [...(newDataset.teams as unknown as Team[])],
      players: [...(newDataset.players as unknown as Player[])],
      matches: [...(newDataset.matches as unknown as Match[])],
      standingsA: [...(newDataset.standingsA as unknown as StandingRow[])],
      standingsB: [...(newDataset.standingsB as unknown as StandingRow[])],
      designations: inMemoryData.designations || [],
    };
    this.applyDesignationsToMatches();
    this.persist();

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('refstudio-sync-update', { detail: { fullSync: true } }));
    }

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
      designations: [],
    };
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    this.persist();
  }
}
