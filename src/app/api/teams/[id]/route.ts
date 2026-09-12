import { NextResponse } from 'next/server';
import { DbService } from '@/lib/repository/db-service';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const team = DbService.getTeamById(params.id);
  if (!team) {
    return NextResponse.json({ success: false, message: 'Squadra non trovata' }, { status: 404 });
  }

  const players = DbService.getPlayers(team.id);
  const notes = DbService.getNotes('squadra', team.id);
  const videos = DbService.getVideos('squadra', team.id);

  return NextResponse.json({
    success: true,
    data: {
      ...team,
      players,
      notes,
      videos,
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const updates = await request.json();
    const updated = DbService.updateTeam(params.id, updates);
    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 400 });
  }
}
