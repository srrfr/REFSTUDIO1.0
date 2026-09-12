import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { ExcelDataProvider } from '@/lib/data-provider/excel-data-provider';
import { DbService } from '@/lib/repository/db-service';

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    const uploadDir = path.resolve(process.cwd(), 'data', 'excel');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Se la richiesta è multipart/form-data, elabora i file caricati
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const fileGironeA = formData.get('fileGironeA') as File | null;
      const fileGironeB = formData.get('fileGironeB') as File | null;
      const fileGareClassifica = formData.get('fileGareClassifica') as File | null;

      if (fileGironeA && fileGironeA.size > 0) {
        const bytes = await fileGironeA.arrayBuffer();
        fs.writeFileSync(path.join(uploadDir, 'Eccellenza_Emilia_Romagna_Girone_A.xlsx'), Buffer.from(bytes));
      }

      if (fileGironeB && fileGironeB.size > 0) {
        const bytes = await fileGironeB.arrayBuffer();
        fs.writeFileSync(path.join(uploadDir, 'Eccellenza_Emilia_Romagna_Girone_B.xlsx'), Buffer.from(bytes));
      }

      if (fileGareClassifica && fileGareClassifica.size > 0) {
        const bytes = await fileGareClassifica.arrayBuffer();
        fs.writeFileSync(path.join(uploadDir, 'Eccellenza_Emilia_Romagna_Gare_Classifica.xlsx'), Buffer.from(bytes));
      }
    }

    const provider = new ExcelDataProvider();
    const validation = await provider.validate();

    if (!validation.isValid) {
      const warningDetails = validation.warnings.join(' | ');
      const sheetDetails = validation.missingSheets.length > 0 ? ` Fogli mancanti: ${validation.missingSheets.join(', ')}` : '';
      return NextResponse.json(
        {
          success: false,
          message: `Validazione sorgente dati fallita: ${warningDetails}${sheetDetails}`,
          report: validation,
        },
        { status: 400 }
      );
    }

    const fullDataset = await provider.loadFullDataset();
    DbService.replaceFullDataset(fullDataset as any);

    return NextResponse.json({
      success: true,
      message: 'Sincronizzazione completata con successo tramite Data Provider',
      summary: {
        championships: fullDataset.championships.length,
        teams: fullDataset.teams.length,
        players: fullDataset.players.length,
        matches: fullDataset.matches.length,
        standingsA: fullDataset.standingsA.length,
        standingsB: fullDataset.standingsB.length,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: `Errore durante il sync: ${err.message}` }, { status: 500 });
  }
}
