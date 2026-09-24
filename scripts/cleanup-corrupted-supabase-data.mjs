import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envLocal = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = envLocal.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = envLocal.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);

const supabaseUrl = urlMatch ? urlMatch[1].trim() : '';
const supabaseKey = keyMatch ? keyMatch[1].trim() : '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Credenziali Supabase mancanti in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function cleanupAndSync() {
  console.log('🚀 Inizio bonifica completa dati Supabase...');

  // 1. Carica dataset ufficiale
  const dbStatePath = path.resolve('data', 'db-state.json');
  const dataset = JSON.parse(fs.readFileSync(dbStatePath, 'utf-8'));

  const standingsA = dataset.standingsA || [];
  const standingsB = dataset.standingsB || [];
  const matches = dataset.matches || [];

  console.log(`📊 Dati master: Standings A=${standingsA.length}, B=${standingsB.length}, Matches=${matches.length}`);

  // 2. Bonifica TABELLA STANDINGS
  console.log('\n🧹 1/2 Bonifica Classifiche (rimozione record storici e duplicati da posizioni)...');
  const { data: oldStandings, error: getStandingsErr } = await supabase.from('standings').select('id, team_name');
  if (getStandingsErr) {
    console.error('Errore lettura standings:', getStandingsErr);
  } else {
    console.log(`   Trovate ${oldStandings.length} righe corrotte/duplicate in Supabase.`);
  }

  // Elimina tutte le righe di classifica esistenti per eliminare i vecchi ID con la posizione
  const { error: delStandingsErr } = await supabase.from('standings').delete().in('girone', ['A', 'B']);
  if (delStandingsErr) {
    console.error('❌ Errore cancellazione standings:', delStandingsErr.message);
  } else {
    console.log('   ✅ Tabelle standings svuotate con successo.');
  }

  // Inserisci le 36 righe pulite con ID stabili senza posizione
  const cleanStandingsPayload = [
    ...standingsA.map((s) => ({
      id: `standing-A-${s.teamId || slugify(s.teamName)}`,
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
      id: `standing-B-${s.teamId || slugify(s.teamName)}`,
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

  const { error: insStandingsErr } = await supabase.from('standings').upsert(cleanStandingsPayload, { onConflict: 'id' });
  if (insStandingsErr) {
    console.error('❌ Errore inserimento standings puliti:', insStandingsErr.message);
  } else {
    console.log(`   ✅ Inserite ${cleanStandingsPayload.length} righe pulite e univoche (18 Girone A, 18 Girone B).`);
  }

  // 3. Bonifica TABELLA MATCHES
  console.log('\n🧹 2/2 Bonifica Partite (rimozione vecchi ID slug duplicati)...');
  const validMatchIds = new Set(matches.map((m) => m.id));
  const { data: currentMatches, error: getMatchesErr } = await supabase.from('matches').select('id');
  if (getMatchesErr) {
    console.error('Errore lettura partite:', getMatchesErr);
  } else {
    console.log(`   Trovate ${currentMatches.length} partite totali in Supabase.`);
    const obsoleteIds = currentMatches.map((m) => m.id).filter((id) => !validMatchIds.has(id));
    if (obsoleteIds.length > 0) {
      console.log(`   Eliminazione di ${obsoleteIds.length} partite obsolete/duplicate con vecchi ID slug...`);
      for (let i = 0; i < obsoleteIds.length; i += 100) {
        const chunk = obsoleteIds.slice(i, i + 100);
        const { error: delErr } = await supabase.from('matches').delete().in('id', chunk);
        if (delErr) {
          console.error(`❌ Errore cancellazione chunk partite:`, delErr.message);
        }
      }
      console.log(`   ✅ ${obsoleteIds.length} partite obsolete eliminate con successo.`);
    } else {
      console.log('   Nessuna partita obsoleta trovata.');
    }
  }

  // Sincronizza tutte le partite ufficiali
  const matchesPayload = matches.map((m) => ({
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

  const CHUNK_SIZE = 150;
  for (let i = 0; i < matchesPayload.length; i += CHUNK_SIZE) {
    const chunk = matchesPayload.slice(i, i + CHUNK_SIZE);
    const { error: mErr } = await supabase.from('matches').upsert(chunk, { onConflict: 'id' });
    if (mErr) {
      console.error(`❌ Errore sincronizzazione partite chunk ${i}:`, mErr.message);
    }
  }
  console.log(`   ✅ Sincronizzate ${matchesPayload.length} partite ufficiali.`);

  // 4. VERIFICA FINALE
  console.log('\n🔍 VERIFICA FINALE STATO SUPABASE:');
  const { data: finalStandings } = await supabase.from('standings').select('*');
  const { count: finalMatchesCount } = await supabase.from('matches').select('*', { count: 'exact', head: true });

  const finalA = finalStandings.filter((s) => s.girone === 'A');
  const finalB = finalStandings.filter((s) => s.girone === 'B');

  console.log(`   • Standings totali: ${finalStandings.length} (Girone A: ${finalA.length}, Girone B: ${finalB.length})`);
  console.log(`   • Matches totali: ${finalMatchesCount} (atteso: 612, 306 per girone)`);

  const teamCountsA = {};
  finalA.forEach((s) => (teamCountsA[s.team_name] = (teamCountsA[s.team_name] || 0) + 1));
  const dupsA = Object.entries(teamCountsA).filter(([_, c]) => c > 1);

  const teamCountsB = {};
  finalB.forEach((s) => (teamCountsB[s.team_name] = (teamCountsB[s.team_name] || 0) + 1));
  const dupsB = Object.entries(teamCountsB).filter(([_, c]) => c > 1);

  if (dupsA.length === 0 && dupsB.length === 0 && finalStandings.length === 36 && finalMatchesCount === 612) {
    console.log('\n🎉 BONIFICA COMPLETATA CON SUCCESSO SENZA ERRORI O DUPLICATI!');
  } else {
    console.warn('\n⚠️ Rilevate anomalie nella verifica finale:', { dupsA, dupsB });
  }
}

cleanupAndSync();
