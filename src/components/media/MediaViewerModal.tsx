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

export interface MediaViewerItem {
  url: string;
  title: string;
  subtitle?: string;
  description?: string;
  mediaType?: 'video' | 'image';
  timestampMark?: string;
  authorName?: string;
}

interface MediaViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  media: MediaViewerItem | null;
}

interface RefereeBookmark {
  id: string;
  time: number;
  timeDisplay: string;
  matchClock?: string;
  note: string;
  createdAt: string;
}

export const MediaViewerModal: React.FC<MediaViewerModalProps> = ({ isOpen, onClose, media }) => {
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

  // Navigator controls
  const [minuteInput, setMinuteInput] = useState('');
  const [activeTab, setActiveTab] = useState<'TEMPI' | 'HIGHLIGHTS' | 'SEGNALIBRI'>('TEMPI');
  const [bookmarks, setBookmarks] = useState<RefereeBookmark[]>([]);
  const [isAddingBookmark, setIsAddingBookmark] = useState(false);
  const [newBookmarkNote, setNewBookmarkNote] = useState('');

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

  // Calcola embed YouTube con eventuale timestamp
  const getYoutubeEmbed = (url: string, timeMark?: string) => {
    try {
      let videoId = '';
      if (url.includes('watch?v=')) {
        videoId = url.split('watch?v=')[1].split('&')[0];
      } else if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1].split('?')[0];
      } else if (url.includes('embed/')) {
        videoId = url.split('embed/')[1].split('?')[0];
      }

      let startParam = '';
      if (timeMark && timeMark.includes(':')) {
        const parts = timeMark.split(':').map((p) => parseInt(p, 10));
        if (parts.length === 2) {
          const seconds = parts[0] * 60 + parts[1];
          startParam = `&start=${seconds}`;
        }
      }

      return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0${startParam}`;
    } catch {
      return url;
    }
  };

  // Funzione di seek fluida
  const seekTo = useCallback(
    (targetSeconds: number) => {
      if (!videoRef.current) return;
      const validTime = Math.max(0, Math.min(videoRef.current.duration || 999999, targetSeconds));
      videoRef.current.currentTime = validTime;
      setCurrentTime(validTime);
    },
    []
  );

  const jumpSeconds = useCallback(
    (delta: number) => {
      if (!videoRef.current) return;
      seekTo(videoRef.current.currentTime + delta);
    },
    [seekTo]
  );

  // Parsing timestamp per salto iniziale
  const jumpToInitialTimestamp = useCallback(() => {
    if (!media?.timestampMark) return;
    const secs = parseTimeToSeconds(media.timestampMark);
    if (secs !== null) {
      seekTo(secs);
      if (videoRef.current?.paused) {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [media?.timestampMark, seekTo]);

  // Gestione invio "Vai al Minuto"
  const handleMinuteSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!minuteInput.trim()) return;
    const secs = parseTimeToSeconds(minuteInput);
    if (secs !== null) {
      seekTo(secs);
      setMinuteInput('');
    }
  };

  // Calcolo tempo gara e minuto effettivo dai periodi Veo
  const getMatchClock = (timeSec: number) => {
    if (!veoData?.periods || veoData.periods.length === 0) return null;
    const p1 = veoData.periods[0];
    const p2 = veoData.periods[1];

    if (p1 && timeSec >= p1.start && timeSec <= p1.end) {
      const matchMin = Math.floor((timeSec - p1.start) / 60) + 1;
      const matchSec = Math.floor((timeSec - p1.start) % 60);
      return {
        periodName: '1° Tempo',
        matchMinute: matchMin,
        display: `1°T ${matchMin}' (${matchMin}:${matchSec.toString().padStart(2, '0')})`,
        isHalfTime: false,
      };
    }

    if (p2 && timeSec >= p2.start) {
      const matchMin = Math.floor(45 + (timeSec - p2.start) / 60) + 1;
      const matchSec = Math.floor((timeSec - p2.start) % 60);
      return {
        periodName: '2° Tempo',
        matchMinute: matchMin,
        display: `2°T ${matchMin}' (${matchMin}:${matchSec.toString().padStart(2, '0')})`,
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
  };

  // Gestione Segnalibri Arbitrali
  const handleAddBookmark = () => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;
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

  // Keyboard shortcuts (Space = play/pause, Esc = close, F = fullscreen, Arrows = seek)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora scorciatoie se l'utente sta digitando in un input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ' && isVideo) {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowRight' && isVideo) {
        e.preventDefault();
        jumpSeconds(e.shiftKey ? 60 : 5);
      } else if (e.key === 'ArrowLeft' && isVideo) {
        e.preventDefault();
        jumpSeconds(e.shiftKey ? -60 : -5);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isVideo, isPlaying, jumpSeconds]);

  // Reset stato alla chiusura / cambio media
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackSpeed(1);
    setImageZoom(1);
    setIsAddingBookmark(false);
    setNewBookmarkNote('');
  }, [media, isOpen]);

  if (!isOpen || !media) return null;

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      if (media.timestampMark) {
        jumpToInitialTimestamp();
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
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
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
    if (!videoRef.current) return;
    videoRef.current.pause();
    setIsPlaying(false);
    const frameTime = 0.04; // ~25 fps
    seekTo(videoRef.current.currentTime + (forward ? frameTime : -frameTime));
  };

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
            ) : (
              <Film className="w-5 h-5 text-[#FF334B]" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-black text-white truncate max-w-[280px] sm:max-w-md">
                {veoData?.title || media.title || 'Visualizzatore Media'}
              </h2>
              {isVeo && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/30">
                  <Sparkles className="w-3 h-3" /> Gara Veo
                </span>
              )}
              {media.timestampMark && (
                <button
                  onClick={jumpToInitialTimestamp}
                  className="flex items-center gap-1 text-[11px] font-black text-black bg-[#CCFF00] hover:bg-[#d8ff33] px-2.5 py-0.5 rounded-full shadow-[0_0_10px_rgba(204,255,0,0.3)] transition-all flex-shrink-0"
                  title="Clicca per saltare al minuto della nota"
                >
                  <Clock className="w-3 h-3" /> Minuto {media.timestampMark}
                </button>
              )}
            </div>
            {media.subtitle && (
              <p className="text-xs text-slate-400 font-bold truncate mt-0.5">{media.subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {media.url && (
            <a
              href={media.url}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-xl bg-[#141824] hover:bg-[#1E2435] text-slate-400 hover:text-white border border-[#212638] transition-all"
              title="Apri link originale"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-[#141824] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-[#212638] hover:border-rose-500/30 transition-all"
            title="Chiudi (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Media Stage */}
      <div className="flex-1 relative flex flex-col items-center justify-center overflow-y-auto p-2 sm:p-4 bg-black">
        {isYoutube ? (
          <div className="w-full max-w-5xl aspect-video rounded-2xl overflow-hidden border border-[#212638] shadow-2xl bg-black">
            <iframe
              src={getYoutubeEmbed(media.url, media.timestampMark)}
              title={media.title}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : isImage ? (
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
        ) : isVideo ? (
          <div className="w-full max-w-5xl flex flex-col items-center">
            {/* Video Container */}
            <div className="relative w-full aspect-video max-h-[65vh] flex items-center justify-center group bg-black/90 rounded-2xl overflow-hidden border border-[#1E2436] shadow-2xl">
              {isLoadingVeo ? (
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
              ) : veoError ? (
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

                  {/* Match clock overlay on top-left of video */}
                  {currentClock && (
                    <div className="absolute top-3 left-3 bg-[#0B0E17]/85 backdrop-blur-md px-3 py-1 rounded-xl border border-[#212638] text-[11px] font-black text-white shadow-lg flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#CCFF00] animate-pulse" />
                      <span>{currentClock.display}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Complete Video & Minute Navigator Panel */}
            <div className="w-full mt-2.5 bg-[#0B0E17]/95 backdrop-blur-md border border-[#212638] rounded-2xl p-3 sm:p-4 space-y-3 shadow-2xl">
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

              {/* Quick Minute Jump Chips */}
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

                {/* Bookmark trigger button */}
                <button
                  onClick={() => setIsAddingBookmark(!isAddingBookmark)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#141824] hover:bg-[#1C2233] text-[#CCFF00] border border-[#212638] text-xs font-black transition-all active:scale-95"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  <span>Segna Minuto ({formatSecondsToTime(currentTime)})</span>
                </button>
              </div>

              {/* Inline Bookmark Creation Form */}
              {isAddingBookmark && (
                <div className="p-3 bg-[#111420] border border-[#CCFF00]/30 rounded-xl space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black text-white flex items-center gap-1.5">
                      <Bookmark className="w-3.5 h-3.5 text-[#CCFF00]" />
                      Aggiungi Appunto Arbitrale al minuto {formatSecondsToTime(currentTime)}
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

              {/* Secondary Navigation Bar: Tempi Gara / Highlights / Segnalibri */}
              <div className="pt-2 border-t border-[#1C2133]">
                {/* Tabs */}
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => setActiveTab('TEMPI')}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
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

                  <button
                    onClick={() => setActiveTab('HIGHLIGHTS')}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                      activeTab === 'HIGHLIGHTS'
                        ? 'bg-[#1C2235] text-white border border-[#2E3754]'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Target className="w-3.5 h-3.5 text-[#00E5FF]" />
                    <span>Eventi & Gol</span>
                    {veoData?.highlights && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#00E5FF]/20 text-[#00E5FF]">
                        {veoData.highlights.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveTab('SEGNALIBRI')}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                      activeTab === 'SEGNALIBRI'
                        ? 'bg-[#1C2235] text-white border border-[#2E3754]'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Bookmark className="w-3.5 h-3.5 text-[#CCFF00]" />
                    <span>Segnalibri Arbitro</span>
                    {bookmarks.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#CCFF00]/20 text-[#CCFF00]">
                        {bookmarks.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* Tab 1: Tempi di Gara (Periodi Veo) */}
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

                {/* Tab 2: Highlights Veo (Gol & Tiri) */}
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

                {/* Tab 3: Segnalibri Arbitrali */}
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
                        <span>Nessun segnalibro salvato. Clicca su &quot;Segna Minuto&quot; per annotare un episodio durante la visione.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-slate-400 text-sm">Formato multimediale non riproducibile</div>
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
