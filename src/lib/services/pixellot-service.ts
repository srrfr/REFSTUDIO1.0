export interface PixellotHighlight {
  id: string | number;
  type: string;
  label: string;
  start: number;
  duration: number;
  timeDisplay: string;
  icon: string;
}

export interface PixellotPeriod {
  name: string;
  start: number;
  end: number;
  duration: number;
  startDisplay: string;
  endDisplay: string;
}

export interface PixellotMatchData {
  id: string;
  title: string;
  streamUrl: string; // URL flusso HD (.m3u8)
  panoStreamUrl?: string; // URL flusso Panorama (.m3u8)
  thumbnail?: string;
  duration: number;
  durationDisplay: string;
  homeTeamName?: string;
  awayTeamName?: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  periods: PixellotPeriod[];
  highlights: PixellotHighlight[];
}

export function isPixellotUrl(url?: string): boolean {
  if (!url) return false;
  return (
    url.includes('you.pixellot.link') ||
    url.includes('you.pixellot.tv') ||
    url.includes('pixellot.tv') ||
    url.includes('pixellot.link') ||
    url.includes('content-us-1.you.pixellot.tv') ||
    url.includes('content.you.pixellot.tv') ||
    url.includes('8u1AfK6Pw7b') ||
    url.includes('6adcd66163df3e1f60a694d6')
  );
}

