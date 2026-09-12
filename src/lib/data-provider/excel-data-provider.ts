import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import {
  IDataProvider,
  DataProviderOptions,
  ValidationReport,
} from './types';
import {
  Championship,
  Team,
  Player,
  Match,
  StandingRow,
  RoleCategory,
  DisciplinaryStatus,
} from '@/types/refstudio';

export const DEFAULT_EXCEL_PATHS = {
  gironeA:
    'C:\\Users\\romin\\PyCharmMiscProject\\Progetti python\\Progetti\\5-scraper tuttocampo\\Eccellenza_Emilia_Romagna_Girone_A.xlsx',
  gironeB:
    'C:\\Users\\romin\\PyCharmMiscProject\\Progetti python\\Progetti\\5-scraper tuttocampo\\Eccellenza_Emilia_Romagna_Girone_B.xlsx',
  gareClassifica:
    'C:\\Users\\romin\\PyCharmMiscProject\\Progetti python\\Progetti\\5-scraper tuttocampo\\Eccellenza_Emilia_Romagna_Gare_Classifica.xlsx',
};

export function resolveCandidatePath(fileName: string, fallbackExternal: string): string {
  const candidates = [
    path.resolve(process.cwd(), 'data', 'excel', fileName),
    path.resolve(process.cwd(), fileName),
    fallbackExternal,
  ];

  for (const c of candidates) {
    if (c && fs.existsSync(c)) {
      return c;
    }
  }
  return candidates[0];
}

