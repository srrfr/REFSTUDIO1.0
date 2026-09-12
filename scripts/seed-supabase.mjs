import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Carica variabili d'ambiente da .env.local se presenti
function loadEnv() {
  const envPaths = ['.env.local', '.env'];
  for (const envFile of envPaths) {
    const fullPath = path.resolve(process.cwd(), envFile);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [k, ...v] = trimmed.split('=');
          const key = k.trim();
          const val = v.join('=').trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      });
    }
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

console.log('\n======================================================');
console.log('⚡ REFSTUDIO - Seed & Migrazione Dati verso Supabase');
console.log('======================================================\n');

if (!supabaseUrl || !supabaseKey || supabaseUrl === 'https://your-project.supabase.co') {
  console.error('❌ ERRORE: Credenziali Supabase mancanti o non configurate!');
  console.error('Assicurati di aver configurato in .env.local le seguenti variabili:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL=https://<tuo-progetto>.supabase.co');
  console.error('  NEXT_PUBLIC_SUPABASE_ANON_KEY=<tua-anon-key>');
  console.error('Oppure esegui lo script passando le credenziali come variabili di ambiente:\n');
  console.error('  NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... node scripts/seed-supabase.mjs\n');
  process.exit(1);
}

console.log(`🔗 Connessione a Supabase: ${supabaseUrl}`);
const supabase = createClient(supabaseUrl, supabaseKey);

// Carica il dataset consolidato
const dbStateFile = path.resolve(process.cwd(), 'data', 'db-state.json');
const datasetFile = path.resolve(process.cwd(), 'src', 'data', 'dataset.json');

let dataset = null;
if (fs.existsSync(dbStateFile)) {
  console.log(`📂 Lettura dati da: data/db-state.json`);
  dataset = JSON.parse(fs.readFileSync(dbStateFile, 'utf-8'));
} else if (fs.existsSync(datasetFile)) {
  console.log(`📂 Lettura dati da: src/data/dataset.json`);
  dataset = JSON.parse(fs.readFileSync(datasetFile, 'utf-8'));
} else {
  console.error('❌ Nessun file di dati trovato in data/ o src/data/');
  process.exit(1);
}

