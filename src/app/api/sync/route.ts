import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { UnifiedExcelService } from '@/lib/data-provider/unified-excel-service';
import { ExcelDataProvider } from '@/lib/data-provider/excel-data-provider';
import { DbService } from '@/lib/repository/db-service';

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    const uploadDir = path.resolve(process.cwd(), 'data', 'excel');
    if (!fs.existsSync(uploadDir)) {
      try {
        fs.mkdirSync(uploadDir, { recursive: true });
      } catch {}
    }

    // 1. Gestione upload multipart/form-data
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();

      // Controllo se è stato caricato il Database Completo Master (.xlsx)
      const fileDatabaseCompleto = (formData.get('fileDatabaseCompleto') || formData.get('fileCompleto')) as File | null;
      if (fileDatabaseCompleto && fileDatabaseCompleto.size > 0) {
        const bytes = await fileDatabaseCompleto.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Salva su disco se possibile
        try {
          fs.writeFileSync(path.join(process.cwd(), 'Eccellenza_Emilia_Romagna_Database_Completo.xlsx'), buffer);
          fs.writeFileSync(path.join(uploadDir, 'Eccellenza_Emilia_Romagna_Database_Completo.xlsx'), buffer);
        } catch {}

        // Elabora immediatamente il file Excel caricato
        const wb = XLSX.read(buffer, { type: 'buffer' });
        const result = UnifiedExcelService.processWorkbook(wb);

        if (!result.success) {
          return NextResponse.json({ success: false, message: result.error }, { status: 400 });
        }

        return NextResponse.json({
          success: true,
          message: 'Database aggiornato con successo dal file Excel completo (36 squadre, 924 giocatori, 405 gare)',
          summary: result.summary,
        });
      }

      // Altrimenti controlla i singoli file (retrocompatibilità)
      const fileGironeA = formData.get('fileGironeA') as File | null;
      const fileGironeB = formData.get('fileGironeB') as File | null;
      const fileGareClassifica = formData.get('fileGareClassifica') as File | null;

      try {
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
      } catch {}
    }

    // 2. Se esiste il file Excel Completo Master sul server, elabora quello
    const masterPath = UnifiedExcelService.findMasterExcelPath();
    if (masterPath && fs.existsSync(masterPath)) {
      const buffer = fs.readFileSync(masterPath);
      const wb = XLSX.read(buffer, { type: 'buffer' });
      const result = UnifiedExcelService.processWorkbook(wb);

      if (result.success) {
        return NextResponse.json({
          success: true,
          message: 'Sincronizzazione completata dal Database Excel Completo con ID ufficiali',
          summary: result.summary,
        });
      }
    }

    // 3. Fallback sul vecchio provider a 3 file se il master non è presente
    const provider = new ExcelDataProvider();
    const validation = await provider.validate();

    if (!validation.isValid) {
      const warningDetails = validation.warnings.join(' | ');
      return NextResponse.json(
        {
          success: false,
          message: `Validazione sorgente dati fallita: ${warningDetails}`,
          report: validation,
        },
        { status: 400 }
      );
    }

    const fullDataset = await provider.loadFullDataset();
    DbService.replaceFullDataset(fullDataset as any);

    return NextResponse.json({
      success: true,
      message: 'Sincronizzazione completata con successo tramite Data Provider a 3 file',
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
