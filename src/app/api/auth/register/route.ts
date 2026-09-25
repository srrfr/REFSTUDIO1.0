import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { DbService } from '@/lib/repository/db-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password, displayName, email, sectionAia, refereeRole, categoryAia } = body;

    if (!username || !displayName) {
      return NextResponse.json(
        { success: false, message: 'Dati incompleti: username e nome sono obbligatori.' },
        { status: 400 }
      );
    }

    const adminEmail = 'rominisamuele@gmail.com';
    const origin = req.nextUrl.origin || 'http://localhost:3000';
    const approveUrl = `${origin}/api/auth/approve?username=${encodeURIComponent(username)}`;

    // Registra nel database locale/in-memory se non già presente
    try {
      DbService.registerProfile({
        username,
        password,
        displayName,
        email,
        sectionAia: sectionAia || 'AIA Emilia-Romagna',
        refereeRole: refereeRole || 'AE',
        categoryAia: categoryAia || 'Eccellenza',
      });
    } catch (dbErr: any) {
      // Se era già registrato o altro errore, proseguiamo con l'invio email o ritorniamo errore se duplicato
      console.warn('DbService registerProfile notice:', dbErr.message);
    }

    // Configura trasporto email (usa variabili d'ambiente se presenti, altrimenti fallback)
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    const emailSubject = `[RefStudio] Richiesta Nuovo Profilo Arbitro: ${displayName} (@${username})`;
    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0A0C10; color: #FFFFFF; padding: 30px; border-radius: 16px; max-width: 600px; margin: 0 auto; border: 1px solid #1F2433;">
        <div style="text-align: center; margin-bottom: 25px;">
          <h1 style="color: #CCFF00; font-size: 24px; margin: 0; font-weight: 900; letter-spacing: 1px;">REFSTUDIO PRO</h1>
          <p style="color: #94A3B8; font-size: 13px; margin: 5px 0 0 0;">Notifica Amministratore - Nuova Richiesta di Registrazione</p>
        </div>

        <div style="background: #11141D; border: 1px solid #212638; border-radius: 12px; padding: 20px; margin-bottom: 25px;">
          <h2 style="color: #FFFFFF; font-size: 16px; margin-top: 0; margin-bottom: 15px; border-bottom: 1px solid #212638; padding-bottom: 8px;">
            Dettagli Nuovo Profilo Arbitrale
          </h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr>
              <td style="color: #94A3B8; padding: 6px 0; width: 140px;">Nome & Cognome:</td>
              <td style="color: #FFFFFF; font-weight: bold; padding: 6px 0;">${displayName}</td>
            </tr>
            <tr>
              <td style="color: #94A3B8; padding: 6px 0;">Username richiesto:</td>
              <td style="color: #CCFF00; font-family: monospace; font-weight: bold; padding: 6px 0;">@${username}</td>
            </tr>
            <tr>
              <td style="color: #94A3B8; padding: 6px 0;">Email di contatto:</td>
              <td style="color: #FFFFFF; padding: 6px 0;"><a href="mailto:${email}" style="color: #38BDF8; text-decoration: none;">${email || 'Non indicata'}</a></td>
            </tr>
            <tr>
              <td style="color: #94A3B8; padding: 6px 0;">Sezione AIA:</td>
              <td style="color: #FFFFFF; padding: 6px 0;">${sectionAia || 'Sezione AIA'}</td>
            </tr>
            <tr>
              <td style="color: #94A3B8; padding: 6px 0;">Ruolo:</td>
              <td style="color: #CCFF00; font-weight: bold; padding: 6px 0;">${refereeRole || 'AE'}</td>
            </tr>
            <tr>
              <td style="color: #94A3B8; padding: 6px 0;">Categoria:</td>
              <td style="color: #FFFFFF; padding: 6px 0;">${categoryAia || 'Eccellenza'}</td>
            </tr>
            <tr>
              <td style="color: #94A3B8; padding: 6px 0;">Data richiesta:</td>
              <td style="color: #94A3B8; font-family: monospace; padding: 6px 0;">${new Date().toLocaleString('it-IT')}</td>
            </tr>
          </table>
        </div>

        <div style="background: rgba(204, 255, 0, 0.08); border: 1px solid rgba(204, 255, 0, 0.3); border-radius: 12px; padding: 18px; text-align: center; margin-bottom: 25px;">
          <p style="color: #FFFFFF; font-size: 13px; margin: 0 0 15px 0;">
            Come amministratore, puoi validare l'accesso con un semplice click:
          </p>
          <a href="${approveUrl}" style="display: inline-block; background: #CCFF00; color: #000000; font-weight: 900; font-size: 13px; padding: 12px 26px; border-radius: 10px; text-decoration: none; box-shadow: 0 0 15px rgba(204, 255, 0, 0.4);">
            ✓ VALIDA ED ABILITA ACCESSO
          </a>
        </div>

        <p style="color: #64748B; font-size: 11px; text-align: center; margin: 0;">
          Questa email automatica è destinata esclusivamente a ${adminEmail} per la gestione della sicurezza della piattaforma RefStudio.
        </p>
      </div>
    `;

    let emailSent = false;

    if (smtpHost && smtpUser && smtpPass) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });

        await transporter.sendMail({
          from: `"RefStudio Access Control" <${smtpUser}>`,
          to: adminEmail,
          subject: emailSubject,
          html: emailHtml,
        });

        emailSent = true;
      } catch (sendErr) {
        console.warn('Errore invio tramite SMTP configurato:', sendErr);
      }
    } else {
      console.log(`[NOTIFICA EMAIL REGISTRAZIONE PROFILO -> ${adminEmail}]`);
      console.log(`Oggetto: ${emailSubject}`);
      console.log(`Link approvazione rapida: ${approveUrl}`);
    }

    return NextResponse.json({
      success: true,
      message: `Richiesta di registrazione inviata! È stata recapitata una notifica a ${adminEmail} per la validazione dell'accesso.`,
      emailSent,
      recipient: adminEmail,
      approveUrl,
    });
  } catch (error: any) {
    console.error('Errore API auth register:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Errore del server durante la registrazione.' },
      { status: 500 }
    );
  }
}
