import fs from 'fs';
import path from 'path';

const datasetPath = path.resolve(process.cwd(), 'data', 'db-state.json');
const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));

function escapeSql(str) {
  if (str === null || str === undefined) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

function formatArray(arr) {
  if (!arr || arr.length === 0) return "'{}'";
  const escapedItems = arr.map(item => `"${String(item).replace(/"/g, '\\"')}"`).join(',');
  return `'{${escapedItems}}'`;
}

let sql = `-- ==============================================================================
-- REFSTUDIO - Seed Completo Dati con ID Ufficiali da Excel
-- ID Squadra = ID Rosa | ID Calciatore = ID Giocatore
-- ==============================================================================

TRUNCATE TABLE public.videos, public.notes, public.standings, public.matches, public.players, public.teams CASCADE;

`;

// Teams
sql += `-- 2. SQUADRE (36 squadre)\nINSERT INTO public.teams (id, championship_id, name, normalized_name, girone, pitch_surface, technical_level, aggression_level, stats) VALUES\n`;
const teamRows = dataset.teams.map(t => {
  return `(${escapeSql(t.id)}, ${escapeSql(t.championshipId || 'eccellenza-er')}, ${escapeSql(t.name)}, ${escapeSql(t.normalizedName)}, ${escapeSql(t.girone)}, ${escapeSql(t.pitchSurface)}, ${t.technicalLevel || 3}, ${t.aggressionLevel || 3}, ${escapeSql(JSON.stringify(t.stats || {}))}::jsonb)`;
});
sql += teamRows.join(',\n') + `\nON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, girone = EXCLUDED.girone, stats = EXCLUDED.stats;\n\n`;

// Standings
sql += `-- 3. CLASSIFICHE (36 righe)\nINSERT INTO public.standings (id, girone, position, team_name, team_id, points, played, won, drawn, lost, goals_for, goals_against, goal_difference) VALUES\n`;
const standings = [...dataset.standingsA, ...dataset.standingsB];
const standingRows = standings.map(s => {
  const id = `standing-${s.girone}-${s.position}-${s.teamId || s.teamName}`;
  return `(${escapeSql(id)}, ${escapeSql(s.girone)}, ${s.position}, ${escapeSql(s.teamName)}, ${escapeSql(s.teamId)}, ${s.points}, ${s.played}, ${s.won}, ${s.drawn}, ${s.lost}, ${s.goalsFor}, ${s.goalsAgainst}, ${s.goalDifference})`;
});
sql += standingRows.join(',\n') + `\nON CONFLICT (id) DO UPDATE SET points = EXCLUDED.points, played = EXCLUDED.played;\n\n`;

// Players in chunks
sql += `-- 4. CALCIATORI (924 giocatori)\n`;
const players = dataset.players;
for (let i = 0; i < players.length; i += 100) {
  const chunk = players.slice(i, i + 100);
  sql += `INSERT INTO public.players (id, team_id, team_name, championship_id, girone, first_name, last_name, role, kit_number, goals, appearances, yellow_cards, red_cards, disciplinary_status, custom_tags, referee_notes) VALUES\n`;
  const pRows = chunk.map(p => {
    return `(${escapeSql(p.id)}, ${escapeSql(p.teamId)}, ${escapeSql(p.teamName)}, ${escapeSql(p.championshipId || 'eccellenza-er')}, ${escapeSql(p.girone)}, ${escapeSql(p.firstName)}, ${escapeSql(p.lastName)}, ${escapeSql(p.role || 'CEN')}, ${p.kitNumber !== null && p.kitNumber !== undefined ? p.kitNumber : 'NULL'}, ${p.goals || 0}, ${p.appearances || 0}, ${p.yellowCards || 0}, ${p.redCards || 0}, ${escapeSql(p.disciplinaryStatus || 'REGOLARE')}, ${formatArray(p.customTags)}, ${escapeSql(p.refereeNotes)})`;
  });
  sql += pRows.join(',\n') + `\nON CONFLICT (id) DO UPDATE SET team_id = EXCLUDED.team_id, role = EXCLUDED.role, yellow_cards = EXCLUDED.yellow_cards, red_cards = EXCLUDED.red_cards, disciplinary_status = EXCLUDED.disciplinary_status, custom_tags = EXCLUDED.custom_tags, referee_notes = EXCLUDED.referee_notes;\n\n`;
}

// Matches in chunks
sql += `-- 5. PARTITE (405 partite)\n`;
const matches = dataset.matches;
for (let i = 0; i < matches.length; i += 100) {
  const chunk = matches.slice(i, i + 100);
  sql += `INSERT INTO public.matches (id, championship_id, girone, match_day, date_text, played, home_team_id, home_team_name, away_team_id, away_team_name, home_score, away_score, referee_name, match_field) VALUES\n`;
  const mRows = chunk.map(m => {
    return `(${escapeSql(m.id)}, ${escapeSql(m.championshipId || 'eccellenza-er')}, ${escapeSql(m.girone)}, ${m.matchDay}, ${escapeSql(m.dateText)}, ${Boolean(m.played)}, ${escapeSql(m.homeTeamId)}, ${escapeSql(m.homeTeamName)}, ${escapeSql(m.awayTeamId)}, ${escapeSql(m.awayTeamName)}, ${m.homeScore !== null && m.homeScore !== undefined ? m.homeScore : 'NULL'}, ${m.awayScore !== null && m.awayScore !== undefined ? m.awayScore : 'NULL'}, ${escapeSql(m.refereeName)}, ${escapeSql(m.matchField)})`;
  });
  sql += mRows.join(',\n') + `\nON CONFLICT (id) DO UPDATE SET played = EXCLUDED.played, home_score = EXCLUDED.home_score, away_score = EXCLUDED.away_score;\n\n`;
}

// Notes
sql += `-- 6. NOTE CONFIDENZIALI (11 note)\n`;
if (dataset.notes && dataset.notes.length > 0) {
  sql += `INSERT INTO public.notes (id, author_id, author_name, author_role, author_avatar, author_section, is_public, target_type, target_id, target_name, content, priority) VALUES\n`;
  const nRows = dataset.notes.map(n => {
    return `(${escapeSql(n.id)}, ${escapeSql(n.authorId || 'samueleromini')}, ${escapeSql(n.authorName || 'Samuele Romini')}, ${escapeSql(n.authorRole || 'AE')}, ${escapeSql(n.authorAvatar || '')}, ${escapeSql(n.authorSection || '')}, ${n.isPublic !== undefined ? Boolean(n.isPublic) : true}, ${escapeSql(n.targetType)}, ${escapeSql(n.targetId)}, ${escapeSql(n.targetName)}, ${escapeSql(n.content)}, ${escapeSql(n.priority || 'NORMAL')})`;
  });
  sql += nRows.join(',\n') + `\nON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, priority = EXCLUDED.priority, is_public = EXCLUDED.is_public;\n\n`;
}

// Profiles
sql += `-- 7. PROFILI UTENTI ARBITRI (5 account)\nINSERT INTO public.profiles (username, password, display_name, email, role, referee_role, section_aia, category_aia) VALUES\n` +
`('samueleromini', 'samueleromini1', 'Samuele Romini', 'samuele.romini@refstudio.internal', 'admin', 'AE', 'Sezione AIA Bologna', 'Eccellenza'),\n` +
`('lucaghirardi', 'lucaghirardi1', 'Luca Ghirardi', 'luca.ghirardi@refstudio.internal', 'arbitro', 'AA', 'Sezione AIA Parma', 'Eccellenza'),\n` +
`('simoneclemente', 'simoneclemente1', 'Simone Clemente', 'simone.clemente@refstudio.internal', 'arbitro', 'AE', 'Sezione AIA Forlì', 'Eccellenza'),\n` +
`('karimpalombo', 'karimpalombo1', 'Karim Palombo', 'karim.palombo@refstudio.internal', 'arbitro', 'AA', 'Sezione AIA Ravenna', 'Eccellenza'),\n` +
`('riccardosamaritani', 'riccardosamaritani1', 'Riccardo Samaritani', 'riccardo.samaritani@refstudio.internal', 'arbitro', 'OA', 'Sezione AIA Ferrara', 'Eccellenza')\n` +
`ON CONFLICT (username) DO UPDATE SET display_name = EXCLUDED.display_name, referee_role = EXCLUDED.referee_role, section_aia = EXCLUDED.section_aia;\n`;

const outPath = path.resolve(process.cwd(), 'supabase', 'seed-official-data.sql');
fs.writeFileSync(outPath, sql, 'utf-8');
console.log(`✅ File SQL generato con successo: ${outPath} (${(sql.length / 1024).toFixed(1)} KB)`);