export function safeReadWorkbook(filePath: string): XLSX.WorkBook {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File non trovato: ${filePath}`);
  }
  const buffer = fs.readFileSync(filePath);
  return XLSX.read(buffer, { type: 'buffer' });
}

export function findSheetByName(wb: XLSX.WorkBook, targetName: string): XLSX.WorkSheet | undefined {
  if (wb.Sheets[targetName]) return wb.Sheets[targetName];
  const normTarget = targetName.trim().toLowerCase();
  for (const name of wb.SheetNames) {
    if (name.trim().toLowerCase() === normTarget) {
      return wb.Sheets[name];
    }
  }
  return undefined;
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function parseBirthDateAndAge(val: any): { birthDate?: string; age?: number } {
  if (!val) return {};

  let dateStr = '';
  if (val instanceof Date) {
    const d = String(val.getDate()).padStart(2, '0');
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const y = val.getFullYear();
    dateStr = `${d}-${m}-${y}`;
  } else {
    dateStr = String(val).trim();
  }

  // Expect DD-MM-YYYY or DD/MM/YYYY or YYYY-MM-DD
  const parts = dateStr.split(/[-/]/);
  let birthYear = 0;
  if (parts.length === 3) {
    if (parts[2].length === 4) {
      birthYear = parseInt(parts[2], 10);
    } else if (parts[0].length === 4) {
      birthYear = parseInt(parts[0], 10);
    }
  }

  const currentYear = new Date().getFullYear();
  const age = birthYear > 1940 && birthYear <= currentYear ? currentYear - birthYear : undefined;

  return { birthDate: dateStr, age };
}

export function normalizeRole(roleStr: any): RoleCategory {
  if (!roleStr) return 'SCONOSCIUTO';
  const r = String(roleStr).trim().toUpperCase();
  if (r.startsWith('P') || r === 'POR' || r === 'PORTIERE') return 'POR';
  if (r.startsWith('D') || r === 'DIF' || r === 'DIFENSORE') return 'DIF';
  if (r.startsWith('C') || r === 'CEN' || r === 'CENTROCAMPISTA') return 'CEN';
  if (r.startsWith('A') || r === 'ATT' || r === 'ATTACCANTE') return 'ATT';
  return 'SCONOSCIUTO';
}

export class ExcelDataProvider implements IDataProvider {
  readonly providerName = 'Excel File Provider (Eccellenza Emilia-Romagna)';
  private options: DataProviderOptions;

  constructor(options?: DataProviderOptions) {
    this.options = {
      gironeAPath: options?.gironeAPath || resolveCandidatePath('Eccellenza_Emilia_Romagna_Girone_A.xlsx', DEFAULT_EXCEL_PATHS.gironeA),
      gironeBPath: options?.gironeBPath || resolveCandidatePath('Eccellenza_Emilia_Romagna_Girone_B.xlsx', DEFAULT_EXCEL_PATHS.gironeB),
      gareClassificaPath: options?.gareClassificaPath || resolveCandidatePath('Eccellenza_Emilia_Romagna_Gare_Classifica.xlsx', DEFAULT_EXCEL_PATHS.gareClassifica),
      season: options?.season || '2024/2025',
      region: options?.region || 'Emilia-Romagna',
    };
  }

  async validate(): Promise<ValidationReport> {
    const report: ValidationReport = {
      isValid: true,
      warnings: [],
      missingSheets: [],
      unexpectedColumns: [],
    };

    const files = [
      { name: 'Girone A', path: this.options.gironeAPath! },
      { name: 'Girone B', path: this.options.gironeBPath! },
      { name: 'Gare & Classifica', path: this.options.gareClassificaPath! },
    ];

    for (const f of files) {
      if (!fs.existsSync(f.path)) {
        report.isValid = false;
        report.warnings.push(`File mancante per ${f.name} (percorso: ${f.path})`);
      }
    }

    if (!report.isValid) return report;

    // Check Gare e Classifica sheets
    try {
      const wb = safeReadWorkbook(this.options.gareClassificaPath!);
      const requiredSheets = [
        'Girone A - Gare',
        'Girone A - Classifica',
        'Girone B - Gare',
        'Girone B - Classifica',
      ];
      for (const req of requiredSheets) {
        if (!findSheetByName(wb, req)) {
          report.isValid = false;
          report.missingSheets.push(req);
        }
      }
    } catch (e: any) {
      report.isValid = false;
      report.warnings.push(`Impossibile leggere file Gare/Classifica: ${e.message}`);
    }

    return report;
  }

  async getChampionships(): Promise<Championship[]> {
    return [
      {
        id: 'eccellenza-er-girone-a',
        name: 'Eccellenza',
        season: this.options.season!,
        region: this.options.region!,
        category: 'Eccellenza',
        girone: 'A',
        totalTeams: 18,
        lastSyncedAt: new Date().toISOString(),
      },
      {
        id: 'eccellenza-er-girone-b',
        name: 'Eccellenza',
        season: this.options.season!,
        region: this.options.region!,
        category: 'Eccellenza',
        girone: 'B',
        totalTeams: 18,
        lastSyncedAt: new Date().toISOString(),
      },
    ];
  }

  async getTeams(girone?: 'A' | 'B'): Promise<Team[]> {
    const gironiToLoad: ('A' | 'B')[] = girone ? [girone] : ['A', 'B'];
    const teams: Team[] = [];

    for (const g of gironiToLoad) {
      const filePath = g === 'A' ? this.options.gironeAPath! : this.options.gironeBPath!;
      if (!fs.existsSync(filePath)) continue;

      const wb = safeReadWorkbook(filePath);
      const standings = await this.getStandings(g);
      const standingsMap = new Map<string, StandingRow>();
      standings.forEach((st) => {
        standingsMap.set(slugify(st.teamName), st);
      });

      for (const sheetName of wb.SheetNames) {
        const teamName = sheetName.trim();
        const teamId = slugify(teamName);
        const stats = standingsMap.get(teamId);

        teams.push({
          id: teamId,
          championshipId: `eccellenza-er-girone-${g.toLowerCase()}`,
          name: teamName,
          normalizedName: teamName.toLowerCase(),
          girone: g,
          city: '',
          stadium: '',
          stadiumAddress: '',
          pitchSurface: 'Erba Naturale',
          tuttocampoUrl: '',
          technicalLevel: 3,
          aggressionLevel: 3,
          benchAttitude: 'Da valutare',
          coachAttitude: 'Da valutare',
          coachName: '',
          managerName: '',
          refereeNotes: '',
          stats: stats
            ? {
                position: stats.position,
                points: stats.points,
                played: stats.played,
                won: stats.won,
                drawn: stats.drawn,
                lost: stats.lost,
                goalsFor: stats.goalsFor,
                goalsAgainst: stats.goalsAgainst,
                goalDifference: stats.goalDifference,
              }
            : undefined,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    return teams;
  }

  async getPlayers(teamIdOrName?: string, girone?: 'A' | 'B'): Promise<Player[]> {
    const gironiToLoad: ('A' | 'B')[] = girone ? [girone] : ['A', 'B'];
    const allPlayers: Player[] = [];

    for (const g of gironiToLoad) {
      const filePath = g === 'A' ? this.options.gironeAPath! : this.options.gironeBPath!;
      if (!fs.existsSync(filePath)) continue;

      const wb = safeReadWorkbook(filePath);
      for (const sheetName of wb.SheetNames) {
        const teamName = sheetName.trim();
        const teamId = slugify(teamName);

        if (teamIdOrName && teamId !== slugify(teamIdOrName) && teamName !== teamIdOrName) {
          continue;
        }

        const sheet = wb.Sheets[sheetName];
        if (!sheet) continue;
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);

        for (const r of rows) {
          const firstName = String(r['Nome'] || '').trim();
          const lastName = String(r['Cognome'] || '').trim();
          if (!firstName && !lastName) continue;

          const { birthDate, age } = parseBirthDateAndAge(r['Data di nascita']);
          const role = normalizeRole(r['Ruolo']);
          const goals = parseInt(r['Gol'] || 0, 10) || 0;
          const appearances = parseInt(r['Presenze'] || 0, 10) || 0;
          const yellowCards = parseInt(r['Ammonizioni'] || 0, 10) || 0;
          const redCards = parseInt(r['Espulsioni'] || 0, 10) || 0;

          // Disciplinary status heuristic based on cards
          let disciplinaryStatus: DisciplinaryStatus = 'REGOLARE';
          if (redCards > 0) {
            disciplinaryStatus = 'SQUALIFICATO';
          } else if (yellowCards >= 4) {
            disciplinaryStatus = 'DIFFIDATO';
          }

          const playerId = `${teamId}-${slugify(lastName)}-${slugify(firstName)}`;

          allPlayers.push({
            id: playerId,
            teamId,
            teamName,
            championshipId: `eccellenza-er-girone-${g.toLowerCase()}`,
            girone: g,
            firstName,
            lastName,
            birthDate,
            age,
            role,
            kitNumber: undefined,
            heightCm: undefined,
            preferredFoot: undefined,
            goals,
            appearances,
            yellowCards,
            redCards,
            disciplinaryStatus,
            customTags: yellowCards >= 3 ? ['aggressivo'] : [],
            refereeNotes: '',
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    return allPlayers;
  }

  async getMatches(girone?: 'A' | 'B', matchDay?: number): Promise<Match[]> {
    const filePath = this.options.gareClassificaPath!;
    if (!fs.existsSync(filePath)) return [];

    const wb = safeReadWorkbook(filePath);
    const gironiToLoad: ('A' | 'B')[] = girone ? [girone] : ['A', 'B'];
    const allMatches: Match[] = [];

    for (const g of gironiToLoad) {
      const sheet = findSheetByName(wb, `Girone ${g} - Gare`);
      if (!sheet) continue;

      const rows: any[] = XLSX.utils.sheet_to_json(sheet);
      for (const r of rows) {
        const day = parseInt(r['Numero giornata'] || 0, 10);
        if (matchDay && day !== matchDay) continue;

        const homeName = String(r['Squadra ospitante'] || '').trim();
        const awayName = String(r['Squadra ospite'] || '').trim();
        if (!homeName || !awayName) continue;

        const homeId = slugify(homeName);
        const awayId = slugify(awayName);
        const played = String(r['Giocata'] || '').toLowerCase() === 'si';
        const dateText = String(r['Data'] || `Giornata ${day}`).trim();

        const homeScoreRaw = r['Reti squadra ospitante'];
        const awayScoreRaw = r['Reti squadra ospite'];

        const homeScore = homeScoreRaw !== undefined && homeScoreRaw !== null && homeScoreRaw !== '' 
          ? parseInt(homeScoreRaw, 10) 
          : undefined;
        const awayScore = awayScoreRaw !== undefined && awayScoreRaw !== null && awayScoreRaw !== '' 
          ? parseInt(awayScoreRaw, 10) 
          : undefined;

        const matchId = `girone-${g.toLowerCase()}-g${day}-${homeId}-vs-${awayId}`;

        allMatches.push({
          id: matchId,
          championshipId: `eccellenza-er-girone-${g.toLowerCase()}`,
          girone: g,
          matchDay: day,
          dateText,
          played,
          homeTeamId: homeId,
          homeTeamName: homeName,
          awayTeamId: awayId,
          awayTeamName: awayName,
          homeScore: isNaN(homeScore as any) ? undefined : homeScore,
          awayScore: isNaN(awayScore as any) ? undefined : awayScore,
          refereeName: '',
          matchField: '',
          observations: '',
          updatedAt: new Date().toISOString(),
        });
      }
    }

    return allMatches;
  }

  async getStandings(girone: 'A' | 'B'): Promise<StandingRow[]> {
    const filePath = this.options.gareClassificaPath!;
    if (!fs.existsSync(filePath)) return [];

    const wb = safeReadWorkbook(filePath);
    const sheet = findSheetByName(wb, `Girone ${girone} - Classifica`);
    if (!sheet) return [];

    const rows: any[] = XLSX.utils.sheet_to_json(sheet);
    const standings: StandingRow[] = [];

    for (const r of rows) {
      const teamName = String(r['Squadra'] || '').trim();
      if (!teamName) continue;

      standings.push({
        position: parseInt(r['Posizione'] || 0, 10),
        teamName,
        teamId: slugify(teamName),
        points: parseInt(r['Punti'] || 0, 10),
        played: parseInt(r['Partite giocate'] || 0, 10),
        won: parseInt(r['Vittorie'] || 0, 10),
        drawn: parseInt(r['Pareggi'] || 0, 10),
        lost: parseInt(r['Sconfitte'] || 0, 10),
        goalsFor: parseInt(r['Gol fatti'] || 0, 10),
        goalsAgainst: parseInt(r['Gol subiti'] || 0, 10),
        goalDifference: parseInt(r['Differenza reti'] || 0, 10),
      });
    }

    return standings;
  }

  async loadFullDataset() {
    const championships = await this.getChampionships();
    const [standingsA, standingsB] = await Promise.all([
      this.getStandings('A'),
      this.getStandings('B'),
    ]);
    const teams = await this.getTeams();
    const players = await this.getPlayers();
    const matches = await this.getMatches();

    return {
      championships,
      teams,
      players,
      matches,
      standingsA,
      standingsB,
    };
  }
}
