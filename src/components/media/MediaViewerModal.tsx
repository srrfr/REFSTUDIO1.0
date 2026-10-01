'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Clock,
  Film,
  Image as ImageIcon,
  FastForward,
  Rewind,
  Gauge,
  ExternalLink,
  Bookmark,
  BookmarkPlus,
  Trash2,
  ArrowRight,
  Sparkles,
  Loader2,
  Target,
  Layers,
  ChevronRight,
  Flag,
  Calendar,
  Shield,
  FileText,
  CheckCircle2,
  Lock,
  Globe,
  Plus,
  PenTool,
  AlertCircle,
} from 'lucide-react';
import {
  isVeoUrl,
  extractVeoSlug,
  formatSecondsToTime,
  parseTimeToSeconds,
  VeoMatchData,
  VeoPeriod,
  VeoHighlight,
} from '@/lib/services/veo-service';
import { DbService } from '@/lib/repository/db-service';
import { Note, Team, VideoClip } from '@/types/refstudio';
import { useAuth } from '@/lib/auth/auth-context';

export interface MediaViewerItem {
  id?: string;
  url: string;
  title: string;
  subtitle?: string;
  description?: string;
  mediaType?: 'video' | 'image';
  timestampMark?: string;
  endTimestampMark?: string;
  authorName?: string;
  targetType?: 'squadra' | 'giocatore' | 'partita';
  targetId?: string;
  targetName?: string;
  homeTeamId?: string;
  homeTeamName?: string;
  awayTeamId?: string;
  awayTeamName?: string;
  relatedTeams?: { id: string; name: string }[];
}

interface MediaViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  media: MediaViewerItem | null;
}

export interface AssociatedTeamItem {
  team: Team;
  role: 'CASA' | 'OSPITE' | 'SQUADRA';
  label: string;
  shortRole: string;
}

