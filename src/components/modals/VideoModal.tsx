'use client';

import React, { useState, useEffect } from 'react';
import { VideoSource, Team, Match } from '@/types/refstudio';
import {
  Video,
  X,
  AlertCircle,
  UploadCloud,
  Link as LinkIcon,
  Film,
  Image as ImageIcon,
  Sparkles,
  Loader2,
  Shield,
  Calendar,
  Layers,
} from 'lucide-react';
import { MediaDropzone, UploadResult } from '@/components/media/MediaDropzone';
import { isVeoUrl } from '@/lib/services/veo-service';
import { DbService } from '@/lib/repository/db-service';

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (videoData: {
    targetType: 'squadra' | 'giocatore' | 'partita';
    targetId: string;
    targetName: string;
    homeTeamId?: string;
    homeTeamName?: string;
    awayTeamId?: string;
    awayTeamName?: string;
    videoSource: VideoSource;
    externalUrl?: string;
    storagePath?: string;
    title: string;
    description?: string;
    timestampMark?: string;
    endTimestampMark?: string;
    mediaType?: 'video' | 'image';
  }) => void;
  initialTargetType?: 'squadra' | 'giocatore' | 'partita';
  initialTargetId?: string;
  initialTargetName?: string;
  initialUploadedMedia?: UploadResult | null;
  initialHomeTeamId?: string;
  initialAwayTeamId?: string;
  initialTimestampMark?: string;
  initialEndTimestampMark?: string;
}

