import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const PATHS = {
  gironeA: 'C:\\Users\\romin\\PyCharmMiscProject\\Progetti python\\Progetti\\5-scraper tuttocampo\\Eccellenza_Emilia_Romagna_Girone_A.xlsx',
  gironeB: 'C:\\Users\\romin\\PyCharmMiscProject\\Progetti python\\Progetti\\5-scraper tuttocampo\\Eccellenza_Emilia_Romagna_Girone_B.xlsx',
  gareClassifica: 'C:\\Users\\romin\\PyCharmMiscProject\\Progetti python\\Progetti\\5-scraper tuttocampo\\Eccellenza_Emilia_Romagna_Gare_Classifica.xlsx',
};

function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function parseBirthDateAndAge(val) {
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

function normalizeRole(roleStr) {
  if (!roleStr) return 'SCONOSCIUTO';
  const r = String(roleStr).trim().toUpperCase();
  if (r.startsWith('P') || r === 'POR' || r === 'PORTIERE') return 'POR';
  if (r.startsWith('D') || r === 'DIF' || r === 'DIFENSORE') return 'DIF';
  if (r.startsWith('C') || r === 'CEN' || r === 'CENTROCAMPISTA') return 'CEN';
  if (r.startsWith('A') || r === 'ATT' || r === 'ATTACCANTE') return 'ATT';
  return 'SCONOSCIUTO';
}

console.log('⚽ REFSTUDIO - Inizio estrazione e sincronizzazione Excel...');

// 1. Leggi Classifiche
const gareClasWb = XLSX.readFile(PATHS.gareClassifica);
const standings = { A: [], B: [] };
const standingsMap = new Map();

for (const g of ['A', 'B']) {
  const sheetName = `Girone ${g} - Classifica`;
  const sheet = gareClasWb.Sheets[sheetName];
  if (sheet) {
    const rows = XLSX.utils.sheet_to_json(sheet);
    for (const r of rows) {
      const teamName = String(r['Squadra'] || '').trim();
      if (!teamName) continue;
      const s = {
        position: parseInt(r['Posizione'] || 0, 10),
        teamName,
        teamId: slugify(teamName),
        girone: g,
        points: parseInt(r['Punti'] || 0, 10),
        played: parseInt(r['Partite giocate'] || 0, 10),
        won: parseInt(r['Vittorie'] || 0, 10),
        drawn: parseInt(r['Pareggi'] || 0, 10),
        lost: parseInt(r['Sconfitte'] || 0, 10),
        goalsFor: parseInt(r['Gol fatti'] || 0, 10),
        goalsAgainst: parseInt(r['Gol subiti'] || 0, 10),
        goalDifference: parseInt(r['Differenza reti'] || 0, 10),
      };
      standings[g].push(s);
      standingsMap.set(`${g}-${s.teamId}`, s);
    }
  }
}

console.log(`✅ Classifiche lette: Girone A (${standings.A.length} squadre), Girone B (${standings.B.length} squadre)`);

// 2. Leggi Partite
const matches = [];
for (const g of ['A', 'B']) {
  const sheetName = `Girone ${g} - Gare`;
  const sheet = gareClasWb.Sheets[sheetName];
  if (sheet) {
    const rows = XLSX.utils.sheet_to_json(sheet);
    for (const r of rows) {
      const day = parseInt(r['Numero giornata'] || 0, 10);
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

      matches.push({
        id: `girone-${g.toLowerCase()}-g${day}-${homeId}-vs-${awayId}`,
        championshipId: `eccellenza-er-girone-${g.toLowerCase()}`,
        girone: g,
        matchDay: day,
        dateText,
        played,
        homeTeamId: homeId,
        homeTeamName: homeName,
        awayTeamId: awayId,
        awayTeamName: awayName,
        homeScore: isNaN(homeScore) ? null : homeScore,
        awayScore: isNaN(awayScore) ? null : awayScore,
        refereeName: '',
        matchField: '',
        observations: '',
        updatedAt: new Date().toISOString(),
      });
    }
  }
}
console.log(`✅ Partite di calendario estratte: ${matches.length} gare`);

// 3. Leggi Squadre e Calciatori dai file Girone A e B
const teams = [];
const players = [];

for (const g of ['A', 'B']) {
  const filePath = g === 'A' ? PATHS.gironeA : PATHS.gironeB;
  const wb = XLSX.readFile(filePath);

  for (const sheetName of wb.SheetNames) {
    const teamName = sheetName.trim();
    const teamId = slugify(teamName);
    const standingInfo = standingsMap.get(`${g}-${teamId}`);

    const team = {
      id: teamId,
      championshipId: `eccellenza-er-girone-${g.toLowerCase()}`,
      name: teamName,
      normalizedName: teamName.toLowerCase(),
      girone: g,
      city: '',
      logoUrl: '',
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
      stats: standingInfo ? {
        position: standingInfo.position,
        points: standingInfo.points,
        played: standingInfo.played,
        won: standingInfo.won,
        drawn: standingInfo.drawn,
        lost: standingInfo.lost,
        goalsFor: standingInfo.goalsFor,
        goalsAgainst: standingInfo.goalsAgainst,
        goalDifference: standingInfo.goalDifference,
      } : null,
      updatedAt: new Date().toISOString(),
    };
    teams.push(team);

    // Parse players
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);
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

      let disciplinaryStatus = 'REGOLARE';
      if (redCards > 0) {
        disciplinaryStatus = 'SQUALIFICATO';
      } else if (yellowCards >= 4) {
        disciplinaryStatus = 'DIFFIDATO';
      }

      const customTags = [];
      if (yellowCards >= 3) customTags.push('aggressivo');
      if (redCards > 0) customTags.push('osservare');

      const playerId = `${teamId}-${slugify(lastName)}-${slugify(firstName)}`;

      players.push({
        id: playerId,
        teamId,
        teamName,
        championshipId: `eccellenza-er-girone-${g.toLowerCase()}`,
        girone: g,
        firstName,
        lastName,
        birthDate: birthDate || null,
        age: age || null,
        role,
        kitNumber: null,
        heightCm: null,
        preferredFoot: null,
        goals,
        appearances,
        yellowCards,
        redCards,
        disciplinaryStatus,
        customTags,
        refereeNotes: '',
        updatedAt: new Date().toISOString(),
      });
    }
  }
}