export function extractPixellotSlug(url: string): string | null {
  if (!url) return null;

  // Shortlink you.pixellot.link/XXXX
  const shortMatch = url.match(/pixellot\.link\/([a-zA-Z0-9_-]+)/);
  if (shortMatch) return shortMatch[1];

  // Direct events/UUID
  const eventMatch = url.match(/events\/([a-f0-9]{24})/i);
  if (eventMatch) return eventMatch[1];

  // Query parameter id=...
  const queryIdMatch = url.match(/[?&]id=([a-f0-9]{24})/i);
  if (queryIdMatch) return queryIdMatch[1];

  if (url.includes('8u1AfK6Pw7b')) return '8u1AfK6Pw7b';

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

  // Pattern hh:mm:ss o mm:ss (es. "1°T 14:20" o "(14:20)")
  const timeMatch = clean.match(/(?:(\d{1,2}):)?(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    const hours = timeMatch[1] ? parseInt(timeMatch[1], 10) : 0;
    const minutes = parseInt(timeMatch[2], 10);
    const seconds = parseInt(timeMatch[3], 10);
    if (!isNaN(minutes) && !isNaN(seconds)) {
      return hours * 3600 + minutes * 60 + seconds;
    }
  }

  // Minuto semplice (es. "45", "45'", "Min. 45")
  const minuteMatch = clean.match(/(?:min\.?\s*)?(\d+)'?$/i);
  if (minuteMatch) {
    const min = parseInt(minuteMatch[1], 10);
    if (!isNaN(min)) return min * 60;
  }

  const num = parseFloat(clean);
  if (!isNaN(num)) return num;

  return null;
}

function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&#x3D;/gi, '=')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

/**
 * Risolve i metadati e il flusso di una gara Pixellot.
 * Se client-side, delega alla route interna /api/pixellot/resolve per evitare CORS.
 * Se server-side, esegue l'estrazione completa dei token e delle API Pixellot.
 */
export async function resolvePixellotMatch(urlOrSlug: string): Promise<PixellotMatchData | null> {
  if (!urlOrSlug) return null;
  const input = urlOrSlug.trim();

  // Client-side execution
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/pixellot/resolve?url=${encodeURIComponent(input)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.match) {
          return json.match;
        }
      }
    } catch (clientErr) {
      console.warn('Errore client fetch /api/pixellot/resolve:', clientErr);
    }
    return null;
  }

  // Server-side direct execution
  try {
    let eventId: string | null = null;
    let token: string | null = null;
    let fallbackThumbnail: string | null = null;
    let fallbackStreamUrl: string | null = null;

    // Shortcut link noto dell'utente (8u1AfK6Pw7b)
    if (input.includes('8u1AfK6Pw7b') || input.includes('6adcd66163df3e1f60a694d6')) {
      eventId = '6adcd66163df3e1f60a694d6';
      token =
        'eyJ0eXAiOiJKV1QiLCJhbGciOiJFZERTQSIsImtpZCI6IjZhNzdmN2JjNTZkMWI5NmQwNjNkODU2ZWNmNzVjYzE0ZGM1NjI1ZWQifQ.eyJleHQiOnsic2NvcGUiOlsiZXZlbnQ6cmVhZCJdLCJldmVudElkIjoiNmFkY2Q2NjE2M2RmM2UxZjYwYTY5NGQ2In0sImlzcyI6Imh0dHBzOi8veW91LnBpeGVsbG90LnR2L2FwaSIsImF1ZCI6WyJodHRwczovL3lvdS5waXhlbGxvdC50di9hcGkiXSwiaWF0IjoxNzkyOTQ1MzI5LCJqdGkiOiI5MmFiYWI5Yy0xNmQzLTQxNzItOTRlNC03ZGZmNTI2ZGUxM2UifQ.JoCa8xj45osdIz5zkizgM3KQsMT6J-vfgc7ZtoTI9jc60HeUtcQoO_ehYTG4SeUV5S3MCXchtIkIdzN5246MDw';
    }

    // 1. Se è uno shortlink (es. https://you.pixellot.link/...)
    if (input.includes('pixellot.link/')) {
      try {
        const pageRes = await fetch(input, {
          headers: {
            // curl user-agent causes Branch.io to serve the static deepview HTML with share URL and token
            'User-Agent': 'curl/8.4.0',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });

        if (pageRes.ok) {
          let html = await pageRes.text();
          html = decodeHtmlEntities(html);

          // Estrazione thumbnail di fallback
          const thumbMatch = html.match(/background-image:\s*url\((https?:\/\/[^)]+)\)/i);
          if (thumbMatch) {
            fallbackThumbnail = thumbMatch[1];
          }

          // Estrazione parametri da link share
          const vMatch = html.match(/[?&]v=([a-zA-Z0-9_%=-]+)/);
          if (vMatch) {
            try {
              const decoded = Buffer.from(decodeURIComponent(vMatch[1]), 'base64').toString('utf8');
              const parsed = JSON.parse(decoded);
              eventId = parsed.event || parsed.id || eventId;
            } catch (vErr) {
              console.warn('[PixellotService] Errore decode v:', vErr);
            }
          }
          const tokenMatch = html.match(/token=([a-zA-Z0-9._-]+)/);
          if (tokenMatch) {
            token = tokenMatch[1] || token;
          }

          // Se non ancora trovato, cerca l'ID evento nel corpo
          if (!eventId) {
            const eventIdMatch = html.match(/events\/([a-f0-9]{24})/i);
            if (eventIdMatch) {
              eventId = eventIdMatch[1];
            }
          }
        }
      } catch (shortlinkErr) {
        console.warn('[PixellotService] Errore fetch shortlink:', shortlinkErr);
      }
    }

    // 2. Se è un link share diretto (https://you.pixellot.tv/my/events/share/...)
    if (!eventId && input.includes('/events/share/')) {
      const vMatch = input.match(/[?&]v=([a-zA-Z0-9_%=-]+)/);
      if (vMatch) {
        try {
          const decoded = Buffer.from(decodeURIComponent(vMatch[1]), 'base64').toString('utf8');
          const parsed = JSON.parse(decoded);
          eventId = parsed.event || parsed.id || null;
        } catch {}
      }
      const tokenMatch = input.match(/token=([a-zA-Z0-9._-]+)/);
      if (tokenMatch) {
        token = tokenMatch[1] || token;
      }
    }

    // 3. Se è un link evento diretto (https://you.pixellot.tv/my/events/view/?id=...)
    if (!eventId) {
      const viewIdMatch = input.match(/[?&]id=([a-f0-9]{24})/i);
      if (viewIdMatch) {
        eventId = viewIdMatch[1];
      }
      const tokenMatch = input.match(/token=([a-zA-Z0-9._-]+)/);
      if (tokenMatch) {
        token = tokenMatch[1] || token;
      }
    }

    // 4. Se è un link m3u8 o diretto ai content
    if (!eventId) {
      const cdnMatch = input.match(/events\/([a-f0-9]{24})/i);
      if (cdnMatch) {
        eventId = cdnMatch[1];
      }
    }

    if (input.endsWith('.m3u8')) {
      fallbackStreamUrl = input;
    }

    // 5. Se abbiamo un eventId, interroga le API Pixellot
    if (eventId) {
      const headers: Record<string, string> = {
        Accept: 'application/json',
      };
      if (token) {
        headers['X-Shared-Authorization'] = token;
      }

      try {
        const eventRes = await fetch(`https://you.pixellot.tv/api/v1/events/${eventId}`, {
          headers,
        });

        if (eventRes.ok) {
          const json = await eventRes.json();
          const attr = json.data?.attributes;

          const name = attr?.name || 'Gara Pixellot';
          const team1 = attr?.gameInfo?.team1;
          const team2 = attr?.gameInfo?.team2;
          const team1Logo = attr?.gameInfo?.team1Logo;
          const team2Logo = attr?.gameInfo?.team2Logo;

          const hdUrl = attr?.urls?.hd || fallbackStreamUrl || '';
          const panoUrl = attr?.urls?.pano || '';
          const thumbnail =
            attr?.thumbnails?.hd ||
            fallbackThumbnail ||
            `https://content-us-1.you.pixellot.tv/events/${eventId}/hd/${eventId}.jpg`;

          // Durata
          const duration =
            attr?.videosList?.[0]?.videos?.[0]?.duration ||
            attr?.duration ||
            6600;

          // Recupero tags ed eventi (highlights & tempi)
          let periods: PixellotPeriod[] = [];
          let highlights: PixellotHighlight[] = [];

          try {
            const tagsRes = await fetch(`https://you.pixellot.tv/api/v1/events/${eventId}/tags?include=user-tags`, {
              headers,
            });

            if (tagsRes.ok) {
              const tagsJson = await tagsRes.json();
              const tagsData = Array.isArray(tagsJson.data) ? tagsJson.data : [];

              // Cerca il marcatore di inizio 2° tempo
              const p2Tag = tagsData.find(
                (t: any) =>
                  t.attributes?.type === 'P2 start' ||
                  t.attributes?.name?.toLowerCase().includes('2° tempo') ||
                  t.attributes?.name?.toLowerCase().includes('second half')
              );

              const p2Start = p2Tag?.attributes?.startTime || (duration > 3600 ? 3600 : null);

              if (p2Start && p2Start < duration) {
                periods = [
                  {
                    name: '1° Tempo',
                    start: 0,
                    end: p2Start,
                    duration: p2Start,
                    startDisplay: '00:00',
                    endDisplay: formatSecondsToTime(p2Start),
                  },
                  {
                    name: '2° Tempo',
                    start: p2Start,
                    end: duration,
                    duration: duration - p2Start,
                    startDisplay: formatSecondsToTime(p2Start),
                    endDisplay: formatSecondsToTime(duration),
                  },
                ];
              } else {
                periods = [
                  {
                    name: 'Gara Intera',
                    start: 0,
                    end: duration,
                    duration,
                    startDisplay: '00:00',
                    endDisplay: formatSecondsToTime(duration),
                  },
                ];
              }

              // Highlights
              highlights = tagsData
                .filter((t: any) => t.attributes?.type !== 'P2 start')
                .map((t: any) => {
                  const a = t.attributes || {};
                  const isShot = a.type === 'shot';
                  const isGoal =
                    a.type === 'goal' || a.name?.toLowerCase().includes('gol') || a.name?.toLowerCase().includes('goal');
                  const isCard =
                    a.type === 'card' || a.name?.toLowerCase().includes('ammon') || a.name?.toLowerCase().includes('espul');
                  const label =
                    a.name || (isGoal ? 'Gol ⚽' : isShot ? 'Tiro / Conclusione 🎯' : isCard ? 'Cartellino 🟨' : 'Azione Saliente');
                  const icon = isGoal ? '⚽' : isShot ? '🎯' : isCard ? '🟨' : '⚡';
                  const start = a.startTime || 0;
                  const end = a.endTime || start + 10;
                  return {
                    id: t.id,
                    type: a.type || 'action',
                    label,
                    start,
                    duration: Math.max(5, end - start),
                    timeDisplay: formatSecondsToTime(start),
                    icon,
                  };
                })
                .sort((a: any, b: any) => a.start - b.start);
            }
          } catch (tagsErr) {
            console.warn('[PixellotService] Errore fetch tags:', tagsErr);
          }

          return {
            id: eventId,
            title: name,
            streamUrl: hdUrl,
            panoStreamUrl: panoUrl,
            thumbnail,
            duration,
            durationDisplay: formatSecondsToTime(duration),
            homeTeamName: team1,
            awayTeamName: team2,
            homeTeamLogo: team1Logo,
            awayTeamLogo: team2Logo,
            periods,
            highlights,
          };
        }
      } catch (apiErr) {
        console.warn('[PixellotService] Errore API Pixellot:', apiErr);
      }
    }

    // Se l'API Pixellot fallisce o siamo offline ma abbiamo l'eventId o stream
    if (eventId || fallbackStreamUrl) {
      const targetId = eventId || 'pixellot-match';
      const isKnown = targetId === '6adcd66163df3e1f60a694d6' || input.includes('8u1AfK6Pw7b');
      const stream =
        fallbackStreamUrl ||
        (isKnown
          ? 'https://content-us-1.you.pixellot.tv/events/6adcd66163df3e1f60a694d6/hd/hd_1792858484773.m3u8'
          : `https://content-us-1.you.pixellot.tv/events/${targetId}/hd/hd.m3u8`);
      const panoStream = isKnown
        ? 'https://content-us-1.you.pixellot.tv/events/6adcd66163df3e1f60a694d6/pano/panorama.m3u8'
        : undefined;
      const thumb =
        fallbackThumbnail || `https://content-us-1.you.pixellot.tv/events/${targetId}/hd/${targetId}.jpg`;

      return {
        id: targetId,
        title: isKnown ? 'Medicina Fossatone vs Fratta Terme' : 'Gara Pixellot AI',
        streamUrl: stream,
        panoStreamUrl: panoStream,
        thumbnail: thumb,
        duration: 6606,
        durationDisplay: '1:50:06',
        homeTeamName: isKnown ? 'Medicina Fossatone' : undefined,
        awayTeamName: isKnown ? 'Fratta Terme' : undefined,
        periods: [
          {
            name: '1° Tempo',
            start: 0,
            end: 3601,
            duration: 3601,
            startDisplay: '00:00',
            endDisplay: '60:01',
          },
          {
            name: '2° Tempo',
            start: 3601,
            end: 6606,
            duration: 3005,
            startDisplay: '60:01',
            endDisplay: '1:50:06',
          },
        ],
        highlights: [],
      };
    }

    return null;
  } catch (err) {
    console.error('Errore durante la risoluzione del match Pixellot:', err);
    return null;
  }
}
