import { NextRequest, NextResponse } from 'next/server';
import { DbService } from '@/lib/repository/db-service';

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username');

  if (!username) {
    return new NextResponse('Parametro username mancante.', { status: 400 });
  }

  try {
    const updated = DbService.approveProfile(username);

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
            padding: 0;
            background-color: #0A0C10;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #FFFFFF;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
          }
          .card {
            background: #0D0F16;
            border: 1px solid #212638;
            border-radius: 24px;
            padding: 40px;
            max-width: 480px;
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
            padding: 15px;
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
            L'accesso per l'utente <strong>${updated.displayName}</strong> è stato verificato e abilitato con successo.
          </p>

          <div class="user-box">
            <div><strong style="color:#FFF;">Nome:</strong> ${updated.displayName}</div>
            <div style="margin-top:4px;"><strong style="color:#FFF;">Username:</strong> <code style="color:#CCFF00;">@${updated.username}</code></div>
            <div style="margin-top:4px;"><strong style="color:#FFF;">Sezione:</strong> ${updated.sectionAia}</div>
            <div style="margin-top:4px;"><strong style="color:#FFF;">Ruolo:</strong> ${updated.refereeRole}</div>
            <div style="margin-top:4px;"><strong style="color:#FFF;">Stato:</strong> <span style="color:#34D399; font-weight:bold;">ATTIVO & CONVALIDATO ✓</span></div>
          </div>

          <a href="/" class="btn">Apri RefStudio</a>
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
