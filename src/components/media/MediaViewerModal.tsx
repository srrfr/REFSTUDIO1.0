'use client';

import React, { useState, useRef, useEffect } from 'react';
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
  Download,
  Clock,
  Film,
  Image as ImageIcon,
  FastForward,
  Rewind,
  Gauge,
  ExternalLink,
} from 'lucide-react';

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

export const MediaViewerModal: React.FC<MediaViewerModalProps> = ({ isOpen, onClose, media }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [imageZoom, setImageZoom] = useState<number>(1);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Determina se il media è YouTube, un video diretto o un'immagine
  const isYoutube = Boolean(
    media?.url && (media.url.includes('youtube.com') || media.url.includes('youtu.be'))
  );

  const isImage = Boolean(
    media?.mediaType === 'image' ||
      (media?.url && media.url.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i))
  );

  const isDirectVideo = !isYoutube && !isImage && Boolean(media?.url);

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

  // Parsing timestamp per video HTML5
  const parseTimestampToSeconds = (mark?: string): number | null => {
    if (!mark) return null;
    const parts = mark.split(':').map((p) => parseInt(p.trim(), 10));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return parts[0] * 60 + parts[1];
    }
    if (parts.length === 1 && !isNaN(parts[0])) {
      return parts[0];
    }
    return null;
  };

  const jumpToTimestamp = () => {
    const secs = parseTimestampToSeconds(media?.timestampMark);
    if (secs !== null && videoRef.current) {
      videoRef.current.currentTime = secs;
      if (videoRef.current.paused) {
        videoRef.current.play();
      }
    }
  };

  // Keyboard shortcuts (Space = play/pause, Esc = close, F = fullscreen)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ' && isDirectVideo) {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowRight' && isDirectVideo && videoRef.current) {
        videoRef.current.currentTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + 5);
      } else if (e.key === 'ArrowLeft' && isDirectVideo && videoRef.current) {
        videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDirectVideo, isPlaying]);

  // Reset stato alla chiusura / cambio media
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackSpeed(1);
    setImageZoom(1);
  }, [media, isOpen]);

  if (!isOpen || !media) return null;

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
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
      // Se presente timestamp mark iniziale, salta direttamente al minuto dell'episodio
      const initialSecs = parseTimestampToSeconds(media.timestampMark);
      if (initialSecs !== null && initialSecs < videoRef.current.duration) {
        videoRef.current.currentTime = initialSecs;
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
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
    // Passo di 1/25 di secondo (~1 frame video a 25fps)
    const frameTime = 0.04;
    videoRef.current.currentTime = Math.max(
      0,
      Math.min(videoRef.current.duration, videoRef.current.currentTime + (forward ? frameTime : -frameTime))
    );
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[80] flex flex-col bg-black/95 backdrop-blur-xl animate-in fade-in duration-200 select-none overflow-hidden"
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-[#0A0D15]/90 border-b border-[#1E2436] z-10">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="p-2 rounded-xl bg-[#141824] border border-[#232A3E] text-[#CCFF00]">
            {isImage ? <ImageIcon className="w-5 h-5 text-[#CCFF00]" /> : <Film className="w-5 h-5 text-[#FF334B]" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-black text-white truncate max-w-[280px] sm:max-w-md">
                {media.title || 'Visualizzatore Media'}
              </h2>
              {media.timestampMark && (
                <button
                  onClick={jumpToTimestamp}
                  className="flex items-center gap-1 text-[11px] font-black text-black bg-[#CCFF00] hover:bg-[#d8ff33] px-2.5 py-0.5 rounded-full shadow-[0_0_10px_rgba(204,255,0,0.3)] transition-all flex-shrink-0"
                  title="Clicca per saltare a questo minuto"
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
              download
              className="p-2 rounded-xl bg-[#141824] hover:bg-[#1E2435] text-slate-400 hover:text-white border border-[#212638] transition-all"
              title="Apri sorgente o scarica"
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
      <div className="flex-1 relative flex items-center justify-center overflow-hidden p-2 sm:p-6 bg-black">
        {isYoutube ? (
          <div className="w-full max-w-5xl aspect-video rounded-2xl overflow-hidden border border-[#212638] shadow-2xl bg-black">
            <iframe
              src={getYoutubeEmbed(media.url, media.timestampMark)}
              title={media.title}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
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
        ) : isDirectVideo ? (
          <div className="relative w-full max-w-5xl h-full max-h-[82vh] flex flex-col items-center justify-center group">
            <video
              ref={videoRef}
              src={media.url}
              onClick={togglePlay}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
              className="w-full h-full max-h-[75vh] object-contain rounded-2xl shadow-2xl cursor-pointer bg-black/60 border border-[#1E2436]"
              playsInline
            />

            {/* Play overlay button on center */}
            {!isPlaying && (
              <button
                onClick={togglePlay}
                className="absolute inset-0 m-auto w-20 h-20 rounded-full bg-[#CCFF00]/90 text-black flex items-center justify-center shadow-[0_0_35px_rgba(204,255,0,0.5)] hover:scale-110 active:scale-95 transition-all z-10"
              >
                <Play className="w-9 h-9 fill-black ml-1" />
              </button>
            )}

            {/* Custom Referee Video Control Bar */}
            <div className="w-full mt-3 bg-[#0B0E17]/90 backdrop-blur-md border border-[#212638] rounded-2xl p-3 sm:p-4 space-y-2.5 shadow-2xl">
              {/* Scrubber timeline */}
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-[#CCFF00] font-black min-w-[40px]">
                  {formatTime(currentTime)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  step={0.05}
                  value={currentTime}
                  onChange={handleSeek}
                  className="flex-1 h-1.5 bg-[#1F2538] rounded-lg appearance-none cursor-pointer accent-[#CCFF00]"
                />
                <span className="text-[11px] font-mono text-slate-400 min-w-[40px] text-right">
                  {formatTime(duration)}
                </span>
              </div>

              {/* Controls row */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={togglePlay}
                    className="p-2 rounded-xl bg-[#CCFF00] hover:bg-[#d8ff33] text-black font-black transition-all shadow-[0_0_12px_rgba(204,255,0,0.3)]"
                    title={isPlaying ? 'Pausa (Spazio)' : 'Riproduci (Spazio)'}
                  >
                    {isPlaying ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black ml-0.5" />}
                  </button>

                  {/* Frame by Frame / Slow Seek buttons for Referee Analysis */}
                  <div className="flex items-center bg-[#141824] rounded-xl border border-[#212638] p-0.5">
                    <button
                      onClick={() => stepFrame(false)}
                      className="px-2 py-1 text-[11px] font-mono text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                      title="Frame precedente (-0.04s)"
                    >
                      -1F
                    </button>
                    <button
                      onClick={() => {
                        if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
                      }}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                      title="Indietro 5 secondi"
                    >
                      <Rewind className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (videoRef.current) videoRef.current.currentTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + 5);
                      }}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                      title="Avanti 5 secondi"
                    >
                      <FastForward className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => stepFrame(true)}
                      className="px-2 py-1 text-[11px] font-mono text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                      title="Frame successivo (+0.04s)"
                    >
                      +1F
                    </button>
                  </div>

                  {/* Volume Slider */}
                  <div className="hidden sm:flex items-center gap-1.5 pl-2 border-l border-[#212638]">
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
                      className="w-16 h-1 bg-[#1F2538] rounded-lg appearance-none cursor-pointer accent-[#CCFF00]"
                    />
                  </div>
                </div>

                {/* Referee Slow Motion Speeds */}
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1 bg-[#141824] rounded-xl border border-[#212638] p-0.5">
                    <span className="hidden md:flex items-center gap-1 text-[10px] font-bold text-slate-400 px-2 uppercase tracking-wider">
                      <Gauge className="w-3 h-3 text-[#CCFF00]" /> Velocità:
                    </span>
                    {[0.25, 0.5, 0.75, 1, 1.5, 2].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => handleSpeedChange(speed)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${
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
            </div>
          </div>
        ) : (
          <div className="text-slate-400 text-sm">Formato multimediale non riproducibile</div>
        )}
      </div>

      {/* Description / Referee Notes Bar if available */}
      {media.description && (
        <div className="px-4 sm:px-6 py-3 bg-[#0A0D15] border-t border-[#1E2436] max-h-24 overflow-y-auto">
          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
            <strong className="text-[#CCFF00] uppercase tracking-wider text-[10px] mr-2">Note Didattiche:</strong>
            {media.description}
          </p>
        </div>
      )}
    </div>
  );
};
