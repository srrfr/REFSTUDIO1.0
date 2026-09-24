'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Shield,
  Search,
  MapPin,
  Edit3,
  Plus,
  X,
  Check,
  FileText,
  Video,
  Users,
  Trash2,
  AlertTriangle,
  Award,
  Crown,
  Eye,
  Paperclip,
  Calendar,
  Globe,
  Lock,
  ArrowRight,
  LayoutList,
  LayoutGrid,
  ChevronRight,
  TrendingUp,
  Activity,
  Sparkles,
  Info,
  Filter,
} from 'lucide-react';
import { DbService } from '@/lib/repository/db-service';
import { Team, Player, Note, VideoClip, RefereeCustomTag, Match, StandingRow } from '@/types/refstudio';
import { RatingStars } from '@/components/common/RatingStars';
import { RoleBadge } from '@/components/common/RoleBadge';
import { TagBadge } from '@/components/common/TagBadge';
import { useAuth } from '@/lib/auth/auth-context';
import { NoteModal } from '@/components/modals/NoteModal';
import { VideoModal } from '@/components/modals/VideoModal';
import { MediaViewerModal, MediaViewerItem } from '@/components/media/MediaViewerModal';
import { useRealtimeSync } from '@/lib/supabase/realtime-context';

const AVAILABLE_TAGS: RefereeCustomTag[] = [
  'proteste frequenti',
  'simulatore',
  'corretto',
  'leader squadra',
  'aggressivo',
  'osservare',
];

export interface TeamRecentMatch {
  matchId: string;
  matchDay: number;
  dateText: string;
  isHome: boolean;
  teamScore: number;
  opponentScore: number;
  opponentName: string;
  result: 'V' | 'N' | 'P';
  scoreDisplay: string;
}

// Calcola in modo deterministico le ultime gare giocate dedotte dalle giornate caricate
function computeTeamRecentMatches(team: Team, allMatches: Match[], limit: number = 5): TeamRecentMatch[] {
  const normName = team.name.toLowerCase().trim();
  const teamId = team.id;

  const played = allMatches.filter((m) => {
    const isHome = m.homeTeamName.toLowerCase().trim() === normName || Boolean(teamId && m.homeTeamId === teamId);
    const isAway = m.awayTeamName.toLowerCase().trim() === normName || Boolean(teamId && m.awayTeamId === teamId);
    if (!isHome && !isAway) return false;
    const hasScores =
      m.homeScore !== undefined &&
      m.homeScore !== null &&
      m.awayScore !== undefined &&
      m.awayScore !== null;
    return m.played || hasScores;
  });

  // Ordina per giornata decrescente (la più recente per prima)
  played.sort((a, b) => (b.matchDay || 0) - (a.matchDay || 0));

  return played.slice(0, limit).map((m) => {
    const isHome: boolean = m.homeTeamName.toLowerCase().trim() === normName || Boolean(teamId && m.homeTeamId === teamId);
    const teamScore = isHome ? (m.homeScore ?? 0) : (m.awayScore ?? 0);
    const oppScore = isHome ? (m.awayScore ?? 0) : (m.homeScore ?? 0);
    const oppName = isHome ? m.awayTeamName : m.homeTeamName;

    let result: 'V' | 'N' | 'P' = 'N';
    if (teamScore > oppScore) result = 'V';
    else if (teamScore < oppScore) result = 'P';
    else result = 'N';

    return {
      matchId: m.id,
      matchDay: m.matchDay,
      dateText: m.dateText,
      isHome,
      teamScore,
      opponentScore: oppScore,
      opponentName: oppName,
      result,
      scoreDisplay: isHome ? `${teamScore} - ${oppScore}` : `${oppScore} - ${teamScore}`,
    };
  });
}

