import { NextResponse } from 'next/server';
import { DbService } from '@/lib/repository/db-service';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetType = searchParams.get('targetType') || undefined;
  const targetId = searchParams.get('targetId') || undefined;
  const username = searchParams.get('username') || undefined;

  const notes = DbService.getNotes(targetType, targetId, username);
  return NextResponse.json({ success: true, count: notes.length, data: notes });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      authorId,
      authorName,
      authorRole,
      authorAvatar,
      authorSection,
      targetType,
      targetId,
      targetName,
      content,
      priority,
      attachments,
      isPublic,
    } = body;

    if (!targetType || !targetId || !content) {
      return NextResponse.json(
        { success: false, message: 'Dati incompleti per la creazione della nota' },
        { status: 400 }
      );
    }

    const note = DbService.addNote({
      authorId: authorId || 'samueleromini',
      authorName: authorName || 'Arbitro',
      authorRole: authorRole || 'AE',
      authorAvatar: authorAvatar || '',
      authorSection: authorSection || '',
      targetType,
      targetId,
      targetName: targetName || 'Entità',
      content,
      priority: priority || 'NORMAL',
      attachments: attachments || [],
      isPublic: isPublic !== false,
    });

    return NextResponse.json({ success: true, data: note });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, username, ...updates } = body;
    if (!id) {
      return NextResponse.json({ success: false, message: 'ID nota obbligatorio' }, { status: 400 });
    }
    const updated = DbService.updateNote(id, updates, username);
    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 403 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const username = searchParams.get('username') || undefined;
  if (!id) {
    return NextResponse.json({ success: false, message: 'ID nota mancante' }, { status: 400 });
  }
  try {
    const deleted = DbService.deleteNote(id, username);
    return NextResponse.json({ success: deleted });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 403 });
  }
}
