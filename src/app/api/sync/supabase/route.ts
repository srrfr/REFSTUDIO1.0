import { NextResponse } from 'next/server';
import { isSupabaseConfigured, getSupabaseClient } from '@/lib/supabase/client';
import { SupabaseService } from '@/lib/supabase/supabase-service';
import { DbService } from '@/lib/repository/db-service';

export async function GET() {
  const configured = isSupabaseConfigured();
  if (!configured) {
    return NextResponse.json({
      configured: false,
      message: 'Credenziali Supabase non configurate nelle variabili d\'ambiente.',
    });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({
      configured: false,
      message: 'Impossibile inizializzare il client Supabase.',
    });
  }

  try {
    const [
      { count: teamsCount, error: tErr },
      { count: playersCount, error: pErr },
      { count: matchesCount, error: mErr },
      { count: notesCount, error: nErr },
      { count: videosCount, error: vErr },
    ] = await Promise.all([
      supabase.from('teams').select('*', { count: 'exact', head: true }),
      supabase.from('players').select('*', { count: 'exact', head: true }),
      supabase.from('matches').select('*', { count: 'exact', head: true }),
      supabase.from('notes').select('*', { count: 'exact', head: true }),
      supabase.from('videos').select('*', { count: 'exact', head: true }),
    ]);

    if (tErr) throw tErr;

    return NextResponse.json({
      configured: true,
      connected: true,
      counts: {
        teams: teamsCount ?? 0,
        players: playersCount ?? 0,
        matches: matchesCount ?? 0,
        notes: notesCount ?? 0,
        videos: videosCount ?? 0,
      },
    });
  } catch (err: any) {
    return NextResponse.json({
      configured: true,
      connected: false,
      error: err.message || 'Errore di connessione a Supabase. Verifica che le tabelle siano state create.',
    });
  }
}

export async function POST() {
  const configured = isSupabaseConfigured();
  if (!configured) {
    return NextResponse.json(
      {
        success: false,
        message:
          'Credenziali Supabase non configurate. Configura NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.',
      },
      { status: 400 }
    );
  }

  try {
    const teams = DbService.getTeams();
    const players = DbService.getPlayers();
    const matches = DbService.getMatches();
    const standingsA = DbService.getStandings('A');
    const standingsB = DbService.getStandings('B');
    const notes = DbService.getNotes();
    const videos = DbService.getVideos();

    const result = await SupabaseService.migrateFullDataset({
      teams,
      players,
      matches,
      standingsA,
      standingsB,
      notes,
      videos,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: `Migrazione Supabase fallita: ${result.error}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Tutti i dati sono stati migrati con successo nel cloud Supabase!',
      summary: result.summary,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        message: `Errore durante la migrazione: ${err.message}`,
      },
      { status: 500 }
    );
  }
}