console.log(`✅ Squadre caricate: ${teams.length}`);
console.log(`✅ Giocatori caricati: ${players.length}`);

// 4. Salva dataset consolidato
const dataDir = path.resolve('src/data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dataset = {
  championships: [
    {
      id: 'eccellenza-er-girone-a',
      name: 'Eccellenza',
      season: '2024/2025',
      region: 'Emilia-Romagna',
      category: 'Eccellenza',
      girone: 'A',
      totalTeams: teams.filter(t => t.girone === 'A').length,
      lastSyncedAt: new Date().toISOString(),
    },
    {
      id: 'eccellenza-er-girone-b',
      name: 'Eccellenza',
      season: '2024/2025',
      region: 'Emilia-Romagna',
      category: 'Eccellenza',
      girone: 'B',
      totalTeams: teams.filter(t => t.girone === 'B').length,
      lastSyncedAt: new Date().toISOString(),
    },
  ],
  teams,
  players,
  matches,
  standingsA: standings.A,
  standingsB: standings.B,
  syncMeta: {
    syncedAt: new Date().toISOString(),
    totalTeams: teams.length,
    totalPlayers: players.length,
    totalMatches: matches.length,
  }
};

const outFile = path.join(dataDir, 'dataset.json');
fs.writeFileSync(outFile, JSON.stringify(dataset, null, 2), 'utf-8');
console.log(`💾 Dataset salvato con successo in: ${outFile}`);
