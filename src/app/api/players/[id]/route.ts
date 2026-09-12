import { NextResponse } from 'next/server';
import { DbService } from '@/lib/repository/db-service';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const player = DbService.getPlayerById(params.id);
  if (!player) {
    return NextResponse.json({ success: false, message: 'Calciatore non trovato' }, { status: 404 });
  }

  const notes = DbService.getNotes('giocatore', player.id);
  const videos = DbService.getVideos('giocatore', player.id);

  return NextResponse.json({
    success: true,
    data: {
      ...player,
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
    const updated = DbService.updatePlayer(params.id, updates);
    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 400 });
  }
}
