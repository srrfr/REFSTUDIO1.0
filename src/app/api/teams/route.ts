import { NextResponse } from 'next/server';
import { DbService } from '@/lib/repository/db-service';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const girone = searchParams.get('girone') as 'A' | 'B' | null;
  const q = searchParams.get('q')?.toLowerCase() || '';

  let teams = DbService.getTeams(girone || undefined);

  if (q) {
    teams = teams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.city && t.city.toLowerCase().includes(q)) ||
        (t.stadium && t.stadium.toLowerCase().includes(q))
    );
  }

  return NextResponse.json({ success: true, count: teams.length, data: teams });
}
