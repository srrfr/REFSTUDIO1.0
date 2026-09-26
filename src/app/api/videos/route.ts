import { NextResponse } from 'next/server';
import { DbService } from '@/lib/repository/db-service';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetType = searchParams.get('targetType') || undefined;
  const targetId = searchParams.get('targetId') || undefined;

  const videos = DbService.getVideos(targetType, targetId);
  return NextResponse.json({ success: true, count: videos.length, data: videos });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { authorId, targetType, targetId, targetName, videoSource, externalUrl, storagePath, title, description, timestampMark } = body;

    if (!targetType || !targetId || !title) {
      return NextResponse.json(
        { success: false, message: 'Dati incompleti per la creazione del video clip' },
        { status: 400 }
      );
    }

    const video = DbService.addVideo({
      authorId: authorId || 'current-referee',
      targetType,
      targetId,
      targetName: targetName || 'Entità',
      videoSource: videoSource || 'YOUTUBE',
      externalUrl,
      storagePath,
      title,
      description,
      timestampMark,
    });

    return NextResponse.json({ success: true, data: video });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ success: false, message: 'ID video mancante' }, { status: 400 });
  }
  const deleted = await DbService.deleteVideoAsync(id);
  return NextResponse.json({ success: deleted });
}
