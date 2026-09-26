import { NextRequest, NextResponse } from 'next/server';
import { resolveVeoMatch, extractVeoSlug } from '@/lib/services/veo-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url') || '';
    const slugParam = searchParams.get('slug') || '';

    const targetSlug = slugParam || extractVeoSlug(url) || url;

    if (!targetSlug) {
      return NextResponse.json(
        { success: false, message: 'URL o slug Veo mancante.' },
        { status: 400 }
      );
    }

    const matchData = await resolveVeoMatch(targetSlug);

    if (!matchData) {
      return NextResponse.json(
        {
          success: false,
          message: 'Impossibile risolvere i metadati della gara Veo. Verifica che il link sia pubblico e corretto.',
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        match: matchData,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (error: any) {
    console.error('Errore API resolve Veo:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Errore interno del server' },
      { status: 500 }
    );
  }
}
