import * as XLSX from 'xlsx';
import { Team, Player, Match, StandingRow } from '@/types/refstudio';

export class ClientExcelParser {
  static slugify(str: string): string {
    return String(str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  static normalizeRole(roleStr: any): 'POR' | 'DIF' | 'CEN' | 'ATT' | 'SCONOSCIUTO' {
    if (!roleStr) return 'SCONOSCIUTO';
    const r = String(roleStr).trim().toUpperCase();
    if (r.startsWith('P') || r === 'POR') return 'POR';
    if (r.startsWith('D') || r === 'DIF') return 'DIF';
    if (r.startsWith('C') || r === 'CEN') return 'CEN';
    if (r.startsWith('A') || r === 'ATT') return 'ATT';
    return 'SCONOSCIUTO';
  }

  static parseWorkbook(wb: XLSX.WorkBook, existingState: any = {}): {
    success: boolean;
    dataset?: any;
    summary?: {
      teams: number;
      players: number;
      matches: number;
      standingsA: number;
      standingsB: number;
      notes: number;
      profiles: number;
    };
    error?: string;
  } {
    try {
      const calciatoriSheet = wb.Sheets['Calciatori'];
      if (!calciatoriSheet) {
        throw new Error('Foglio obbligatorio "Calciatori" non trovato nel file Excel.');
      }

      const existingTeamsMap = new Map<string, Team>();
      if (existingState.teams) {
        existingState.teams.forEach((t: Team) => existingTeamsMap.set(t.name.toLowerCase().trim(), t));
      }

      const existingPlayersMap = new Map<string, Player>();
      if (existingState.players) {
        existingState.players.forEach((p: Player) => {
          existingPlayersMap.set(p.id, p);
          existingPlayersMap.set(`${p.firstName} ${p.lastName}`.toLowerCase().trim(), p);
          existingPlayersMap.set(`${p.lastName} ${p.firstName}`.toLowerCase().trim(), p);
        });
      }

      const rawPlayers: any[] = XLSX.utils.sheet_to_json(calciatoriSheet);

      // 1. Squadre
      const teamsMap = new Map<string, Team>();
      const teamNameToId = new Map<string, string>();

      rawPlayers.forEach((p) => {
        const teamId = String(p['ID Rosa'] || '').trim();
        const teamName = String(p['Nome Rosa'] || '').trim();
        const gironeRaw = String(p['Girone'] || '').trim();
        const girone = gironeRaw.replace('Girone ', '').trim() as 'A' | 'B';

        if (teamId && !teamsMap.has(teamId)) {
          const existing = existingTeamsMap.get(teamName.toLowerCase());
          teamsMap.set(teamId, {
            id: teamId,
            championshipId: `eccellenza-er-girone-${girone.toLowerCase()}`,
            name: teamName,
            normalizedName: this.slugify(teamName),
            girone: girone,
            city: existing?.city || '',
            logoUrl: existing?.logoUrl || '',
            stadium: existing?.stadium || '',
            stadiumAddress: existing?.stadiumAddress || '',
            pitchSurface: existing?.pitchSurface || 'Erba Naturale',
            tuttocampoUrl: existing?.tuttocampoUrl || '',
            technicalLevel: existing?.technicalLevel || 3,
            aggressionLevel: existing?.aggressionLevel || 3,
            benchAttitude: existing?.benchAttitude || 'Da valutare',
            coachAttitude: existing?.coachAttitude || 'Da valutare',
            coachName: existing?.coachName || '',
            managerName: existing?.managerName || '',
            refereeNotes: existing?.refereeNotes || '',
            stats: existing?.stats || {
              position: 0,
              points: 0,
              played: 0,
              won: 0,
              drawn: 0,
              lost: 0,
              goalsFor: 0,
              goalsAgainst: 0,
              goalDifference: 0,
            },
            updatedAt: new Date().toISOString(),
          });
          teamNameToId.set(teamName.toLowerCase(), teamId);
        }
      });

      // Se non ci sono squadre nel file Excel, riutilizziamo quelle esistenti
      if (teamsMap.size === 0 && existingState.teams) {
        existingState.teams.forEach((t: Team) => {
          teamsMap.set(t.id, t);
          teamNameToId.set(t.name.toLowerCase(), t.id);
        });
      }

      // 2. Classifiche
      let standingsA: StandingRow[] = [];
      let standingsB: StandingRow[] = [];

      (['A', 'B'] as const).forEach((g) => {
        const sheet = wb.Sheets[`Girone ${g} - Classifica`];
        if (!sheet) return;
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);
        const targetArray = g === 'A' ? standingsA : standingsB;

        rows.forEach((r, idx) => {
          const teamName = String(r['Squadra'] || '').trim();
          if (!teamName || targetArray.some((s) => s.teamName.toLowerCase() === teamName.toLowerCase())) return;
          const teamId = teamNameToId.get(teamName.toLowerCase()) || this.slugify(teamName);
          const played = parseInt(r['Partite giocate'] || 0, 10);
          const points = parseInt(r['Punti'] || 0, 10);
          const won = parseInt(r['Vittorie'] || 0, 10);
          const drawn = parseInt(r['Pareggi'] || 0, 10);
          const lost = parseInt(r['Sconfitte'] || 0, 10);
          const goalsFor = parseInt(r['Gol fatti'] || 0, 10);
          const goalsAgainst = parseInt(r['Gol subiti'] || 0, 10);
          const goalDifference = parseInt(r['Differenza reti'] || goalsFor - goalsAgainst, 10);
          const position = parseInt(r['Posizione'] || idx + 1, 10);

          targetArray.push({
            position: position,
            teamName: teamName,
            teamId: teamId,
            points: points,
            played: played,
            won: won,
            drawn: drawn,
            lost: lost,
            goalsFor: goalsFor,
            goalsAgainst: goalsAgainst,
            goalDifference: goalDifference,
          });

          if (teamsMap.has(teamId)) {
            const sq = teamsMap.get(teamId)!;
            sq.stats = {
              position: position,
              points: points,
              played: played,
              won: won,
              drawn: drawn,
              lost: lost,
              goalsFor: goalsFor,
              goalsAgainst: goalsAgainst,
              goalDifference: goalDifference,
            };
          }
        });
      });

      // Se le classifiche nell'Excel caricato sono vuote, preserviamo quelle esistenti
      if (standingsA.length === 0 && existingState.standingsA?.length) {
        standingsA = existingState.standingsA;
      }
      if (standingsB.length === 0 && existingState.standingsB?.length) {
        standingsB = existingState.standingsB;
      }

      // 3. Calciatori
      const players: Player[] = [];
      const currentYear = new Date().getFullYear();

      rawPlayers.forEach((p) => {
        const playerId = String(p['ID Giocatore'] || '').trim();
        const teamId = String(p['ID Rosa'] || '').trim();
        const teamName = String(p['Nome Rosa'] || '').trim();
        const firstName = String(p['Nome'] || '').trim();
        const lastName = String(p['Cognome'] || '').trim();
        const girone = String(p['Girone'] || '').replace('Girone ', '').trim() as 'A' | 'B';
        const birthYearStr = String(p['Anno di nascita'] || '').trim();
        const birthYear = parseInt(birthYearStr, 10);
        const age = birthYear > 1940 && birthYear <= currentYear ? currentYear - birthYear : undefined;

        const appearances = parseInt(p['Presenze'] || 0, 10);
        const goals = parseInt(p['Reti'] || 0, 10);
        const yellowCards = parseInt(p['Ammonizioni'] || 0, 10);
        const redCards = parseInt(p['Espulsioni'] || 0, 10);

        let disciplinaryStatus: Player['disciplinaryStatus'] = 'REGOLARE';
        if (redCards > 0) disciplinaryStatus = 'SQUALIFICATO';
        else if (yellowCards >= 4) disciplinaryStatus = 'DIFFIDATO';

        const existingByFullName =
          existingPlayersMap.get(playerId) ||
          existingPlayersMap.get(`${firstName} ${lastName}`.toLowerCase().trim()) ||
          existingPlayersMap.get(`${lastName} ${firstName}`.toLowerCase().trim());

        const customTags = existingByFullName?.customTags || [];
        const refereeNotes = existingByFullName?.refereeNotes || '';

        players.push({
          id: playerId,
          teamId: teamId,
          teamName: teamName,
          championshipId: `eccellenza-er-girone-${girone.toLowerCase()}`,
          girone: girone,
          firstName: firstName,
          lastName: lastName,
          birthDate: birthYearStr ? `01-01-${birthYearStr}` : undefined,
          age: age,
          role: this.normalizeRole(p['Ruolo']),
          goals: goals,
          appearances: appearances,
          yellowCards: yellowCards,
          redCards: redCards,
          disciplinaryStatus: disciplinaryStatus,
          customTags: customTags,
          refereeNotes: refereeNotes,
          updatedAt: new Date().toISOString(),
        });
      });

      // 4. Partite
      let matches: Match[] = [];
      (['A', 'B'] as const).forEach((g) => {
        const sheet = wb.Sheets[`Girone ${g} - Gare`];
        if (!sheet) return;
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);

        rows.forEach((r) => {
          const matchDay = parseInt(r['Numero giornata'] || 1, 10);
          const dateText = String(r['Data'] || `Giornata ${matchDay}`).trim();
          const homeName = String(r['Squadra ospitante'] || '').trim();
          const awayName = String(r['Squadra ospite'] || '').trim();
          const homeTeamId = teamNameToId.get(homeName.toLowerCase()) || this.slugify(homeName);
          const awayTeamId = teamNameToId.get(awayName.toLowerCase()) || this.slugify(awayName);

          const isPlayed = String(r['Giocata'] || '').trim().toLowerCase() === 'si';
          const homeScore = isPlayed && r['Reti squadra ospitante'] !== undefined ? parseInt(r['Reti squadra ospitante'], 10) : undefined;
          const awayScore = isPlayed && r['Reti squadra ospite'] !== undefined ? parseInt(r['Reti squadra ospite'], 10) : undefined;

          const matchId = `match-${g}-${matchDay}-${homeTeamId}-${awayTeamId}`;
          if (matches.some((m) => m.id === matchId)) return;

          matches.push({
            id: matchId,
            championshipId: `eccellenza-er-girone-${g.toLowerCase()}`,
            girone: g,
            matchDay: matchDay,
            dateText: dateText,
            played: isPlayed,
            homeTeamId: homeTeamId,
            homeTeamName: homeName,
            awayTeamId: awayTeamId,
            awayTeamName: awayName,
            homeScore: homeScore,
            awayScore: awayScore,
            refereeName: 'Da designare',
            matchField: 'Campo Federale',
            observations: '',
            updatedAt: new Date().toISOString(),
          });
        });
      });

      // Se le partite nell'Excel sono vuote, preserviamo quelle già caricate
      if (matches.length === 0 && existingState.matches?.length) {
        matches = existingState.matches;
      }

      // 5. Note
      const notes = existingState.notes || [];

      const finalDatabase = {
        teams: Array.from(teamsMap.values()),
        players: players.length > 0 ? players : (existingState.players || []),
        matches: matches,
        standingsA: standingsA,
        standingsB: standingsB,
        notes: notes,
        videos: existingState.videos || [],
        profiles: existingState.profiles || [],
      };

      return {
        success: true,
        dataset: finalDatabase,
        summary: {
          teams: finalDatabase.teams.length,
          players: finalDatabase.players.length,
          matches: finalDatabase.matches.length,
          standingsA: standingsA.length,
          standingsB: standingsB.length,
          notes: notes.length,
          profiles: (finalDatabase.profiles || []).length,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
      };
    }
  }
}