async function seed() {
  const teams = dataset.teams || [];
  const players = dataset.players || [];
  const matches = dataset.matches || [];
  const standingsA = dataset.standingsA || [];
  const standingsB = dataset.standingsB || [];
  const notes = dataset.notes || [];
  const videos = dataset.videos || [];

  console.log(`\n📊 Dati pronti per il caricamento:`);
  console.log(`   • Squadre:     ${teams.length}`);
  console.log(`   • Calciatori:  ${players.length}`);
  console.log(`   • Partite:     ${matches.length}`);
  console.log(`   • Classifiche: ${standingsA.length + standingsB.length} righe`);
  console.log(`   • Note:        ${notes.length}`);
  console.log(`   • Video:       ${videos.length}\n`);

  const shouldClean = process.argv.includes('--clean') || process.argv.includes('--reset');

  if (shouldClean) {
    console.log('🧹 Modalità RESET rilevata: pulizia tabelle esistenti in Supabase...');
    // Cancellazione in ordine inverso di vincolo FK
    await supabase.from('videos').delete().neq('id', '___non_existent___');
    await supabase.from('notes').delete().neq('id', '___non_existent___');
    await supabase.from('standings').delete().neq('id', '___non_existent___');
    await supabase.from('matches').delete().neq('id', '___non_existent___');
    await supabase.from('players').delete().neq('id', '___non_existent___');
    await supabase.from('teams').delete().neq('id', '___non_existent___');
    console.log('   ✅ Tabelle svuotate correttamente per la nuova struttura con ID ufficiali.\n');
  }

  // 1. Inserimento Squadre (Deduplicate per ID)
  console.log('⏳ 1/7 Inserimento Squadre in Supabase...');
  const uniqueTeamsMap = new Map();
  teams.forEach((t) => uniqueTeamsMap.set(t.id, t));
  const teamsPayload = Array.from(uniqueTeamsMap.values()).map((t) => ({
    id: t.id,
    championship_id: t.championshipId || 'eccellenza-er',
    name: t.name,
    normalized_name: t.normalizedName || t.name,
    girone: t.girone,
    city: t.city || null,
    logo_url: t.logoUrl || null,
    stadium: t.stadium || null,
    stadium_address: t.stadiumAddress || null,
    pitch_surface: t.pitchSurface || null,
    tuttocampo_url: t.tuttocampoUrl || null,
    technical_level: t.technicalLevel || 3,
    aggression_level: t.aggressionLevel || 3,
    bench_attitude: t.benchAttitude || null,
    coach_attitude: t.coachAttitude || null,
    coach_name: t.coachName || null,
    manager_name: t.managerName || null,
    referee_notes: t.refereeNotes || null,
    stats: t.stats || {},
  }));

  const { error: tErr } = await supabase.from('teams').upsert(teamsPayload, { onConflict: 'id' });
  if (tErr) {
    console.error('❌ Errore durante inserimento squadre:', tErr.message);
    process.exit(1);
  }
  console.log(`   ✅ ${teamsPayload.length} squadre sincronizzate con successo.`);

  // 2. Inserimento Calciatori in blocchi da 150 (Deduplicati per ID)
  console.log('⏳ 2/7 Inserimento Calciatori in blocchi da 150...');
  const uniquePlayersMap = new Map();
  players.forEach((p) => uniquePlayersMap.set(p.id, p));
  const playerPayload = Array.from(uniquePlayersMap.values()).map((p) => ({
    id: p.id,
    team_id: p.teamId,
    team_name: p.teamName,
    championship_id: p.championshipId || 'eccellenza-er',
    girone: p.girone,
    first_name: p.firstName,
    last_name: p.lastName,
    birth_date: p.birthDate || null,
    age: p.age || null,
    role: p.role || 'CEN',
    kit_number: p.kitNumber || null,
    height_cm: p.heightCm || null,
    preferred_foot: p.preferredFoot || null,
    goals: p.goals || 0,
    appearances: p.appearances || 0,
    yellow_cards: p.yellowCards || 0,
    red_cards: p.redCards || 0,
    disciplinary_status: p.disciplinaryStatus || 'REGOLARE',
    custom_tags: p.customTags || [],
    referee_notes: p.refereeNotes || null,
  }));

  const CHUNK_SIZE = 150;
  for (let i = 0; i < playerPayload.length; i += CHUNK_SIZE) {
    const chunk = playerPayload.slice(i, i + CHUNK_SIZE);
    const { error: pErr } = await supabase.from('players').upsert(chunk, { onConflict: 'id' });
    if (pErr) {
      console.error(`❌ Errore durante inserimento calciatori (blocco ${i}):`, pErr.message);
      process.exit(1);
    }
    process.stdout.write(`   ➡️  Calciatori caricati: ${Math.min(i + CHUNK_SIZE, playerPayload.length)}/${playerPayload.length}\r`);
  }
  console.log(`\n   ✅ ${playerPayload.length} calciatori sincronizzati con successo.`);

  // 3. Inserimento Partite in blocchi da 150 (Deduplicate per ID)
  console.log('⏳ 3/7 Inserimento Partite in blocchi da 150...');
  const uniqueMatchesMap = new Map();
  matches.forEach((m) => uniqueMatchesMap.set(m.id, m));
  const matchesPayload = Array.from(uniqueMatchesMap.values()).map((m) => ({
    id: m.id,
    championship_id: m.championshipId || 'eccellenza-er',
    girone: m.girone,
    match_day: m.matchDay,
    date_text: m.dateText || null,
    match_date: m.matchDate || null,
    played: Boolean(m.played),
    home_team_id: m.homeTeamId,
    home_team_name: m.homeTeamName,
    away_team_id: m.awayTeamId,
    away_team_name: m.awayTeamName,
    home_score: m.homeScore ?? null,
    away_score: m.awayScore ?? null,
    referee_name: m.refereeName || null,
    match_field: m.matchField || null,
    observations: m.observations || null,
  }));

  for (let i = 0; i < matchesPayload.length; i += CHUNK_SIZE) {
    const chunk = matchesPayload.slice(i, i + CHUNK_SIZE);
    const { error: mErr } = await supabase.from('matches').upsert(chunk, { onConflict: 'id' });
    if (mErr) {
      console.error(`❌ Errore durante inserimento partite (blocco ${i}):`, mErr.message);
      process.exit(1);
    }
    process.stdout.write(`   ➡️  Partite caricate: ${Math.min(i + CHUNK_SIZE, matchesPayload.length)}/${matchesPayload.length}\r`);
  }
  console.log(`\n   ✅ ${matchesPayload.length} partite sincronizzate con successo.`);

  // 4. Inserimento Classifiche
  console.log('⏳ 4/7 Inserimento Classifiche...');
  const standingsPayload = [
    ...standingsA.map((s) => ({
      id: `standing-A-${s.position}-${s.teamId || s.teamName}`,
      girone: 'A',
      position: s.position,
      team_name: s.teamName,
      team_id: s.teamId || null,
      points: s.points,
      played: s.played,
      won: s.won,
      drawn: s.drawn,
      lost: s.lost,
      goals_for: s.goalsFor,
      goals_against: s.goalsAgainst,
      goal_difference: s.goalDifference,
    })),
    ...standingsB.map((s) => ({
      id: `standing-B-${s.position}-${s.teamId || s.teamName}`,
      girone: 'B',
      position: s.position,
      team_name: s.teamName,
      team_id: s.teamId || null,
      points: s.points,
      played: s.played,
      won: s.won,
      drawn: s.drawn,
      lost: s.lost,
      goals_for: s.goalsFor,
      goals_against: s.goalsAgainst,
      goal_difference: s.goalDifference,
    })),
  ];

  if (standingsPayload.length > 0) {
    const { error: sErr } = await supabase.from('standings').upsert(standingsPayload, { onConflict: 'id' });
    if (sErr) {
      console.error('❌ Errore durante inserimento classifiche:', sErr.message);
      process.exit(1);
    }
    console.log(`   ✅ ${standingsPayload.length} posizioni di classifica sincronizzate.`);
  }

  // 5. Inserimento Note (Deduplicate per ID)
  if (notes.length > 0) {
    console.log('⏳ 5/7 Inserimento Note confidenziali...');
    const uniqueNotesMap = new Map();
    notes.forEach((n) => uniqueNotesMap.set(n.id, n));
    const notesPayload = Array.from(uniqueNotesMap.values()).map((n) => ({
      id: n.id,
      author_id: n.authorId || 'samueleromini',
      author_name: n.authorName || 'Samuele Romini',
      author_role: n.authorRole || 'AE',
      author_avatar: n.authorAvatar || '',
      author_section: n.authorSection || '',
      is_public: n.isPublic !== undefined ? n.isPublic : true,
      target_type: n.targetType,
      target_id: n.targetId,
      target_name: n.targetName,
      content: n.content,
      priority: n.priority || 'NORMAL',
      attachments: n.attachments || [],
    }));

    const { error: nErr } = await supabase.from('notes').upsert(notesPayload, { onConflict: 'id' });
    if (nErr) {
      console.error('❌ Errore durante inserimento note:', nErr.message);
    } else {
      console.log(`   ✅ ${notesPayload.length} note confidenziali sincronizzate.`);
    }
  }

  // 6. Inserimento Video (Deduplicati per ID)
  if (videos.length > 0) {
    console.log('⏳ 6/7 Inserimento Video e clip didattiche...');
    const uniqueVideosMap = new Map();
    videos.forEach((v) => uniqueVideosMap.set(v.id, v));
    const videosPayload = Array.from(uniqueVideosMap.values()).map((v) => ({
      id: v.id,
      author_id: v.authorId || 'ref-1',
      target_type: v.targetType,
      target_id: v.targetId,
      target_name: v.targetName,
      video_source: v.videoSource || 'YOUTUBE',
      external_url: v.externalUrl || null,
      storage_path: v.storagePath || null,
      title: v.title,
      description: v.description || null,
      timestamp_mark: v.timestampMark || null,
    }));

    const { error: vErr } = await supabase.from('videos').upsert(videosPayload, { onConflict: 'id' });
    if (vErr) {
      console.error('❌ Errore durante inserimento video:', vErr.message);
    } else {
      console.log(`   ✅ ${videosPayload.length} video e clip sincronizzate.`);
    }
  }

  // 7. Inserimento Profili Arbitri
  console.log('⏳ 7/7 Inserimento Profili Arbitri...');
  const profiles = dataset.profiles || [
    { username: 'samueleromini', password: 'samueleromini1', displayName: 'Samuele Romini', email: 'samuele.romini@refstudio.internal', role: 'admin', refereeRole: 'AE', sectionAia: 'Sezione AIA Bologna', categoryAia: 'Eccellenza' },
    { username: 'lucaghirardi', password: 'lucaghirardi1', displayName: 'Luca Ghirardi', email: 'luca.ghirardi@refstudio.internal', role: 'arbitro', refereeRole: 'AA', sectionAia: 'Sezione AIA Parma', categoryAia: 'Eccellenza' },
    { username: 'simoneclemente', password: 'simoneclemente1', displayName: 'Simone Clemente', email: 'simone.clemente@refstudio.internal', role: 'arbitro', refereeRole: 'AE', sectionAia: 'Sezione AIA Forlì', categoryAia: 'Eccellenza' },
    { username: 'karimpalombo', password: 'karimpalombo1', displayName: 'Karim Palombo', email: 'karim.palombo@refstudio.internal', role: 'arbitro', refereeRole: 'AA', sectionAia: 'Sezione AIA Ravenna', categoryAia: 'Eccellenza' },
    { username: 'riccardosamaritani', password: 'riccardosamaritani1', displayName: 'Riccardo Samaritani', email: 'riccardo.samaritani@refstudio.internal', role: 'arbitro', refereeRole: 'OA', sectionAia: 'Sezione AIA Ferrara', categoryAia: 'Eccellenza' },
  ];

  const profilesPayload = profiles.map((p) => ({
    username: p.username,
    password: p.password || '',
    display_name: p.displayName,
    email: p.email || null,
    role: p.role || 'arbitro',
    referee_role: p.refereeRole || 'AE',
    section_aia: p.sectionAia || 'Sezione AIA Bologna',
    category_aia: p.categoryAia || 'Eccellenza',
    avatar_url: p.avatarUrl || null,
  }));

  const { error: prErr } = await supabase.from('profiles').upsert(profilesPayload, { onConflict: 'username' });
  if (prErr) {
    console.error('❌ Errore durante inserimento profili:', prErr.message);
  } else {
    console.log(`   ✅ ${profilesPayload.length} profili arbitrali sincronizzati.`);
  }

  console.log('\n======================================================');
  console.log('🎉 MIGRAZIONE SUPABASE COMPLETATA CON SUCCESSO!');
  console.log('======================================================');
  console.log('Tutti i dati sono ora residenti nel cloud PostgreSQL di Supabase.');
  console.log('L\'applicazione REFSTUDIO è ora pronta per operare in rete su qualsiasi dispositivo!\n');
}

seed().catch((err) => {
  console.error('❌ Errore imprevisto durante la migrazione:', err);
  process.exit(1);
});
