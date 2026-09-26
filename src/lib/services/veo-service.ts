export interface VeoHighlight {
  id: string;
  type: string;
  label: string;
  start: number;
  duration: number;
  timeDisplay: string;
  icon: string;
}

export interface VeoPeriod {
  name: string;
  start: number;
  end: number;
  duration: number;
  startDisplay: string;
  endDisplay: string;
}

export interface VeoMatchData {
  id: string;
  slug: string;
  title: string;
  streamUrl: string;
  reelUrl?: string;
  thumbnail?: string;
  duration: number;
  durationDisplay: string;
  periods: VeoPeriod[];
  highlights: VeoHighlight[];
}

export function isVeoUrl(url?: string): boolean {
  if (!url) return false;
  return (
    url.includes('app.veo.co') ||
    url.includes('veo.co/matches') ||
    url.includes('c.veocdn.com')
  );
}

export function extractVeoSlug(url: string): string | null {
  if (!url) return null;
  const match = url.match(/matches\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];

  // Se è un link CDN diretto: https://c.veocdn.com/<uuid>/...
  const cdnMatch = url.match(/c\.veocdn\.com\/([a-f0-9-]+)/i);
  if (cdnMatch) return cdnMatch[1];

  return null;
}

export function formatSecondsToTime(secs: number): string {
  if (isNaN(secs) || secs < 0) return '00:00';
  const total = Math.floor(secs);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function parseTimeToSeconds(timeStr: string): number | null {
  if (!timeStr) return null;
  const clean = timeStr.trim();

  // Formato mm:ss o hh:mm:ss
  if (clean.includes(':')) {
    const parts = clean.split(':').map((p) => parseInt(p, 10));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return parts[0] * 60 + parts[1];
    }
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
  }

  // Numero semplice di minuti es. "45" o "45'" -> 45 * 60
  const minuteMatch = clean.match(/^(\d+)'?$/);
  if (minuteMatch) {
    const min = parseInt(minuteMatch[1], 10);
    return min * 60;
  }

  const num = parseFloat(clean);
  if (!isNaN(num)) return num;

  return null;
}

/**
 * Risolve i metadati di una gara Veo.
 * Se eseguita nel browser (client-side), chiama l'endpoint interno /api/veo/resolve per evitare restrizioni CORS.
 * Se eseguita lato server, chiama direttamente le API Veo.
 */
export async function resolveVeoMatch(urlOrSlug: string): Promise<VeoMatchData | null> {
  const slug = extractVeoSlug(urlOrSlug) || urlOrSlug.trim();
  if (!slug) return null;

  // Client-side execution
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/veo/resolve?slug=${encodeURIComponent(slug)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.match) {
          return json.match;
        }
      }
    } catch (clientErr) {
      console.warn('Errore client fetch /api/veo/resolve:', clientErr);
    }
    return null;
  }

  // Server-side direct execution
  try {
    const matchRes = await fetch(`https://app.veo.co/api/app/matches/${slug}/`, {
      headers: { Accept: 'application/json' },
    });

    if (!matchRes.ok) {
      console.warn(`Veo match API status: ${matchRes.status}`);
      return null;
    }

    const matchData = await matchRes.json();
    const matchId = matchData.id || slug;
    const thumbnail = matchData.thumbnail || '';
    const streamUrl = thumbnail ? thumbnail.replace(/thumbnail\.jpg(\?.*)?$/i, 'video.mp4') : '';

    // Fetch highlights (goals, shots on target)
    let highlights: VeoHighlight[] = [];
    try {
      const hRes = await fetch(`https://app.veo.co/api/app/matches/${matchId}/highlights/`, {
        headers: { Accept: 'application/json' },
      });
      if (hRes.ok) {
        const hList = await hRes.json();
        if (Array.isArray(hList)) {
          highlights = hList.map((h: any) => {
            const isGoal = h.type === 'goal';
            return {
              id: h.id,
              type: h.type || 'highlight',
              label: isGoal ? 'Gol ⚽' : h.type === 'shot_on_goal' ? 'Tiro in porta 🎯' : 'Azione',
              start: h.start || 0,
              duration: h.duration || 25,
              timeDisplay: formatSecondsToTime(h.start || 0),
              icon: isGoal ? '⚽' : '🎯',
            };
          });
          // Ordina cronologicamente
          highlights.sort((a, b) => a.start - b.start);
        }
      }
    } catch (hErr) {
      console.warn('Veo highlights fetch error:', hErr);
    }

    // Fetch periods (1° Tempo, 2° Tempo)
    let periods: VeoPeriod[] = [];
    try {
      const pRes = await fetch(`https://app.veo.co/api/app/matches/${matchId}/periods/`, {
        headers: { Accept: 'application/json' },
      });
      if (pRes.ok) {
        const pList = await pRes.json();
        if (Array.isArray(pList)) {
          periods = pList.map((p: any, idx: number) => {
            const start = p.timeframe ? p.timeframe[0] : 0;
            const end = p.timeframe ? p.timeframe[1] : 0;
            return {
              name: idx === 0 ? '1° Tempo' : idx === 1 ? '2° Tempo' : `Tempo ${idx + 1}`,
              start,
              end,
              duration: p.duration || end - start,
              startDisplay: formatSecondsToTime(start),
              endDisplay: formatSecondsToTime(end),
            };
          });
        }
      }
    } catch (pErr) {
      console.warn('Veo periods fetch error:', pErr);
    }

    return {
      id: matchId,
      slug: matchData.slug || slug,
      title: matchData.title || 'Gara Veo',
      streamUrl: streamUrl || matchData.reel_url || '',
      reelUrl: matchData.reel_url,
      thumbnail,
      duration: matchData.duration || 0,
      durationDisplay: formatSecondsToTime(matchData.duration || 0),
      periods,
      highlights,
    };
  } catch (err) {
    console.error('Errore durante la risoluzione del match Veo:', err);
    return null;
  }
}
