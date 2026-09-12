import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const EXCEL_PATH = fs.existsSync('Eccellenza_Emilia_Romagna_Database_Completo.xlsx')
  ? 'Eccellenza_Emilia_Romagna_Database_Completo.xlsx'
  : 'data/excel/Eccellenza_Emilia_Romagna_Database_Completo.xlsx';
const wb = XLSX.readFile(EXCEL_PATH);

// 1. Carica stato esistente per preservare annotazioni, tag, note e profili
let existingState = {};
try {
  existingState = JSON.parse(fs.readFileSync('data/db-state.json', 'utf8'));
} catch (e) {}

const existingTeamsMap = new Map();
if (existingState.teams) {
  existingState.teams.forEach(t => existingTeamsMap.set(t.name.toLowerCase().trim(), t));
}

const existingPlayersMap = new Map();
if (existingState.players) {
  existingState.players.forEach(p => {
    const key = `${p.firstName} ${p.lastName}`.toLowerCase().trim();
    existingPlayersMap.set(key, p);
    existingPlayersMap.set(`${p.lastName} ${p.firstName}`.toLowerCase().trim(), p);
    existingPlayersMap.set(p.id, p);
  });
}

function normalizeRole(roleStr) {
  if (!roleStr) return 'SCONOSCIUTO';
  const r = String(roleStr).trim().toUpperCase();
  if (r.startsWith('P') || r === 'POR') return 'POR';
  if (r.startsWith('D') || r === 'DIF') return 'DIF';
  if (r.startsWith('C') || r === 'CEN') return 'CEN';
  if (r.startsWith('A') || r === 'ATT') return 'ATT';
  return 'SCONOSCIUTO';
}

function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

console.log('⚽ Estrazione Squadre da Calciatori...');
const rawPlayers = XLSX.utils.sheet_to_json(wb.Sheets['Calciatori']);

// Mappa Squadre per ID Rosa
const teamsMap = new Map();
const teamNameToId = new Map();

rawPlayers.forEach(p => {
  const teamId = String(p['ID Rosa'] || '').trim();
  const teamName = String(p['Nome Rosa'] || '').trim();
  const gironeRaw = String(p['Girone'] || '').trim();
  const girone = gironeRaw.replace('Girone ', '').trim();
  const category = String(p['Categoria'] || 'Eccellenza').trim();

  if (teamId && !teamsMap.has(teamId)) {
    const existing = existingTeamsMap.get(teamName.toLowerCase());
    teamsMap.set(teamId, {
      id: teamId, // ID Rosa ufficiale univoco
      championshipId: `eccellenza-er-girone-${girone.toLowerCase()}`,
      name: teamName,
      normalizedName: slugify(teamName),
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
        goalDifference: 0
      },
      updatedAt: new Date().toISOString()
    });
    teamNameToId.set(teamName.toLowerCase(), teamId);
  }
});

console.log(`✅ Squadre processate: ${teamsMap.size}`);

// 2. Classifiche
const standingsA = [];
const standingsB = [];

['A', 'B'].forEach(g => {
  const sheet = wb.Sheets[`Girone ${g} - Classifica`];
  if (!sheet) return;
  const rows = XLSX.utils.sheet_to_json(sheet);
  const targetArray = g === 'A' ? standingsA : standingsB;

  rows.forEach((r, idx) => {
    const teamName = String(r['Squadra'] || '').trim();
    const teamId = teamNameToId.get(teamName.toLowerCase()) || slugify(teamName);
    const played = parseInt(r['Partite giocate'] || 0, 10);
    const points = parseInt(r['Punti'] || 0, 10);
    const won = parseInt(r['Vittorie'] || 0, 10);
    const drawn = parseInt(r['Pareggi'] || 0, 10);
    const lost = parseInt(r['Sconfitte'] || 0, 10);
    const goalsFor = parseInt(r['Gol fatti'] || 0, 10);
    const goalsAgainst = parseInt(r['Gol subiti'] || 0, 10);
    const goalDifference = parseInt(r['Differenza reti'] || (goalsFor - goalsAgainst), 10);
    const position = parseInt(r['Posizione'] || (idx + 1), 10);

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
      goalDifference: goalDifference
    });

    // Aggiorna anche le stats della squadra
    if (teamsMap.has(teamId)) {
      const sq = teamsMap.get(teamId);
      sq.stats = {
        position: position,
        points: points,
        played: played,
        won: won,
        drawn: drawn,
        lost: lost,
        goalsFor: goalsFor,
        goalsAgainst: goalsAgainst,
        goalDifference: goalDifference
      };
    }
  });
});

console.log(`✅ Classifiche processate: Girone A (${standingsA.length}), Girone B (${standingsB.length})`);

// 3. Calciatori
const players = [];
const currentYear = new Date().getFullYear();

