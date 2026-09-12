import { NextResponse } from 'next/server';
import { DbService } from '@/lib/repository/db-service';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get('teamId') || undefined;
  const girone = (searchParams.get('girone') as 'A' | 'B') || undefined;
  const role = searchParams.get('role');
  const tag = searchParams.get('tag');
  const disciplinary = searchParams.get('disciplinary');
  const q = searchParams.get('q')?.toLowerCase() || '';

  let players = DbService.getPlayers(teamId, girone);

  if (q) {
    players = players.filter(
      (p) =>
        p.firstName.toLowerCase().includes(q) ||
        p.lastName.toLowerCase().includes(q) ||
        p.teamName.toLowerCase().includes(q)
    );
  }

  if (role) {
    players = players.filter((p) => p.role === role);
  }

  if (tag) {
    players = players.filter((p) => p.customTags.includes(tag as any));
  }

  if (disciplinary) {
    players = players.filter((p) => p.disciplinaryStatus === disciplinary);
  }

  return NextResponse.json({ success: true, count: players.length, data: players });
}