interface RefereeBookmark {
  id: string;
  time: number;
  timeDisplay: string;
  matchClock?: string;
  note: string;
  createdAt: string;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

export const MediaViewerModal: React.FC<MediaViewerModalProps> = ({ isOpen, onClose, media }) => {
  const { user } = useAuth();

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [imageZoom, setImageZoom] = useState<number>(1);

  // Veo specific states
  const [veoData, setVeoData] = useState<VeoMatchData | null>(null);
  const [isLoadingVeo, setIsLoadingVeo] = useState(false);
  const [veoError, setVeoError] = useState<string | null>(null);
  const [directStreamUrl, setDirectStreamUrl] = useState<string>('');

  // YouTube specific states
  const [isYtReady, setIsYtReady] = useState(false);
  const ytPlayerRef = useRef<any>(null);

  // Navigator controls
  const [minuteInput, setMinuteInput] = useState('');
  const [activeTab, setActiveTab] = useState<'NOTE_SQUADRE' | 'TEMPI' | 'HIGHLIGHTS' | 'SEGNALIBRI'>('NOTE_SQUADRE');
  const [bookmarks, setBookmarks] = useState<RefereeBookmark[]>([]);
  const [isAddingBookmark, setIsAddingBookmark] = useState(false);
  const [newBookmarkNote, setNewBookmarkNote] = useState('');

  // Gestione Squadre Coinvolte & Acquisizione Note Video / Clip
  const [allDbTeams, setAllDbTeams] = useState<Team[]>([]);
  const [associatedTeams, setAssociatedTeams] = useState<AssociatedTeamItem[]>([]);
  const [videoNotes, setVideoNotes] = useState<Note[]>([]);
  const [recordedClips, setRecordedClips] = useState<VideoClip[]>([]);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [selectedNoteTeamId, setSelectedNoteTeamId] = useState<string>('');
  const [noteMinuteText, setNoteMinuteText] = useState('');
  const [noteEndMinuteText, setNoteEndMinuteText] = useState('');
  const [noteClipTitle, setNoteClipTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [notePriority, setNotePriority] = useState<'LOW' | 'NORMAL' | 'HIGH'>('NORMAL');
  const [noteIsPublic, setNoteIsPublic] = useState(true);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [noteFormError, setNoteFormError] = useState<string | null>(null);

  // Controllo riproduzione clip con intervallo temporale (minuto iniziale -> finale)
  const [activeClipRange, setActiveClipRange] = useState<{ start: number; end: number; label: string } | null>(null);
  const activeClipRangeRef = useRef<{ start: number; end: number; label: string } | null>(null);
  const [isClipFinished, setIsClipFinished] = useState(false);

  useEffect(() => {
    activeClipRangeRef.current = activeClipRange;
  }, [activeClipRange]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isVeo = Boolean(media?.url && isVeoUrl(media.url));

  const isYoutube = Boolean(
    !isVeo && media?.url && (media.url.includes('youtube.com') || media.url.includes('youtu.be'))
  );

  const isImage = Boolean(
    media?.mediaType === 'image' ||
      (!isVeo && !isYoutube && media?.url && media.url.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i))
  );

  const isVideo = !isYoutube && !isImage && Boolean(media?.url);

  // Utility estrazione YouTube Video ID
  const getYoutubeVideoId = useCallback((url?: string): string => {
    if (!url) return '';
    try {
      if (url.includes('watch?v=')) {
        return url.split('watch?v=')[1].split('&')[0];
      } else if (url.includes('youtu.be/')) {
        return url.split('youtu.be/')[1].split('?')[0];
      } else if (url.includes('embed/')) {
        return url.split('embed/')[1].split('?')[0];
      }
    } catch {}
    return '';
  }, []);

  // Calcolo tempo gara e minuto effettivo dai periodi Veo (avvio corretto da 00:00)
  const getMatchClock = useCallback((timeSec: number) => {
    if (!veoData?.periods || veoData.periods.length === 0) return null;
    const p1 = veoData.periods[0];
    const p2 = veoData.periods[1];

    if (p1 && timeSec >= p1.start && timeSec <= p1.end) {
      const elapsedSec = Math.max(0, Math.floor(timeSec - p1.start));
      const mm = Math.floor(elapsedSec / 60);
      const ss = elapsedSec % 60;
      const timeStr = `${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
      return {
        periodName: '1° Tempo',
        matchMinute: mm,
        display: `1°T ${timeStr}`,
        isHalfTime: false,
      };
    }

    if (p2 && timeSec >= p2.start) {
      const elapsedSec = Math.max(0, Math.floor(timeSec - p2.start));
      const mm = 45 + Math.floor(elapsedSec / 60);
      const ss = elapsedSec % 60;
      const timeStr = `${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
      return {
        periodName: '2° Tempo',
        matchMinute: mm,
        display: `2°T ${timeStr}`,
        isHalfTime: false,
      };
    }

    if (p1 && timeSec < p1.start) {
      return {
        periodName: 'Pre-gara',
        matchMinute: 0,
        display: 'Pre-gara',
        isHalfTime: false,
      };
    }

    if (p1 && p2 && timeSec > p1.end && timeSec < p2.start) {
      return {
        periodName: 'Intervallo',
        matchMinute: 45,
        display: 'Intervallo 1°/2°T',
        isHalfTime: true,
      };
    }

    return null;
  }, [veoData]);

  // Caricamento e identificazione squadre coinvolte nel video
  useEffect(() => {
    if (!isOpen) return;
    const teams = DbService.getTeams().sort((a, b) => a.name.localeCompare(b.name));
    setAllDbTeams(teams);

    if (!media) {
      setAssociatedTeams([]);
      return;
    }

    let resolvedHomeTeamId: string | undefined = media.homeTeamId;
    let resolvedAwayTeamId: string | undefined = media.awayTeamId;

    // Se mancano, controlla se media.targetId ha il formato `${homeId}_vs_${awayId}`
    if ((!resolvedHomeTeamId || !resolvedAwayTeamId) && media.targetId && media.targetId.includes('_vs_')) {
      const [hId, aId] = media.targetId.split('_vs_');
      if (!resolvedHomeTeamId && hId) resolvedHomeTeamId = hId;
      if (!resolvedAwayTeamId && aId) resolvedAwayTeamId = aId;
    }

    // Se ancora mancano e targetType === 'partita' e punta a un match a calendario
    if ((!resolvedHomeTeamId || !resolvedAwayTeamId) && media.targetType === 'partita' && media.targetId) {
      const match = DbService.getMatchById(media.targetId);
      if (match) {
        if (!resolvedHomeTeamId) resolvedHomeTeamId = match.homeTeamId;
        if (!resolvedAwayTeamId) resolvedAwayTeamId = match.awayTeamId;
      }
    }

    // Se ancora mancano, analizza titolo / targetName cercando il separatore standard "vs" o "-"
    if (!resolvedHomeTeamId || !resolvedAwayTeamId) {
      const fullText = `${media.title || ''} ${media.targetName || ''} ${media.subtitle || ''}`.trim();
      const vsPattern = /\s+(?:vs\.?|v\.?|-)\s+/i;
      if (vsPattern.test(fullText)) {
        const parts = fullText.split(vsPattern);
        if (parts.length >= 2) {
          const leftPart = parts[0].toLowerCase();
          const rightPart = parts[1].toLowerCase();
          const longestFirst = [...teams].sort((a, b) => b.name.length - a.name.length);
          const hMatch = longestFirst.find((t) => leftPart.includes(t.name.toLowerCase()));
          const aMatch = longestFirst.find((t) => rightPart.includes(t.name.toLowerCase()));
          if (hMatch && !resolvedHomeTeamId) resolvedHomeTeamId = hMatch.id;
          if (aMatch && !resolvedAwayTeamId) resolvedAwayTeamId = aMatch.id;
        }
      }
    }

    const items: AssociatedTeamItem[] = [];

    // Casa: risolto con massima priorità
    if (resolvedHomeTeamId) {
      const ht = teams.find((t) => t.id === resolvedHomeTeamId);
      if (ht) {
        items.push({
          team: ht,
          role: 'CASA',
          label: `Casa: ${ht.name}`,
          shortRole: 'Casa: ',
        });
      }
    }

    // Ospite: risolto con massima priorità
    if (resolvedAwayTeamId && resolvedAwayTeamId !== resolvedHomeTeamId) {
      const at = teams.find((t) => t.id === resolvedAwayTeamId);
      if (at) {
        items.push({
          team: at,
          role: 'OSPITE',
          label: `Ospite: ${at.name}`,
          shortRole: 'Ospite: ',
        });
      }
    }

    // Singola squadra (se targetType === 'squadra')
    if (items.length === 0 && media.targetType === 'squadra' && media.targetId) {
      const single = teams.find((t) => t.id === media.targetId);
      if (single) {
        items.push({
          team: single,
          role: 'SQUADRA',
          label: single.name,
          shortRole: '',
        });
      }
    }

    // Fallback: cerca occorrenze nel testo ordinate per indice di apparizione nel testo (MAI in ordine alfabetico!)
    if (items.length === 0) {
      const fullText = `${media.title || ''} ${media.subtitle || ''} ${media.targetName || ''} ${media.description || ''}`.toLowerCase();
      const occurrences: { team: Team; index: number }[] = [];
      for (const t of teams) {
        const idx = fullText.indexOf(t.name.toLowerCase());
        if (idx !== -1) {
          occurrences.push({ team: t, index: idx });
        }
      }
      occurrences.sort((a, b) => a.index - b.index);

      if (occurrences.length >= 2) {
        items.push({
          team: occurrences[0].team,
          role: 'CASA',
          label: `Casa: ${occurrences[0].team.name}`,
          shortRole: 'Casa: ',
        });
        items.push({
          team: occurrences[1].team,
          role: 'OSPITE',
          label: `Ospite: ${occurrences[1].team.name}`,
          shortRole: 'Ospite: ',
        });
      } else if (occurrences.length === 1) {
        items.push({
          team: occurrences[0].team,
          role: 'SQUADRA',
          label: occurrences[0].team.name,
          shortRole: '',
        });
      }
    }

    setAssociatedTeams(items);
    if (items.length > 0) {
      setSelectedNoteTeamId(items[0].team.id);
    } else if (teams.length > 0) {
      setSelectedNoteTeamId(teams[0].id);
    }
  }, [isOpen, media]);

  // Caricamento note e clip registrate per questo video / squadre
  const loadVideoNotes = useCallback(() => {
    if (!media) {
      setVideoNotes([]);
      setRecordedClips([]);
      return;
    }
    const allNotes = DbService.getNotes(undefined, undefined, user?.username);
    const allClips = DbService.getVideos();
    const relevantTeamIds = associatedTeams.map((item) => item.team.id);

    // Filtra clip video appartenenti a questa gara o squadre coinvolte
    const filteredClips = allClips.filter((c) => {
      if (media.id && c.id === media.id) return true;
      if (media.url && (c.externalUrl === media.url || c.storagePath === media.url)) return true;
      if (relevantTeamIds.includes(c.targetId)) return true;
      if (media.homeTeamId && (c.homeTeamId === media.homeTeamId || c.awayTeamId === media.homeTeamId)) return true;
      if (media.awayTeamId && (c.homeTeamId === media.awayTeamId || c.awayTeamId === media.awayTeamId)) return true;
      if (media.targetId && c.targetId === media.targetId) return true;
      return false;
    });
    setRecordedClips(filteredClips);

    const filtered = allNotes.filter((n) => {
      // Nota creata con ID o URL esplicito del video
      if (media.id && n.videoId === media.id) return true;
      if (media.url && n.videoUrl === media.url) return true;

      // Nota associata a una delle squadre della gara e con indicazione del minuto
      if (relevantTeamIds.includes(n.targetId) && (n.minute || n.videoId || n.videoUrl || n.content.includes('[Min.'))) {
        return true;
      }

      // Se la nota è associata direttamente al match
      if (media.targetId && n.targetId === media.targetId) return true;

      return false;
    });

    setVideoNotes(filtered);
  }, [media, associatedTeams, user?.username]);

  useEffect(() => {
    if (isOpen) {
      loadVideoNotes();
    }
  }, [isOpen, loadVideoNotes]);

  // Sincronizzazione in tempo reale con eventi locali
  useEffect(() => {
    if (!isOpen) return;
    const handleSync = () => {
      loadVideoNotes();
    };
    window.addEventListener('refstudio-sync-update', handleSync);
    return () => window.removeEventListener('refstudio-sync-update', handleSync);
  }, [isOpen, loadVideoNotes]);

  // Carica i metadati Veo se l'URL fornito è una gara Veo
  useEffect(() => {
    if (!isOpen || !media?.url) {
      setVeoData(null);
      setIsLoadingVeo(false);
      setVeoError(null);
      setDirectStreamUrl('');
      return;
    }

    if (isVeo) {
      setIsLoadingVeo(true);
      setVeoError(null);

      const slug = extractVeoSlug(media.url) || media.url;
      const storageKey = `refstudio_bookmarks_${slug}`;
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          setBookmarks(JSON.parse(saved));
        } else {
          setBookmarks([]);
        }
      } catch {
        setBookmarks([]);
      }

      fetch(`/api/veo/resolve?url=${encodeURIComponent(media.url)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.match) {
            setVeoData(data.match);
            setDirectStreamUrl(data.match.streamUrl);
          } else {
            setVeoError(data.message || 'Impossibile caricare il flusso video della gara Veo.');
          }
        })
        .catch((err) => {
          console.error('Errore chiamata Veo API:', err);
          setVeoError('Errore di connessione al servizio Veo.');
        })
        .finally(() => {
          setIsLoadingVeo(false);
        });
    } else {
      setVeoData(null);
      setIsLoadingVeo(false);
      setVeoError(null);
      setDirectStreamUrl(media.url);
    }
  }, [isOpen, media?.url, isVeo]);

  // Inizializzazione YouTube Player API
  useEffect(() => {
    if (!isOpen || !isYoutube || !media?.url) {
      setIsYtReady(false);
      ytPlayerRef.current = null;
      return;
    }

    const videoId = getYoutubeVideoId(media.url);
    if (!videoId) return;

    let pollInterval: any = null;

    const setupPlayer = () => {
      const containerEl = document.getElementById('yt-player-iframe-mount');
      if (!containerEl || !window.YT || !window.YT.Player) return;

      try {
        if (ytPlayerRef.current && typeof ytPlayerRef.current.destroy === 'function') {
          ytPlayerRef.current.destroy();
        }

        const initialSeconds = media.timestampMark ? parseTimeToSeconds(media.timestampMark) || 0 : 0;

        ytPlayerRef.current = new window.YT.Player('yt-player-iframe-mount', {
          videoId,
          playerVars: {
            autoplay: 1,
            enablejsapi: 1,
            rel: 0,
            start: initialSeconds,
          },
          events: {
            onReady: (event: any) => {
              setIsYtReady(true);
              const d = event.target.getDuration();
              if (d) setDuration(d);
            },
            onStateChange: (event: any) => {
              // 1 = PLAYING, 2 = PAUSED
              setIsPlaying(event.data === 1);
            },
          },
        });

        // Polling del minutaggio corrente da YouTube Player con controllo fine clip
        pollInterval = setInterval(() => {
          if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
            try {
              const t = ytPlayerRef.current.getCurrentTime();
              if (typeof t === 'number' && !isNaN(t)) {
                setCurrentTime(t);
                if (activeClipRangeRef.current && t >= activeClipRangeRef.current.end) {
                  ytPlayerRef.current.pauseVideo();
                  setIsPlaying(false);
                  setIsClipFinished(true);
                }
              }
              const d = ytPlayerRef.current.getDuration();
              if (d && !isNaN(d)) {
                setDuration(d);
              }
            } catch {}
          }
        }, 300);
      } catch (err) {
        console.warn('Inizializzazione YouTube Player non riuscita:', err);
      }
    };

    if (window.YT && window.YT.Player) {
      setupPlayer();
    } else {
      const existingScript = document.getElementById('youtube-iframe-api-script');
      if (!existingScript) {
        const tag = document.createElement('script');
        tag.id = 'youtube-iframe-api-script';
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
      }

      window.onYouTubeIframeAPIReady = () => {
        setupPlayer();
      };
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (ytPlayerRef.current && typeof ytPlayerRef.current.destroy === 'function') {
        try {
          ytPlayerRef.current.destroy();
        } catch {}
      }
      ytPlayerRef.current = null;
      setIsYtReady(false);
    };
  }, [isOpen, isYoutube, media?.url, getYoutubeVideoId, media?.timestampMark]);

  // Funzione di seek fluida unificata per Veo, YouTube e Video locale
  const seekTo = useCallback(
    (targetSeconds: number) => {
      const safeTime = Math.max(0, targetSeconds);
      if (isYoutube && ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
        try {
          ytPlayerRef.current.seekTo(safeTime, true);
          setCurrentTime(safeTime);
          return;
        } catch {}
      }

      if (videoRef.current) {
        const validTime = Math.max(0, Math.min(videoRef.current.duration || 999999, safeTime));
        videoRef.current.currentTime = validTime;
        setCurrentTime(validTime);
      }
    },
    [isYoutube]
  );

  const jumpSeconds = useCallback(
    (delta: number) => {
      seekTo(currentTime + delta);
    },
    [currentTime, seekTo]
  );

  const togglePlay = () => {
    if (isYoutube && ytPlayerRef.current) {
      try {
        if (isPlaying) {
          ytPlayerRef.current.pauseVideo();
          setIsPlaying(false);
        } else {
          ytPlayerRef.current.playVideo();
          setIsPlaying(true);
        }
        return;
      } catch {}
    }

    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  // Apertura form acquisizione clip/nota con minuto iniziale e finale
  const handleOpenAddNote = () => {
    // Pausa video per consentire all'arbitro di scrivere e regolare i tempi con calma
    if (isPlaying) {
      togglePlay();
    }

    // Minuto effettivo di scorrimento del video (timeline) per sincronizzazione 1:1 con il player
    const videoStartStr = formatSecondsToTime(currentTime);
    setNoteMinuteText(videoStartStr);

    // Minuto finale di default a +30s rispetto al tempo effettivo del video
    const defaultEndSec = currentTime + 30;
    const videoEndStr = formatSecondsToTime(defaultEndSec);
    setNoteEndMinuteText(videoEndStr);

    setNoteClipTitle('');
    setNoteContent('');
    setNoteFormError(null);
    setSaveSuccessMessage(null);
    setIsAddingNote(true);
  };

  // Salvataggio nota video/clip direttamente nella sezione Note Video della squadra
  const handleSaveTeamNote = () => {
    if (!selectedNoteTeamId) {
      setNoteFormError('Seleziona la squadra a cui fa riferimento la nota video.');
      return;
    }

    if (!noteContent.trim() && !noteClipTitle.trim()) {
      setNoteFormError('Inserisci un titolo per la clip o l\'osservazione arbitrale.');
      return;
    }

    const targetTeam = allDbTeams.find((t) => t.id === selectedNoteTeamId);
    const teamName = targetTeam ? targetTeam.name : 'Squadra';

    const cleanStart = noteMinuteText.trim() || formatSecondsToTime(currentTime);
    const cleanEnd = noteEndMinuteText.trim() || formatSecondsToTime(currentTime + 30);

    const clock = getMatchClock(currentTime);
    const clockInfo = clock?.display ? ` [${clock.display}]` : '';

    const titleToUse =
      noteClipTitle.trim() ||
      `Clip ${cleanStart}${cleanEnd ? ` - ${cleanEnd}` : ''}${clockInfo} (${teamName})`;

    try {
      const createdVideo = DbService.addVideo({
        targetType: 'squadra',
        targetId: selectedNoteTeamId,
        targetName: teamName,
        homeTeamId: media?.homeTeamId,
        homeTeamName: media?.homeTeamName,
        awayTeamId: media?.awayTeamId,
        awayTeamName: media?.awayTeamName,
        videoSource: isVeo ? 'VEO' : isYoutube ? 'YOUTUBE' : 'LOCAL',
        externalUrl: media?.url,
        storagePath: !isYoutube && !isVeo ? media?.url : undefined,
        title: titleToUse,
        description: noteContent.trim(),
        timestampMark: cleanStart,
        endTimestampMark: cleanEnd || undefined,
        mediaType: 'video',
        priority: notePriority,
        isPublic: noteIsPublic,
        authorId: user?.username || 'arbitro',
        authorName: user?.displayName || 'Arbitro',
      });

      // Feedback visivo immediato
      setSaveSuccessMessage(`Nota video salvata con successo nella sezione "Note Video" di ${teamName}!`);
      setNoteContent('');
      setNoteClipTitle('');
      setIsAddingNote(false);
      setNoteFormError(null);
      setActiveTab('NOTE_SQUADRE');

      // Notifica globale multi-componente (aggiorna la scheda squadra istantaneamente)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('refstudio-sync-update', { detail: { videoCreated: createdVideo } }));
      }

      loadVideoNotes();
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err: any) {
      setNoteFormError(err.message || 'Errore durante il salvataggio della nota video.');
    }
  };

  const handleDeleteRecordedClip = async (clipId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Sei sicuro di voler eliminare questa clip dalla sezione Note Video della squadra?')) {
      try {
        await DbService.deleteVideoAsync(clipId);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('refstudio-sync-update', { detail: { videoDeleted: clipId } }));
        }
        loadVideoNotes();
      } catch (err: any) {
        alert(err.message || 'Non sei autorizzato a eliminare questa clip.');
      }
    }
  };

  const handlePlayClip = (clip: VideoClip) => {
    const startSec = clip.timestampMark ? parseTimeToSeconds(clip.timestampMark) ?? 0 : 0;
    const endSec = clip.endTimestampMark ? parseTimeToSeconds(clip.endTimestampMark) : null;
    seekTo(startSec);
    if (endSec !== null && endSec > startSec) {
      setActiveClipRange({
        start: startSec,
        end: endSec,
        label: `${clip.timestampMark} → ${clip.endTimestampMark}`,
      });
      setIsClipFinished(false);
    } else {
      setActiveClipRange(null);
      setIsClipFinished(false);
    }
    if (!isPlaying) {
      togglePlay();
    }
  };

  const handleDeleteTeamNote = async (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Sei sicuro di voler eliminare questa nota arbitrale?')) {
      try {
        await DbService.deleteNoteAsync(noteId, user?.username);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('refstudio-sync-update', { detail: { noteDeleted: noteId } }));
        }
        loadVideoNotes();
      } catch (err: any) {
        alert(err.message || 'Non sei autorizzato a eliminare questa nota.');
      }
    }
  };

  // Segnalibri locali Veo
  const handleAddBookmark = () => {
    const time = currentTime;
    const timeDisplay = formatSecondsToTime(time);
    const clock = getMatchClock(time);

    const newBm: RefereeBookmark = {
      id: `bm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      time,
      timeDisplay,
      matchClock: clock ? clock.display : undefined,
      note: newBookmarkNote.trim() || `Appunto al ${clock ? clock.display : timeDisplay}`,
      createdAt: new Date().toISOString(),
    };

    const updated = [newBm, ...bookmarks];
    setBookmarks(updated);
    setNewBookmarkNote('');
    setIsAddingBookmark(false);

    if (media?.url) {
      const slug = extractVeoSlug(media.url) || media.url;
      try {
        localStorage.setItem(`refstudio_bookmarks_${slug}`, JSON.stringify(updated));
      } catch {}
    }
  };

  const handleDeleteBookmark = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = bookmarks.filter((b) => b.id !== id);
    setBookmarks(updated);
    if (media?.url) {
      const slug = extractVeoSlug(media.url) || media.url;
      try {
        localStorage.setItem(`refstudio_bookmarks_${slug}`, JSON.stringify(updated));
      } catch {}
    }
  };

  const handleMinuteSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!minuteInput.trim()) return;
    const secs = parseTimeToSeconds(minuteInput);
    if (secs !== null) {
      seekTo(secs);
      setMinuteInput('');
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const cur = videoRef.current.currentTime;
      setCurrentTime(cur);
      if (activeClipRangeRef.current && cur >= activeClipRangeRef.current.end) {
        videoRef.current.pause();
        setIsPlaying(false);
        setIsClipFinished(true);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      if (media?.timestampMark) {
        const secs = parseTimeToSeconds(media.timestampMark);
        if (secs !== null) seekTo(secs);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    seekTo(time);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    if (isYoutube && ytPlayerRef.current && typeof ytPlayerRef.current.setPlaybackRate === 'function') {
      try {
        ytPlayerRef.current.setPlaybackRate(speed);
      } catch {}
    }
  };

  const toggleMute = () => {
    if (isYoutube && ytPlayerRef.current) {
      try {
        if (isMuted) {
          ytPlayerRef.current.unMute();
          setIsMuted(false);
        } else {
          ytPlayerRef.current.mute();
          setIsMuted(true);
        }
        return;
      } catch {}
    }

    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (isYoutube && ytPlayerRef.current) {
      try {
        ytPlayerRef.current.setVolume(val * 100);
        setIsMuted(val === 0);
      } catch {}
    }
    if (videoRef.current) {
      videoRef.current.volume = val;
      setIsMuted(val === 0);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => console.warn(err));
    } else {
      document.exitFullscreen().catch((err) => console.warn(err));
    }
  };

  const stepFrame = (forward: boolean) => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
      const frameTime = 0.04;
      seekTo(videoRef.current.currentTime + (forward ? frameTime : -frameTime));
    } else if (isYoutube) {
      jumpSeconds(forward ? 1 : -1);
    }
  };

