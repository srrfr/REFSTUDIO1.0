import { NextResponse } from 'next/server';
import { ADMIN_PIN_SECRET } from '@/lib/auth/admin-guard';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pin } = body;

    if (!pin) {
      return NextResponse.json({ success: false, message: 'Codice PIN obbligatorio' }, { status: 400 });
    }

    if (String(pin).trim() === ADMIN_PIN_SECRET) {
      return NextResponse.json({
        success: true,
        role: 'admin',
        message: 'Autenticazione Amministratore confermata. Accesso sbloccato.',
      });
    }

    return NextResponse.json(
      { success: false, message: 'Codice PIN errato. Accesso negato.' },
      { status: 401 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