export const VideoModal: React.FC<VideoModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTargetType = 'squadra',
  initialTargetId = '',
  initialTargetName = '',
  initialUploadedMedia = null,
  initialHomeTeamId = '',
  initialAwayTeamId = '',
  initialTimestampMark = '',
  initialEndTimestampMark = '',
}) => {
  const [mode, setMode] = useState<'UPLOAD' | 'URL'>('UPLOAD');
  const [targetType, setTargetType] = useState<'squadra' | 'giocatore' | 'partita'>(initialTargetType);
  const [targetId, setTargetId] = useState(initialTargetId);
  const [targetName, setTargetName] = useState(initialTargetName);
  const [videoSource, setVideoSource] = useState<VideoSource>('LOCAL');
  const [externalUrl, setExternalUrl] = useState('');
  const [storagePath, setStoragePath] = useState('');
  const [mediaType, setMediaType] = useState<'video' | 'image'>('video');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timestampMark, setTimestampMark] = useState(initialTimestampMark);
  const [endTimestampMark, setEndTimestampMark] = useState(initialEndTimestampMark);
  const [error, setError] = useState('');

  // Squadre dal Database & Partite
  const [dbTeams, setDbTeams] = useState<Team[]>([]);
  const [dbMatches, setDbMatches] = useState<Match[]>([]);
  const [homeTeamId, setHomeTeamId] = useState(initialHomeTeamId);
  const [homeTeamName, setHomeTeamName] = useState('');
  const [awayTeamId, setAwayTeamId] = useState(initialAwayTeamId);
  const [awayTeamName, setAwayTeamName] = useState('');
  const [selectedMatchId, setSelectedMatchId] = useState('');

  useEffect(() => {
    if (isOpen) {
      const teams = DbService.getTeams().sort((a, b) => a.name.localeCompare(b.name));
      const matches = DbService.getMatches();
      setDbTeams(teams);
      setDbMatches(matches);

      setTargetType(initialTargetType);
      setTargetId(initialTargetId);
      setTargetName(initialTargetName);
      setError('');

      // Pre-popolamento squadre esplicite
      if (initialHomeTeamId) {
        const ht = teams.find((t) => t.id === initialHomeTeamId);
        setHomeTeamId(initialHomeTeamId);
        setHomeTeamName(ht?.name || '');
      }
      if (initialAwayTeamId) {
        const at = teams.find((t) => t.id === initialAwayTeamId);
        setAwayTeamId(initialAwayTeamId);
        setAwayTeamName(at?.name || '');
      }

      // Pre-popolamento squadre se initialTargetType è squadra o partita (solo se non già definite esplicitamente)
      if (!initialHomeTeamId && !initialAwayTeamId) {
        if (initialTargetType === 'squadra' && initialTargetId) {
          const team = teams.find((t) => t.id === initialTargetId);
          if (team) {
            setHomeTeamId(team.id);
            setHomeTeamName(team.name);
          }
        } else if (initialTargetType === 'partita' && initialTargetId) {
          const match = matches.find((m) => m.id === initialTargetId);
          if (match) {
            setSelectedMatchId(match.id);
            setHomeTeamId(match.homeTeamId);
            setHomeTeamName(match.homeTeamName);
            setAwayTeamId(match.awayTeamId);
            setAwayTeamName(match.awayTeamName);
          }
        }
      }

      if (initialUploadedMedia) {
        setMode('UPLOAD');
        setExternalUrl(initialUploadedMedia.url);
        setStoragePath(initialUploadedMedia.localUrl);
        setMediaType(initialUploadedMedia.mediaType);
        setVideoSource('LOCAL');
        if (!title) {
          setTitle(initialUploadedMedia.originalName.replace(/\.[^/.]+$/, ''));
        }
      }
    }
  }, [isOpen, initialTargetType, initialTargetId, initialTargetName, initialUploadedMedia, initialHomeTeamId, initialAwayTeamId]);

  // Chiudi con tasto Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleMediaUploaded = (result: UploadResult) => {
    setExternalUrl(result.url);
    setStoragePath(result.localUrl);
    setMediaType(result.mediaType);
    setVideoSource('LOCAL');
    setError('');

    if (!title.trim()) {
      setTitle(result.originalName.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleClearMedia = () => {
    setExternalUrl('');
    setStoragePath('');
  };

  const autoDetectTeams = (text: string) => {
    if (!text || dbTeams.length === 0) return;
    // CRITICO: Non sovrascrivere se l'utente ha già impostato le squadre nei menù a tendina
    if (homeTeamId && awayTeamId) return;

    // 1. Prova splitting con standard calcistico "Casa vs Ospite" o "Casa - Ospite"
    const vsPattern = /\s+(?:vs\.?|v\.?|-)\s+/i;
    if (vsPattern.test(text)) {
      const parts = text.split(vsPattern);
      if (parts.length >= 2) {
        const homeCandidateStr = parts[0].trim().toLowerCase();
        const awayCandidateStr = parts[1].trim().toLowerCase();

        // Cerca per prima la squadra con il nome più lungo per evitare falsi positivi
        const sortedDbTeams = [...dbTeams].sort((a, b) => b.name.length - a.name.length);
        const homeMatch = sortedDbTeams.find((t) => homeCandidateStr.includes(t.name.toLowerCase()));
        const awayMatch = sortedDbTeams.find((t) => awayCandidateStr.includes(t.name.toLowerCase()));

        if (homeMatch && awayMatch && homeMatch.id !== awayMatch.id) {
          if (!homeTeamId) {
            setHomeTeamId(homeMatch.id);
            setHomeTeamName(homeMatch.name);
          }
          if (!awayTeamId) {
            setAwayTeamId(awayMatch.id);
            setAwayTeamName(awayMatch.name);
          }
          setTargetType('partita');
          setTargetId(`${homeMatch.id}_vs_${awayMatch.id}`);
          setTargetName(`${homeMatch.name} vs ${awayMatch.name}`);
          return;
        }
      }
    }

    // 2. Ordinamento per posizione di apparizione nel testo (NON alfabetico!)
    const lower = text.toLowerCase();
    const matchedWithIndex: { team: Team; index: number }[] = [];
    for (const t of dbTeams) {
      const idx = lower.indexOf(t.name.toLowerCase());
      if (idx !== -1) {
        matchedWithIndex.push({ team: t, index: idx });
      }
    }
    // Ordina per ordine nel testo (prima squadra che compare = Casa, seconda = Ospite)
    matchedWithIndex.sort((a, b) => a.index - b.index);

    if (matchedWithIndex.length >= 2) {
      const h = matchedWithIndex[0].team;
      const a = matchedWithIndex[1].team;
      if (!homeTeamId) {
        setHomeTeamId(h.id);
        setHomeTeamName(h.name);
      }
      if (!awayTeamId) {
        setAwayTeamId(a.id);
        setAwayTeamName(a.name);
      }
      setTargetType('partita');
      setTargetId(`${h.id}_vs_${a.id}`);
      setTargetName(`${h.name} vs ${a.name}`);
    } else if (matchedWithIndex.length === 1 && !homeTeamId) {
      const single = matchedWithIndex[0].team;
      setHomeTeamId(single.id);
      setHomeTeamName(single.name);
      if (!targetName) {
        setTargetName(single.name);
      }
    }
  };

  const handleUrlChange = (url: string) => {
    setExternalUrl(url);
    if (isVeoUrl(url)) {
      setVideoSource('VEO');
      setMediaType('video');
      fetch(`/api/veo/resolve?url=${encodeURIComponent(url)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.match) {
            if (!title.trim()) {
              setTitle(data.match.title || 'Gara Veo');
            }
            if (data.match.title) {
              autoDetectTeams(data.match.title);
            }
          }
        })
        .catch(() => {});
    } else if (url.includes('youtube') || url.includes('youtu.be')) {
      setVideoSource('YOUTUBE');
      setMediaType('video');
    }
  };

  const handleMatchSelect = (matchId: string) => {
    setSelectedMatchId(matchId);
    if (!matchId) return;

    const m = dbMatches.find((item) => item.id === matchId);
    if (m) {
      setHomeTeamId(m.homeTeamId);
      setHomeTeamName(m.homeTeamName);
      setAwayTeamId(m.awayTeamId);
      setAwayTeamName(m.awayTeamName);
      setTargetId(m.id);
      const matchLabel = `${m.homeTeamName} vs ${m.awayTeamName}`;
      setTargetName(matchLabel);
      if (!title.trim()) {
        setTitle(`Ripresa Gara: ${matchLabel} (${m.dateText || 'Campionato'})`);
      }
    }
  };

  const handleHomeTeamChange = (teamId: string) => {
    setHomeTeamId(teamId);
    const team = dbTeams.find((t) => t.id === teamId);
    const hName = team ? team.name : '';
    setHomeTeamName(hName);

    if (hName && awayTeamName) {
      setTargetName(`${hName} vs ${awayTeamName}`);
      setTargetId(`${teamId}_vs_${awayTeamId}`);
    } else if (hName) {
      setTargetName(hName);
      setTargetId(teamId);
    }
  };

  const handleAwayTeamChange = (teamId: string) => {
    setAwayTeamId(teamId);
    const team = dbTeams.find((t) => t.id === teamId);
    const aName = team ? team.name : '';
    setAwayTeamName(aName);

    if (homeTeamName && aName) {
      setTargetName(`${homeTeamName} vs ${aName}`);
      setTargetId(`${homeTeamId}_vs_${teamId}`);
    } else if (aName) {
      setTargetName(aName);
      setTargetId(teamId);
    }
  };

  const handleSingleTeamChange = (teamId: string) => {
    setTargetId(teamId);
    const team = dbTeams.find((t) => t.id === teamId);
    if (team) {
      setTargetName(team.name);
      setHomeTeamId(team.id);
      setHomeTeamName(team.name);
      setAwayTeamId('');
      setAwayTeamName('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError('Inserisci un titolo per il contenuto multimediale.');
      return;
    }

    if (!targetName.trim()) {
      setError('Indica il soggetto o le squadre a cui associare il contenuto.');
      return;
    }

    if (!externalUrl.trim()) {
      setError(
        mode === 'UPLOAD'
          ? 'Trascina o seleziona un file video o immagine dal tuo PC.'
          : 'Inserisci un URL valido (YouTube, Veo o file web).'
      );
      return;
    }

    const effectiveSource =
      mode === 'UPLOAD'
        ? 'LOCAL'
        : isVeoUrl(externalUrl)
        ? 'VEO'
        : externalUrl.includes('youtube') || externalUrl.includes('youtu.be')
        ? 'YOUTUBE'
        : videoSource;

    const effectiveHomeId = homeTeamId.trim() || undefined;
    const effectiveAwayId = awayTeamId.trim() || undefined;
    const effectiveHomeName =
      homeTeamName.trim() || (effectiveHomeId ? dbTeams.find((t) => t.id === effectiveHomeId)?.name : undefined);
    const effectiveAwayName =
      awayTeamName.trim() || (effectiveAwayId ? dbTeams.find((t) => t.id === effectiveAwayId)?.name : undefined);

    let effectiveTargetId = targetId.trim();
    if (targetType === 'partita' && effectiveHomeId && effectiveAwayId) {
      effectiveTargetId = `${effectiveHomeId}_vs_${effectiveAwayId}`;
    }

    onSave({
      targetType,
      targetId: effectiveTargetId || targetName.toLowerCase().replace(/\s+/g, '-'),
      targetName: targetName.trim(),
      homeTeamId: effectiveHomeId,
      homeTeamName: effectiveHomeName,
      awayTeamId: effectiveAwayId,
      awayTeamName: effectiveAwayName,
      videoSource: effectiveSource,
      externalUrl: externalUrl.trim(),
      storagePath: storagePath.trim() || undefined,
      title: title.trim(),
      description: description.trim(),
      timestampMark: timestampMark.trim() || undefined,
      endTimestampMark: endTimestampMark.trim() || undefined,
      mediaType,
    });

    // Reset state
    setTitle('');
    setExternalUrl('');
    setStoragePath('');
    setDescription('');
    setTimestampMark('');
    setEndTimestampMark('');
    setHomeTeamId('');
    setHomeTeamName('');
    setAwayTeamId('');
    setAwayTeamName('');
    setSelectedMatchId('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-xl max-h-[94vh] overflow-y-auto rounded-2xl bg-[#0D0F16] border border-[#212638] shadow-2xl p-4 sm:p-6 text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-[#141824] transition-colors cursor-pointer active:scale-95 z-20"
          title="Chiudi (Esc)"
          aria-label="Chiudi"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-3 bg-[#FF334B]/10 border border-[#FF334B]/30 rounded-xl text-[#FF334B] shadow-[0_0_12px_rgba(255,51,75,0.2)]">
            <Video className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">Carica Video / Gara Arbitrale</h3>
            <p className="text-xs text-slate-400">
              Collega video da YouTube o Veo AI, oppure carica file dal PC associando le squadre dal database
            </p>
          </div>
        </div>

        {/* Tab Switcher: Carica da PC vs Link Esterno */}
        <div className="flex p-1 mb-5 rounded-xl bg-[#11141D] border border-[#212638]">
          <button
            type="button"
            onClick={() => {
              setMode('UPLOAD');
              setVideoSource('LOCAL');
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-black rounded-lg transition-all ${
              mode === 'UPLOAD'
                ? 'bg-[#CCFF00] text-black shadow-[0_0_12px_rgba(204,255,0,0.3)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UploadCloud className="w-4 h-4" /> Carica dal PC (Drag & Drop)
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('URL');
              setVideoSource('YOUTUBE');
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-black rounded-lg transition-all ${
              mode === 'URL'
                ? 'bg-[#CCFF00] text-black shadow-[0_0_12px_rgba(204,255,0,0.3)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LinkIcon className="w-4 h-4" /> Link Esterno (YouTube / Veo / URL)
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Area Upload o Input URL in base alla modalità */}
          {mode === 'UPLOAD' ? (
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">
                Trascina il tuo file video o immagine
              </label>
              <MediaDropzone
                onUploaded={handleMediaUploaded}
                accept="all"
                currentPreviewUrl={externalUrl}
                onClear={handleClearMedia}
                helperText="Trascina file MP4, WebM, MOV o immagini JPG, PNG dal computer"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">
                    Sorgente Link
                  </label>
                  <select
                    value={videoSource}
                    onChange={(e) => setVideoSource(e.target.value as any)}
                    className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/40 transition-all font-medium"
                  >
                    <option value="YOUTUBE">YouTube (URL / Embed)</option>
                    <option value="VEO">Gara Veo (app.veo.co)</option>
                    <option value="LOCAL">URL Diretto (MP4 / WebM / Immagine)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">
                    Tipo Media
                  </label>
                  <select
                    value={mediaType}
                    onChange={(e) => setMediaType(e.target.value as any)}
                    className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/40 transition-all font-medium"
                  >
                    <option value="video">Video</option>
                    <option value="image">Immagine</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[10px] flex items-center justify-between">
                  <span>
                    {videoSource === 'VEO'
                      ? 'Link Partita Veo'
                      : videoSource === 'YOUTUBE'
                      ? 'URL Video YouTube'
                      : 'URL File Web'}
                  </span>
                  {isVeoUrl(externalUrl) && (
                    <span className="text-[10px] font-black text-[#00E5FF] flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Rilevato Veo Match AI
                    </span>
                  )}
                  {(externalUrl.includes('youtube') || externalUrl.includes('youtu.be')) && (
                    <span className="text-[10px] font-black text-[#FF334B] flex items-center gap-1">
                      <Film className="w-3 h-3" /> YouTube Video
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={externalUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder={
                    videoSource === 'VEO'
                      ? 'https://app.veo.co/matches/...'
                      : 'https://www.youtube.com/watch?v=... o https://...'
                  }
                  className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/40 transition-all font-medium"
                />
              </div>
            </div>
          )}

          {/* Tipo di Associazione, Minuto Iniziale & Minuto Finale */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">
                Tipologia Contenuto
              </label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as any)}
                className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/40 transition-all font-medium font-bold"
              >
                <option value="partita">Partita Intera / Gara (2 Squadre)</option>
                <option value="squadra">Singola Squadra</option>
                <option value="giocatore">Calciatore</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">
                Minuto Iniziale
              </label>
              <input
                type="text"
                value={timestampMark}
                onChange={(e) => setTimestampMark(e.target.value)}
                placeholder="Es. 00:00 o 14:20"
                className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/40 transition-all font-medium font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">
                Minuto Finale (Opzionale)
              </label>
              <input
                type="text"
                value={endTimestampMark}
                onChange={(e) => setEndTimestampMark(e.target.value)}
                placeholder="Es. 15:45 o 1°T 36'"
                className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/40 transition-all font-medium font-mono"
              />
            </div>
          </div>

          {/* Sezione SQUADRE DAL DATABASE (per Partita o Singola Squadra) */}
          {targetType === 'partita' && (
            <div className="p-3.5 bg-[#121622] rounded-2xl border border-[#232B40] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#CCFF00] flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                  <Shield className="w-3.5 h-3.5" /> Seleziona Squadre Interessate (dal Database)
                </span>
                {dbMatches.length > 0 && (
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-500" /> O da calendario
                  </span>
                )}
              </div>

              {/* Seleziona da Partita Ufficiale da Calendario */}
              {dbMatches.length > 0 && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">
                    Carica rapidamente da Partita Ufficiale
                  </label>
                  <select
                    value={selectedMatchId}
                    onChange={(e) => handleMatchSelect(e.target.value)}
                    className="w-full bg-[#161B2B] border border-[#263048] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#CCFF00]"
                  >
                    <option value="">-- Seleziona partita a calendario (opzionale) --</option>
                    {dbMatches.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.homeTeamName} vs {m.awayTeamName} ({m.dateText || `G.${m.matchDay}`})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Squadra di Casa & Squadra Ospite */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[10px] font-black text-slate-300 uppercase tracking-wider mb-1">
                    🏠 Squadra di Casa
                  </label>
                  <select
                    value={homeTeamId}
                    onChange={(e) => handleHomeTeamChange(e.target.value)}
                    className="w-full bg-[#161B2B] border border-[#263048] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#CCFF00] font-semibold"
                  >
                    <option value="">-- Seleziona Squadra Casa --</option>
                    {dbTeams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-300 uppercase tracking-wider mb-1">
                    ✈️ Squadra Ospite
                  </label>
                  <select
                    value={awayTeamId}
                    onChange={(e) => handleAwayTeamChange(e.target.value)}
                    className="w-full bg-[#161B2B] border border-[#263048] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#CCFF00] font-semibold"
                  >
                    <option value="">-- Seleziona Squadra Ospite --</option>
                    {dbTeams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Anteprima associazione */}
              {(homeTeamName || awayTeamName) && (
                <div className="pt-1 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-medium">Squadre associate alle note:</span>
                  {homeTeamName && (
                    <span className="text-[10px] font-black text-[#CCFF00] bg-[#CCFF00]/15 border border-[#CCFF00]/30 px-2 py-0.5 rounded-full">
                      Casa: {homeTeamName}
                    </span>
                  )}
                  {awayTeamName && (
                    <span className="text-[10px] font-black text-sky-400 bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 rounded-full">
                      Ospite: {awayTeamName}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {targetType === 'squadra' && (
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">
                Seleziona Squadra dal Database
              </label>
              <select
                value={homeTeamId || targetId}
                onChange={(e) => handleSingleTeamChange(e.target.value)}
                className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#CCFF00] font-semibold"
              >
                <option value="">-- Seleziona Squadra --</option>
                {dbTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Nome Soggetto / Match (Personalizzabile) */}
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">
              Nome Soggetto / Partita
            </label>
            <input
              type="text"
              value={targetName}
              onChange={(e) => {
                setTargetName(e.target.value);
                if (!targetId) setTargetId(e.target.value.toLowerCase().replace(/\s+/g, '-'));
              }}
              placeholder="Es. Vianese Calcio vs Rolo Fabbrico..."
              className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/40 transition-all font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">
              Titolo del Contenuto Video
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Es. Ripresa Integrale Gara, Calci d'angolo difensivi, Episodi chiave..."
              className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/40 transition-all font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">
              Note Didattiche / Descrizione
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Indicazioni per l'analisi arbitrale (movimenti tattici, falli reiterati, proteste, ecc.)..."
              className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/40 transition-all font-medium leading-relaxed"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl animate-in fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2.5 border-t border-[#1C2130]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold bg-[#141824] hover:bg-[#1E2435] text-slate-300 rounded-xl border border-[#212638] transition-all"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-black bg-[#CCFF00] hover:bg-[#D8FF33] text-black rounded-xl shadow-[0_0_15px_rgba(204,255,0,0.35)] transition-all"
            >
              Salva Contenuto
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