  // Scorciatoie da tastiera
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        handleOpenAddNote();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        jumpSeconds(e.shiftKey ? 60 : 5);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        jumpSeconds(e.shiftKey ? -60 : -5);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPlaying, jumpSeconds]);

  // Reset stato alla chiusura / cambio media e inizializzazione intervallo clip
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackSpeed(1);
    setImageZoom(1);
    setIsAddingBookmark(false);
    setIsAddingNote(false);
    setNewBookmarkNote('');
    setNoteContent('');
    setNoteClipTitle('');
    setNoteFormError(null);

    // Inizializza intervallo clip se il media caricato contiene timestampMark ed endTimestampMark
    if (isOpen && media?.timestampMark) {
      const s = parseTimeToSeconds(media.timestampMark);
      const e = media.endTimestampMark ? parseTimeToSeconds(media.endTimestampMark) : null;
      if (s !== null && e !== null && e > s) {
        setActiveClipRange({
          start: s,
          end: e,
          label: `${media.timestampMark} → ${media.endTimestampMark}`,
        });
        setIsClipFinished(false);
      } else {
        setActiveClipRange(null);
        setIsClipFinished(false);
      }
    } else {
      setActiveClipRange(null);
      setIsClipFinished(false);
    }
  }, [media, isOpen]);

  if (!isOpen || !media) return null;

  const currentClock = getMatchClock(currentTime);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[80] flex flex-col bg-black/95 backdrop-blur-xl animate-in fade-in duration-200 select-none overflow-hidden"
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-[#0A0D15]/95 border-b border-[#1E2436] z-10 flex-shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="p-2 rounded-xl bg-[#141824] border border-[#232A3E]">
            {isImage ? (
              <ImageIcon className="w-5 h-5 text-[#CCFF00]" />
            ) : isVeo ? (
              <span className="text-xs font-black text-[#00E5FF] px-1 py-0.5 rounded bg-[#00E5FF]/10 border border-[#00E5FF]/30">
                VEO AI
              </span>
            ) : isYoutube ? (
              <span className="text-xs font-black text-[#FF334B] px-1 py-0.5 rounded bg-[#FF334B]/10 border border-[#FF334B]/30">
                YouTube
              </span>
            ) : (
              <Film className="w-5 h-5 text-[#CCFF00]" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-black text-white truncate max-w-[260px] sm:max-w-md">
                {veoData?.title || media.title || 'Visualizzatore Video & Analisi Arbitrale'}
              </h3>
              {associatedTeams.length > 0 && (
                <div className="hidden md:flex items-center gap-1.5 ml-2">
                  {associatedTeams.map((item) => (
                    <span
                      key={item.team.id}
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        item.role === 'CASA'
                          ? 'bg-[#CCFF00]/15 text-[#CCFF00] border-[#CCFF00]/30'
                          : item.role === 'OSPITE'
                          ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                          : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      }`}
                    >
                      {item.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {media.subtitle && <p className="text-xs text-slate-400 truncate">{media.subtitle}</p>}
          </div>
        </div>

        {/* Action Header: Tasto rapido Acquisisci Nota & Chiudi */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={handleOpenAddNote}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-[#CCFF00] hover:bg-[#d8ff33] text-black text-xs font-black shadow-[0_0_15px_rgba(204,255,0,0.35)] transition-all active:scale-95 cursor-pointer"
            title="Acquisisci clip / nota video associata a una squadra (Tasto N)"
          >
            <PenTool className="w-4 h-4 fill-black" />
            <span className="hidden sm:inline">Acquisisci Nota Video</span>
            <span className="sm:hidden">Nuova Clip</span>
          </button>

          {media.url && (
            <a
              href={media.url}
              target="_blank"
              rel="noreferrer"
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
              title="Apri sorgente originale in nuova scheda"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors active:scale-95"
            title="Chiudi (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Toast Feedback Salva Nota */}
      {saveSuccessMessage && (
        <div className="bg-[#CCFF00] text-black px-4 py-2 font-black text-xs flex items-center justify-center gap-2 shadow-lg animate-in fade-in duration-150 z-20">
          <CheckCircle2 className="w-4 h-4" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* Main Video View Area */}
      <div className="flex-1 relative flex flex-col items-center justify-start overflow-y-auto p-2 sm:p-4 bg-black">
        {isImage ? (
          <div className="relative w-full h-full flex items-center justify-center overflow-auto p-4">
            <img
              src={media.url}
              alt={media.title}
              style={{ transform: `scale(${imageZoom})`, transition: 'transform 0.15s ease-out' }}
              className="max-h-[82vh] max-w-[92vw] object-contain rounded-xl shadow-2xl"
            />
            {/* Image Zoom floating toolbar */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#0D101A]/85 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#22283B] shadow-xl">
              <button
                onClick={() => setImageZoom((z) => Math.max(0.5, z - 0.25))}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
                title="Zoom indietro"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-mono text-slate-300 min-w-[45px] text-center">
                {Math.round(imageZoom * 100)}%
              </span>
              <button
                onClick={() => setImageZoom((z) => Math.min(3, z + 0.25))}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
                title="Zoom avanti"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <div className="h-4 w-px bg-slate-700 mx-1" />
              <button
                onClick={() => setImageZoom(1)}
                className="px-2 py-1 text-[11px] font-bold text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
              >
                Reset
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-5xl flex flex-col items-center space-y-3">
            {/* Video Player Box */}
            <div className="relative w-full aspect-video max-h-[62vh] flex items-center justify-center group bg-black/90 rounded-2xl overflow-hidden border border-[#1E2436] shadow-2xl">
              {isYoutube ? (
                <div className="w-full h-full relative flex items-center justify-center bg-black">
                  <div id="yt-player-iframe-mount" className="w-full h-full" />
                </div>
              ) : isVeo && isLoadingVeo ? (
                <div className="flex flex-col items-center gap-3 p-8 text-center animate-in fade-in">
                  <div className="w-12 h-12 rounded-2xl bg-[#00E5FF]/10 border border-[#00E5FF]/30 flex items-center justify-center text-[#00E5FF]">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white">Caricamento Flusso Gara Veo...</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">
                      Recupero stream diretto, tempi di gioco ed eventi partita in corso
                    </p>
                  </div>
                </div>
              ) : isVeo && veoError ? (
                <div className="flex flex-col items-center gap-2 p-8 text-center text-rose-400">
                  <p className="text-sm font-bold">{veoError}</p>
                  <a
                    href={media.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 text-xs font-black text-[#00E5FF] underline"
                  >
                    Apri direttamente su app.veo.co
                  </a>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    src={directStreamUrl}
                    onClick={togglePlay}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onEnded={() => setIsPlaying(false)}
                    className="w-full h-full object-contain cursor-pointer"
                    playsInline
                  />

                  {/* Play overlay button on center */}
                  {!isPlaying && (
                    <button
                      onClick={togglePlay}
                      className="absolute inset-0 m-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#CCFF00]/90 text-black flex items-center justify-center shadow-[0_0_35px_rgba(204,255,0,0.5)] hover:scale-110 active:scale-95 transition-all z-10"
                    >
                      <Play className="w-8 h-8 sm:w-9 sm:h-9 fill-black ml-1" />
                    </button>
                  )}
                </>
              )}

              {/* Match clock & video timeline overlay on top-left of video */}
              {(currentClock || isVeo) && (
                <div className="absolute top-3 left-3 bg-[#0B0E17]/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[#212638] text-[11px] font-black text-white shadow-lg flex items-center gap-2.5 z-10 pointer-events-none">
                  <span className="w-2 h-2 rounded-full bg-[#CCFF00] animate-pulse" />
                  {currentClock && <span>{currentClock.display}</span>}
                  <span className="text-slate-400 font-mono text-[10px] border-l border-slate-700 pl-2">
                    Video: {formatSecondsToTime(currentTime)}
                  </span>
                </div>
              )}

              {/* Active Clip Range Indicator on top-right */}
              {activeClipRange && (
                <div className="absolute top-3 right-3 bg-[#0B0E17]/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[#CCFF00]/40 text-xs font-bold text-white shadow-xl flex items-center gap-2 z-10 animate-in fade-in">
                  <span className="w-2 h-2 rounded-full bg-[#CCFF00] animate-pulse" />
                  <span className="text-[10px] font-black text-slate-400 uppercase">Riproduzione Clip:</span>
                  <span className="font-mono text-[#CCFF00] font-black">{activeClipRange.label}</span>
                  <button
                    onClick={() => {
                      setActiveClipRange(null);
                      setIsClipFinished(false);
                    }}
                    className="ml-1 text-slate-400 hover:text-white text-[10px] bg-white/10 px-1.5 py-0.5 rounded hover:bg-white/20 transition-all cursor-pointer"
                    title="Esci dalla clip e continua riproduzione libera"
                  >
                    Esci da Clip
                  </button>
                </div>
              )}

              {/* Clip Finished Overlay with Quick Actions */}
              {isClipFinished && activeClipRange && (
                <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20 animate-in fade-in duration-200">
                  <div className="w-12 h-12 rounded-2xl bg-[#CCFF00]/20 border border-[#CCFF00]/40 flex items-center justify-center text-[#CCFF00] mb-2 shadow-[0_0_20px_rgba(204,255,0,0.3)]">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-black text-white">Clip Terminata</h4>
                  <p className="text-xs text-slate-300 mt-1 font-mono">
                    Intervallo clip: <span className="text-[#CCFF00] font-bold">{activeClipRange.label}</span>
                  </p>
                  <div className="flex items-center gap-3 mt-4">
                    <button
                      onClick={() => {
                        seekTo(activeClipRange.start);
                        setIsClipFinished(false);
                        if (!isPlaying) togglePlay();
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#CCFF00] hover:bg-[#d8ff33] text-black font-black text-xs shadow-lg transition-all active:scale-95 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Riavvia Clip
                    </button>
                    <button
                      onClick={() => {
                        setIsClipFinished(false);
                        setActiveClipRange(null);
                        if (!isPlaying) togglePlay();
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1C2235] hover:bg-[#252D45] text-white font-bold text-xs border border-[#2F3854] transition-all active:scale-95 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" /> Continua Gara Intera
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Complete Unified Video & Minute Navigator Panel */}
            <div className="w-full bg-[#0B0E17]/95 backdrop-blur-md border border-[#212638] rounded-2xl p-3 sm:p-4 space-y-3 shadow-2xl">
              {/* Scrubber timeline */}
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-[#CCFF00] font-black min-w-[55px]">
                  {formatSecondsToTime(currentTime)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  step={0.1}
                  value={currentTime}
                  onChange={handleSeek}
                  className="flex-1 h-2 bg-[#1F2538] rounded-lg appearance-none cursor-pointer accent-[#CCFF00]"
                />
                <span className="text-[11px] font-mono text-slate-400 min-w-[55px] text-right">
                  {formatSecondsToTime(duration)}
                </span>
              </div>

              {/* Main Controls Row */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t border-[#1C2133]">
                {/* Left: Play/Pause, Frame stepping, Volume */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={togglePlay}
                    className="p-2 rounded-xl bg-[#CCFF00] hover:bg-[#d8ff33] text-black font-black transition-all shadow-[0_0_12px_rgba(204,255,0,0.3)] active:scale-95"
                    title={isPlaying ? 'Pausa (Spazio)' : 'Riproduci (Spazio)'}
                  >
                    {isPlaying ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black ml-0.5" />}
                  </button>

                  {/* Frame by Frame / Seek buttons */}
                  <div className="flex items-center bg-[#141824] rounded-xl border border-[#212638] p-0.5">
                    <button
                      onClick={() => stepFrame(false)}
                      className="px-2 py-1 text-[10px] font-mono text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                      title="Frame precedente (-0.04s)"
                    >
                      -1F
                    </button>
                    <button
                      onClick={() => jumpSeconds(-5)}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                      title="Indietro 5 secondi (←)"
                    >
                      <Rewind className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => jumpSeconds(5)}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                      title="Avanti 5 secondi (→)"
                    >
                      <FastForward className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => stepFrame(true)}
                      className="px-2 py-1 text-[10px] font-mono text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                      title="Frame successivo (+0.04s)"
                    >
                      +1F
                    </button>
                  </div>

                  {/* Volume Slider */}
                  <div className="hidden md:flex items-center gap-1.5 pl-2 border-l border-[#212638]">
                    <button onClick={toggleMute} className="text-slate-400 hover:text-white p-1">
                      {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-14 h-1 bg-[#1F2538] rounded-lg appearance-none cursor-pointer accent-[#CCFF00]"
                    />
                  </div>
                </div>

                {/* Center / Right: Jump to minute input */}
                <div className="flex items-center gap-1.5">
                  <form onSubmit={handleMinuteSubmit} className="flex items-center bg-[#141824] rounded-xl border border-[#212638] px-2 py-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1.5 hidden sm:inline">
                      Minuto:
                    </span>
                    <input
                      type="text"
                      placeholder="es. 45 o 82:53"
                      value={minuteInput}
                      onChange={(e) => setMinuteInput(e.target.value)}
                      className="w-24 sm:w-28 bg-transparent text-xs font-mono text-white placeholder-slate-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="px-2 py-0.5 rounded-lg bg-[#CCFF00] hover:bg-[#d8ff33] text-black text-[10px] font-black transition-all flex items-center gap-1 ml-1"
                      title="Vai al minuto indicato"
                    >
                      VAI <ArrowRight className="w-3 h-3" />
                    </button>
                  </form>
                </div>

                {/* Right: Slow Motion Speeds & Fullscreen */}
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-0.5 bg-[#141824] rounded-xl border border-[#212638] p-0.5">
                    {[0.25, 0.5, 0.75, 1, 1.5, 2].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => handleSpeedChange(speed)}
                        className={`px-1.5 py-1 rounded-lg text-[10px] font-black transition-all ${
                          playbackSpeed === speed
                            ? 'bg-[#CCFF00] text-black shadow-sm'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {speed === 1 ? '1x' : `${speed}x`}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={toggleFullscreen}
                    className="p-2 rounded-xl bg-[#141824] hover:bg-[#1E2435] text-slate-300 hover:text-white border border-[#212638] transition-all"
                    title="Schermo intero"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Quick Minute Jump Chips & Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1C2133]/80">
                <div className="flex flex-wrap items-center gap-1 text-[11px]">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mr-1">
                    Salti rapidi:
                  </span>
                  {[-300, -60, -10, 10, 60, 300].map((delta) => {
                    const label =
                      delta === -300 ? '-5m' :
                      delta === -60 ? '-1m' :
                      delta === -10 ? '-10s' :
                      delta === 10 ? '+10s' :
                      delta === 60 ? '+1m' : '+5m';
                    return (
                      <button
                        key={delta}
                        onClick={() => jumpSeconds(delta)}
                        className="px-2 py-0.5 rounded-lg bg-[#141824] hover:bg-[#1C2233] text-slate-300 hover:text-[#CCFF00] font-mono text-[11px] font-bold border border-[#212638] transition-all active:scale-95"
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2">
                  {/* Bookmark trigger button */}
                  <button
                    onClick={() => setIsAddingBookmark(!isAddingBookmark)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#141824] hover:bg-[#1C2233] text-slate-300 border border-[#212638] text-xs font-bold transition-all active:scale-95"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5 text-slate-400" />
                    <span>Segnalibro ({formatSecondsToTime(currentTime)})</span>
                  </button>

                  {/* Primary Note Acquisition Trigger Button */}
                  <button
                    onClick={handleOpenAddNote}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#CCFF00] hover:bg-[#d8ff33] text-black text-xs font-black shadow-[0_0_12px_rgba(204,255,0,0.35)] transition-all active:scale-95 cursor-pointer"
                  >
                    <PenTool className="w-3.5 h-3.5 fill-black" />
                    <span>Registra Nota Video Squadra</span>
                  </button>
                </div>
              </div>

              {/* Inline Form ACQUISIZIONE NOTA VIDEO & CLIP PER LA SQUADRA */}
              {isAddingNote && (
                <div className="p-4 bg-[#111420] border-2 border-[#CCFF00]/50 rounded-2xl space-y-3.5 shadow-2xl animate-in fade-in duration-200">
                  <div className="flex items-center justify-between border-b border-[#21283D] pb-2">
                    <span className="font-black text-white flex items-center gap-2 text-xs sm:text-sm">
                      <PenTool className="w-4 h-4 text-[#CCFF00]" />
                      Acquisisci Nota Video / Clip per la Squadra
                    </span>
                    <button
                      onClick={() => setIsAddingNote(false)}
                      className="text-slate-400 hover:text-white p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 1. Selezione della squadra di riferimento (Obbligatoria) */}
                  <div>
                    <label className="block text-[11px] font-black text-slate-300 uppercase tracking-wider mb-1.5">
                      Squadra a cui associare la clip (Seleziona):
                    </label>

                    {associatedTeams.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {associatedTeams.map((item) => {
                          const isSelected = selectedNoteTeamId === item.team.id;
                          return (
                            <button
                              key={item.team.id}
                              type="button"
                              onClick={() => setSelectedNoteTeamId(item.team.id)}
                              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                                isSelected
                                  ? item.role === 'CASA'
                                    ? 'bg-[#CCFF00] text-black shadow-[0_0_15px_rgba(204,255,0,0.4)] scale-102 ring-2 ring-[#CCFF00]'
                                    : item.role === 'OSPITE'
                                    ? 'bg-sky-400 text-black shadow-[0_0_15px_rgba(56,189,248,0.4)] scale-102 ring-2 ring-sky-400'
                                    : 'bg-[#CCFF00] text-black shadow-[0_0_15px_rgba(204,255,0,0.4)] scale-102 ring-2 ring-[#CCFF00]'
                                  : 'bg-[#181D2D] text-slate-300 border border-[#2B354F] hover:text-white hover:border-slate-400'
                              }`}
                            >
                              <Shield className="w-3.5 h-3.5" />
                              {item.shortRole && <span className="font-bold">{item.shortRole}</span>}
                              <span>{item.team.name}</span>
                            </button>
                          );
                        })}

                        {/* Possibilità di selezionare un'altra squadra dal database se necessario */}
                        <div className="flex-1 min-w-[200px]">
                          <select
                            value={selectedNoteTeamId}
                            onChange={(e) => setSelectedNoteTeamId(e.target.value)}
                            className="w-full bg-[#181D2D] border border-[#2B354F] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#CCFF00]"
                          >
                            <option value="">-- Altra Squadra dal Database --</option>
                            {allDbTeams.map((team) => (
                              <option key={team.id} value={team.id}>
                                {team.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : (
                      <select
                        value={selectedNoteTeamId}
                        onChange={(e) => setSelectedNoteTeamId(e.target.value)}
                        className="w-full bg-[#181D2D] border border-[#2B354F] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#CCFF00] font-bold"
                      >
                        <option value="">-- Seleziona Squadra dal Database --</option>
                        {allDbTeams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* 2. Dettagli Intervallo Temporale Clip (Minuto Iniziale e Minuto Finale) */}
                  <div className="space-y-1.5 p-3 rounded-xl bg-[#141824] border border-[#232B40]">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-black text-[#CCFF00] uppercase tracking-wider flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Minuto Inizio Clip (Video)
                          </label>
                          {currentClock && (
                            <span className="text-[9px] font-mono text-slate-400 bg-black/40 px-1.5 py-0.5 rounded border border-slate-700">
                              Gara: {currentClock.display}
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          value={noteMinuteText}
                          onChange={(e) => setNoteMinuteText(e.target.value)}
                          placeholder="Es. 14:20"
                          className="w-full bg-[#181D2D] border border-[#2B354F] rounded-xl px-3 py-2 text-xs text-white font-mono font-bold focus:outline-none focus:border-[#CCFF00]"
                        />
                        <p className="text-[9px] text-slate-400 mt-1">
                          Tempo effettivo del video (timeline)
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-black text-[#00E5FF] uppercase tracking-wider flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Minuto Fine Clip (Intervallo)
                          </label>
                        </div>
                        <input
                          type="text"
                          value={noteEndMinuteText}
                          onChange={(e) => setNoteEndMinuteText(e.target.value)}
                          placeholder="Es. 14:50"
                          className="w-full bg-[#181D2D] border border-[#2B354F] rounded-xl px-3 py-2 text-xs text-white font-mono font-bold focus:outline-none focus:border-[#00E5FF]"
                        />
                        <p className="text-[9px] text-slate-400 mt-1">
                          Fine riproduzione automatica della clip
                        </p>
                      </div>
                    </div>

                    {/* Preset rapidi per impostare il minuto finale */}
                    <div className="flex items-center gap-1 text-[11px] flex-wrap pt-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                        Imposta fine clip:
                      </span>
                      {[15, 30, 45, 60, 120].map((delta) => (
                        <button
                          key={delta}
                          type="button"
                          onClick={() => {
                            const sSec = parseTimeToSeconds(noteMinuteText) ?? currentTime;
                            const target = sSec + delta;
                            setNoteEndMinuteText(formatSecondsToTime(target));
                          }}
                          className="px-2 py-0.5 rounded-lg bg-[#1A2030] hover:bg-[#252E46] text-slate-300 hover:text-[#CCFF00] border border-[#2B354F] font-mono text-[10px] font-bold transition-all cursor-pointer"
                        >
                          +{delta < 60 ? `${delta}s` : `${delta / 60}m`}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setNoteEndMinuteText(formatSecondsToTime(currentTime));
                        }}
                        className="px-2 py-0.5 rounded-lg bg-[#1A2030] hover:bg-[#252E46] text-[#00E5FF] border border-[#00E5FF]/40 font-mono text-[10px] font-bold transition-all cursor-pointer"
                      >
                        📍 Tempo video corrente
                      </button>
                    </div>
                  </div>

                  {/* 3. Titolo Clip, Priorità e Visibilità */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                        Titolo Clip (Opzionale)
                      </label>
                      <input
                        type="text"
                        value={noteClipTitle}
                        onChange={(e) => setNoteClipTitle(e.target.value)}
                        placeholder="Es. Contrasto in area, Pressing..."
                        className="w-full bg-[#181D2D] border border-[#2B354F] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#CCFF00]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                        Priorità Nota
                      </label>
                      <select
                        value={notePriority}
                        onChange={(e) => setNotePriority(e.target.value as any)}
                        className="w-full bg-[#181D2D] border border-[#2B354F] rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-[#CCFF00]"
                      >
                        <option value="HIGH">Alta Priorità</option>
                        <option value="NORMAL">Normale</option>
                        <option value="LOW">Bassa</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                        Visibilità
                      </label>
                      <div className="flex bg-[#181D2D] border border-[#2B354F] rounded-xl p-1">
                        <button
                          type="button"
                          onClick={() => setNoteIsPublic(true)}
                          className={`flex-1 py-1 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1 transition-all ${
                            noteIsPublic ? 'bg-[#CCFF00] text-black font-black' : 'text-slate-400'
                          }`}
                        >
                          <Globe className="w-3 h-3" /> Pubblica
                        </button>
                        <button
                          type="button"
                          onClick={() => setNoteIsPublic(false)}
                          className={`flex-1 py-1 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1 transition-all ${
                            !noteIsPublic ? 'bg-amber-400 text-black font-black' : 'text-slate-400'
                          }`}
                        >
                          <Lock className="w-3 h-3" /> Privata
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 4. Contenuto dell'Osservazione Arbitrale */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                      Osservazione Arbitrale
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Descrivi l'episodio (fallo tattico, ammonizione, proteste, comportamento panchina, fuorigioco, ecc.)..."
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      className="w-full px-3 py-2 bg-[#181D2D] border border-[#2B354F] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#CCFF00] leading-relaxed"
                      autoFocus
                    />
                  </div>

                  {noteFormError && (
                    <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{noteFormError}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-400">
                      La clip verrà archiviata direttamente nella sezione <strong className="text-white">&quot;Note Video&quot;</strong> della squadra.
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsAddingNote(false)}
                        className="px-3 py-1.5 bg-[#181D2D] hover:bg-[#252C42] text-slate-300 font-bold text-xs rounded-xl border border-[#2B354F] transition-all cursor-pointer"
                      >
                        Annulla
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveTeamNote}
                        className="px-4 py-1.5 bg-[#CCFF00] hover:bg-[#d8ff33] text-black font-black text-xs rounded-xl shadow-[0_0_15px_rgba(204,255,0,0.35)] transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Salva nella Sezione &quot;Note Video&quot; della Squadra
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Inline Bookmark Creation Form */}
              {isAddingBookmark && (
                <div className="p-3 bg-[#111420] border border-[#CCFF00]/30 rounded-xl space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black text-white flex items-center gap-1.5">
                      <Bookmark className="w-3.5 h-3.5 text-[#CCFF00]" />
                      Aggiungi Segnalibro al minuto {formatSecondsToTime(currentTime)}
                      {currentClock && ` (${currentClock.display})`}
                    </span>
                    <button
                      onClick={() => setIsAddingBookmark(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="es. Fallo da ammonizione non visto, posizione fuorigioco..."
                      value={newBookmarkNote}
                      onChange={(e) => setNewBookmarkNote(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddBookmark();
                      }}
                      className="flex-1 px-3 py-1.5 bg-[#181D2D] border border-[#262E44] rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#CCFF00]"
                      autoFocus
                    />
                    <button
                      onClick={handleAddBookmark}
                      className="px-3 py-1.5 bg-[#CCFF00] hover:bg-[#d8ff33] text-black font-black text-xs rounded-lg transition-all"
                    >
                      Salva
                    </button>
                  </div>
                </div>
              )}

              {/* Tabs Navigazione: Note Squadre / Tempi Gara / Highlights / Segnalibri */}
              <div className="pt-2 border-t border-[#1C2133]">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {/* Tab Note Video Squadre */}
                  <button
                    onClick={() => setActiveTab('NOTE_SQUADRE')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'NOTE_SQUADRE'
                        ? 'bg-[#1C2235] text-white border border-[#2E3754] shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Film className="w-3.5 h-3.5 text-[#CCFF00]" />
                    <span>Note Video Squadre</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#CCFF00]/20 text-[#CCFF00] font-mono">
                      {recordedClips.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTab('TEMPI')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                      activeTab === 'TEMPI'
                        ? 'bg-[#1C2235] text-white border border-[#2E3754]'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-[#CCFF00]" />
                    <span>Tempi di Gara</span>
                    {veoData?.periods && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#141824] text-slate-300">
                        {veoData.periods.length}
                      </span>
                    )}
                  </button>

                  {veoData?.highlights && (
                    <button
                      onClick={() => setActiveTab('HIGHLIGHTS')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                        activeTab === 'HIGHLIGHTS'
                          ? 'bg-[#1C2235] text-white border border-[#2E3754]'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Target className="w-3.5 h-3.5 text-[#00E5FF]" />
                      <span>Eventi & Gol</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#00E5FF]/20 text-[#00E5FF]">
                        {veoData.highlights.length}
                      </span>
                    </button>
                  )}

                  <button
                    onClick={() => setActiveTab('SEGNALIBRI')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                      activeTab === 'SEGNALIBRI'
                        ? 'bg-[#1C2235] text-white border border-[#2E3754]'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Bookmark className="w-3.5 h-3.5 text-[#CCFF00]" />
                    <span>Segnalibri Locali</span>
                    {bookmarks.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#CCFF00]/20 text-[#CCFF00]">
                        {bookmarks.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* Tab 1: NOTE VIDEO SQUADRE GARA */}
                {activeTab === 'NOTE_SQUADRE' && (
                  <div className="space-y-3">
                    {recordedClips.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-52 overflow-y-auto p-1">
                        {recordedClips.map((clip) => {
                          const isMine = user && clip.authorId && clip.authorId.toLowerCase() === user.username.toLowerCase();
                          const hasInterval = Boolean(clip.timestampMark && clip.endTimestampMark);

                          return (
                            <div
                              key={clip.id}
                              onClick={() => handlePlayClip(clip)}
                              className="flex flex-col justify-between p-2.5 rounded-xl bg-[#141824] border border-[#212638] hover:border-[#CCFF00]/50 transition-all cursor-pointer group shadow-sm"
                            >
                              <div>
                                <div className="flex items-center justify-between gap-1 text-[10px] border-b border-[#1C2233] pb-1.5 mb-1.5">
                                  <span className="font-black text-[#CCFF00] bg-[#CCFF00]/10 px-2 py-0.5 rounded truncate max-w-[130px]">
                                    {clip.targetName}
                                  </span>

                                  <div className="flex items-center gap-1.5">
                                    {clip.timestampMark && (
                                      <span className="font-mono font-black text-black bg-[#CCFF00] px-1.5 py-0.2 rounded shadow-xs flex items-center gap-1 text-[10px]">
                                        <Clock className="w-2.5 h-2.5" />
                                        {hasInterval ? `${clip.timestampMark} → ${clip.endTimestampMark}` : `Min. ${clip.timestampMark}`}
                                      </span>
                                    )}

                                    {isMine && (
                                      <button
                                        onClick={(e) => handleDeleteRecordedClip(clip.id, e)}
                                        className="text-slate-500 hover:text-rose-400 p-0.5 rounded transition-colors cursor-pointer"
                                        title="Elimina clip da Note Video"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                <h5 className="font-bold text-xs text-white line-clamp-1 group-hover:text-[#CCFF00] transition-colors">
                                  {clip.title}
                                </h5>

                                {clip.description && (
                                  <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed mt-1">
                                    {clip.description}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 mt-1.5 border-t border-[#1A1F2E]">
                                <span>{clip.authorName || 'Arbitro'}</span>
                                <span className="text-[#CCFF00] font-bold group-hover:underline flex items-center gap-0.5">
                                  <Play className="w-2.5 h-2.5 fill-[#CCFF00]" /> Riproduci Clip
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-3 rounded-xl bg-[#121622] border border-[#212638] text-xs text-slate-400">
                        <span>Nessuna clip archiviata nella sezione &quot;Note Video&quot; per questa gara. Clicca &quot;Registra Nota Video Squadra&quot; per salvare una clip con intervallo.</span>
                        <button
                          onClick={handleOpenAddNote}
                          className="px-3 py-1 bg-[#CCFF00] hover:bg-[#d8ff33] text-black font-black text-xs rounded-lg transition-all flex items-center gap-1 flex-shrink-0 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Registra Nota Video
                        </button>
                      </div>
                    )}

                    {/* Eventuali note arbitrali testuali legacy */}
                    {videoNotes.length > 0 && (
                      <div className="pt-2 border-t border-[#1C2233]">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5 block">
                          Altre Note Arbitrali Testuali ({videoNotes.length})
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {videoNotes.map((n) => {
                            const isMine = user && n.authorId && n.authorId.toLowerCase() === user.username.toLowerCase();
                            const seekSec = n.minuteSeconds ?? (n.minute ? parseTimeToSeconds(n.minute) : null);
                            return (
                              <div
                                key={n.id}
                                onClick={() => {
                                  if (seekSec !== null && seekSec !== undefined) {
                                    seekTo(seekSec);
                                  }
                                }}
                                className="p-2 rounded-xl bg-[#121520] border border-[#1E2536] hover:border-[#CCFF00]/40 transition-all cursor-pointer text-xs"
                              >
                                <div className="flex items-center justify-between text-[10px] pb-1 mb-1 border-b border-[#1A1F2C]">
                                  <span className="text-[#CCFF00] font-bold truncate max-w-[120px]">{n.targetName}</span>
                                  <div className="flex items-center gap-1">
                                    {n.minute && <span className="text-slate-400 font-mono font-bold">{n.minute}</span>}
                                    {isMine && (
                                      <button
                                        onClick={(e) => handleDeleteTeamNote(n.id, e)}
                                        className="text-slate-500 hover:text-rose-400 p-0.5 rounded cursor-pointer"
                                        title="Elimina nota"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <p className="text-slate-300 text-[11px] line-clamp-1">{n.content}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 2: Tempi di Gara (Periodi Veo) */}
                {activeTab === 'TEMPI' && (
                  <div className="flex flex-wrap items-center gap-2">
                    {veoData?.periods && veoData.periods.length > 0 ? (
                      veoData.periods.map((p, idx) => {
                        const isCurrent = currentTime >= p.start && currentTime <= p.end;
                        return (
                          <button
                            key={idx}
                            onClick={() => seekTo(p.start)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-black transition-all active:scale-95 ${
                              isCurrent
                                ? 'bg-[#CCFF00]/15 border-[#CCFF00]/50 text-white shadow-sm'
                                : 'bg-[#141824] border-[#212638] text-slate-300 hover:text-white hover:border-slate-500'
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full bg-[#CCFF00]" />
                            <span>{p.name}</span>
                            <span className="text-[10px] font-mono text-slate-400">
                              [{p.startDisplay} - {p.endDisplay}]
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <button
                          onClick={() => seekTo(0)}
                          className="px-3 py-1.5 rounded-xl bg-[#141824] border border-[#212638] text-slate-300 hover:text-white text-xs font-bold"
                        >
                          Inizio Gara (00:00)
                        </button>
                        <button
                          onClick={() => seekTo(45 * 60)}
                          className="px-3 py-1.5 rounded-xl bg-[#141824] border border-[#212638] text-slate-300 hover:text-white text-xs font-bold"
                        >
                          Minuto 45&apos; (45:00)
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 3: Highlights Veo (Gol & Tiri) */}
                {activeTab === 'HIGHLIGHTS' && (
                  <div className="space-y-2">
                    {veoData?.highlights && veoData.highlights.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-2 max-h-36 overflow-y-auto p-1">
                        {veoData.highlights.map((h) => {
                          const isGoal = h.type === 'goal';
                          return (
                            <button
                              key={h.id}
                              onClick={() => seekTo(h.start)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
                                isGoal
                                  ? 'bg-[#FF334B]/15 border-[#FF334B]/40 text-white hover:bg-[#FF334B]/25'
                                  : 'bg-[#141824] border-[#212638] text-slate-300 hover:text-white hover:border-slate-500'
                              }`}
                            >
                              <span>{isGoal ? '⚽' : '🎯'}</span>
                              <span className="font-black">{h.label}</span>
                              <span className="text-[10px] font-mono text-slate-400">
                                {h.timeDisplay}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">
                        Nessun evento automatico registrato per questa gara.
                      </p>
                    )}
                  </div>
                )}

                {/* Tab 4: Segnalibri Locali */}
                {activeTab === 'SEGNALIBRI' && (
                  <div className="space-y-2">
                    {bookmarks.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-1">
                        {bookmarks.map((b) => (
                          <div
                            key={b.id}
                            onClick={() => seekTo(b.time)}
                            className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#141824] border border-[#212638] hover:border-[#CCFF00]/40 transition-all cursor-pointer group/bm"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-mono font-black text-[#CCFF00] bg-[#CCFF00]/10 px-1.5 py-0.5 rounded">
                                  {b.timeDisplay}
                                </span>
                                {b.matchClock && (
                                  <span className="text-[10px] font-black text-slate-300">
                                    {b.matchClock}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-300 truncate font-semibold mt-0.5">
                                {b.note}
                              </p>
                            </div>
                            <button
                              onClick={(e) => handleDeleteBookmark(b.id, e)}
                              className="p-1 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors opacity-80 group-hover/bm:opacity-100"
                              title="Elimina segnalibro"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-xs text-slate-400 py-1">
                        <span>Nessun segnalibro salvato. Clicca su &quot;Segnalibro&quot; per annotare un appunto veloce.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Description / Referee Notes Bar if available */}
      {media.description && (
        <div className="px-4 sm:px-6 py-2.5 bg-[#0A0D15] border-t border-[#1E2436] max-h-20 overflow-y-auto flex-shrink-0">
          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
            <strong className="text-[#CCFF00] uppercase tracking-wider text-[10px] mr-2">Note:</strong>
            {media.description}
          </p>
        </div>
      )}
    </div>
  );
};
