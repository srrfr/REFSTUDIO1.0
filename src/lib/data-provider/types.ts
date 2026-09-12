/**
 * REFSTUDIO - Data Provider Abstraction Layer Interface
 * 
 * Questa interfaccia astrae la fonte dei dati sportivi (file Excel, API web o web scraper).
 * Permette di aggiornare periodicamente la base dati semplicemente sostituendo i file Excel
 * o collegando un futuro provider HTTP senza modificare la logica applicativa.
 */

import { Championship, Team, Player, Match, StandingRow } from '@/types/refstudio';

export interface DataProviderOptions {
  gironeAPath?: string;
  gironeBPath?: string;
  gareClassificaPath?: string;
  season?: string;
  region?: string;
}

export interface SyncStats {
  championshipsSynced: number;
  teamsCreated: number;
  teamsUpdated: number;
  playersCreated: number;
  playersUpdated: number;
  matchesSynced: number;
  standingsSynced: number;
  errors: string[];
}

export interface SyncResult {
  success: boolean;
  timestamp: string;
  stats: SyncStats;
  sourceType: 'EXCEL' | 'SCRAPER' | 'API' | 'MOCK';
}

export interface ValidationReport {
  isValid: boolean;
  warnings: string[];
  missingSheets: string[];
  unexpectedColumns: string[];
}

export interface IDataProvider {
  /** Nome identificativo del provider (es: "Excel File Provider", "Tuttocampo Scraper") */
  readonly providerName: string;

  /** Validazione preliminare dei dati sorgente (struttura file, colonne, fogli) */
  validate(): Promise<ValidationReport>;

  /** Carica tutti i campionati gestiti */
  getChampionships(): Promise<Championship[]>;

  /** Carica l'elenco delle squadre (opzionalmente filtrate per campionato o girone) */
  getTeams(girone?: 'A' | 'B'): Promise<Team[]>;

  /** Carica i giocatori (opzionalmente per squadra o girone) */
  getPlayers(teamIdOrName?: string, girone?: 'A' | 'B'): Promise<Player[]>;

  /** Carica le partite di calendario e risultati */
  getMatches(girone?: 'A' | 'B', matchDay?: number): Promise<Match[]>;

  /** Carica la classifica per il girone */
  getStandings(girone: 'A' | 'B'): Promise<StandingRow[]>;

  /**
   * Esegue la sincronizzazione completa estraendo tutti i dati
   * e restituendo un aggregato normalizzato pronto per Firestore o cache locale
   */
  loadFullDataset(): Promise<{
    championships: Championship[];
    teams: Team[];
    players: Player[];
    matches: Match[];
    standingsA: StandingRow[];
    standingsB: StandingRow[];
  }>;
}