function SquadreContent() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') || '';

  const { user, isAdmin } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [allStandings, setAllStandings] = useState<StandingRow[]>([]);

  const [gironeFilter, setGironeFilter] = useState<'ALL' | 'A' | 'B'>('ALL');
  const [searchQuery, setSearchQuery] = useState(initialQ);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list'); // Default: elenco snello

  // Selected team state (apre la scheda dettagliata)
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [activeTeamTab, setActiveTeamTab] = useState<'FORMA' | 'ROSA' | 'NOTE' | 'VIDEO' | 'VALUTAZIONI'>('FORMA');
  const [teamRoster, setTeamRoster] = useState<Player[]>([]);
  const [teamNotes, setTeamNotes] = useState<Note[]>([]);
  const [teamVideos, setTeamVideos] = useState<VideoClip[]>([]);
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterRoleFilter, setRosterRoleFilter] = useState<string>('ALL');

  // Team Admin edit mode
  const [isEditingTeam, setIsEditingTeam] = useState(false);
  const [editTeamForm, setEditTeamForm] = useState<Partial<Team>>({});

  // Selected Player from Roster state
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [playerNotes, setPlayerNotes] = useState<Note[]>([]);
  const [playerVideos, setPlayerVideos] = useState<VideoClip[]>([]);
  const [isEditingPlayer, setIsEditingPlayer] = useState(false);
  const [editPlayerForm, setEditPlayerForm] = useState<Partial<Player>>({});

  // Note Modal state
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteModalTargetType, setNoteModalTargetType] = useState<'squadra' | 'giocatore'>('squadra');
  const [noteModalTargetId, setNoteModalTargetId] = useState('');
  const [noteModalTargetName, setNoteModalTargetName] = useState('');
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  // Video Modal state
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [videoModalTargetType, setVideoModalTargetType] = useState<'squadra' | 'giocatore'>('squadra');
  const [videoModalTargetId, setVideoModalTargetId] = useState('');
  const [videoModalTargetName, setVideoModalTargetName] = useState('');

  // In-App Media Viewer State
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [activeViewerMedia, setActiveViewerMedia] = useState<MediaViewerItem | null>(null);

  const loadAllData = useCallback(() => {
    const list = DbService.getTeams();
    setTeams(list);

    const matchesList = DbService.getMatches();
    setAllMatches(matchesList);

    const standingsA = DbService.getStandings('A');
    const standingsB = DbService.getStandings('B');
    setAllStandings([...standingsA, ...standingsB]);

    // Se c'è una squadra aperta nella scheda dettagliata, aggiorna i dati in tempo reale
    if (selectedTeam) {
      const freshTeam = DbService.getTeamById(selectedTeam.id);
      if (freshTeam) setSelectedTeam(freshTeam);
      setTeamRoster(DbService.getPlayers(selectedTeam.id));
      setTeamNotes(DbService.getNotes('squadra', selectedTeam.id, user?.username));
      setTeamVideos(DbService.getVideos('squadra', selectedTeam.id));
    }

    // Se c'è un calciatore aperto nella modale, aggiorna i dati in tempo reale
    if (selectedPlayer) {
      const freshPlayer = DbService.getPlayerById(selectedPlayer.id);
      if (freshPlayer) setSelectedPlayer(freshPlayer);
      setPlayerNotes(DbService.getNotes('giocatore', selectedPlayer.id, user?.username));
      setPlayerVideos(DbService.getVideos('giocatore', selectedPlayer.id));
    }
  }, [selectedTeam, selectedPlayer, user?.username]);

  // Sottoscrizione Realtime multi-dispositivo
  useRealtimeSync(loadAllData);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  useEffect(() => {
    if (initialQ) {
      setSearchQuery(initialQ);
    }
  }, [initialQ]);

  // Map pre-calcolata delle ultime 5 gare per ciascuna squadra
  const recentMatchesByTeam = useMemo(() => {
    const map = new Map<string, TeamRecentMatch[]>();
    teams.forEach((t) => {
      map.set(t.id, computeTeamRecentMatches(t, allMatches, 5));
    });
    return map;
  }, [teams, allMatches]);

  // Map delle classifiche per nome squadra
  const standingsByTeam = useMemo(() => {
    const map = new Map<string, StandingRow>();
    allStandings.forEach((s) => {
      map.set(s.teamName.toLowerCase().trim(), s);
    });
    return map;
  }, [allStandings]);

  // Map del conteggio calciatori per squadra
  const playersCountByTeam = useMemo(() => {
    const map = new Map<string, number>();
    teams.forEach((t) => {
      const pList = DbService.getPlayers(t.id);
      map.set(t.id, pList.length);
    });
    return map;
  }, [teams]);

  // Selezione e apertura scheda dettagliata
  const handleSelectTeam = (team: Team) => {
    setSelectedTeam(team);
    setEditTeamForm(team);
    setIsEditingTeam(false);
    setSelectedPlayer(null);
    setActiveTeamTab('FORMA');
    setRosterSearch('');
    setRosterRoleFilter('ALL');

    setTeamRoster(DbService.getPlayers(team.id));
    setTeamNotes(DbService.getNotes('squadra', team.id, user?.username));
    setTeamVideos(DbService.getVideos('squadra', team.id));
  };

  const handleSaveTeamEdit = () => {
    if (!selectedTeam) return;
    try {
      const updated = DbService.updateTeam(selectedTeam.id, editTeamForm);
      setSelectedTeam(updated);
      setIsEditingTeam(false);
      loadAllData();
    } catch (err) {
      console.error(err);
    }
  };

  // Apertura modale singolo calciatore dalla rosa
  const handleOpenPlayerFromRoster = (player: Player) => {
    setSelectedPlayer(player);
    setEditPlayerForm(player);
    setIsEditingPlayer(false);
    setPlayerNotes(DbService.getNotes('giocatore', player.id, user?.username));
    setPlayerVideos(DbService.getVideos('giocatore', player.id));
  };

  const handleSavePlayerEdit = () => {
    if (!selectedPlayer) return;
    try {
      const updated = DbService.updatePlayer(selectedPlayer.id, editPlayerForm);
      setSelectedPlayer(updated);
      setIsEditingPlayer(false);
      setTeamRoster((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleTogglePlayerTag = (tag: RefereeCustomTag) => {
    const currentTags = editPlayerForm.customTags || [];
    if (currentTags.includes(tag)) {
      setEditPlayerForm({
        ...editPlayerForm,
        customTags: currentTags.filter((t) => t !== tag),
      });
    } else {
      setEditPlayerForm({
        ...editPlayerForm,
        customTags: [...currentTags, tag],
      });
    }
  };

  // Note actions
  const handleAddNoteForPlayer = (player: Player) => {
    setEditingNote(null);
    setNoteModalTargetType('giocatore');
    setNoteModalTargetId(player.id);
    setNoteModalTargetName(`${player.firstName} ${player.lastName} (${player.teamName})`);
    setIsNoteModalOpen(true);
  };

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setNoteModalTargetType(note.targetType as any);
    setNoteModalTargetId(note.targetId);
    setNoteModalTargetName(note.targetName);
    setIsNoteModalOpen(true);
  };

  const handleDeleteNote = (noteId: string, isPlayerNote: boolean) => {
    if (confirm('Sei sicuro di voler eliminare questa nota?')) {
      try {
        DbService.deleteNote(noteId, user?.username);
        if (isPlayerNote && selectedPlayer) {
          setPlayerNotes(DbService.getNotes('giocatore', selectedPlayer.id, user?.username));
        } else if (selectedTeam) {
          setTeamNotes(DbService.getNotes('squadra', selectedTeam.id, user?.username));
        }
      } catch (err: any) {
        alert(err.message || 'Non sei autorizzato a eliminare questa nota.');
      }
    }
  };

  const handleSaveNote = (noteData: any) => {
    try {
      if (noteData.id) {
        DbService.updateNote(noteData.id, noteData, user?.username);
      } else {
        DbService.addNote({
          ...noteData,
          authorId: user?.username || 'samueleromini',
          authorName: user?.displayName || 'Arbitro',
          authorRole: user?.refereeRole || 'AE',
          authorAvatar: user?.avatarUrl || '',
          authorSection: user?.sectionAia || '',
        });
      }

      if (selectedPlayer && noteData.targetType === 'giocatore') {
        setPlayerNotes(DbService.getNotes('giocatore', selectedPlayer.id, user?.username));
      }
      if (selectedTeam && noteData.targetType === 'squadra') {
        setTeamNotes(DbService.getNotes('squadra', selectedTeam.id, user?.username));
      }
      setIsNoteModalOpen(false);
      setEditingNote(null);
    } catch (err: any) {
      alert(err.message || 'Errore durante il salvataggio della nota');
    }
  };

  // Filtraggio squadre
  const filteredTeams = useMemo(() => {
    return teams.filter((t) => {
      if (gironeFilter !== 'ALL' && t.girone !== gironeFilter) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        t.name.toLowerCase().includes(q) ||
        (t.city && t.city.toLowerCase().includes(q)) ||
        (t.stadium && t.stadium.toLowerCase().includes(q))
      );
    });
  }, [teams, gironeFilter, searchQuery]);

  // Filtraggio calciatori all'interno della modale rosa
  const filteredRoster = useMemo(() => {
    return teamRoster.filter((p) => {
      if (rosterRoleFilter !== 'ALL' && p.role !== rosterRoleFilter) return false;
      if (!rosterSearch) return true;
      const q = rosterSearch.toLowerCase().trim();
      return (
        p.lastName.toLowerCase().includes(q) ||
        p.firstName.toLowerCase().includes(q) ||
        p.customTags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [teamRoster, rosterRoleFilter, rosterSearch]);

  // Helper per renderizzare i pallini forma (V-N-P)
  const renderFormBadges = (recentMatches: TeamRecentMatch[], size: 'sm' | 'md' = 'sm') => {
    if (!recentMatches || recentMatches.length === 0) {
      return <span className="text-[10px] text-slate-500 italic">Nessuna gara disputata</span>;
    }

    // Visualizza le gare dalla più vecchia alla più recente (da sinistra a destra) o viceversa
    // Invertiamo l'array recente (che ha la più recente all'indice 0) per mostrare l'andamento cronologico
    const chronological = [...recentMatches].reverse();

    return (
      <div className="flex items-center gap-1.5" title="Ultime gare disputate (da sx a dx)">
        {chronological.map((m) => {
          const bg =
            m.result === 'V'
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
              : m.result === 'P'
              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-[0_0_8px_rgba(244,63,94,0.2)]'
              : 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.2)]';

          const dim = size === 'sm' ? 'w-5 h-5 text-[10px]' : 'w-6 h-6 text-xs';

          return (
            <div
              key={m.matchId}
              className={`rounded-md flex items-center justify-center font-black border font-mono transition-transform hover:scale-110 cursor-help ${dim} ${bg}`}
              title={`G${m.matchDay}: ${m.isHome ? 'Casa' : 'Trasf'} vs ${m.opponentName} (${m.scoreDisplay}) - ${
                m.result === 'V' ? 'Vittoria' : m.result === 'P' ? 'Sconfitta' : 'Pareggio'
              }`}
            >
              {m.result}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. HEADER & CONTROLS SNELLI */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#0D0F16] border border-[#1F2433] rounded-2xl p-5 shadow-lg">
        <div>
          <div className="flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-[#CCFF00]" />
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide">
              Squadre & Rose Ufficiali
            </h1>
            <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-[#141824] text-[#CCFF00] border border-[#CCFF00]/30 font-bold">
              {filteredTeams.length} Club
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Elenco snello dei club e delle rose. Clicca su qualsiasi squadra per aprire la scheda dettagliata e consultare l&apos;organico completo.
          </p>
        </div>

        {/* Filters & View Switcher */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-60">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca squadra, città o stadio..."
              className="w-full bg-[#11141D] border border-[#212638] rounded-xl pl-9 pr-8 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#CCFF00]/40 focus:border-[#CCFF00]"
            />
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Girone Selector */}
          <div className="flex rounded-xl bg-[#11141D] border border-[#212638] p-1 shrink-0">
            {(['ALL', 'A', 'B'] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGironeFilter(g)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                  gironeFilter === g
                    ? 'bg-[#CCFF00] text-black shadow-[0_0_10px_rgba(204,255,0,0.3)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {g === 'ALL' ? 'Tutti' : `Girone ${g}`}
              </button>
            ))}
          </div>

          {/* View Toggle */}
          <div className="flex rounded-xl bg-[#11141D] border border-[#212638] p-1 shrink-0">
            <button
              onClick={() => setViewMode('list')}
              title="Visualizzazione Elenco Snello"
              className={`p-1.5 rounded-lg text-xs transition-all ${
                viewMode === 'list'
                  ? 'bg-[#1F2638] text-[#CCFF00]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              title="Visualizzazione Griglia Compatta"
              className={`p-1.5 rounded-lg text-xs transition-all ${
                viewMode === 'grid'
                  ? 'bg-[#1F2638] text-[#CCFF00]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. ELENCO SNELLO DELLE SQUADRE / ROSE */}
      {filteredTeams.length === 0 ? (
        <div className="p-12 text-center bg-[#0D0F16] border border-dashed border-[#212638] rounded-2xl text-slate-500 text-xs">
          Nessuna squadra trovata con i filtri correnti. Prova a modificare la ricerca o il girone.
        </div>
      ) : viewMode === 'list' ? (
        /* VISTA TABELLARE / LISTA SNELLA */
        <div className="bg-[#0D0F16] border border-[#1F2433] rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1C2130] bg-[#11141D]/70 text-[10px] uppercase font-black tracking-wider text-slate-400">
                  <th className="py-3 px-4">Squadra & Sede</th>
                  <th className="py-3 px-4">Girone</th>
                  <th className="py-3 px-4">Classifica</th>
                  <th className="py-3 px-4">Rosa</th>
                  <th className="py-3 px-4">Ultime 5 Gare (V-N-P)</th>
                  <th className="py-3 px-4 text-center">Note / Video</th>
                  <th className="py-3 px-4 text-right">Azione</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A1F2C] text-xs">
                {filteredTeams.map((team) => {
                  const recent = recentMatchesByTeam.get(team.id) || [];
                  const standing = standingsByTeam.get(team.name.toLowerCase().trim());
                  const pCount = playersCountByTeam.get(team.id) || 0;
                  const notesCount = DbService.getNotes('squadra', team.id, user?.username).length;
                  const videosCount = DbService.getVideos('squadra', team.id).length;

                  return (
                    <tr
                      key={team.id}
                      onClick={() => handleSelectTeam(team)}
                      className="group cursor-pointer hover:bg-[#141824]/80 transition-colors"
                    >
                      {/* Squadra & Sede */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[#141824] border border-[#242A3C] flex items-center justify-center font-black text-xs text-[#CCFF00] group-hover:scale-105 group-hover:border-[#CCFF00]/50 transition-all shrink-0">
                            {team.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-white group-hover:text-[#CCFF00] transition-colors block text-sm">
                              {team.name}
                            </span>
                            <span className="text-[11px] text-slate-400 truncate max-w-[200px] block">
                              {team.city ? `${team.city} • ` : ''}
                              {team.stadium || 'Campo federale'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Girone */}
                      <td className="py-3 px-4">
                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-[#11141D] text-slate-300 border border-[#212638]">
                          Girone {team.girone}
                        </span>
                      </td>

                      {/* Classifica */}
                      <td className="py-3 px-4">
                        {standing ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-[#CCFF00] bg-[#CCFF00]/10 px-2 py-0.5 rounded border border-[#CCFF00]/20 font-mono">
                              #{standing.position}
                            </span>
                            <span className="text-xs font-mono font-bold text-white">
                              {standing.points} pt
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                              ({standing.played}G)
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Organico Rosa */}
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs text-slate-300 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-slate-500" />
                          <strong className="text-white">{pCount}</strong> giocatori
                        </span>
                      </td>

                      {/* Ultime 5 Gare (V-N-P) */}
                      <td className="py-3 px-4">
                        {renderFormBadges(recent, 'sm')}
                      </td>

                      {/* Note & Video */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2 text-[11px]">
                          {notesCount > 0 && (
                            <span className="flex items-center gap-1 text-slate-400" title={`${notesCount} Note arbitrali`}>
                              <FileText className="w-3 h-3 text-[#CCFF00]" />
                              {notesCount}
                            </span>
                          )}
                          {videosCount > 0 && (
                            <span className="flex items-center gap-1 text-slate-400" title={`${videosCount} Clip video`}>
                              <Video className="w-3 h-3 text-cyan-400" />
                              {videosCount}
                            </span>
                          )}
                          {notesCount === 0 && videosCount === 0 && (
                            <span className="text-slate-600 text-[10px]">-</span>
                          )}
                        </div>
                      </td>

                      {/* Azione Apri */}
                      <td className="py-3 px-4 text-right">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#CCFF00] group-hover:translate-x-1 transition-transform">
                          Apri scheda <ChevronRight className="w-4 h-4" />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* VISTA A GRIGLIA COMPATTA */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeams.map((team) => {
            const recent = recentMatchesByTeam.get(team.id) || [];
            const standing = standingsByTeam.get(team.name.toLowerCase().trim());
            const pCount = playersCountByTeam.get(team.id) || 0;
            const notesCount = DbService.getNotes('squadra', team.id, user?.username).length;
            const videosCount = DbService.getVideos('squadra', team.id).length;

            return (
              <div
                key={team.id}
                onClick={() => handleSelectTeam(team)}
                className="group cursor-pointer rounded-2xl bg-[#0D0F16] border border-[#1F2433] p-4 hover:border-[#CCFF00]/40 transition-all hover:shadow-xl flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#141824] border border-[#242A3C] flex items-center justify-center font-black text-sm text-[#CCFF00] group-hover:scale-105 group-hover:border-[#CCFF00]/50 transition-all">
                        {team.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-sm text-white group-hover:text-[#CCFF00] transition-colors line-clamp-1">
                            {team.name}
                          </h3>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {team.city ? `${team.city} • ` : ''}Girone {team.girone}
                        </p>
                      </div>
                    </div>

                    {standing && (
                      <span className="text-xs font-mono font-black px-2 py-0.5 rounded-lg bg-[#11141D] border border-[#212638] text-[#CCFF00]">
                        #{standing.position} • {standing.points} pt
                      </span>
                    )}
                  </div>

                  {/* Ultime 5 Gare Section */}
                  <div className="mt-3 pt-3 border-t border-[#1A1F2C] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                        Ultime 5 gare
                      </span>
                      {renderFormBadges(recent, 'sm')}
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                        Organico
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-300">
                        {pCount} giocatori
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-[#1A1F2C]">
                  <span className="truncate max-w-[160px]">
                    🏟️ {team.stadium || 'Campo non specificato'}
                  </span>
                  <span className="text-[#CCFF00] font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    Scheda →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. SCHEDA DETTAGLIATA SQUADRA (MODALE A TUTTO SCHERMO / AMPIA) */}
      {selectedTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-5 animate-in fade-in duration-200">
          <div className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-3xl bg-[#0D0F16] border border-[#212638] shadow-2xl p-5 sm:p-7 text-slate-100 space-y-6">
            <button
              onClick={() => setSelectedTeam(null)}
              className="absolute right-5 top-5 p-2 rounded-xl bg-[#141824] hover:bg-[#1E2435] text-slate-400 hover:text-white border border-[#212638] transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Testata della Scheda */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1E2333] pb-5 pt-1">
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-[#CCFF00] text-black font-black text-xl flex items-center justify-center shadow-[0_0_15px_rgba(204,255,0,0.3)]">
                  {selectedTeam.name.substring(0, 3).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#161B26] text-[#CCFF00] border border-[#CCFF00]/30 uppercase">
                      Girone {selectedTeam.girone}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">
                      Eccellenza Emilia-Romagna
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                    {selectedTeam.name}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedTeam.city ? `${selectedTeam.city} • ` : ''}
                    {selectedTeam.stadium ? `Stadio: ${selectedTeam.stadium}` : 'Campo di casa'}
                    {selectedTeam.coachName ? ` • All: ${selectedTeam.coachName}` : ''}
                  </p>
                </div>
              </div>

              {/* Box Classifica Rapido */}
              {standingsByTeam.get(selectedTeam.name.toLowerCase().trim()) && (
                <div className="flex items-center gap-2 bg-[#11141D] p-2.5 rounded-2xl border border-[#212638] shrink-0">
                  <div className="px-3 border-r border-[#1F2538] text-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Posizione</span>
                    <span className="text-lg font-black text-[#CCFF00]">
                      #{standingsByTeam.get(selectedTeam.name.toLowerCase().trim())?.position}
                    </span>
                  </div>
                  <div className="px-3 border-r border-[#1F2538] text-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Punti</span>
                    <span className="text-lg font-black text-white">
                      {standingsByTeam.get(selectedTeam.name.toLowerCase().trim())?.points}
                    </span>
                  </div>
                  <div className="px-3 text-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Giocate (V-N-P)</span>
                    <span className="text-xs font-mono font-bold text-slate-200">
                      {standingsByTeam.get(selectedTeam.name.toLowerCase().trim())?.played} (
                      {standingsByTeam.get(selectedTeam.name.toLowerCase().trim())?.won}-
                      {standingsByTeam.get(selectedTeam.name.toLowerCase().trim())?.drawn}-
                      {standingsByTeam.get(selectedTeam.name.toLowerCase().trim())?.lost})
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* TAB DI NAVIGAZIONE INTERNA ALLA SCHEDA */}
            <div className="flex items-center gap-2 border-b border-[#1E2333] pb-1 overflow-x-auto">
              <button
                onClick={() => setActiveTeamTab('FORMA')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                  activeTeamTab === 'FORMA'
                    ? 'bg-[#CCFF00] text-black shadow-[0_0_12px_rgba(204,255,0,0.3)]'
                    : 'text-slate-400 hover:text-white bg-[#11141D] border border-[#212638]'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" /> Ultime Gare & Forma
              </button>
              <button
                onClick={() => setActiveTeamTab('ROSA')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                  activeTeamTab === 'ROSA'
                    ? 'bg-[#CCFF00] text-black shadow-[0_0_12px_rgba(204,255,0,0.3)]'
                    : 'text-slate-400 hover:text-white bg-[#11141D] border border-[#212638]'
                }`}
              >
                <Users className="w-3.5 h-3.5" /> Rosa Calciatori ({teamRoster.length})
              </button>
              <button
                onClick={() => setActiveTeamTab('NOTE')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                  activeTeamTab === 'NOTE'
                    ? 'bg-[#CCFF00] text-black shadow-[0_0_12px_rgba(204,255,0,0.3)]'
                    : 'text-slate-400 hover:text-white bg-[#11141D] border border-[#212638]'
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> Note Riservate ({teamNotes.length})
              </button>
              <button
                onClick={() => setActiveTeamTab('VIDEO')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                  activeTeamTab === 'VIDEO'
                    ? 'bg-[#CCFF00] text-black shadow-[0_0_12px_rgba(204,255,0,0.3)]'
                    : 'text-slate-400 hover:text-white bg-[#11141D] border border-[#212638]'
                }`}
              >
                <Video className="w-3.5 h-3.5" /> Videoteca ({teamVideos.length})
              </button>
              <button
                onClick={() => setActiveTeamTab('VALUTAZIONI')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                  activeTeamTab === 'VALUTAZIONI'
                    ? 'bg-[#CCFF00] text-black shadow-[0_0_12px_rgba(204,255,0,0.3)]'
                    : 'text-slate-400 hover:text-white bg-[#11141D] border border-[#212638]'
                }`}
              >
                <Award className="w-3.5 h-3.5" /> Profilo Arbitrale
              </button>
            </div>

            {/* CONTENUTO DEI TAB */}

            {/* TAB 1: ULTIME GARE & FORMA (VITTORIE, PAREGGI, SCONFITTE) */}
            {activeTeamTab === 'FORMA' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                {/* Bilancio Riassuntivo */}
                {(() => {
                  const recent = recentMatchesByTeam.get(selectedTeam.id) || [];
                  const wins = recent.filter((x) => x.result === 'V').length;
                  const draws = recent.filter((x) => x.result === 'N').length;
                  const losses = recent.filter((x) => x.result === 'P').length;
                  const points = wins * 3 + draws;

                  return (
                    <div className="p-4 sm:p-5 rounded-2xl bg-[#11141D] border border-[#212638] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4 text-[#CCFF00]" />
                          <h3 className="text-sm font-black text-white uppercase tracking-wider">
                            Andamento Recente in Campionato (Ultime {recent.length} Gare)
                          </h3>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Dedotto direttamente dai risultati registrati e sincronizzati nel file delle partite
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-[#0D0F16] px-3.5 py-2 rounded-xl border border-[#212638]">
                          <span className="text-xs text-slate-400 font-bold">Bilancio:</span>
                          <span className="text-xs font-mono font-black text-emerald-400">{wins}V</span>
                          <span className="text-xs font-mono font-black text-amber-400">{draws}N</span>
                          <span className="text-xs font-mono font-black text-rose-400">{losses}P</span>
                          <span className="text-xs text-slate-500 font-mono">({points} pt)</span>
                        </div>
                        {renderFormBadges(recent, 'md')}
                      </div>
                    </div>
                  );
                })()}

                {/* Dettaglio Partite Ultime 5 Gare */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#CCFF00]" />
                    Dettaglio Partite Giocate (Ordinate dalla più recente)
                  </h4>

                  {(() => {
                    const recent = recentMatchesByTeam.get(selectedTeam.id) || [];
                    if (recent.length === 0) {
                      return (
                        <div className="p-8 text-center text-slate-500 text-xs italic bg-[#11141D] rounded-2xl border border-dashed border-[#212638]">
                          Nessun risultato ancora registrato per questa squadra nel calendario gare.
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {recent.map((m) => {
                          const badgeColor =
                            m.result === 'V'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                              : m.result === 'P'
                              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                              : 'bg-amber-500/20 text-amber-400 border-amber-500/40';

                          const resultLabel =
                            m.result === 'V'
                              ? 'Vittoria'
                              : m.result === 'P'
                              ? 'Sconfitta'
                              : 'Pareggio';

                          return (
                            <div
                              key={m.matchId}
                              className="p-4 rounded-2xl bg-[#11141D] border border-[#212638] flex items-center justify-between gap-4 hover:border-[#CCFF00]/30 transition-all group"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                                  <span className="font-bold text-[#CCFF00] bg-[#CCFF00]/10 px-2 py-0.5 rounded border border-[#CCFF00]/20">
                                    Giornata {m.matchDay}
                                  </span>
                                  <span>{m.isHome ? '🏠 In Casa' : '✈️ In Trasferta'}</span>
                                  {m.dateText && <span>• {m.dateText}</span>}
                                </div>
                                <h5 className="font-bold text-sm text-white group-hover:text-[#CCFF00] transition-colors">
                                  {m.isHome ? `${selectedTeam.name} vs ${m.opponentName}` : `${m.opponentName} vs ${selectedTeam.name}`}
                                </h5>
                                <p className="text-xs text-slate-400">
                                  Avversario: <strong className="text-slate-200">{m.opponentName}</strong>
                                </p>
                              </div>

                              <div className="flex flex-col items-end gap-1.5 shrink-0">
                                <div className="px-3 py-1 bg-[#090A0E] rounded-lg border border-[#212638] text-base font-black font-mono text-white tracking-widest">
                                  {m.scoreDisplay}
                                </div>
                                <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${badgeColor}`}>
                                  {m.result} • {resultLabel}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* TAB 2: ROSA CALCIATORI UFFICIALE */}
            {activeTeamTab === 'ROSA' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* Search & Role Filter inside Roster */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative flex-1 sm:max-w-xs">
                    <input
                      type="text"
                      value={rosterSearch}
                      onChange={(e) => setRosterSearch(e.target.value)}
                      placeholder="Cerca calciatore per cognome o tag..."
                      className="w-full bg-[#11141D] border border-[#212638] rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-[#CCFF00]"
                    />
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  </div>

                  <div className="flex rounded-xl bg-[#11141D] border border-[#212638] p-1 shrink-0 overflow-x-auto">
                    {[
                      { id: 'ALL', label: 'Tutti' },
                      { id: 'P', label: 'Portieri' },
                      { id: 'D', label: 'Difensori' },
                      { id: 'C', label: 'Centrocampisti' },
                      { id: 'A', label: 'Attaccanti' },
                    ].map((rf) => (
                      <button
                        key={rf.id}
                        onClick={() => setRosterRoleFilter(rf.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          rosterRoleFilter === rf.id
                            ? 'bg-[#CCFF00] text-black font-black'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {rf.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Roster Table / List */}
                <div className="max-h-[55vh] overflow-y-auto rounded-2xl border border-[#212638] divide-y divide-[#1C2130] bg-[#0A0C10]">
                  {filteredRoster.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs italic">
                      Nessun calciatore corrisponde ai filtri di ricerca.
                    </div>
                  ) : (
                    filteredRoster.map((player) => (
                      <div
                        key={player.id}
                        onClick={() => handleOpenPlayerFromRoster(player)}
                        className="p-3.5 flex items-center justify-between text-xs hover:bg-[#CCFF00]/10 cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <RoleBadge role={player.role} />
                          <div>
                            <span className="font-bold text-white group-hover:text-[#CCFF00] transition-colors">
                              {player.lastName} {player.firstName}
                            </span>
                            {player.age && (
                              <span className="text-slate-500 ml-1.5 text-[11px]">({player.age} anni)</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex gap-1">
                            {player.customTags.map((t, idx) => (
                              <TagBadge key={idx} tag={t} size="sm" />
                            ))}
                          </div>

                          <div className="flex items-center gap-2 text-slate-400 font-mono text-xs">
                            <span className="text-slate-300 font-semibold">{player.appearances || 0} pres</span>
                            {player.goals !== undefined && player.goals > 0 && (
                              <span className="text-emerald-400 font-bold">{player.goals} ⚽</span>
                            )}
                            <span className="text-yellow-400 font-bold">{player.yellowCards} 🟨</span>
                            <span className="text-rose-400 font-bold">{player.redCards} 🟥</span>
                          </div>

                          <span className="text-[11px] font-black text-[#CCFF00] opacity-0 group-hover:opacity-100 transition-opacity">
                            Apri scheda →
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: NOTE RISERVATE SULLA SQUADRA */}
            {activeTeamTab === 'NOTE' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-black text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#CCFF00]" />
                      Note Arbitrali sulla Squadra ({teamNotes.length})
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Annotazioni riservate inserite dai colleghi arbitri su condotta, clima e campo
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingNote(null);
                      setNoteModalTargetType('squadra');
                      setNoteModalTargetId(selectedTeam.id);
                      setNoteModalTargetName(selectedTeam.name);
                      setIsNoteModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#CCFF00] hover:bg-[#D8FF33] text-black font-black text-xs shadow-[0_0_12px_rgba(204,255,0,0.35)] transition-all"
                  >
                    <Plus className="w-4 h-4" /> Aggiungi Nota
                  </button>
                </div>

                {teamNotes.length > 0 ? (
                  <div className="space-y-3">
                    {teamNotes.map((n) => (
                      <div key={n.id} className="p-4 bg-[#11141D] rounded-2xl text-xs space-y-2.5 border border-[#212638]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-black text-[#CCFF00] uppercase tracking-wider px-2 py-0.5 rounded bg-[#141824] border border-[#212638]">
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

                          <div className="flex items-center gap-2">
                            {user && n.authorId && n.authorId.toLowerCase() === user.username.toLowerCase() ? (
                              <>
                                <button
                                  onClick={() => handleEditNote(n)}
                                  className="text-slate-400 hover:text-[#CCFF00] p-1 transition-colors"
                                  title="Modifica Nota"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteNote(n.id, false)}
                                  className="text-slate-400 hover:text-rose-400 p-1 transition-colors"
                                  title="Elimina Nota"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <span className="text-[10px] text-slate-500 italic flex items-center gap-1">
                                <Lock className="w-3 h-3 text-slate-600" /> Sola lettura
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Author info */}
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-0.5">
                          <span className="font-bold text-white">{n.authorName || n.authorId}</span>
                          {n.authorRole && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-black bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/30">
                              {n.authorRole}
                            </span>
                          )}
                          {n.authorSection && <span className="text-slate-500">• {n.authorSection}</span>}
                        </div>

                        <p className="text-slate-200 leading-relaxed whitespace-pre-line">{n.content}</p>

                        {/* Allegati */}
                        {n.attachments && n.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {n.attachments.map((att, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => {
                                  const isImg = att.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i);
                                  setActiveViewerMedia({
                                    url: att,
                                    title: `${selectedTeam.name} - Allegato ${i + 1}`,
                                    subtitle: `Nota arbitrale di ${n.authorName || 'Arbitro'}`,
                                    description: n.content,
                                    mediaType: isImg ? 'image' : 'video',
                                  });
                                  setIsViewerOpen(true);
                                }}
                                className="inline-flex items-center gap-1 text-[10px] text-[#CCFF00] bg-[#141824] border border-[#212638] px-2.5 py-1 rounded-lg hover:border-[#CCFF00]/40 transition-colors"
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
                  <div className="p-8 text-center text-slate-500 text-xs italic bg-[#11141D] rounded-2xl border border-dashed border-[#212638]">
                    Nessuna nota registrata per questa squadra. Clicca &quot;Aggiungi Nota&quot; per annotare dettagli utili.
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: VIDEOTECA SQUADRA */}
            {activeTeamTab === 'VIDEO' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-black text-white flex items-center gap-2">
                      <Video className="w-4 h-4 text-[#CCFF00]" />
                      Videoteca Didattica della Squadra ({teamVideos.length})
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Clip video di falli, tattiche e posizionamenti con player in-app e slow motion
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setVideoModalTargetType('squadra');
                      setVideoModalTargetId(selectedTeam.id);
                      setVideoModalTargetName(selectedTeam.name);
                      setIsVideoModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#CCFF00] hover:bg-[#D8FF33] text-black font-black text-xs shadow-[0_0_12px_rgba(204,255,0,0.35)] transition-all"
                  >
                    <Plus className="w-4 h-4" /> Carica Video
                  </button>
                </div>

                {teamVideos.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                    {teamVideos.map((vid) => (
                      <div
                        key={vid.id}
                        className="p-3.5 rounded-2xl bg-[#11141D] border border-[#212638] space-y-2.5 flex flex-col justify-between"
                      >
                        <div>
                          <span className="text-[10px] font-mono font-bold text-[#CCFF00] bg-[#CCFF00]/10 px-2 py-0.5 rounded border border-[#CCFF00]/20">
                            {vid.timestampMark ? `Min. ${vid.timestampMark}` : 'Clip Video'}
                          </span>
                          <h5 className="font-bold text-xs text-white mt-1.5 line-clamp-1">{vid.title}</h5>
                          {vid.description && (
                            <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{vid.description}</p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const videoUrl = vid.externalUrl || vid.storagePath || '';
                            setActiveViewerMedia({
                              url: videoUrl,
                              title: vid.title,
                              subtitle: `${selectedTeam.name} • ${vid.timestampMark ? `Min. ${vid.timestampMark}` : 'Clip Video'}`,
                              description: vid.description,
                              mediaType: 'video',
                            });
                            setIsViewerOpen(true);
                          }}
                          className="w-full flex items-center justify-center gap-1.5 py-2 bg-[#141824] hover:bg-[#1E2435] text-[#CCFF00] border border-[#212638] rounded-xl text-xs font-bold transition-all"
                        >
                          <Video className="w-3.5 h-3.5" /> Riproduci in App
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-500 text-xs italic bg-[#11141D] rounded-2xl border border-dashed border-[#212638]">
                    Nessun video archiviato per questa squadra. Clicca &quot;Carica Video&quot; per aggiungere un filmato.
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: PROFILO ARBITRALE & VALUTAZIONI */}
            {activeTeamTab === 'VALUTAZIONI' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <Award className="w-4 h-4 text-[#CCFF00]" />
                    Valutazioni Arbitrali sul Club
                  </h4>

                  <div>
                    {isEditingTeam ? (
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveTeamEdit}
                          className="flex items-center gap-1.5 px-4 py-2 bg-[#CCFF00] hover:bg-[#D8FF33] text-black font-black text-xs rounded-xl shadow-[0_0_12px_rgba(204,255,0,0.35)] transition-all"
                        >
                          <Check className="w-4 h-4" /> Salva Modifiche
                        </button>
                        <button
                          onClick={() => setIsEditingTeam(false)}
                          className="px-3.5 py-2 bg-[#141824] hover:bg-[#1E2435] text-slate-300 border border-[#212638] font-bold text-xs rounded-xl transition-all"
                        >
                          Annulla
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsEditingTeam(true)}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-[#141824] hover:bg-[#1E2435] text-slate-200 border border-[#212638] font-bold text-xs rounded-xl transition-all"
                      >
                        <Edit3 className="w-4 h-4 text-[#CCFF00]" /> Modifica Scheda Club
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Valutazioni Tecnico / Agonistiche */}
                  <div className="p-4 rounded-2xl bg-[#11141D] border border-[#212638] space-y-3">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-400 block">
                      Livello Tecnico & Aggressività
                    </span>
                    {isEditingTeam ? (
                      <div className="space-y-3 text-xs">
                        <div>
                          <label className="text-slate-400 block mb-1 font-bold">Livello Tecnico (1-5)</label>
                          <RatingStars
                            value={editTeamForm.technicalLevel || 3}
                            type="technical"
                            readOnly={false}
                            onChange={(v) => setEditTeamForm({ ...editTeamForm, technicalLevel: v })}
                          />
                        </div>
                        <div>
                          <label className="text-slate-400 block mb-1 font-bold">Aggressività (1-5)</label>
                          <RatingStars
                            value={editTeamForm.aggressionLevel || 3}
                            type="aggression"
                            readOnly={false}
                            onChange={(v) => setEditTeamForm({ ...editTeamForm, aggressionLevel: v })}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-300 space-y-2.5 pt-1">
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500 font-bold">Tecnica di gioco:</span>
                          <RatingStars value={selectedTeam.technicalLevel} type="technical" />
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500 font-bold">Intensità / Aggressività:</span>
                          <RatingStars value={selectedTeam.aggressionLevel} type="aggression" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Impianto & Panchina */}
                  <div className="p-4 rounded-2xl bg-[#11141D] border border-[#212638] space-y-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-400 block">
                      Impianto di Gioco & Staff
                    </span>
                    {isEditingTeam ? (
                      <div className="space-y-2 text-xs">
                        <div>
                          <label className="text-slate-400 block mb-1 font-bold">Nome Stadio</label>
                          <input
                            type="text"
                            value={editTeamForm.stadium || ''}
                            onChange={(e) => setEditTeamForm({ ...editTeamForm, stadium: e.target.value })}
                            className="w-full bg-[#0D0F16] border border-[#212638] rounded-xl p-2 text-xs text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="text-slate-400 block mb-1 font-bold">Allenatore</label>
                          <input
                            type="text"
                            value={editTeamForm.coachName || ''}
                            onChange={(e) => setEditTeamForm({ ...editTeamForm, coachName: e.target.value })}
                            className="w-full bg-[#0D0F16] border border-[#212638] rounded-xl p-2 text-xs text-slate-200"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-300 space-y-1.5 pt-1">
                        <p><span className="text-slate-500 font-bold">Stadio:</span> {selectedTeam.stadium || 'Non specificato'}</p>
                        <p><span className="text-slate-500 font-bold">Città:</span> {selectedTeam.city || 'Emilia-Romagna'}</p>
                        <p><span className="text-slate-500 font-bold">Allenatore:</span> {selectedTeam.coachName || 'Non specificato'}</p>
                        <p><span className="text-slate-500 font-bold">Atteggiamento panchina:</span> {selectedTeam.benchAttitude || 'Regolare'}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Footer Chiudi Scheda */}
            <div className="pt-4 border-t border-[#1C2130] flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Scheda informativa club RefStudio • Dati aggiornati
              </span>
              <button
                onClick={() => setSelectedTeam(null)}
                className="px-5 py-2.5 bg-[#141824] hover:bg-[#1E2435] text-xs font-bold text-slate-300 rounded-xl border border-[#212638] transition-all hover:text-white"
              >
                Chiudi Scheda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODALE SINGOLO CALCIATORE (APRIBILE DALLA ROSA DELLA SQUADRA) */}
      {selectedPlayer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#0D0F16] border border-[#212638] shadow-2xl p-6 md:p-8 text-slate-100 space-y-6">
            <button
              onClick={() => setSelectedPlayer(null)}
              className="absolute right-6 top-6 text-slate-400 hover:text-[#CCFF00] transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Player Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1E2333] pb-5">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#CCFF00]/15 border border-[#CCFF00]/30 flex items-center justify-center text-[#CCFF00] font-black text-lg shadow-[0_0_12px_rgba(204,255,0,0.2)]">
                  {selectedPlayer.lastName.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-black text-white">
                    {selectedPlayer.firstName} {selectedPlayer.lastName}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {selectedPlayer.teamName} • Girone {selectedPlayer.girone}
                  </p>
                </div>
              </div>

              {/* Player edit trigger */}
              <div>
                {isEditingPlayer ? (
                  <div className="flex gap-2">
                    <button
                      onClick={handleSavePlayerEdit}
                      className="flex items-center gap-1.5 px-4 py-2 bg-[#CCFF00] hover:bg-[#D8FF33] text-black font-black text-xs rounded-xl shadow-[0_0_12px_rgba(204,255,0,0.35)] transition-all"
                    >
                      <Check className="w-4 h-4" /> Salva Dati
                    </button>
                    <button
                      onClick={() => setIsEditingPlayer(false)}
                      className="px-3.5 py-2 bg-[#141824] hover:bg-[#1E2435] text-slate-300 text-xs font-bold rounded-xl border border-[#212638] transition-all"
                    >
                      Annulla
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsEditingPlayer(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-[#141824] hover:bg-[#1E2435] text-slate-200 border border-[#212638] font-bold text-xs rounded-xl transition-all"
                  >
                    <Edit3 className="w-4 h-4 text-[#CCFF00]" /> Modifica Dati & Tag
                  </button>
                )}
              </div>
            </div>

            {/* Player Stats Grid */}
            <div className="grid grid-cols-4 gap-2.5 text-center text-xs">
              <div className="p-3 bg-[#11141D] rounded-xl border border-[#212638]">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Ruolo</span>
                <span className="font-black text-[#CCFF00] text-sm mt-0.5 block">{selectedPlayer.role}</span>
              </div>
              <div className="p-3 bg-[#11141D] rounded-xl border border-[#212638]">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Presenze</span>
                <span className="font-black text-white text-sm mt-0.5 block">{selectedPlayer.appearances || 0}</span>
              </div>
              <div className="p-3 bg-[#11141D] rounded-xl border border-[#212638]">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Ammonizioni</span>
                <span className="font-black text-yellow-400 text-sm mt-0.5 block">{selectedPlayer.yellowCards} 🟨</span>
              </div>
              <div className="p-3 bg-[#11141D] rounded-xl border border-[#212638]">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Espulsioni</span>
                <span className="font-black text-rose-400 text-sm mt-0.5 block">{selectedPlayer.redCards} 🟥</span>
              </div>
            </div>

            {/* Custom Tags Section */}
            <div className="p-4 rounded-2xl bg-[#11141D] border border-[#212638] space-y-2.5">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                Tag Arbitrali Personalizzati
              </h4>
              {isEditingPlayer ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {AVAILABLE_TAGS.map((tag) => {
                    const isChecked = editPlayerForm.customTags?.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleTogglePlayerTag(tag)}
                        className={`p-2.5 rounded-xl border text-left text-xs font-bold flex items-center justify-between transition-all ${
                          isChecked
                            ? 'bg-[#CCFF00]/15 text-[#CCFF00] border-[#CCFF00]/50 shadow-[0_0_10px_rgba(204,255,0,0.15)]'
                            : 'bg-[#141824] text-slate-400 border-[#212638] hover:border-slate-600'
                        }`}
                      >
                        <span>{tag}</span>
                        {isChecked && <Check className="w-3.5 h-3.5 text-[#CCFF00]" />}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedPlayer.customTags.length > 0 ? (
                    selectedPlayer.customTags.map((t, idx) => <TagBadge key={idx} tag={t} />)
                  ) : (
                    <span className="text-xs text-slate-500 italic">Nessun tag disciplinare assegnato.</span>
                  )}
                </div>
              )}
            </div>

            {/* Note Riservate sul Calciatore */}
            <div className="p-5 rounded-2xl bg-[#11141D] border border-[#212638] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#CCFF00]" />
                    Note Riservate sul Calciatore ({playerNotes.length})
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Annotazioni riservate per la direzione di gara e lo storico comportamentale
                  </p>
                </div>
                <button
                  onClick={() => handleAddNoteForPlayer(selectedPlayer)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#CCFF00] hover:bg-[#D8FF33] text-black font-black text-xs shadow-[0_0_12px_rgba(204,255,0,0.35)] transition-all"
                >
                  <Plus className="w-4 h-4" /> Aggiungi Nota
                </button>
              </div>

              {playerNotes.length > 0 ? (
                <div className="space-y-3">
                  {playerNotes.map((note) => (
                    <div
                      key={note.id}
                      className="p-3.5 rounded-xl bg-[#0D0F16] border border-[#212638] text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-black ${
                              note.priority === 'HIGH'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-[#141824] text-slate-300 border border-[#212638]'
                            }`}
                          >
                            Priorità {note.priority}
                          </span>
                          {note.isPublic === false ? (
                            <span className="flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              <Lock className="w-2.5 h-2.5 text-amber-400" /> Privata
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded bg-[#CCFF00]/10 text-[#CCFF00] border border-[#CCFF00]/30">
                              <Globe className="w-2.5 h-2.5 text-[#CCFF00]" /> Pubblica
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-mono text-slate-500">
                            {new Date(note.createdAt).toLocaleDateString('it-IT')}
                          </span>
                          {user && note.authorId && note.authorId.toLowerCase() === user.username.toLowerCase() ? (
                            <>
                              <button
                                onClick={() => handleEditNote(note)}
                                className="text-slate-400 hover:text-[#CCFF00] flex items-center gap-1 font-semibold transition-colors"
                              >
                                <Edit3 className="w-3.5 h-3.5" /> Modifica
                              </button>
                              <button
                                onClick={() => handleDeleteNote(note.id, true)}
                                className="text-slate-400 hover:text-rose-400 flex items-center gap-1 font-semibold transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Elimina
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] text-slate-500 italic flex items-center gap-1">
                              <Lock className="w-3 h-3 text-slate-600" /> Sola lettura
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Author info */}
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-0.5">
                        <span className="font-bold text-white">{note.authorName || note.authorId}</span>
                        {note.authorRole && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-black bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/30">
                            {note.authorRole}
                          </span>
                        )}
                        {note.authorSection && <span className="text-slate-500">• {note.authorSection}</span>}
                      </div>

                      <p className="text-slate-200 whitespace-pre-line leading-relaxed">{note.content}</p>

                      {note.attachments && note.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {note.attachments.map((att, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                const isImg = att.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i);
                                setActiveViewerMedia({
                                  url: att,
                                  title: `${selectedPlayer.firstName} ${selectedPlayer.lastName} - Allegato ${i + 1}`,
                                  subtitle: `Nota arbitrale di ${note.authorName || 'Arbitro'}`,
                                  description: note.content,
                                  mediaType: isImg ? 'image' : 'video',
                                });
                                setIsViewerOpen(true);
                              }}
                              className="inline-flex items-center gap-1 text-[10px] text-[#CCFF00] bg-[#141824] border border-[#212638] px-2.5 py-1 rounded-lg hover:border-[#CCFF00]/40 transition-colors"
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
                <div className="py-6 text-center text-slate-500 text-xs italic bg-[#0D0F16] rounded-xl border border-dashed border-[#212638]">
                  Nessuna nota presente per questo calciatore. Clicca &quot;Aggiungi Nota&quot; per registrare un appunto.
                </div>
              )}
            </div>

            {/* Footer Close */}
            <div className="pt-4 border-t border-[#1C2130] flex justify-end">
              <button
                onClick={() => setSelectedPlayer(null)}
                className="px-5 py-2.5 bg-[#141824] hover:bg-[#1E2435] text-xs font-bold text-slate-300 rounded-xl border border-[#212638] transition-all hover:text-white"
              >
                Chiudi Scheda Calciatore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reusable Note Modal (Create & Edit) */}
      <NoteModal
        isOpen={isNoteModalOpen}
        onClose={() => {
          setIsNoteModalOpen(false);
          setEditingNote(null);
        }}
        initialTargetType={noteModalTargetType}
        initialTargetId={noteModalTargetId}
        initialTargetName={noteModalTargetName}
        existingNote={editingNote}
        onSave={handleSaveNote}
      />

      {/* Video Modal */}
      <VideoModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        initialTargetType={videoModalTargetType}
        initialTargetId={videoModalTargetId}
        initialTargetName={videoModalTargetName}
        onSave={(data) => {
          DbService.addVideo(data);
          setIsVideoModalOpen(false);
        }}
      />

      {/* Universal In-App Media Viewer Modal */}
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
}

export default function SquadrePage() {
  return (
    <React.Suspense fallback={<div className="py-20 text-center text-slate-500 text-xs">Caricamento squadre e rose...</div>}>
      <SquadreContent />
    </React.Suspense>
  );
}
