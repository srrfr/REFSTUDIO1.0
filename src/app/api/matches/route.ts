import { NextResponse } from 'next/server';
import { DbService } from '@/lib/repository/db-service';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const girone = (searchParams.get('girone') as 'A' | 'B') || undefined;
  const matchDayStr = searchParams.get('day');
  const matchDay = matchDayStr ? parseInt(matchDayStr, 10) : undefined;
  const playedParam = searchParams.get('played');

  let matches = DbService.getMatches(girone, matchDay);

  if (playedParam !== null) {
    const isPlayed = playedParam === 'true';
    matches = matches.filter((m) => m.played === isPlayed);
  }

  const standingsA = DbService.getStandings('A');
  const standingsB = DbService.getStandings('B');

  return NextResponse.json({
    success: true,
    count: matches.length,
    data: matches,
    standings: {
      A: standingsA,
      B: standingsB,
    },
  });
}
