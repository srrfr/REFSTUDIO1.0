import { NextRequest, NextResponse } from 'next/server';
import { DbService } from '@/lib/repository/db-service';
import { createClient } from '@supabase/supabase-js';

function getDirectSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    return createClient(supabaseUrl, supabaseKey);
  }
  return null;
}

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action');
  const username = req.nextUrl.searchParams.get('username');

  // Se richiesto l'elenco delle richieste in sospeso
  if (action === 'pending' || (!username && req.nextUrl.searchParams.get('list') === 'true')) {
    try {
      const supabase = getDirectSupabaseClient();
      let pendingList: any[] = [];

      if (supabase) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'pending')
          .order('created_at', { ascending: false });

        if (!error && data) {
          pendingList = data.map((row) => ({
            username: row.username,
            displayName: row.display_name || row.username,
            email: row.email || '',
            role: 'arbitro',
            refereeRole: row.referee_role || 'AE',
            sectionAia: row.section_aia || 'Sezione AIA',
            categoryAia: row.category_aia || 'Eccellenza',
            avatarUrl: row.avatar_url || '',
            isApproved: false,
            status: 'PENDING',
            requestedAt: row.created_at,
          }));
        }
      }

      // Unisci con eventuali profili locali in pending
      const localPending = DbService.getPendingProfiles();
      localPending.forEach((lp) => {
        if (!pendingList.some((p) => p.username.toLowerCase() === lp.username.toLowerCase())) {
          pendingList.push(lp);
        }
      });

      return NextResponse.json({ success: true, pendingUsers: pendingList });
    } catch (err: any) {
      return NextResponse.json({ success: false, pendingUsers: [], error: err.message }, { status: 500 });
    }
  }

  if (!username) {
    return new NextResponse('Parametro username mancante.', { status: 400 });
  }

  const cleanUser = username.trim().toLowerCase();

  try {
    let displayName = cleanUser;
    let sectionAia = 'Sezione AIA';
    let refereeRole = 'AE';

    // 1. Aggiornamento diretto su Supabase Cloud
    const supabase = getDirectSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          role: 'arbitro',
          updated_at: new Date().toISOString(),
        })
        .eq('username', cleanUser)
        .select()
        .single();

      if (!error && data) {
        displayName = data.display_name || displayName;
        sectionAia = data.section_aia || sectionAia;
        refereeRole = data.referee_role || refereeRole;
      }
    }

    // 2. Aggiornamento in DbService locale
    try {
      const updated = DbService.approveProfile(cleanUser);
      displayName = updated.displayName || displayName;
      sectionAia = updated.sectionAia || sectionAia;
      refereeRole = updated.refereeRole || refereeRole;
    } catch {
      try {
        DbService.registerProfile({
          username: cleanUser,
          displayName,
          sectionAia,
          refereeRole: refereeRole as any,
        });
        DbService.approveProfile(cleanUser);
      } catch {}
    }

    const html = `
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Accesso Validato - RefStudio</title>
        <style>
          body {
            margin: 0;
            padding: 20px;
            background-color: #0A0C10;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #FFFFFF;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            box-sizing: border-box;
          }
          .card {
            background: #0D0F16;
            border: 1px solid #212638;
            border-radius: 24px;
            padding: 36px 30px;
            max-width: 480px;
            width: 100%;
            text-align: center;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
          }
          .badge {
            display: inline-block;
            background: rgba(204, 255, 0, 0.15);
            color: #CCFF00;
            border: 1px solid rgba(204, 255, 0, 0.3);
            border-radius: 8px;
            padding: 4px 12px;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            margin-bottom: 20px;
          }
          h1 {
            font-size: 22px;
            margin: 0 0 10px 0;
            font-weight: 900;
          }
          p {
            font-size: 14px;
            color: #94A3B8;
            line-height: 1.6;
            margin-bottom: 25px;
          }
          .user-box {
            background: #12151F;
            border: 1px solid #1E2333;
            border-radius: 14px;
            padding: 16px;
            margin-bottom: 25px;
            text-align: left;
            font-size: 13px;
          }
          .btn {
            display: inline-block;
            background: #CCFF00;
            color: #000000;
            font-weight: 900;
            text-decoration: none;
            padding: 12px 30px;
            border-radius: 12px;
            font-size: 13px;
            box-shadow: 0 0 20px rgba(204, 255, 0, 0.35);
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">AIA RefStudio Access Control</div>
          <h1>Profilo Arbitro Validato!</h1>
          <p>
            L'accesso per l'utente <strong>${displayName}</strong> è stato verificato e abilitato con successo.
          </p>

          <div class="user-box">
            <div><strong style="color:#FFF;">Nome:</strong> ${displayName}</div>
            <div style="margin-top:6px;"><strong style="color:#FFF;">Username:</strong> <code style="color:#CCFF00;">@${cleanUser}</code></div>
            <div style="margin-top:6px;"><strong style="color:#FFF;">Sezione:</strong> ${sectionAia}</div>
            <div style="margin-top:6px;"><strong style="color:#FFF;">Ruolo:</strong> ${refereeRole}</div>
            <div style="margin-top:6px;"><strong style="color:#FFF;">Stato:</strong> <span style="color:#34D399; font-weight:bold;">ATTIVO & ABILITATO ✓</span></div>
          </div>

          <a href="/profilo" class="btn">Apri RefStudio</a>
        </div>
      </body>
      </html>
    `;

    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error: any) {
    return new NextResponse(`Errore validazione profilo: ${error.message}`, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, pin, action } = body;

    if (!username) {
      return NextResponse.json(
        { success: false, message: 'Nome utente obbligatorio.' },
        { status: 400 }
      );
    }

    const cleanUser = username.trim().toLowerCase();
    const adminPin = process.env.ADMIN_PIN_SECRET || '280899';

    // Se fornito un PIN non valido, rifiuta
    if (pin && pin !== adminPin) {
      return NextResponse.json(
        { success: false, message: 'Codice PIN Amministratore non valido.' },
        { status: 403 }
      );
    }

    const isReject = action === 'reject';
    const newRole = isReject ? 'rejected' : 'arbitro';

    let profileData: any = null;

    // 1. Aggiorna Supabase Cloud
    const supabase = getDirectSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          role: newRole,
          updated_at: new Date().toISOString(),
        })
        .eq('username', cleanUser)
        .select()
        .single();

      if (!error && data) {
        profileData = data;
      }
    }

    // 2. Aggiorna DbService locale
    try {
      if (isReject) {
        DbService.rejectProfile(cleanUser);
      } else {
        DbService.approveProfile(cleanUser);
      }
    } catch {
      // Se non presente in memoria locale, registralo con i dati ricavati da Supabase
      if (!isReject && profileData) {
        try {
          DbService.registerProfile({
            username: cleanUser,
            displayName: profileData.display_name || cleanUser,
            email: profileData.email,
            sectionAia: profileData.section_aia || 'Sezione AIA',
            refereeRole: profileData.referee_role || 'AE',
            categoryAia: profileData.category_aia || 'Eccellenza',
          });
          DbService.approveProfile(cleanUser);
        } catch {}
      }
    }

    return NextResponse.json({
      success: true,
      message: isReject
        ? `Profilo @${cleanUser} rifiutato.`
        : `Profilo @${cleanUser} validato ed abilitato con successo!`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Errore durante la convalida.' },
      { status: 500 }
    );
  }
}