rawPlayers.forEach(p => {
  const playerId = String(p['ID Giocatore'] || '').trim();
  const teamId = String(p['ID Rosa'] || '').trim();
  const teamName = String(p['Nome Rosa'] || '').trim();
  const firstName = String(p['Nome'] || '').trim();
  const lastName = String(p['Cognome'] || '').trim();
  const girone = String(p['Girone'] || '').replace('Girone ', '').trim();
  const birthYearStr = String(p['Anno di nascita'] || '').trim();
  const birthYear = parseInt(birthYearStr, 10);
  const age = birthYear > 1940 && birthYear <= currentYear ? currentYear - birthYear : undefined;

  const appearances = parseInt(p['Presenze'] || 0, 10);
  const goals = parseInt(p['Reti'] || 0, 10);
  const yellowCards = parseInt(p['Ammonizioni'] || 0, 10);
  const redCards = parseInt(p['Espulsioni'] || 0, 10);

  let disciplinaryStatus = 'REGOLARE';
  if (redCards > 0) disciplinaryStatus = 'SQUALIFICATO';
  else if (yellowCards >= 4) disciplinaryStatus = 'DIFFIDATO';

  // Recupera eventuali tag e note precedentemente assegnate dall'arbitro
  const existingByFullName = existingPlayersMap.get(playerId)
    || existingPlayersMap.get(`${firstName} ${lastName}`.toLowerCase().trim())
    || existingPlayersMap.get(`${lastName} ${firstName}`.toLowerCase().trim());

  const customTags = existingByFullName?.customTags || [];
  const refereeNotes = existingByFullName?.refereeNotes || '';

  players.push({
    id: playerId, // ID Giocatore ufficiale univoco
    teamId: teamId, // ID Rosa ufficiale della squadra
    teamName: teamName,
    championshipId: `eccellenza-er-girone-${girone.toLowerCase()}`,
    girone: girone,
    firstName: firstName,
    lastName: lastName,
    birthDate: birthYearStr ? `01-01-${birthYearStr}` : undefined,
    age: age,
    role: normalizeRole(p['Ruolo']),
    goals: goals,
    appearances: appearances,
    yellowCards: yellowCards,
    redCards: redCards,
    disciplinaryStatus: disciplinaryStatus,
    customTags: customTags,
    refereeNotes: refereeNotes,
    updatedAt: new Date().toISOString()
  });
});

console.log(`✅ Calciatori processati: ${players.length}`);

// 4. Partite
const matches = [];
for (const g of ['A', 'B']) {
  const sheet = wb.Sheets[`Girone ${g} - Gare`];
  if (!sheet) continue;
  const rows = XLSX.utils.sheet_to_json(sheet);

  rows.forEach((r, idx) => {
    const matchDay = parseInt(r['Numero giornata'] || 1, 10);
    const dateText = String(r['Data'] || `Giornata ${matchDay}`).trim();
    const homeName = String(r['Squadra ospitante'] || '').trim();
    const awayName = String(r['Squadra ospite'] || '').trim();
    const homeTeamId = teamNameToId.get(homeName.toLowerCase()) || slugify(homeName);
    const awayTeamId = teamNameToId.get(awayName.toLowerCase()) || slugify(awayName);

    const isPlayed = String(r['Giocata'] || '').trim().toLowerCase() === 'si';
    const homeScore = isPlayed && r['Reti squadra ospitante'] !== undefined ? parseInt(r['Reti squadra ospitante'], 10) : undefined;
    const awayScore = isPlayed && r['Reti squadra ospite'] !== undefined ? parseInt(r['Reti squadra ospite'], 10) : undefined;

    matches.push({
      id: `match-${g}-${matchDay}-${homeTeamId}-${awayTeamId}`,
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
      updatedAt: new Date().toISOString()
    });
  });
}

console.log(`✅ Partite processate: ${matches.length}`);

// 5. Mappatura Note esistenti verso i nuovi ID Rosa e ID Giocatore
const notes = existingState.notes || [];
notes.forEach(n => {
  if (n.targetType === 'squadra') {
    const teamId = teamNameToId.get(n.targetName.toLowerCase().trim());
    if (teamId) n.targetId = teamId;
  } else if (n.targetType === 'giocatore') {
    // Se targetId corrisponde già a un giocatore valido, preservalo
    const existingById = players.find(p => p.id === n.targetId);
    if (!existingById) {
      const pMatch = players.find(p => n.targetName.toLowerCase().includes(p.lastName.toLowerCase()));
      if (pMatch) {
        n.targetId = pMatch.id;
        n.targetName = `${pMatch.firstName} ${pMatch.lastName} (${pMatch.teamName})`;
      }
    }
  }
});

console.log(`✅ Note rimappate: ${notes.length}`);

// 6. Assembla il Database Finale
const finalDatabase = {
  teams: Array.from(teamsMap.values()),
  players: players,
  matches: matches,
  standingsA: standingsA,
  standingsB: standingsB,
  notes: notes,
  videos: existingState.videos || [],
  profiles: existingState.profiles || []
};

// Salva in src/data/dataset.json e data/db-state.json
fs.writeFileSync('src/data/dataset.json', JSON.stringify(finalDatabase, null, 2), 'utf8');
fs.writeFileSync('data/db-state.json', JSON.stringify(finalDatabase, null, 2), 'utf8');

// Copia il file Excel master nella cartella data/excel/
if (!fs.existsSync('data/excel')) {
  fs.mkdirSync('data/excel', { recursive: true });
}
fs.copyFileSync(EXCEL_PATH, 'data/excel/Eccellenza_Emilia_Romagna_Database_Completo.xlsx');

console.log('🎉 REBUILD COMPLETATO CON SUCCESSO!');
console.log(`- Squadre: ${finalDatabase.teams.length}`);
console.log(`- Calciatori: ${finalDatabase.players.length}`);
console.log(`- Partite: ${finalDatabase.matches.length}`);
console.log(`- Note: ${finalDatabase.notes.length}`);
console.log(`- Profili: ${finalDatabase.profiles.length}`);
