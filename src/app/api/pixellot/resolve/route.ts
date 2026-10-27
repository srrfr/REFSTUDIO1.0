import { NextRequest, NextResponse } from 'next/server';
import { resolvePixellotMatch } from '@/lib/services/pixellot-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const fullReqUrl = req.url;
    const urlIdx = fullReqUrl.indexOf('url=');
    let url = '';
    if (urlIdx !== -1) {
      url = decodeURIComponent(fullReqUrl.slice(urlIdx + 4));
    } else {
      const { searchParams } = new URL(req.url);
      url = searchParams.get('url') || searchParams.get('slug') || '';
    }

    if (!url) {
      return NextResponse.json(
        { success: false, message: 'URL o ID Pixellot mancante.' },
        { status: 400 }
      );
    }

    const matchData = await resolvePixellotMatch(url);

    if (!matchData) {
      return NextResponse.json(
        {
          success: false,
          message: 'Impossibile risolvere i metadati della gara Pixellot. Verifica che il link sia valido e accessibile.',
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
    console.error('Errore API resolve Pixellot:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Errore interno del server' },
      { status: 500 }
    );
  }
}
