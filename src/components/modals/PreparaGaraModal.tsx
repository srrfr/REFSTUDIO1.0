'use client';

import React, { useState, useMemo } from 'react';
import { Match, Team, Player, Note, VideoClip, StandingRow } from '@/types/refstudio';
import { DbService } from '@/lib/repository/db-service';
import { useAuth } from '@/lib/auth/auth-context';
import {
  ClipboardCheck,
  X,
  Printer,
  Shield,
  Users,
  AlertTriangle,
  Film,
  FileText,
  Calendar,
  Trophy,
  Activity,
  Plus,
  Play,
  Paperclip,
  Lock,
  Globe,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { TagBadge } from '@/components/common/TagBadge';
import { RoleBadge } from '@/components/common/RoleBadge';
import { NoteModal } from '@/components/modals/NoteModal';
import { VideoModal } from '@/components/modals/VideoModal';
import { MediaViewerModal, MediaViewerItem } from '@/components/media/MediaViewerModal';

interface PreparaGaraModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match | null;
}

export const PreparaGaraModal: React.FC<PreparaGaraModalProps> = ({
  isOpen,
  onClose,
  match,
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'HOME' | 'AWAY' | 'CHECKLIST'>('OVERVIEW');

  // Sub-modal states for adding notes/videos directly from Prepara la Gara
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteTarget, setNoteTarget] = useState<{ id: string; name: string; type: 'squadra' | 'partita' }>({
    id: '',
    name: '',
    type: 'squadra',
  });

  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [videoTarget, setVideoTarget] = useState<{ id: string; name: string; type: 'squadra' | 'partita' }>({
    id: '',
    name: '',
    type: 'squadra',
  });

  // Media Viewer state for attachments and videos
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [activeViewerMedia, setActiveViewerMedia] = useState<MediaViewerItem | null>(null);

  // Reload counter to refresh data when a note/video is added
  const [refreshKey, setRefreshKey] = useState(0);

  // Memoized data resolution for both teams involved in this specific match
  const matchData = useMemo(() => {
    if (!match) return null;

    const girone: 'A' | 'B' = match.girone === 'B' ? 'B' : 'A';
    const teams = DbService.getTeams(girone);
    const standings = DbService.getStandings(girone);
    const allMatches = DbService.getMatches(girone);

    // Resolve Home Team
    const homeTeam: Team =
      teams.find((t) => t.id === match.homeTeamId || t.name.toLowerCase().trim() === match.homeTeamName.toLowerCase().trim()) ||
      DbService.getTeamById(match.homeTeamId) || {
        id: match.homeTeamId || 'home-team',
        championshipId: `eccellenza-er-girone-${(match.girone || 'A').toLowerCase()}`,
        name: match.homeTeamName,
        girone: match.girone,
        city: '',
        stadium: match.matchField || '',
        technicalLevel: 3,
        aggressionLevel: 3,
        coachName: '',
      };

    // Resolve Away Team
    const awayTeam: Team =
      teams.find((t) => t.id === match.awayTeamId || t.name.toLowerCase().trim() === match.awayTeamName.toLowerCase().trim()) ||
      DbService.getTeamById(match.awayTeamId) || {
        id: match.awayTeamId || 'away-team',
        championshipId: `eccellenza-er-girone-${(match.girone || 'A').toLowerCase()}`,
        name: match.awayTeamName,
        girone: match.girone,
        city: '',
        stadium: '',
        technicalLevel: 3,
        aggressionLevel: 3,
        coachName: '',
      };

    const homeStanding = standings.find(
      (s) => (s.teamName || '').toLowerCase().trim() === homeTeam.name.toLowerCase().trim()
    );
    const awayStanding = standings.find(
      (s) => (s.teamName || '').toLowerCase().trim() === awayTeam.name.toLowerCase().trim()
    );

    // Rosters
    const homePlayers = DbService.getPlayers(homeTeam.id);
    const awayPlayers = DbService.getPlayers(awayTeam.id);

    // Notes
    const homeNotes = DbService.getNotes('squadra', homeTeam.id, user?.username);
    const awayNotes = DbService.getNotes('squadra', awayTeam.id, user?.username);
    const matchNotes = DbService.getNotes('partita', match.id, user?.username);

    // Videos
    const homeVideos = DbService.getVideos('squadra', homeTeam.id);
    const awayVideos = DbService.getVideos('squadra', awayTeam.id);
    const matchVideos = DbService.getVideos('partita', match.id);

    // High risk / Flagged players
    const getWatchPlayers = (players: Player[]) => {
      return players.filter(
        (p) =>
          p.customTags.length > 0 ||
          (p.yellowCards && p.yellowCards >= 3) ||
          (p.redCards && p.redCards >= 1) ||
          p.refereeNotes
      );
    };

    const homeWatchPlayers = getWatchPlayers(homePlayers);
    const awayWatchPlayers = getWatchPlayers(awayPlayers);

    // Recent 5 matches for each team
    const getRecentTeamMatches = (teamName: string) => {
      return allMatches
        .filter(
          (m) =>
            m.played &&
            (m.homeTeamName.toLowerCase().trim() === teamName.toLowerCase().trim() ||
              m.awayTeamName.toLowerCase().trim() === teamName.toLowerCase().trim())
        )
        .slice(-5)
        .reverse();
    };

    const homeRecentMatches = getRecentTeamMatches(homeTeam.name);
    const awayRecentMatches = getRecentTeamMatches(awayTeam.name);

    // Head-to-Head between these two teams
    const headToHead = allMatches.filter(
      (m) =>
        m.played &&
        ((m.homeTeamName.toLowerCase().trim() === homeTeam.name.toLowerCase().trim() &&
          m.awayTeamName.toLowerCase().trim() === awayTeam.name.toLowerCase().trim()) ||
          (m.homeTeamName.toLowerCase().trim() === awayTeam.name.toLowerCase().trim() &&
            m.awayTeamName.toLowerCase().trim() === homeTeam.name.toLowerCase().trim()))
    );

    return {
      homeTeam,
      awayTeam,
      homeStanding,
      awayStanding,
      homePlayers,
      awayPlayers,
      homeNotes,
      awayNotes,
      matchNotes,
      homeVideos,
      awayVideos,
      matchVideos,
      homeWatchPlayers,
      awayWatchPlayers,
      homeRecentMatches,
      awayRecentMatches,
      headToHead,
    };
  }, [match, user?.username, refreshKey]);

  if (!isOpen || !match || !matchData) return null;

  const {
    homeTeam,
    awayTeam,
    homeStanding,
    awayStanding,
    homePlayers,
    awayPlayers,
    homeNotes,
    awayNotes,
    matchNotes,
    homeVideos,
    awayVideos,
    matchVideos,
    homeWatchPlayers,
    awayWatchPlayers,
    homeRecentMatches,
    awayRecentMatches,
    headToHead,
  } = matchData;

  const handleOpenAddNote = (id: string, name: string, type: 'squadra' | 'partita') => {
    setNoteTarget({ id, name, type });
    setIsNoteModalOpen(true);
  };

  const handleOpenAddVideo = (id: string, name: string, type: 'squadra' | 'partita') => {
    setVideoTarget({ id, name, type });
    setIsVideoModalOpen(true);
  };

  const openMedia = (item: MediaViewerItem) => {
    setActiveViewerMedia(item);
    setIsViewerOpen(true);
  };

  // Render a specific team's full dossier
  const renderTeamSection = (
    team: Team,
    standing?: StandingRow,
    notes: Note[] = [],
    watchPlayers: Player[] = [],
    videos: VideoClip[] = [],
    players: Player[] = [],
    recentMatches: Match[] = [],
    isHome: boolean = true
  ) => {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Team Identity Banner */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#11141D] border border-[#212638] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm text-black shadow-lg ${
                isHome ? 'bg-[#CCFF00]' : 'bg-[#FF334B]'
              }`}
            >
              {team.name.substring(0, 3).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                  {isHome ? 'Squadra Ospitante (Casa)' : 'Squadra Ospite (Trasferta)'}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#181C28] text-slate-300 border border-[#262D40]">
                  Girone {team.girone}
                </span>
              </div>
              <h3 className="text-xl font-black text-white mt-0.5">{team.name}</h3>
              <p className="text-xs text-slate-400">
                {team.stadium ? `Stadio: ${team.stadium}` : 'Campo di casa'} • {team.city || 'Emilia-Romagna'}
                {team.coachName ? ` • Allenatore: ${team.coachName}` : ''}
              </p>
            </div>
          </div>

          {/* Standings Summary Pill */}
          {standing ? (
            <div className="flex items-center gap-2 bg-[#0A0D15] p-2.5 rounded-xl border border-[#212638] text-center">
              <div className="px-3 border-r border-[#1F2538]">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Pos</span>
                <span className="text-base font-black text-[#CCFF00]">#{standing.position}</span>
              </div>
              <div className="px-3 border-r border-[#1F2538]">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Punti</span>
                <span className="text-base font-black text-white">{standing.points}</span>
              </div>
              <div className="px-3 border-r border-[#1F2538]">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">G / V-N-P</span>
                <span className="text-xs font-mono font-bold text-slate-200">
                  {standing.played} ({standing.won}-{standing.drawn}-{standing.lost})
                </span>
              </div>
              <div className="px-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Reti (DR)</span>
                <span className="text-xs font-mono font-bold text-slate-200">
                  {standing.goalsFor}:{standing.goalsAgainst} ({standing.goalDifference >= 0 ? `+${standing.goalDifference}` : standing.goalDifference})
                </span>
              </div>
            </div>
          ) : (
            <span className="text-xs text-slate-500 italic">Dati classifica non disponibili</span>
          )}
        </div>

        {/* Action Bar for this Team */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenAddNote(team.id, team.name, 'squadra')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#CCFF00]/15 hover:bg-[#CCFF00]/25 text-[#CCFF00] border border-[#CCFF00]/30 text-xs font-bold transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> Nuova Nota per {team.name}
            </button>
            <button
              onClick={() => handleOpenAddVideo(team.id, team.name, 'squadra')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FF334B]/15 hover:bg-[#FF334B]/25 text-[#FF334B] border border-[#FF334B]/30 text-xs font-bold transition-all shadow-sm"
            >
              <Film className="w-3.5 h-3.5" /> Collega Video
            </button>
          </div>

          <div className="text-xs text-slate-400 font-mono">
            {notes.length} note • {watchPlayers.length} calciatori attenzionati • {videos.length} clip video
          </div>
        </div>

        {/* 1. NOTE ARBITRALI RISERVATE PER QUESTA SQUADRA */}
        <div className="rounded-2xl bg-[#0D0F16] border border-[#1F2433] p-4 sm:p-5 space-y-3 shadow-lg">
          <div className="flex items-center justify-between border-b border-[#1A1F2C] pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#CCFF00]" />
              <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                Note e Osservazioni Disciplinari ({notes.length})
              </h4>
            </div>
            <span className="text-[10px] text-slate-400">
              Registrate da colleghi arbitri per la condotta di gara
            </span>
          </div>

          {notes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {notes.map((n) => (
                <div
                  key={n.id}
                  className="rounded-xl bg-[#11141D] border border-[#212638] p-4 space-y-2.5 hover:border-[#CCFF00]/40 transition-all"
                >
                  <div className="flex items-center justify-between text-xs text-slate-400 border-b border-[#1C2232] pb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-[#181C28] text-slate-300 border border-[#262C3D]">
                        {n.priority}
                      </span>
                      {n.isPublic === false ? (
                        <span className="flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          <Lock className="w-2.5 h-2.5 text-amber-400" /> Privata
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded bg-[#CCFF00]/10 text-[#CCFF00] border border-[#CCFF00]/30">
                          <Globe className="w-2.5 h-2.5 text-[#CCFF00]" /> Pubblica
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-slate-500">
                      {new Date(n.createdAt).toLocaleDateString('it-IT')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span className="font-bold text-white">{n.authorName || n.authorId}</span>
                    {n.authorRole && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-black bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/30">
                        {n.authorRole}
                      </span>
                    )}
                    {n.authorSection && <span className="text-slate-500">• {n.authorSection}</span>}
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line">{n.content}</p>

                  {/* Allegati note */}
                  {n.attachments && n.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-[#1C2232]">
                      {n.attachments.map((att, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            const isImg = att.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i);
                            openMedia({
                              url: att,
                              title: `${team.name} - Allegato ${i + 1}`,
                              subtitle: `Nota arbitrale di ${n.authorName || 'Arbitro'}`,
                              description: n.content,
                              mediaType: isImg ? 'image' : 'video',
                            });
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-[#CCFF00] bg-[#141824] border border-[#212638] px-2 py-1 rounded-lg hover:border-[#CCFF00]/50 transition-colors"
                        >
                          <Paperclip className="w-3 h-3" /> Allegato {i + 1}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-slate-500 text-xs italic bg-[#11141D] rounded-xl border border-dashed border-[#212638]">
              Nessuna nota archiviata per {team.name}. Clicca &quot;Nuova Nota per {team.name}&quot; per registrare un appunto preventivo.
            </div>
          )}
        </div>

        {/* 2. CALCIATORI SOTTO OSSERVAZIONE ARBITRALE */}
        <div className="rounded-2xl bg-[#0D0F16] border border-[#1F2433] p-4 sm:p-5 space-y-3 shadow-lg">
          <div className="flex items-center justify-between border-b border-[#1A1F2C] pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                Calciatori Attenzionati & Disciplina ({watchPlayers.length})
              </h4>
            </div>
            <span className="text-[10px] text-slate-400">Cartellini accumulati, proteste e profili particolari</span>
          </div>

          {watchPlayers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
              {watchPlayers.map((p) => (
                <div
                  key={p.id}
                  className="p-3.5 rounded-xl bg-[#11141D] border border-[#212638] space-y-2 hover:border-amber-400/40 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white truncate max-w-[150px]">
                      {p.firstName} {p.lastName}
                    </span>
                    <RoleBadge role={p.role} />
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                    <span>{p.appearances || 0} pres.</span>
                    <span className="text-yellow-400 font-bold">{p.yellowCards || 0} 🟨</span>
                    <span className="text-rose-400 font-bold">{p.redCards || 0} 🟥</span>
                  </div>

                  {p.customTags && p.customTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {p.customTags.map((t, idx) => (
                        <TagBadge key={idx} tag={t} size="sm" />
                      ))}
                    </div>
                  )}

                  {p.refereeNotes && (
                    <p className="text-[11px] text-slate-300 italic pt-1 border-t border-[#1C2232] line-clamp-2">
                      &quot;{p.refereeNotes}&quot;
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic py-4 text-center bg-[#11141D] rounded-xl border border-dashed border-[#212638]">
              Nessun calciatore con criticità disciplinari segnalate in archivio per {team.name}.
            </p>
          )}
        </div>

        {/* 3. VIDEOTECA ED EPISODI DIDATTICI CORRELATI */}
        <div className="rounded-2xl bg-[#0D0F16] border border-[#1F2433] p-4 sm:p-5 space-y-3 shadow-lg">
          <div className="flex items-center justify-between border-b border-[#1A1F2C] pb-3">
            <div className="flex items-center gap-2">
              <Film className="w-4 h-4 text-[#FF334B]" />
              <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                Videoteca & Episodi Didattici ({videos.length})
              </h4>
            </div>
            <span className="text-[10px] text-slate-400">Clip tattiche, falli e situazioni da palla inattiva</span>
          </div>

          {videos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
              {videos.map((v) => (
                <div
                  key={v.id}
                  className="rounded-xl bg-[#11141D] border border-[#212638] p-3.5 flex flex-col justify-between space-y-2.5 group hover:border-[#CCFF00]/40 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-b border-[#1C2232] pb-1.5">
                      <span className="text-[#CCFF00] font-black">{v.targetName}</span>
                      {v.timestampMark && (
                        <span className="bg-[#CCFF00]/15 text-[#CCFF00] px-1.5 py-0.5 rounded font-bold">
                          Min. {v.timestampMark}
                        </span>
                      )}
                    </div>
                    <h5 className="font-bold text-xs text-white mt-1.5 group-hover:text-[#CCFF00] transition-colors">
                      {v.title}
                    </h5>
                    {v.description && (
                      <p className="text-[11px] text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                        {v.description}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (v.externalUrl) {
                        openMedia({
                          url: v.externalUrl,
                          title: v.title,
                          subtitle: v.targetName,
                          description: v.description,
                          timestampMark: v.timestampMark,
                          mediaType: v.mediaType,
                        });
                      }
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-[#CCFF00] hover:bg-[#d8ff33] text-black text-xs font-black transition-all shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5 fill-black" /> Riproduci in App
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic py-4 text-center bg-[#11141D] rounded-xl border border-dashed border-[#212638]">
              Nessun video associato a {team.name}.
            </p>
          )}
        </div>

        {/* 4. ULTIME GARE DISPUTATE */}
        {recentMatches.length > 0 && (
          <div className="rounded-2xl bg-[#0D0F16] border border-[#1F2433] p-4 sm:p-5 space-y-3">
            <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 border-b border-[#1A1F2C] pb-3">
              <Calendar className="w-4 h-4 text-[#CCFF00]" />
              Ultime Gare Disputate in Campionato ({recentMatches.length})
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
              {recentMatches.map((m) => {
                const isHomeGame = m.homeTeamName.toLowerCase().trim() === team.name.toLowerCase().trim();
                const teamScore = isHomeGame ? m.homeScore : m.awayScore;
                const oppScore = isHomeGame ? m.awayScore : m.homeScore;
                const oppName = isHomeGame ? m.awayTeamName : m.homeTeamName;
                const result =
                  teamScore !== undefined && oppScore !== undefined
                    ? teamScore > oppScore
                      ? 'V'
                      : teamScore < oppScore
                      ? 'S'
                      : 'P'
                    : '-';

                const badgeColor =
                  result === 'V'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : result === 'S'
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/30';

                return (
                  <div
                    key={m.id}
                    className="p-3 rounded-xl bg-[#11141D] border border-[#212638] flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="text-[10px] text-slate-500 font-mono block">
                        G{m.matchDay} • {isHomeGame ? 'Casa' : 'Trasferta'}
                      </span>
                      <span className="font-bold text-white truncate max-w-[130px] block mt-0.5">
                        vs {oppName}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-black text-xs text-white font-mono">
                        {m.homeScore} : {m.awayScore}
                      </span>
                      <span className={`w-5 h-5 rounded flex items-center justify-center font-black text-[10px] border ${badgeColor}`}>
                        {result}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. ORGANICO COMPLETO DELLA ROSA */}
        <details className="rounded-2xl bg-[#0D0F16] border border-[#1F2433] overflow-hidden group/roster">
          <summary className="p-4 cursor-pointer select-none text-xs sm:text-sm font-black uppercase tracking-wider text-white flex items-center justify-between hover:bg-[#11141D] transition-colors">
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#CCFF00]" />
              Organico Completo Rosa Calciatori ({players.length})
            </span>
            <span className="text-xs font-mono text-[#CCFF00]">Espandi / Riduci ▾</span>
          </summary>

          <div className="p-4 border-t border-[#1C2130] max-h-72 overflow-y-auto divide-y divide-[#1C2130]">
            {players.map((p) => (
              <div key={p.id} className="py-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <RoleBadge role={p.role} />
                  <span className="font-bold text-white">
                    {p.firstName} {p.lastName}
                  </span>
                  {p.age && <span className="text-slate-500 font-mono text-[11px]">({p.age} anni)</span>}
                </div>

                <div className="flex items-center gap-2 font-mono text-slate-400 text-[11px]">
                  <span>{p.appearances || 0} pres</span>
                  <span>{p.goals || 0} gol</span>
                  <span className="text-yellow-400">{p.yellowCards || 0} 🟨</span>
                  <span className="text-rose-400">{p.redCards || 0} 🟥</span>
                </div>
              </div>
            ))}
          </div>
        </details>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl my-4 rounded-3xl bg-[#0A0D15] border border-[#212638] shadow-2xl p-4 sm:p-7 text-slate-100 max-h-[94vh] overflow-y-auto flex flex-col justify-between space-y-5">
        {/* Top Bar with Title and Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1E2333] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#CCFF00]/15 border border-[#CCFF00]/30 text-[#CCFF00] shadow-[0_0_15px_rgba(204,255,0,0.25)] flex-shrink-0">
              <ClipboardCheck className="w-6 h-6 text-[#CCFF00]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-[#CCFF00]">
                  Dossier Operativo Arbitro
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#161B28] text-slate-400 border border-[#262D40]">
                  Giornata {match.matchDay} • Girone {match.girone}
                </span>
              </div>
              <h2 className="text-lg sm:text-2xl font-black text-white mt-0.5">
                Prepara la Gara: {match.homeTeamName} <span className="text-slate-500">vs</span> {match.awayTeamName}
              </h2>
              <p className="text-xs text-slate-400">
                🏟️ {match.matchField || 'Campo da designare'} • 🗓️ {match.dateText || 'Data da calendario'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141824] hover:bg-[#1E2435] text-slate-300 text-xs font-bold border border-[#212638] transition-all"
              title="Stampa Dossier"
            >
              <Printer className="w-4 h-4 text-slate-400" />
              <span className="hidden sm:inline">Stampa</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-[#141824] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-[#212638] transition-all"
              title="Chiudi (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 rounded-xl bg-[#11141D] border border-[#212638] overflow-x-auto gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('OVERVIEW')}
            className={`flex-1 min-w-[130px] flex items-center justify-center gap-1.5 py-2 text-xs font-black rounded-lg transition-all ${
              activeTab === 'OVERVIEW'
                ? 'bg-[#CCFF00] text-black shadow-[0_0_12px_rgba(204,255,0,0.3)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" /> Panoramica & Confronto
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('HOME')}
            className={`flex-1 min-w-[140px] flex items-center justify-center gap-1.5 py-2 text-xs font-black rounded-lg transition-all ${
              activeTab === 'HOME'
                ? 'bg-[#CCFF00] text-black shadow-[0_0_12px_rgba(204,255,0,0.3)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-inherit" /> Casa: {homeTeam.name}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('AWAY')}
            className={`flex-1 min-w-[140px] flex items-center justify-center gap-1.5 py-2 text-xs font-black rounded-lg transition-all ${
              activeTab === 'AWAY'
                ? 'bg-[#CCFF00] text-black shadow-[0_0_12px_rgba(204,255,0,0.3)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-inherit" /> Trasf: {awayTeam.name}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('CHECKLIST')}
            className={`flex-1 min-w-[130px] flex items-center justify-center gap-1.5 py-2 text-xs font-black rounded-lg transition-all ${
              activeTab === 'CHECKLIST'
                ? 'bg-[#CCFF00] text-black shadow-[0_0_12px_rgba(204,255,0,0.3)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Checklist Gara
          </button>
        </div>

        {/* Tab 1: PANORAMICA & CONFRONTO DIRETTO */}
        {activeTab === 'OVERVIEW' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Comparative Head-to-Head Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Home Team Card */}
              <div
                onClick={() => setActiveTab('HOME')}
                className="p-5 rounded-2xl bg-[#0D0F16] border border-[#1F2433] hover:border-[#CCFF00]/50 transition-all cursor-pointer group shadow-lg space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#CCFF00] text-black font-black flex items-center justify-center text-xs">
                      {homeTeam.name.substring(0, 3).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ospitante (Casa)</span>
                      <h4 className="text-base font-black text-white group-hover:text-[#CCFF00] transition-colors">{homeTeam.name}</h4>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-[#CCFF00] transition-colors" />
                </div>

                {homeStanding && (
                  <div className="grid grid-cols-4 gap-2 text-center bg-[#11141D] p-3 rounded-xl border border-[#212638]">
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase font-bold block">Classifica</span>
                      <span className="text-sm font-black text-[#CCFF00]">#{homeStanding.position}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase font-bold block">Punti</span>
                      <span className="text-sm font-black text-white">{homeStanding.points}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase font-bold block">V-N-P</span>
                      <span className="text-xs font-mono font-bold text-slate-200">{homeStanding.won}-{homeStanding.drawn}-{homeStanding.lost}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase font-bold block">Reti</span>
                      <span className="text-xs font-mono font-bold text-slate-200">{homeStanding.goalsFor}:{homeStanding.goalsAgainst}</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                  <span>Note archiviate: <strong className="text-white font-mono">{homeNotes.length}</strong></span>
                  <span>Calciatori attenzionati: <strong className="text-amber-400 font-mono">{homeWatchPlayers.length}</strong></span>
                </div>
              </div>

              {/* Away Team Card */}
              <div
                onClick={() => setActiveTab('AWAY')}
                className="p-5 rounded-2xl bg-[#0D0F16] border border-[#1F2433] hover:border-[#FF334B]/50 transition-all cursor-pointer group shadow-lg space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#FF334B] text-black font-black flex items-center justify-center text-xs">
                      {awayTeam.name.substring(0, 3).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ospite (Trasferta)</span>
                      <h4 className="text-base font-black text-white group-hover:text-[#FF334B] transition-colors">{awayTeam.name}</h4>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-[#FF334B] transition-colors" />
                </div>

                {awayStanding && (
                  <div className="grid grid-cols-4 gap-2 text-center bg-[#11141D] p-3 rounded-xl border border-[#212638]">
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase font-bold block">Classifica</span>
                      <span className="text-sm font-black text-[#FF334B]">#{awayStanding.position}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase font-bold block">Punti</span>
                      <span className="text-sm font-black text-white">{awayStanding.points}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase font-bold block">V-N-P</span>
                      <span className="text-xs font-mono font-bold text-slate-200">{awayStanding.won}-{awayStanding.drawn}-{awayStanding.lost}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase font-bold block">Reti</span>
                      <span className="text-xs font-mono font-bold text-slate-200">{awayStanding.goalsFor}:{awayStanding.goalsAgainst}</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                  <span>Note archiviate: <strong className="text-white font-mono">{awayNotes.length}</strong></span>
                  <span>Calciatori attenzionati: <strong className="text-amber-400 font-mono">{awayWatchPlayers.length}</strong></span>
                </div>
              </div>
            </div>

            {/* Note Partita Specifiche */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#0D0F16] border border-[#1F2433] space-y-3">
              <div className="flex items-center justify-between border-b border-[#1A1F2C] pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#CCFF00]" />
                  <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                    Note Specifiche su questa Gara ({matchNotes.length})
                  </h4>
                </div>
                <button
                  onClick={() => handleOpenAddNote(match.id, `${match.homeTeamName} vs ${match.awayTeamName}`, 'partita')}
                  className="flex items-center gap-1 text-[11px] font-bold text-[#CCFF00] hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" /> Aggiungi nota per questa gara
                </button>
              </div>

              {matchNotes.length > 0 ? (
                <div className="space-y-2">
                  {matchNotes.map((n) => (
                    <div key={n.id} className="p-3 rounded-xl bg-[#11141D] border border-[#212638] text-xs space-y-1">
                      <div className="flex items-center justify-between text-slate-400 text-[10px]">
                        <span className="font-bold text-white">{n.authorName || 'Arbitro'}</span>
                        <span>{new Date(n.createdAt).toLocaleDateString('it-IT')}</span>
                      </div>
                      <p className="text-slate-200">{n.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic py-2 text-center">
                  Nessuna annotazione specifica memorizzata per questa partita. Usa il pulsante in alto per aggiungere appunti per la terna.
                </p>
              )}
            </div>

            {/* Precedenti Diretti */}
            {headToHead.length > 0 && (
              <div className="p-4 sm:p-5 rounded-2xl bg-[#0D0F16] border border-[#1F2433] space-y-3">
                <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 border-b border-[#1A1F2C] pb-3">
                  <Trophy className="w-4 h-4 text-[#CCFF00]" />
                  Scontri Diretti Precedenti in Archivio ({headToHead.length})
                </h4>
                <div className="space-y-2">
                  {headToHead.map((m) => (
                    <div key={m.id} className="p-3 rounded-xl bg-[#11141D] border border-[#212638] flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-mono text-[11px]">Giornata {m.matchDay}</span>
                      <span className="font-bold text-white">
                        {m.homeTeamName} <span className="text-[#CCFF00] font-mono px-2">{m.homeScore} : {m.awayScore}</span> {m.awayTeamName}
                      </span>
                      <span className="text-slate-500 text-[11px] font-mono">{m.dateText}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: FOCUS SQUADRA CASA */}
        {activeTab === 'HOME' &&
          renderTeamSection(
            homeTeam,
            homeStanding,
            homeNotes,
            homeWatchPlayers,
            homeVideos,
            homePlayers,
            homeRecentMatches,
            true
          )}

        {/* Tab 3: FOCUS SQUADRA TRASFERTA */}
        {activeTab === 'AWAY' &&
          renderTeamSection(
            awayTeam,
            awayStanding,
            awayNotes,
            awayWatchPlayers,
            awayVideos,
            awayPlayers,
            awayRecentMatches,
            false
          )}

        {/* Tab 4: CHECKLIST PRE-GARA PER LA TERNA */}
        {activeTab === 'CHECKLIST' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="p-5 rounded-2xl bg-[#0D0F16] border border-[#1F2433] space-y-4">
              <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 border-b border-[#1E2333] pb-3">
                <CheckCircle2 className="w-4 h-4 text-[#CCFF00]" />
                Protocollo Operativo Direzione di Gara
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#11141D] border border-[#212638] space-y-2">
                  <h5 className="text-xs font-bold text-[#CCFF00] uppercase tracking-wide">1. Ispezione Campo & Divise</h5>
                  <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside leading-relaxed">
                    <li>Verifica reti delle porte, tiranti e bandierine d&apos;angolo.</li>
                    <li>Accertamento contrasto cromatico tra divise di gioco e portieri.</li>
                    <li>Controllo palloni omologati di gara e riscaldamento pre-gara.</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-[#11141D] border border-[#212638] space-y-2">
                  <h5 className="text-xs font-bold text-[#CCFF00] uppercase tracking-wide">2. Riconoscimento & Documenti</h5>
                  <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside leading-relaxed">
                    <li>Verifica cartellini d&apos;identità/tessere federali e liste giocatori.</li>
                    <li>Rilevazione capitani, vicecapitani e dirigenti ammessi in panchina.</li>
                    <li>Firma e conferma distinta con i dirigenti accompagnatori.</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-[#11141D] border border-[#212638] space-y-2">
                  <h5 className="text-xs font-bold text-[#CCFF00] uppercase tracking-wide">3. Disposizioni agli Assistenti</h5>
                  <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside leading-relaxed">
                    <li>Allineamento su fuorigioco geografico vs attivo.</li>
                    <li>Gestione contatti e falli sul limite dell&apos;area di rigore.</li>
                    <li>Condotta violenta a palla lontana e controllo panchine.</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-[#11141D] border border-[#212638] space-y-2">
                  <h5 className="text-xs font-bold text-[#CCFF00] uppercase tracking-wide">4. Clima Gara & Disciplina</h5>
                  <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside leading-relaxed">
                    <li>Attenzione preventiva sui calciatori segnalati per proteste frequenti.</li>
                    <li>Presenza fisica autorevole nelle ripartenze e nei calci piazzati.</li>
                    <li>Tutela dell&apos;incolumità dei calciatori su interventi pericolosi.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-4 border-t border-[#1C2130] flex items-center justify-between">
          <span className="text-xs text-slate-500 font-mono">
            REFSTUDIO • Modulo Operativo Preparazione Gara
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-[#CCFF00] hover:bg-[#d8ff33] text-black text-xs font-black rounded-xl shadow-[0_0_15px_rgba(204,255,0,0.3)] transition-all"
          >
            Chiudi Dossier Gara
          </button>
        </div>
      </div>

      {/* Sub-Modals triggered from inside Prepara la Gara */}
      <NoteModal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        initialTargetType={noteTarget.type}
        initialTargetId={noteTarget.id}
        initialTargetName={noteTarget.name}
        onSave={(data) => {
          DbService.addNote({
            ...data,
            authorId: user?.username || 'samueleromini',
            authorName: user?.displayName || 'Arbitro',
            authorRole: user?.refereeRole || 'AE',
            authorAvatar: user?.avatarUrl || '',
            authorSection: user?.sectionAia || '',
          });
          setIsNoteModalOpen(false);
          setRefreshKey((k) => k + 1);
        }}
      />

      <VideoModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        initialTargetType={videoTarget.type === 'partita' ? 'partita' : 'squadra'}
        initialTargetId={videoTarget.id}
        initialTargetName={videoTarget.name}
        onSave={(data) => {
          DbService.addVideo(data);
          setIsVideoModalOpen(false);
          setRefreshKey((k) => k + 1);
        }}
      />

      {/* Media Viewer Modal */}
      <MediaViewerModal
        isOpen={isViewerOpen}
        onClose={() => {
          setIsViewerOpen(false);
          setActiveViewerMedia(null);
        }}
        media={activeViewerMedia}
      />
    </div>
  );
};
