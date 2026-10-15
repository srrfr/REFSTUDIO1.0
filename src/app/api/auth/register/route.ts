import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
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

    const cleanUser = username.trim().toLowerCase();
    const adminEmail = 'rominisamuele@gmail.com';
    const origin = req.nextUrl.origin || 'http://localhost:3000';
    const approveUrl = `${origin}/api/auth/approve?username=${encodeURIComponent(cleanUser)}`;

    // 1. Registra nel database locale/in-memory
    try {
      DbService.registerProfile({
        username: cleanUser,
        password,
        displayName: displayName.trim(),
        email: email ? email.trim() : undefined,
        sectionAia: sectionAia || 'AIA Emilia-Romagna',
        refereeRole: refereeRole || 'AE',
        categoryAia: categoryAia || 'Eccellenza',
      });
    } catch (dbErr: any) {
      console.warn('DbService registerProfile notice:', dbErr.message);
    }

    // 2. Persistenza immediata su Supabase Cloud con stato in attesa (role = 'pending')
    const supabase = getDirectSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('profiles').upsert(
          {
            username: cleanUser,
            password: password ? password.trim() : '',
            display_name: displayName.trim(),
            email: email ? email.trim() : '',
            role: 'pending',
            referee_role: refereeRole || 'AE',
            section_aia: sectionAia || 'AIA Emilia-Romagna',
            category_aia: categoryAia || 'Eccellenza',
            avatar_url: '',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'username' }
        );
      } catch (sbErr) {
        console.warn('Errore salvataggio Supabase da API register:', sbErr);
      }
    }

    // 3. Configura trasporto email (usa variabili d'ambiente se presenti)
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    const emailSubject = `[RefStudio] Richiesta Nuovo Profilo Arbitro: ${displayName} (@${cleanUser})`;
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
              <td style="color: #CCFF00; font-family: monospace; font-weight: bold; padding: 6px 0;">@${cleanUser}</td>
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
          Questa email automatica è inviata a ${adminEmail} per la gestione degli accessi alla piattaforma RefStudio.
        </p>
      </div>
    `;

    let emailSent = false;
    const smtpConfigured = Boolean(smtpHost && smtpUser && smtpPass);

    if (smtpConfigured) {
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
      console.log(`\n======================================================`);
      console.log(`[NOTIFICA REGISTRAZIONE PROFILO -> ${adminEmail}]`);
      console.log(`Oggetto: ${emailSubject}`);
      console.log(`Link approvazione rapida: ${approveUrl}`);
      console.log(`======================================================\n`);
    }

    return NextResponse.json({
      success: true,
      message: emailSent
        ? `Richiesta di registrazione inviata! È stata recapitata un'email a ${adminEmail} per la validazione dell'accesso.`
        : `Richiesta di registrazione inviata! Il profilo è in attesa di validazione da parte dell'amministratore.`,
      emailSent,
      smtpConfigured,
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
