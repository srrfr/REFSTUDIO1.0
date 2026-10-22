'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Activity,
  Sparkles,
  Info,
  Filter,
  Layers,
  Camera,
  Play,
  Clock,
  Film,
  Image as ImageIcon,
  ArrowUpDown,
  Gavel,
  ShieldAlert,
  ExternalLink,
} from 'lucide-react';
import { DbService } from '@/lib/repository/db-service';
import { Team, Player, Note, VideoClip, RefereeCustomTag, Match, StandingRow, BenchAttitudeTag, BENCH_ATTITUDE_TAGS, TeamStaffSanction } from '@/types/refstudio';
import { BenchAttitudeBadge, getBenchAttitudeMeta } from '@/components/common/BenchAttitudeBadge';
import {
  RosterSortField,
  SortDirection,
  ROSTER_SORT_OPTIONS,
  sortRoster,
  matchesRosterRole,
  getPlayerBirthYear,
  getPlayerEffectiveAge,
  getRoleWeight,
  getRolePluralLabel,
  getRoleIcon,
} from '@/lib/utils/roster-sort';
import { RatingStars } from '@/components/common/RatingStars';
import { RoleBadge } from '@/components/common/RoleBadge';
import { TagBadge } from '@/components/common/TagBadge';
import { TeamBadge, PlayerBadge, CoachBadge } from '@/components/common/AvatarBadge';
import { PlayerDisciplinaryAlert } from '@/components/common/PlayerDisciplinaryAlert';
import { useAuth } from '@/lib/auth/auth-context';
import { NoteModal } from '@/components/modals/NoteModal';
import { StaffNoteModal } from '@/components/modals/StaffNoteModal';
import { VideoModal } from '@/components/modals/VideoModal';
import { MediaViewerModal, MediaViewerItem } from '@/components/media/MediaViewerModal';
import { AvatarUrlModal } from '@/components/modals/AvatarUrlModal';
import { PlayerNotesBadge } from '@/components/common/PlayerNotesBadge';
import { buildPlayersMediaMap } from '@/lib/utils/player-notes';
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

type ViewStep = 'CATEGORY' | 'GIRONE' | 'TEAMS';

function SquadreContent() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') || '';

  // Step di Navigazione:
  // 1: 'CATEGORY' -> Selezione Categoria (al momento Eccellenza)
  // 2: 'GIRONE'   -> Selezione Girone (A o B)
  // 3: 'TEAMS'    -> Visualizzazione Squadre & Rose
  const [viewStep, setViewStep] = useState<ViewStep>(initialQ ? 'TEAMS' : 'CATEGORY');
  const [selectedCategory, setSelectedCategory] = useState<'eccellenza'>('eccellenza');

  const { user, isAdmin } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [allStandings, setAllStandings] = useState<StandingRow[]>([]);

  const [gironeFilter, setGironeFilter] = useState<'ALL' | 'A' | 'B'>('ALL');
  const [searchQuery, setSearchQuery] = useState(initialQ);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list'); // Default: elenco snello

  // Selected team state (apre la scheda dettagliata)
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const selectedTeamRef = useRef<Team | null>(null);
  selectedTeamRef.current = selectedTeam;

  const [activeTeamTab, setActiveTeamTab] = useState<'FORMA' | 'ROSA' | 'NOTE' | 'VIDEO' | 'VALUTAZIONI'>('FORMA');
  const [teamRoster, setTeamRoster] = useState<Player[]>([]);
  const [teamNotes, setTeamNotes] = useState<Note[]>([]);
  const [teamVideos, setTeamVideos] = useState<VideoClip[]>([]);
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterRoleFilter, setRosterRoleFilter] = useState<string>('ALL');
  const [rosterSortField, setRosterSortField] = useState<RosterSortField>('ROLE');
  const [rosterSortDirection, setRosterSortDirection] = useState<SortDirection>('asc');

  // Team Admin edit mode
  const [isEditingTeam, setIsEditingTeam] = useState(false);
  const [editTeamForm, setEditTeamForm] = useState<Partial<Team>>({});

  // Selected Player from Roster state
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const selectedPlayerRef = useRef<Player | null>(null);
  selectedPlayerRef.current = selectedPlayer;

  const [playerNotes, setPlayerNotes] = useState<Note[]>([]);
  const [playerVideos, setPlayerVideos] = useState<VideoClip[]>([]);
  const [isEditingPlayer, setIsEditingPlayer] = useState(false);
  const [editPlayerForm, setEditPlayerForm] = useState<Partial<Player>>({});

  // Handlers robusti per chiusura schede e modali
  const handleCloseTeam = useCallback(() => {
    setSelectedTeam(null);
    setSelectedPlayer(null);
    setIsEditingTeam(false);
    setIsEditingPlayer(false);
  }, []);

  const handleClosePlayer = useCallback(() => {
    setSelectedPlayer(null);
    setIsEditingPlayer(false);
  }, []);

  // Note Modal state
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteModalTargetType, setNoteModalTargetType] = useState<'squadra' | 'giocatore'>('squadra');
  const [noteModalTargetId, setNoteModalTargetId] = useState('');
  const [noteModalTargetName, setNoteModalTargetName] = useState('');
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  // Staff / Coach Note Modal state (Profilo Arbitrale)
  const [staffNotes, setStaffNotes] = useState<Note[]>([]);
  const [isStaffNoteModalOpen, setIsStaffNoteModalOpen] = useState(false);
  const [editingStaffNote, setEditingStaffNote] = useState<Note | null>(null);

  // Video Modal state
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<VideoClip | null>(null);
  const [videoModalTargetType, setVideoModalTargetType] = useState<'squadra' | 'giocatore'>('squadra');
  const [videoModalTargetId, setVideoModalTargetId] = useState('');
  const [videoModalTargetName, setVideoModalTargetName] = useState('');

  // In-App Media Viewer State
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [activeViewerMedia, setActiveViewerMedia] = useState<MediaViewerItem | null>(null);

  // Avatar / Logo URL Modal state
  const [avatarModalState, setAvatarModalState] = useState<{
    isOpen: boolean;
    type: 'team' | 'player' | 'coach';
    id: string;
    title: string;
    subtitle?: string;
    currentUrl?: string;
    role?: string;
  }>({
    isOpen: false,
    type: 'team',
    id: '',
    title: '',
  });

  const handleOpenAvatarModal = (
    type: 'team' | 'player' | 'coach',
    id: string,
    title: string,
    currentUrl?: string,
    subtitle?: string,
    role?: string
  ) => {
    setAvatarModalState({
      isOpen: true,
      type,
      id,
      title,
      currentUrl: currentUrl || '',
      subtitle,
      role,
    });
  };

  const handleSaveAvatarUrl = async (newUrl: string) => {
    const { type, id } = avatarModalState;
    if (type === 'team') {
      const updated = await DbService.updateTeamAsync(id, { logoUrl: newUrl });
      if (selectedTeam && selectedTeam.id === id) {
        setSelectedTeam(updated);
        setEditTeamForm((prev) => ({ ...prev, logoUrl: newUrl }));
      }
      loadAllData();
    } else if (type === 'coach') {
      const updated = await DbService.updateTeamAsync(id, { coachPhotoUrl: newUrl });
      if (selectedTeam && selectedTeam.id === id) {
        setSelectedTeam(updated);
        setEditTeamForm((prev) => ({ ...prev, coachPhotoUrl: newUrl }));
      }
      loadAllData();
    } else if (type === 'player') {
      const updated = await DbService.updatePlayerAsync(id, { photoUrl: newUrl });
      if (selectedPlayer && selectedPlayer.id === id) {
        setSelectedPlayer(updated);
        setEditPlayerForm((prev) => ({ ...prev, photoUrl: newUrl }));
      }
      setTeamRoster((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    }
  };

  // Caricamento dati con dipendenze stabili: evita loop continui di re-render
  const loadAllData = useCallback(() => {
    const list = DbService.getTeams();
    setTeams(list);

    const matchesList = DbService.getMatches();
    setAllMatches(matchesList);

    const standingsA = DbService.getStandings('A');
    const standingsB = DbService.getStandings('B');
    setAllStandings([...standingsA, ...standingsB]);

    // Se c'è una scheda squadra aperta, aggiorna i dati correlati senza forzare setState ridondanti
    const currentTeam = selectedTeamRef.current;
    if (currentTeam) {
      const freshTeam = DbService.getTeamById(currentTeam.id);
      if (freshTeam && JSON.stringify(freshTeam) !== JSON.stringify(currentTeam)) {
        setSelectedTeam(freshTeam);
      }
      setTeamRoster(DbService.getPlayers(currentTeam.id));
      const allTeamNotes = DbService.getNotes(undefined, currentTeam.id, user?.username);
      setTeamNotes(allTeamNotes.filter((n) => n.targetType === 'squadra'));
      setStaffNotes(
        allTeamNotes.filter((n) => n.targetType === 'allenatore' || n.targetType === 'dirigente')
      );
      setTeamVideos(DbService.getVideos('squadra', currentTeam.id));
    }

    // Se c'è una scheda calciatore aperta, aggiorna i dati correlati
    const currentPlayer = selectedPlayerRef.current;
    if (currentPlayer) {
      const freshPlayer = DbService.getPlayerById(currentPlayer.id);
      if (freshPlayer && JSON.stringify(freshPlayer) !== JSON.stringify(currentPlayer)) {
        setSelectedPlayer(freshPlayer);
      }
      setPlayerNotes(DbService.getNotes('giocatore', currentPlayer.id, user?.username));
      setPlayerVideos(DbService.getVideos('giocatore', currentPlayer.id, `${currentPlayer.firstName} ${currentPlayer.lastName}`));
    }
  }, [user?.username]);

  // Sottoscrizione Realtime multi-dispositivo (ora stabile e priva di cicli)
  useRealtimeSync(loadAllData);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Chiusura automatica di tutte le schede e modali con il tasto Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (avatarModalState.isOpen) {
          setAvatarModalState((prev) => ({ ...prev, isOpen: false }));
        } else if (isViewerOpen) {
          setIsViewerOpen(false);
        } else if (isStaffNoteModalOpen) {
          setIsStaffNoteModalOpen(false);
          setEditingStaffNote(null);
        } else if (isNoteModalOpen) {
          setIsNoteModalOpen(false);
        } else if (isVideoModalOpen) {
          setIsVideoModalOpen(false);
        } else if (selectedPlayer) {
          handleClosePlayer();
        } else if (selectedTeam) {
          handleCloseTeam();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [avatarModalState.isOpen, isViewerOpen, isStaffNoteModalOpen, isNoteModalOpen, isVideoModalOpen, selectedPlayer, selectedTeam, handleClosePlayer, handleCloseTeam]);

  useEffect(() => {
    if (initialQ) {
      setSearchQuery(initialQ);
      setViewStep('TEAMS');
    }
  }, [initialQ]);

  const handleSelectCategory = (cat: 'eccellenza') => {
    setSelectedCategory(cat);
    setViewStep('GIRONE');
  };

  const handleSelectGirone = (girone: 'A' | 'B') => {
    setGironeFilter(girone);
    setViewStep('TEAMS');
  };

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
    const allNotes = DbService.getNotes(undefined, team.id, user?.username);
    setTeamNotes(allNotes.filter((n) => n.targetType === 'squadra'));
    setStaffNotes(
      allNotes.filter((n) => n.targetType === 'allenatore' || n.targetType === 'dirigente')
    );
    setTeamVideos(DbService.getVideos('squadra', team.id));
  };

  // Sincronizzazione automatica Note Video e Note quando vengono create o eliminate
  useEffect(() => {
    const handleSync = () => {
      if (selectedTeam) {
        setTeamVideos(DbService.getVideos('squadra', selectedTeam.id));
        const allNotes = DbService.getNotes(undefined, selectedTeam.id, user?.username);
        setTeamNotes(allNotes.filter((n) => n.targetType === 'squadra'));
        setStaffNotes(
          allNotes.filter((n) => n.targetType === 'allenatore' || n.targetType === 'dirigente')
        );
      }
      if (selectedPlayer) {
        setPlayerVideos(DbService.getVideos('giocatore', selectedPlayer.id, `${selectedPlayer.firstName} ${selectedPlayer.lastName}`));
        setPlayerNotes(DbService.getNotes('giocatore', selectedPlayer.id, user?.username));
      }
    };
    window.addEventListener('refstudio-sync-update', handleSync);
    return () => window.removeEventListener('refstudio-sync-update', handleSync);
  }, [selectedTeam, selectedPlayer, user?.username]);

  const handleSaveTeamEdit = async () => {
    if (!selectedTeam) return;
    try {
      const updated = await DbService.updateTeamAsync(selectedTeam.id, editTeamForm);
      setSelectedTeam(updated);
      setIsEditingTeam(false);
      loadAllData();
    } catch (err) {
      console.error(err);
    }
  };

  const getYoutubeVideoId = (url?: string): string | null => {
    if (!url) return null;
    try {
      if (url.includes('watch?v=')) {
        return url.split('watch?v=')[1].split('&')[0];
      } else if (url.includes('youtu.be/')) {
        return url.split('youtu.be/')[1].split('?')[0];
      } else if (url.includes('embed/')) {
        return url.split('embed/')[1].split('?')[0];
      }
    } catch {
      return null;
    }
    return null;
  };

  const handleAddVideoForPlayer = (player: Player) => {
    setEditingVideo(null);
    setVideoModalTargetType('giocatore');
    setVideoModalTargetId(player.id);
    setVideoModalTargetName(`${player.firstName} ${player.lastName} (${player.teamName})`);
    setIsVideoModalOpen(true);
  };

  const handleEditPlayerVideo = (vid: VideoClip) => {
    setEditingVideo(vid);
    setVideoModalTargetType('giocatore');
    setVideoModalTargetId(vid.targetId);
    setVideoModalTargetName(vid.targetName);
    setIsVideoModalOpen(true);
  };

  const handleDeletePlayerVideo = async (videoId: string) => {
    if (confirm('Sei sicuro di voler eliminare questa nota video?')) {
      try {
        await DbService.deleteVideoAsync(videoId, user?.username, user?.role);
        if (selectedPlayer) {
          setPlayerVideos(DbService.getVideos('giocatore', selectedPlayer.id, `${selectedPlayer.firstName} ${selectedPlayer.lastName}`));
        }
      } catch (err: any) {
        alert(err.message || 'Non sei autorizzato a eliminare questa nota video.');
      }
    }
  };

  const handleEditTeamVideo = (vid: VideoClip) => {
    setEditingVideo(vid);
    setVideoModalTargetType('squadra');
    setVideoModalTargetId(vid.targetId);
    setVideoModalTargetName(vid.targetName);
    setIsVideoModalOpen(true);
  };

  const handleDeleteTeamVideo = async (videoId: string) => {
    if (confirm('Sei sicuro di voler eliminare questo video della squadra?')) {
      try {
        await DbService.deleteVideoAsync(videoId, user?.username, user?.role);
        if (selectedTeam) {
          setTeamVideos(DbService.getVideos('squadra', selectedTeam.id));
        }
      } catch (err: any) {
        alert(err.message || 'Non sei autorizzato a eliminare questo video.');
      }
    }
  };

  // Apertura modale singolo calciatore dalla rosa
  const handleOpenPlayerFromRoster = (player: Player) => {
    setSelectedPlayer(player);
    setEditPlayerForm(player);
    setIsEditingPlayer(false);
    setPlayerNotes(DbService.getNotes('giocatore', player.id, user?.username));
    setPlayerVideos(DbService.getVideos('giocatore', player.id, `${player.firstName} ${player.lastName}`));
  };

  const handleSavePlayerEdit = async () => {
    if (!selectedPlayer) return;
    try {
      const updated = await DbService.updatePlayerAsync(selectedPlayer.id, editPlayerForm);
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

  const handleDeleteNote = async (noteId: string, isPlayerNote: boolean) => {
    if (confirm('Sei sicuro di voler eliminare questa nota?')) {
      try {
        await DbService.deleteNoteAsync(noteId, user?.username);
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
        const allNotes = DbService.getNotes(undefined, selectedTeam.id, user?.username);
        setTeamNotes(allNotes.filter((n) => n.targetType === 'squadra'));
        setStaffNotes(
          allNotes.filter((n) => n.targetType === 'allenatore' || n.targetType === 'dirigente')
        );
      }
      setIsNoteModalOpen(false);
      setEditingNote(null);
    } catch (err: any) {
      alert(err.message || 'Errore durante il salvataggio della nota');
    }
  };

  const handleSaveStaffNote = (noteData: {
    id?: string;
    targetType: 'allenatore' | 'dirigente';
    targetId: string;
    targetName: string;
    content: string;
    priority: 'LOW' | 'NORMAL' | 'HIGH';
    isPublic: boolean;
  }) => {
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

      if (selectedTeam) {
        const allNotes = DbService.getNotes(undefined, selectedTeam.id, user?.username);
        setStaffNotes(
          allNotes.filter((n) => n.targetType === 'allenatore' || n.targetType === 'dirigente')
        );
      }
      setIsStaffNoteModalOpen(false);
      setEditingStaffNote(null);
    } catch (err: any) {
      alert(err.message || 'Errore durante il salvataggio della nota staff');
    }
  };

  const handleDeleteStaffNote = async (noteId: string) => {
    if (confirm('Sei sicuro di voler eliminare questa nota sullo staff?')) {
      try {
        await DbService.deleteNoteAsync(noteId, user?.username);
        if (selectedTeam) {
          const allNotes = DbService.getNotes(undefined, selectedTeam.id, user?.username);
          setStaffNotes(
            allNotes.filter((n) => n.targetType === 'allenatore' || n.targetType === 'dirigente')
          );
        }
      } catch (err: any) {
        alert(err.message || 'Non sei autorizzato a eliminare questa nota.');
      }
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

  // Conteggio calciatori per ruolo nella rosa
  const rosterRoleCounts = useMemo(() => {
    const counts = { ALL: teamRoster.length, POR: 0, DIF: 0, CEN: 0, ATT: 0 };
    teamRoster.forEach((p) => {
      const w = getRoleWeight(p.role);
      if (w === 1) counts.POR++;
      else if (w === 2) counts.DIF++;
      else if (w === 3) counts.CEN++;
      else if (w === 4) counts.ATT++;
    });
    return counts;
  }, [teamRoster]);

  // Handler cambio ordinamento
  const handleToggleRosterSort = useCallback((field: RosterSortField) => {
    setRosterSortField((currentField) => {
      if (currentField === field) {
        setRosterSortDirection((prevDir) => (prevDir === 'asc' ? 'desc' : 'asc'));
        return currentField;
      }
      const option = ROSTER_SORT_OPTIONS.find((o) => o.id === field);
      setRosterSortDirection(option ? option.defaultDirection : 'desc');
      return field;
    });
  }, []);

  // Filtraggio e ordinamento calciatori all'interno della modale rosa
  const filteredRoster = useMemo(() => {
    const filtered = teamRoster.filter((p) => {
      if (!matchesRosterRole(p.role, rosterRoleFilter)) return false;
      if (!rosterSearch) return true;
      const q = rosterSearch.toLowerCase().trim();
      return (
        p.lastName.toLowerCase().includes(q) ||
        p.firstName.toLowerCase().includes(q) ||
        (p.customTags && p.customTags.some((tag) => tag.toLowerCase().includes(q)))
      );
    });

    return sortRoster(filtered, rosterSortField, rosterSortDirection);
  }, [teamRoster, rosterRoleFilter, rosterSearch, rosterSortField, rosterSortDirection]);

  // Mappa delle note e video registrati per ciascun calciatore della rosa
  const rosterMediaMap = useMemo(() => {
    if (!teamRoster || teamRoster.length === 0) return new Map();
    const allNotes = DbService.getNotes('giocatore', undefined, user?.username);
    const allVideos = DbService.getVideos('giocatore');
    return buildPlayersMediaMap(teamRoster, allNotes, allVideos);
  }, [teamRoster, user?.username, playerNotes, playerVideos]);

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

  // =========================================================================
  // STEP 1: SCHEDA SELEZIONE CATEGORIA
  // =========================================================================
  if (viewStep === 'CATEGORY') {
    return (
      <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-200">
        {/* Intestazione Fase 1 */}
        <div className="bg-[#0D0F16] border border-[#1F2433] rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#CCFF00] bg-[#CCFF00]/10 px-2.5 py-0.5 rounded-full border border-[#CCFF00]/30 font-bold">
                Passo 1 di 3 • Selezione Competizione
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-wide flex items-center gap-3">
              <Award className="w-8 h-8 text-[#CCFF00]" />
              Seleziona la Categoria
            </h1>
            <p className="text-sm text-slate-400 mt-2 max-w-2xl">
              Scegli il campionato di riferimento per accedere alla scelta del girone, consultare le rose ufficiali e la scheda informativa delle squadre.
            </p>
          </div>
          <div className="hidden sm:flex flex-col items-center justify-center p-3.5 px-6 rounded-2xl bg-[#141824] border border-[#212638] shadow-lg shrink-0">
            <img
              src="/eccellenza-logo.svg"
              alt="Logo Ufficiale Eccellenza"
              className="w-16 h-16 object-contain filter drop-shadow-[0_4px_14px_rgba(0,23,158,0.5)]"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'https://upload.wikimedia.org/wikipedia/commons/7/7d/Eccellenza_Logo_2026.svg';
              }}
            />
            <span className="text-[10px] font-black text-slate-300 mt-1.5 uppercase tracking-wider font-mono">
              Eccellenza
            </span>
          </div>
        </div>

        {/* Griglia Categorie */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Categoria 1: Eccellenza (ATTIVA) */}
          <div
            onClick={() => handleSelectCategory('eccellenza')}
            className="group relative rounded-3xl bg-gradient-to-b from-[#121622] to-[#0D0F16] border-2 border-[#CCFF00]/40 hover:border-[#CCFF00] p-6 shadow-[0_0_25px_rgba(204,255,0,0.08)] hover:shadow-[0_0_35px_rgba(204,255,0,0.2)] transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-16 h-16 rounded-2xl bg-white/10 p-2.5 border border-[#CCFF00]/40 flex items-center justify-center group-hover:scale-110 group-hover:border-[#CCFF00] transition-all shadow-[0_0_15px_rgba(204,255,0,0.15)] overflow-hidden">
                  <img
                    src="/eccellenza-logo.svg"
                    alt="Logo Ufficiale Eccellenza"
                    className="w-full h-full object-contain filter drop-shadow"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://upload.wikimedia.org/wikipedia/commons/7/7d/Eccellenza_Logo_2026.svg';
                    }}
                  />
                </div>
                <span className="text-[10px] font-mono font-black uppercase text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  Attiva Ora
                </span>
              </div>

              <div>
                <div className="flex items-center gap-2.5">
                  <img
                    src="/eccellenza-logo.svg"
                    alt="Eccellenza"
                    className="w-6 h-6 object-contain drop-shadow"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://upload.wikimedia.org/wikipedia/commons/7/7d/Eccellenza_Logo_2026.svg';
                    }}
                  />
                  <h3 className="text-xl font-black text-white group-hover:text-[#CCFF00] transition-colors">
                    Eccellenza
                  </h3>
                </div>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  CRER • Emilia-Romagna (FIGC - LND)
                </p>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Massima divisione regionale. Gironi A e B da 18 squadre ciascuno, schede club, ultime gare e organici completi.
              </p>

              {/* Statistiche rapide */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1C2232] text-[11px]">
                <div className="bg-[#141824] p-2 rounded-xl border border-[#212638]">
                  <span className="text-slate-400 block text-[10px]">Gironi:</span>
                  <span className="font-mono font-bold text-white">Girone A & B</span>
                </div>
                <div className="bg-[#141824] p-2 rounded-xl border border-[#212638]">
                  <span className="text-slate-400 block text-[10px]">Società:</span>
                  <span className="font-mono font-bold text-[#CCFF00]">36 Squadre</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#1C2232] flex items-center justify-between">
              <span className="text-xs font-black text-[#CCFF00] group-hover:underline">
                Seleziona Categoria
              </span>
              <div className="w-8 h-8 rounded-full bg-[#CCFF00] text-black flex items-center justify-center group-hover:translate-x-1 transition-transform">
                <ArrowRight className="w-4 h-4 font-bold" />
              </div>
            </div>
          </div>

          {/* Categoria 2: Promozione (PROSSIMAMENTE) */}
          <div className="rounded-3xl bg-[#0D0F16]/60 border border-[#1A1F2C] p-6 opacity-60 flex flex-col justify-between cursor-not-allowed">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-[#141824] border border-[#212638] flex items-center justify-center text-slate-500">
                  <Shield className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-mono uppercase text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-full border border-slate-700">
                  In Arrivo
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-300">Promozione</h3>
                <p className="text-xs text-slate-500">Campionato Regionale</p>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Gestione dei gironi regionali di Promozione. La sincronizzazione delle rose sarà abilitata nei prossimi aggiornamenti.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-[#1A1F2C] text-xs text-slate-500 font-mono">
              Disponibile a breve
            </div>
          </div>

          {/* Categoria 3: Prima Categoria (PROSSIMAMENTE) */}
          <div className="rounded-3xl bg-[#0D0F16]/60 border border-[#1A1F2C] p-6 opacity-60 flex flex-col justify-between cursor-not-allowed">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-[#141824] border border-[#212638] flex items-center justify-center text-slate-500">
                  <Layers className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-mono uppercase text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-full border border-slate-700">
                  In Arrivo
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-300">Prima Categoria</h3>
                <p className="text-xs text-slate-500">Campionati Provinciali / Regionali</p>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Campionati di Prima Categoria con schede informative e organici completi.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-[#1A1F2C] text-xs text-slate-500 font-mono">
              Disponibile a breve
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // STEP 2: SCHEDA SELEZIONE GIRONE (Snella, immediata: click su A o su B)
  // =========================================================================
  if (viewStep === 'GIRONE') {
    return (
      <div className="space-y-6 max-w-3xl mx-auto animate-in fade-in duration-200">
        {/* Barra di Navigazione a Ritroso */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setViewStep('CATEGORY')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0D0F16] hover:bg-[#141824] text-slate-300 hover:text-[#CCFF00] border border-[#1F2433] text-xs font-bold transition-all group shadow-sm"
          >
            <ChevronLeft className="w-4 h-4 text-[#CCFF00] group-hover:-translate-x-0.5 transition-transform" />
            <span>← Torna a Categorie</span>
          </button>

          <span className="text-[10px] font-mono uppercase tracking-wider text-[#CCFF00] bg-[#CCFF00]/10 px-3 py-1 rounded-full border border-[#CCFF00]/30 font-bold">
            Passo 2 di 3 • Selezione Girone
          </span>
        </div>

        {/* Intestazione Rapida */}
        <div className="bg-[#0D0F16] border border-[#1F2433] rounded-3xl p-6 text-center shadow-xl space-y-3 flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-white/10 p-2 border border-[#212638] flex items-center justify-center shadow-md">
            <img
              src="/eccellenza-logo.svg"
              alt="Logo Eccellenza"
              className="w-full h-full object-contain filter drop-shadow-[0_4px_12px_rgba(0,23,158,0.4)]"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'https://upload.wikimedia.org/wikipedia/commons/7/7d/Eccellenza_Logo_2026.svg';
              }}
            />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-wide">
              Seleziona il Girone
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Eccellenza Emilia-Romagna • Clicca sul girone desiderato per consultare le squadre
            </p>
          </div>
        </div>

        {/* Selezione Rapida A o B (identica a Partite & Classifiche) */}
        <div className="grid grid-cols-2 gap-4 sm:gap-6">
          {/* Pulsante Girone A */}
          <button
            onClick={() => handleSelectGirone('A')}
            className="group relative rounded-3xl bg-gradient-to-b from-[#121622] to-[#0D0F16] border-2 border-[#212638] hover:border-[#CCFF00] p-6 sm:p-10 shadow-xl hover:shadow-[0_0_35px_rgba(204,255,0,0.22)] transition-all flex flex-col items-center justify-center space-y-4 active:scale-95 text-center cursor-pointer"
          >
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-[#CCFF00]/15 border border-[#CCFF00]/40 flex items-center justify-center text-3xl sm:text-4xl font-black text-[#CCFF00] group-hover:scale-110 transition-transform shadow-inner">
              A
            </div>
            <div>
              <span className="text-xl sm:text-2xl font-black text-white group-hover:text-[#CCFF00] transition-colors block">
                Girone A
              </span>
              <span className="text-xs font-mono text-slate-400 font-semibold mt-0.5 block">
                18 Squadre
              </span>
            </div>
            <div className="w-full pt-3 border-t border-[#1C2232] flex items-center justify-center gap-1 text-xs font-bold text-[#CCFF00] group-hover:underline">
              <span>Seleziona</span>
              <ArrowRight className="w-3.5 h-3.5 font-bold group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Pulsante Girone B */}
          <button
            onClick={() => handleSelectGirone('B')}
            className="group relative rounded-3xl bg-gradient-to-b from-[#121622] to-[#0D0F16] border-2 border-[#212638] hover:border-[#CCFF00] p-6 sm:p-10 shadow-xl hover:shadow-[0_0_35px_rgba(204,255,0,0.22)] transition-all flex flex-col items-center justify-center space-y-4 active:scale-95 text-center cursor-pointer"
          >
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-[#CCFF00]/15 border border-[#CCFF00]/40 flex items-center justify-center text-3xl sm:text-4xl font-black text-[#CCFF00] group-hover:scale-110 transition-transform shadow-inner">
              B
            </div>
            <div>
              <span className="text-xl sm:text-2xl font-black text-white group-hover:text-[#CCFF00] transition-colors block">
                Girone B
              </span>
              <span className="text-xs font-mono text-slate-400 font-semibold mt-0.5 block">
                18 Squadre
              </span>
            </div>
            <div className="w-full pt-3 border-t border-[#1C2232] flex items-center justify-center gap-1 text-xs font-bold text-[#CCFF00] group-hover:underline">
              <span>Seleziona</span>
              <ArrowRight className="w-3.5 h-3.5 font-bold group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // STEP 3: SCHEDA SQUADRE & ROSE (Visualizzazione originale intatta con back bar)
  // =========================================================================
  return (
    <div className="space-y-6">
      {/* 0. BARRA DI NAVIGAZIONE A RITROSO */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0D0F16] border border-[#1F2433] rounded-2xl px-5 py-3 shadow-md">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSelectedTeam(null);
              setViewStep('GIRONE');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141824] hover:bg-[#1E2435] text-slate-200 hover:text-[#CCFF00] border border-[#212638] text-xs font-bold transition-all shadow-sm group"
            title="Torna alla selezione del Girone"
          >
            <ChevronLeft className="w-4 h-4 text-[#CCFF00] group-hover:-translate-x-0.5 transition-transform" />
            <span>Cambia Girone</span>
          </button>

          <button
            onClick={() => {
              setSelectedTeam(null);
              setViewStep('CATEGORY');
            }}
            className="px-2.5 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-[#141824] transition-colors"
            title="Torna alla selezione Categoria"
          >
            ← Categoria
          </button>

          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 ml-2">
            <span className="text-slate-600">•</span>
            <img
              src="/eccellenza-logo.svg"
              alt="Logo Eccellenza"
              className="w-4 h-4 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'https://upload.wikimedia.org/wikipedia/commons/7/7d/Eccellenza_Logo_2026.svg';
              }}
            />
            <span className="font-semibold text-slate-300">Eccellenza</span>
            <span className="text-slate-600">/</span>
            <span className="font-black text-[#CCFF00]">
              {gironeFilter === 'ALL' ? 'Tutti i Gironi' : `Girone ${gironeFilter}`}
            </span>
            <span className="text-slate-500 font-mono text-[11px]">
              {gironeFilter === 'ALL' ? '(36 Squadre)' : '(18 Squadre)'}
            </span>
          </div>
        </div>

        {/* Girone quick pill toggle */}
        <div className="flex items-center gap-1 bg-[#11141D] border border-[#212638] p-1 rounded-xl">
          <button
            onClick={() => setGironeFilter('A')}
            className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
              gironeFilter === 'A'
                ? 'bg-[#CCFF00] text-black shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Girone A
          </button>
          <button
            onClick={() => setGironeFilter('B')}
            className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
              gironeFilter === 'B'
                ? 'bg-[#CCFF00] text-black shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Girone B
          </button>
          <button
            onClick={() => setGironeFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              gironeFilter === 'ALL'
                ? 'bg-[#1E2435] text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Tutti
          </button>
        </div>
      </div>

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
                          <TeamBadge
                            name={team.name}
                            logoUrl={team.logoUrl}
                            size="md"
                            className="group-hover:scale-105 group-hover:border-[#CCFF00]/50"
                          />
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
                      <TeamBadge
                        name={team.name}
                        logoUrl={team.logoUrl}
                        size="lg"
                        className="group-hover:scale-105 group-hover:border-[#CCFF00]/50"
                      />
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-5 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseTeam();
          }}
        >
          <div
            className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-3xl bg-[#0D0F16] border border-[#212638] shadow-2xl p-5 sm:p-7 text-slate-100 space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Testata della Scheda */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1E2333] pb-5 pt-1">
              <div className="flex items-center gap-3.5">
                <div className="relative group/teamlogo">
                  <TeamBadge
                    name={selectedTeam.name}
                    logoUrl={selectedTeam.logoUrl}
                    size="xl"
                    className="shadow-[0_0_15px_rgba(204,255,0,0.3)] cursor-pointer"
                    onClick={() =>
                      handleOpenAvatarModal(
                        'team',
                        selectedTeam.id,
                        selectedTeam.name,
                        selectedTeam.logoUrl,
                        `Girone ${selectedTeam.girone}`
                      )
                    }
                    showEditOverlay={true}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      handleOpenAvatarModal(
                        'team',
                        selectedTeam.id,
                        selectedTeam.name,
                        selectedTeam.logoUrl,
                        `Girone ${selectedTeam.girone}`
                      )
                    }
                    className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-[#161B26] hover:bg-[#CCFF00] text-slate-300 hover:text-black border border-[#2B3245] shadow-md transition-all cursor-pointer"
                    title="Modifica Logo Squadra (URL)"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
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
                    {selectedTeam.benchAttitude && selectedTeam.benchAttitude !== 'Da valutare' && (
                      <span className="inline-flex ml-1.5">
                        <BenchAttitudeBadge attitude={selectedTeam.benchAttitude} size="xs" />
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Box Classifica Rapido + Tasto Chiudi */}
              <div className="flex items-center gap-2.5 self-end md:self-center shrink-0">
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

                <button
                  type="button"
                  onClick={handleCloseTeam}
                  className="p-2.5 rounded-2xl bg-[#141824] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-[#212638] hover:border-rose-500/40 transition-all cursor-pointer shadow-md shrink-0 active:scale-95"
                  title="Chiudi Scheda (Esc)"
                  aria-label="Chiudi Scheda"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
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
                <FileText className="w-3.5 h-3.5" /> Note Arbitrali ({teamNotes.length})
              </button>
              <button
                onClick={() => setActiveTeamTab('VIDEO')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                  activeTeamTab === 'VIDEO'
                    ? 'bg-[#CCFF00] text-black shadow-[0_0_12px_rgba(204,255,0,0.3)]'
                    : 'text-slate-400 hover:text-white bg-[#11141D] border border-[#212638]'
                }`}
              >
                <Video className="w-3.5 h-3.5" /> Note Video ({teamVideos.length})
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
                {selectedTeam.staffSanctions && selectedTeam.staffSanctions.length > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                      activeTeamTab === 'VALUTAZIONI'
                        ? 'bg-black text-[#CCFF00]'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}
                    title={`${selectedTeam.staffSanctions.length} provvedimenti disciplinari staff/allenatori`}
                  >
                    {selectedTeam.staffSanctions.length}
                  </span>
                )}
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
                      { id: 'ALL', label: `Tutti (${rosterRoleCounts.ALL})` },
                      { id: 'POR', label: `🧤 Portieri (${rosterRoleCounts.POR})` },
                      { id: 'DIF', label: `🛡️ Difensori (${rosterRoleCounts.DIF})` },
                      { id: 'CEN', label: `⚙️ Centrocampisti (${rosterRoleCounts.CEN})` },
                      { id: 'ATT', label: `⚡ Attaccanti (${rosterRoleCounts.ATT})` },
                    ].map((rf) => (
                      <button
                        key={rf.id}
                        type="button"
                        onClick={() => setRosterRoleFilter(rf.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                          rosterRoleFilter === rf.id
                            ? 'bg-[#CCFF00] text-black font-black shadow-[0_0_10px_rgba(204,255,0,0.3)]'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {rf.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sort Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-2xl bg-[#0D0F16] border border-[#212638] shadow-md">
                  <div className="flex items-center gap-2 text-xs font-bold shrink-0">
                    <ArrowUpDown className="w-4 h-4 text-[#CCFF00]" />
                    <span className="text-[11px] uppercase tracking-wider text-slate-400 font-black">
                      Ordina Calciatori:
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {ROSTER_SORT_OPTIONS.map((opt) => {
                      const isActive = rosterSortField === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleToggleRosterSort(opt.id)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                            isActive
                              ? 'bg-[#CCFF00] text-black font-black shadow-[0_0_12px_rgba(204,255,0,0.35)]'
                              : 'bg-[#141824] text-slate-300 hover:text-white hover:bg-[#1C2233] border border-[#23293D]'
                          }`}
                          title={`Ordina per ${opt.label} (${
                            isActive
                              ? rosterSortDirection === 'asc'
                                ? 'Crescente - Clicca per invertire'
                                : 'Decrescente - Clicca per invertire'
                              : 'Clicca per ordinare'
                          })`}
                        >
                          <span>{opt.label}</span>
                          {isActive && (
                            <span className="font-mono text-[10px] ml-0.5 font-black bg-black/15 px-1 py-0.2 rounded">
                              {rosterSortDirection === 'asc' ? '▲ ASC' : '▼ DESC'}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Roster Table / List */}
                <div className="max-h-[58vh] overflow-y-auto rounded-2xl border border-[#212638] bg-[#0A0C10] shadow-xl">
                  {/* Intestazione Colonne Interattiva */}
                  <div className="sticky top-0 z-10 px-4 py-2.5 bg-[#0F131D] border-b border-[#212638] flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400 select-none">
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => handleToggleRosterSort('ROLE')}
                        className={`flex items-center gap-1 hover:text-[#CCFF00] transition-colors ${
                          rosterSortField === 'ROLE' ? 'text-[#CCFF00]' : ''
                        }`}
                        title="Ordina per Ruolo (Portieri ➔ Attaccanti)"
                      >
                        <span>Calciatore & Ruolo</span>
                        {rosterSortField === 'ROLE' && (
                          <span className="font-mono">{rosterSortDirection === 'asc' ? '▲' : '▼'}</span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleRosterSort('BIRTH_YEAR')}
                        className={`flex items-center gap-1 hover:text-[#CCFF00] transition-colors ${
                          rosterSortField === 'BIRTH_YEAR' ? 'text-[#CCFF00]' : ''
                        }`}
                        title="Ordina per Anno di Nascita o Età"
                      >
                        <span>Anno / Età</span>
                        {rosterSortField === 'BIRTH_YEAR' && (
                          <span className="font-mono">{rosterSortDirection === 'asc' ? '▲' : '▼'}</span>
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-4 font-mono">
                      <button
                        type="button"
                        onClick={() => handleToggleRosterSort('APPEARANCES')}
                        className={`hover:text-[#CCFF00] transition-colors ${
                          rosterSortField === 'APPEARANCES' ? 'text-[#CCFF00] font-black' : ''
                        }`}
                        title="Ordina per Presenze"
                      >
                        Presenze {rosterSortField === 'APPEARANCES' && (rosterSortDirection === 'asc' ? '▲' : '▼')}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleRosterSort('GOALS')}
                        className={`hover:text-emerald-400 transition-colors ${
                          rosterSortField === 'GOALS' ? 'text-emerald-400 font-black' : ''
                        }`}
                        title="Ordina per Reti segnate"
                      >
                        Reti ⚽ {rosterSortField === 'GOALS' && (rosterSortDirection === 'asc' ? '▲' : '▼')}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleRosterSort('YELLOW_CARDS')}
                        className={`hover:text-yellow-400 transition-colors ${
                          rosterSortField === 'YELLOW_CARDS' ? 'text-yellow-400 font-black' : ''
                        }`}
                        title="Ordina per Cartellini Gialli"
                      >
                        Gialli 🟨 {rosterSortField === 'YELLOW_CARDS' && (rosterSortDirection === 'asc' ? '▲' : '▼')}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleRosterSort('RED_CARDS')}
                        className={`hover:text-rose-400 transition-colors ${
                          rosterSortField === 'RED_CARDS' ? 'text-rose-400 font-black' : ''
                        }`}
                        title="Ordina per Cartellini Rossi"
                      >
                        Rossi 🟥 {rosterSortField === 'RED_CARDS' && (rosterSortDirection === 'asc' ? '▲' : '▼')}
                      </button>
                    </div>
                  </div>

                  {filteredRoster.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs italic">
                      Nessun calciatore corrisponde ai filtri di ricerca.
                    </div>
                  ) : (
                    <div className="divide-y divide-[#1C2130]">
                      {filteredRoster.map((player, idx) => {
                        const birthYear = getPlayerBirthYear(player);
                        const age = getPlayerEffectiveAge(player);

                        // Intestazione gruppo ruolo se ordinato per RUOLO e filtro su TUTTI
                        const showRoleDivider =
                          rosterSortField === 'ROLE' &&
                          rosterRoleFilter === 'ALL' &&
                          (idx === 0 ||
                            getRoleWeight(player.role) !==
                              getRoleWeight(filteredRoster[idx - 1].role));
                        const currentWeight = getRoleWeight(player.role);

                        return (
                          <React.Fragment key={player.id}>
                            {showRoleDivider && (
                              <div className="px-4 py-2 bg-[#121622]/90 border-y border-[#1E2436] flex items-center justify-between text-xs font-black uppercase tracking-wider text-[#CCFF00]">
                                <span className="flex items-center gap-1.5">
                                  <span>{getRoleIcon(currentWeight)}</span>
                                  <span>{getRolePluralLabel(currentWeight)}</span>
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono font-normal">
                                  {filteredRoster.filter((p) => getRoleWeight(p.role) === currentWeight).length} calciatori
                                </span>
                              </div>
                            )}

                            <div
                              onClick={() => handleOpenPlayerFromRoster(player)}
                              className={`p-3.5 flex items-center justify-between text-xs hover:bg-[#CCFF00]/10 cursor-pointer transition-colors group ${
                                player.disciplinaryStatus === 'SQUALIFICATO'
                                  ? 'bg-rose-950/20 hover:bg-rose-950/30 border-l-2 border-rose-500'
                                  : player.disciplinaryStatus === 'DIFFIDATO'
                                  ? 'bg-amber-950/20 hover:bg-amber-950/30 border-l-2 border-amber-400'
                                  : ''
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <PlayerBadge
                                  player={player}
                                  firstName={player.firstName}
                                  lastName={player.lastName}
                                  photoUrl={player.photoUrl}
                                  role={player.role}
                                  teamName={selectedTeam.name}
                                  size="sm"
                                />
                                <RoleBadge role={player.role} />
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-bold text-white group-hover:text-[#CCFF00] transition-colors">
                                      {player.lastName} {player.firstName}
                                    </span>
                                    <PlayerDisciplinaryAlert player={player} variant="badge" />
                                    {(() => {
                                      const summary = rosterMediaMap.get(player.id);
                                      if (!summary || !summary.hasMedia) return null;
                                      return (
                                        <PlayerNotesBadge
                                          textCount={summary.textCount}
                                          videoCount={summary.videoCount}
                                        />
                                      );
                                    })()}
                                  </div>
                                  {(birthYear > 0 || age !== undefined) && (
                                    <span className="text-slate-400 text-[11px] font-mono block">
                                      ({age ? `${age} anni` : ''}
                                      {birthYear > 0 ? (age ? ` • ${birthYear}` : `Nato: ${birthYear}`) : ''})
                                    </span>
                                  )}

                                  {/* Provvedimento Disciplinare: Squalifica con motivazione o Alert Diffida */}
                                  {(player.disciplinaryStatus === 'SQUALIFICATO' || player.disciplinaryStatus === 'DIFFIDATO') && (
                                    <div className="mt-1.5 max-w-lg">
                                      <PlayerDisciplinaryAlert player={player} variant="compact" />
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                {player.customTags && player.customTags.length > 0 && (
                                  <div className="hidden md:flex gap-1">
                                    {player.customTags.map((t, tIdx) => (
                                      <TagBadge key={tIdx} tag={t} size="sm" />
                                    ))}
                                  </div>
                                )}

                                <div className="flex items-center gap-2 sm:gap-3 text-slate-400 font-mono text-xs">
                                  <span
                                    className={`px-2 py-0.5 rounded font-semibold ${
                                      rosterSortField === 'APPEARANCES'
                                        ? 'bg-[#CCFF00]/15 text-[#CCFF00] font-black border border-[#CCFF00]/30'
                                        : 'text-slate-300'
                                    }`}
                                  >
                                    {player.appearances || 0} pres
                                  </span>

                                  <span
                                    className={`px-2 py-0.5 rounded font-bold ${
                                      rosterSortField === 'GOALS'
                                        ? 'bg-emerald-500/20 text-emerald-400 font-black border border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                                        : player.goals && player.goals > 0
                                        ? 'text-emerald-400'
                                        : 'text-slate-500'
                                    }`}
                                  >
                                    {player.goals || 0} ⚽
                                  </span>

                                  <span
                                    className={`px-2 py-0.5 rounded font-bold ${
                                      rosterSortField === 'YELLOW_CARDS'
                                        ? 'bg-yellow-500/20 text-yellow-400 font-black border border-yellow-500/40'
                                        : (player.yellowCards || 0) > 0
                                        ? 'text-yellow-400'
                                        : 'text-slate-500'
                                    }`}
                                  >
                                    {player.yellowCards || 0} 🟨
                                  </span>

                                  <span
                                    className={`px-2 py-0.5 rounded font-bold ${
                                      rosterSortField === 'RED_CARDS'
                                        ? 'bg-rose-500/20 text-rose-400 font-black border border-rose-500/40'
                                        : (player.redCards || 0) > 0
                                        ? 'text-rose-400'
                                        : 'text-slate-500'
                                    }`}
                                  >
                                    {player.redCards || 0} 🟥
                                  </span>
                                </div>

                                <span className="text-[11px] font-black text-[#CCFF00] opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                                  Apri scheda →
                                </span>
                              </div>
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
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
                      Osservazioni inserite dai colleghi arbitri su condotta, clima e campo
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
                            {n.minute && (
                              <span className="flex items-center gap-1 text-[10px] font-mono font-black text-black bg-[#CCFF00] px-2 py-0.5 rounded shadow-sm">
                                <Clock className="w-3 h-3" /> Min. {n.minute}
                              </span>
                            )}
                            {n.videoUrl && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveViewerMedia({
                                    id: n.videoId,
                                    url: n.videoUrl!,
                                    title: n.videoTitle || `Analisi Gara - ${selectedTeam.name}`,
                                    subtitle: `${selectedTeam.name} • ${n.minute || 'Video'}`,
                                    description: n.content,
                                    timestampMark: n.minute,
                                    mediaType: 'video',
                                    targetType: 'squadra',
                                    targetId: selectedTeam.id,
                                    targetName: selectedTeam.name,
                                    homeTeamId: selectedTeam.id,
                                    homeTeamName: selectedTeam.name,
                                  });
                                  setIsViewerOpen(true);
                                }}
                                className="inline-flex items-center gap-1 text-[10px] font-black text-[#CCFF00] hover:text-[#d8ff33] bg-[#CCFF00]/10 border border-[#CCFF00]/30 px-2 py-0.5 rounded transition-all"
                                title="Guarda il video al minuto esatto"
                              >
                                <Play className="w-3 h-3 fill-[#CCFF00]" /> Video
                              </button>
                            )}
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

            {/* TAB 4: NOTE VIDEO SQUADRA */}
            {activeTeamTab === 'VIDEO' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-black text-white flex items-center gap-2">
                      <Video className="w-4 h-4 text-[#CCFF00]" />
                      Note Video della Squadra ({teamVideos.length})
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Clip video di falli, tattiche e posizionamenti con minutaggio e player in-app
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingVideo(null);
                      setVideoModalTargetType('squadra');
                      setVideoModalTargetId(selectedTeam.id);
                      setVideoModalTargetName(selectedTeam.name);
                      setIsVideoModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#CCFF00] hover:bg-[#D8FF33] text-black font-black text-xs shadow-[0_0_12px_rgba(204,255,0,0.35)] transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Carica Video
                  </button>
                </div>

                {teamVideos.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                    {teamVideos.map((vid) => {
                      const hasInterval = Boolean(vid.timestampMark && vid.endTimestampMark);
                      const timeLabel = vid.timestampMark ? (
                        hasInterval ? `Min. ${vid.timestampMark} → ${vid.endTimestampMark}` : `Min. ${vid.timestampMark}`
                      ) : 'Clip Video';

                      const isOwnerOrAdmin = Boolean(
                        isAdmin ||
                        user?.role === 'admin' ||
                        !vid.authorId ||
                        (user?.username && vid.authorId.toLowerCase().trim() === user.username.toLowerCase().trim())
                      );

                      return (
                        <div
                          key={vid.id}
                          className="p-3.5 rounded-2xl bg-[#11141D] border border-[#212638] space-y-2.5 flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-mono font-bold text-[#CCFF00] bg-[#CCFF00]/10 px-2 py-0.5 rounded border border-[#CCFF00]/20">
                                {timeLabel}
                              </span>
                              {isOwnerOrAdmin && (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleEditTeamVideo(vid)}
                                    className="text-slate-500 hover:text-[#CCFF00] p-1 rounded-md hover:bg-[#141824] transition-colors cursor-pointer"
                                    title="Modifica video"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteTeamVideo(vid.id)}
                                    className="text-slate-500 hover:text-rose-400 p-1 rounded-md hover:bg-[#141824] transition-colors cursor-pointer"
                                    title="Elimina video"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
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
                                id: vid.id,
                                url: videoUrl,
                                title: vid.title,
                                subtitle: `${selectedTeam.name} • ${timeLabel}`,
                                description: vid.description,
                                timestampMark: vid.timestampMark,
                                endTimestampMark: vid.endTimestampMark,
                                mediaType: 'video',
                                targetType: vid.targetType,
                                targetId: vid.targetId || selectedTeam.id,
                                targetName: vid.targetName || selectedTeam.name,
                                homeTeamId: vid.homeTeamId || (vid.targetType === 'squadra' ? selectedTeam.id : undefined),
                                homeTeamName: vid.homeTeamName || (vid.targetType === 'squadra' ? selectedTeam.name : undefined),
                                awayTeamId: vid.awayTeamId,
                                awayTeamName: vid.awayTeamName,
                              });
                              setIsViewerOpen(true);
                            }}
                            className="w-full flex items-center justify-center gap-1.5 py-2 bg-[#141824] hover:bg-[#1E2435] text-[#CCFF00] border border-[#212638] rounded-xl text-xs font-bold transition-all cursor-pointer"
                          >
                            <Video className="w-3.5 h-3.5" /> Riproduci in App
                          </button>
                        </div>
                      );
                    })}
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
                  <div className="p-4 rounded-2xl bg-[#11141D] border border-[#212638] space-y-2.5">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-400 block">
                      Logo Club, Impianto & Staff Tecnico
                    </span>
                    {isEditingTeam ? (
                      <div className="space-y-3 text-xs">
                        {/* Logo Squadra URL */}
                        <div>
                          <label className="text-slate-400 block mb-1 font-bold">
                            Logo Squadra (URL immagine web)
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="url"
                              value={editTeamForm.logoUrl || ''}
                              onChange={(e) => setEditTeamForm({ ...editTeamForm, logoUrl: e.target.value })}
                              placeholder="https://esempio.com/logo-squadra.png"
                              className="flex-1 bg-[#0D0F16] border border-[#212638] rounded-xl p-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00]"
                            />
                            <TeamBadge
                              name={editTeamForm.name || selectedTeam.name}
                              logoUrl={editTeamForm.logoUrl}
                              size="md"
                            />
                          </div>
                        </div>

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
                          <label className="text-slate-400 block mb-1 font-bold">Nome Allenatore</label>
                          <input
                            type="text"
                            value={editTeamForm.coachName || ''}
                            onChange={(e) => setEditTeamForm({ ...editTeamForm, coachName: e.target.value })}
                            className="w-full bg-[#0D0F16] border border-[#212638] rounded-xl p-2 text-xs text-slate-200"
                          />
                        </div>

                        {/* Foto Allenatore URL */}
                        <div>
                          <label className="text-slate-400 block mb-1 font-bold">
                            Foto Allenatore (URL immagine web)
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="url"
                              value={editTeamForm.coachPhotoUrl || ''}
                              onChange={(e) => setEditTeamForm({ ...editTeamForm, coachPhotoUrl: e.target.value })}
                              placeholder="https://esempio.com/foto-allenatore.jpg"
                              className="flex-1 bg-[#0D0F16] border border-[#212638] rounded-xl p-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00]"
                            />
                            <CoachBadge
                              coachName={editTeamForm.coachName || selectedTeam.coachName}
                              coachPhotoUrl={editTeamForm.coachPhotoUrl}
                              size="md"
                              enableZoom={false}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-300 space-y-2 pt-1">
                        <p><span className="text-slate-500 font-bold">Stadio:</span> {selectedTeam.stadium || 'Non specificato'}</p>
                        <p><span className="text-slate-500 font-bold">Città:</span> {selectedTeam.city || 'Emilia-Romagna'}</p>
                        <div className="flex items-center gap-2 pt-0.5">
                          <span className="text-slate-500 font-bold">Allenatore:</span>
                          <div className="relative group/coachlogo">
                            <CoachBadge
                              coachName={selectedTeam.coachName}
                              coachPhotoUrl={selectedTeam.coachPhotoUrl}
                              teamName={selectedTeam.name}
                              size="md"
                              className="cursor-pointer"
                              onClick={() =>
                                handleOpenAvatarModal(
                                  'coach',
                                  selectedTeam.id,
                                  selectedTeam.coachName || 'Allenatore',
                                  selectedTeam.coachPhotoUrl,
                                  selectedTeam.name
                                )
                              }
                              showEditOverlay={true}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                handleOpenAvatarModal(
                                  'coach',
                                  selectedTeam.id,
                                  selectedTeam.coachName || 'Allenatore',
                                  selectedTeam.coachPhotoUrl,
                                  selectedTeam.name
                                )
                              }
                              className="absolute -bottom-1 -right-1 p-1 rounded-full bg-[#161B26] hover:bg-[#CCFF00] text-slate-300 hover:text-black border border-[#2B3245] shadow-md transition-all cursor-pointer"
                              title="Modifica Foto Allenatore (URL)"
                            >
                              <Camera className="w-2.5 h-2.5" />
                            </button>
                          </div>
                          <span className="font-semibold text-white">{selectedTeam.coachName || 'Non specificato'}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Dedicata: Profilo Arbitrale - Atteggiamento della Panchina */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#11141D] border border-[#212638] space-y-3.5 md:col-span-2 shadow-lg">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1C2232] pb-3">
                      <div>
                        <span className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                          <Users className="w-4 h-4 text-[#CCFF00]" />
                          Atteggiamento della Panchina
                        </span>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Profilo comportamentale di dirigenti, staff e calciatori di riserva rilevato nelle direzioni di gara
                        </p>
                      </div>
                      {!isEditingTeam && (
                        <BenchAttitudeBadge attitude={selectedTeam.benchAttitude} size="md" />
                      )}
                    </div>

                    {isEditingTeam ? (
                      <div className="space-y-2">
                        <label className="text-xs text-slate-300 block font-bold">
                          Seleziona il tag comportamentale della panchina:
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-1">
                          {BENCH_ATTITUDE_TAGS.map((tag) => {
                            const isSelected = (editTeamForm.benchAttitude || '').toLowerCase() === tag.toLowerCase();
                            return (
                              <BenchAttitudeBadge
                                key={tag}
                                attitude={tag}
                                size="lg"
                                isSelected={isSelected}
                                showDescription={true}
                                className="w-full justify-between py-2.5"
                                onClick={() =>
                                  setEditTeamForm({
                                    ...editTeamForm,
                                    benchAttitude: isSelected ? undefined : tag,
                                  })
                                }
                              />
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[#0B0E17] border border-[#1E2436]">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xs font-bold text-slate-300">Valutazione panchina:</span>
                            <BenchAttitudeBadge attitude={selectedTeam.benchAttitude} size="sm" />
                          </div>
                          <p className="text-xs text-slate-400">
                            {getBenchAttitudeMeta(selectedTeam.benchAttitude).description}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsEditingTeam(true)}
                          className="px-3.5 py-1.5 rounded-xl bg-[#141824] hover:bg-[#1E2435] text-slate-300 hover:text-white border border-[#212638] text-xs font-bold transition-all shrink-0 flex items-center gap-1.5"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[#CCFF00]" /> Modifica Tag Panchina
                        </button>
                      </div>
                    )}

                    {/* Nuova Sezione: Note su Allenatore & Membri dello Staff */}
                    <div className="pt-4 border-t border-[#1C2232] space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <span className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[#CCFF00]" />
                            Note su Allenatore & Membri dello Staff
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#1A2030] text-[#CCFF00] border border-[#2B354D]">
                              {staffNotes.length}
                            </span>
                          </span>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Osservazioni comportamentali sul mister e sui dirigenti (con cognome del dirigente)
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingStaffNote(null);
                            setIsStaffNoteModalOpen(true);
                          }}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#CCFF00] hover:bg-[#D8FF33] text-black font-black text-xs shadow-[0_0_12px_rgba(204,255,0,0.35)] transition-all cursor-pointer self-start sm:self-auto shrink-0 active:scale-95"
                        >
                          <Plus className="w-4 h-4" /> Aggiungi Nota Staff / Mister
                        </button>
                      </div>

                      {/* Lista Note Staff */}
                      {staffNotes.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                          {staffNotes.map((note) => {
                            const isCoach = note.targetType === 'allenatore';
                            const isOwner = Boolean(
                              !note.authorId ||
                              (user?.username && note.authorId.toLowerCase().trim() === user.username.toLowerCase().trim()) ||
                              user?.role === 'admin'
                            );

                            return (
                              <div
                                key={note.id}
                                className="p-4 rounded-xl bg-[#090C13] border border-[#1E2436] hover:border-[#CCFF00]/40 transition-all space-y-2.5 relative group"
                              >
                                {/* Header Nota: Badge Soggetto + Priorità + Azioni */}
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {isCoach ? (
                                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 shadow-sm">
                                        <Award className="w-3.5 h-3.5 text-amber-400" />
                                        Mister {selectedTeam.coachName || 'Allenatore'}
                                      </span>
                                    ) : (
                                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5 shadow-sm">
                                        <Users className="w-3.5 h-3.5 text-cyan-400" />
                                        {note.targetName || 'Dirigente / Staff'}
                                      </span>
                                    )}

                                    <span
                                      className={`px-2 py-0.5 rounded text-[9px] font-mono font-black uppercase tracking-wider ${
                                        note.priority === 'HIGH'
                                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                          : note.priority === 'LOW'
                                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                      }`}
                                    >
                                      {note.priority === 'HIGH'
                                        ? 'Alta Priorità'
                                        : note.priority === 'LOW'
                                        ? 'Bassa'
                                        : 'Normale'}
                                    </span>

                                    {note.isPublic === false ? (
                                      <span className="flex items-center gap-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                        <Lock className="w-2.5 h-2.5 text-amber-400" /> Privata
                                      </span>
                                    ) : (
                                      <span className="flex items-center gap-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-[#CCFF00]/10 text-[#CCFF00] border border-[#CCFF00]/30">
                                        <Globe className="w-2.5 h-2.5 text-[#CCFF00]" /> Rete
                                      </span>
                                    )}
                                  </div>

                                  {isOwner && (
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingStaffNote(note);
                                          setIsStaffNoteModalOpen(true);
                                        }}
                                        className="p-1 rounded-lg text-slate-400 hover:text-[#CCFF00] hover:bg-[#141824] transition-all cursor-pointer"
                                        title="Modifica Nota"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteStaffNote(note.id)}
                                        className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                                        title="Elimina Nota"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* Contenuto Nota */}
                                <p className="text-slate-200 text-xs leading-relaxed whitespace-pre-line font-medium pt-0.5">
                                  {note.content}
                                </p>

                                {/* Footer Nota: Autore e Data */}
                                <div className="pt-2 border-t border-[#161B26] flex items-center justify-between text-[10px] text-slate-400 font-mono">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-300">
                                      {note.authorName || note.authorId || 'Arbitro'}
                                    </span>
                                    {note.authorRole && (
                                      <span className="px-1.5 py-0.2 rounded bg-[#CCFF00]/10 text-[#CCFF00] border border-[#CCFF00]/20 font-black">
                                        {note.authorRole}
                                      </span>
                                    )}
                                    {note.authorSection && (
                                      <span className="text-slate-500 hidden sm:inline">• {note.authorSection}</span>
                                    )}
                                  </div>
                                  <span className="text-slate-500">
                                    {new Date(note.createdAt).toLocaleDateString('it-IT', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: '2-digit',
                                    })}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-4 sm:p-5 rounded-xl bg-[#090C13] border border-dashed border-[#1E2436] flex flex-col items-center justify-center text-center space-y-2">
                          <Users className="w-7 h-7 text-slate-600" />
                          <div>
                            <p className="text-xs font-bold text-slate-300">
                              Nessuna nota registrata su allenatore o dirigenti
                            </p>
                            <p className="text-[11px] text-slate-500 max-w-md mt-0.5">
                              Puoi inserire osservazioni sul comportamento del mister o dei membri dello staff (inserendo il cognome del dirigente se non si tratta dell&apos;allenatore) per preparare al meglio le direzioni di gara.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingStaffNote(null);
                              setIsStaffNoteModalOpen(true);
                            }}
                            className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141824] hover:bg-[#1C2232] text-[#CCFF00] hover:text-[#d8ff33] border border-[#252B3C] text-xs font-bold transition-all cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" /> Inserisci la prima nota
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Dedicata: Squalifiche & Inibizioni Staff e Dirigenza (Campionato & Coppa Italia) */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#11141D] border border-[#212638] space-y-3.5 md:col-span-2 shadow-lg">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1C2232] pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
                          <Gavel className="w-4 h-4 text-amber-400" />
                        </div>
                        <div>
                          <span className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                            Squalifiche & Inibizioni Staff e Dirigenza
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              {selectedTeam.staffSanctions?.length || 0} {selectedTeam.staffSanctions?.length === 1 ? 'provvedimento' : 'provvedimenti'}
                            </span>
                          </span>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Delibere ufficiali del Giudice Sportivo (Campionato Eccellenza & Coppa Italia) rivolte a dirigenti, allenatori e staff
                          </p>
                        </div>
                      </div>

                      <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-[#141824] text-slate-300 border border-[#23293B] self-start sm:self-auto">
                        Campionato & Coppa Italia
                      </span>
                    </div>

                    {/* Elenco Provvedimenti Staff & Dirigenza */}
                    {selectedTeam.staffSanctions && selectedTeam.staffSanctions.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        {selectedTeam.staffSanctions.map((sanz, sIdx) => {
                          const isCoach = /allenator/i.test(sanz.ruolo || '');
                          const isDirigente = /dirigent/i.test(sanz.ruolo || '');
                          const isCoppa = /coppa/i.test(sanz.competizione || '');

                          return (
                            <div
                              key={sIdx}
                              className="p-4 rounded-xl bg-[#090C13] border border-[#1E2436] hover:border-[#CCFF00]/40 transition-all space-y-2.5 relative group"
                            >
                              <div className="flex items-start justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {/* Badge Ruolo */}
                                  <span
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1.5 shadow-sm ${
                                      isCoach
                                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                        : isDirigente
                                        ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                                        : 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                                    }`}
                                  >
                                    {isCoach ? (
                                      <Award className="w-3.5 h-3.5 text-amber-400" />
                                    ) : (
                                      <Users className="w-3.5 h-3.5 text-cyan-400" />
                                    )}
                                    {sanz.ruolo}
                                  </span>

                                  {/* Badge Competizione */}
                                  <span
                                    className={`px-2 py-0.5 rounded text-[9px] font-mono font-black uppercase tracking-wider ${
                                      isCoppa
                                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    }`}
                                  >
                                    {sanz.competizione || 'Campionato Eccellenza'}
                                  </span>

                                  {/* Badge CU */}
                                  {sanz.comunicato && (
                                    <span className="text-[10px] font-mono font-bold text-slate-300 bg-[#161B28] border border-slate-700/60 px-2 py-0.5 rounded flex items-center gap-1">
                                      <FileText className="w-3 h-3 text-slate-400" />
                                      {sanz.comunicato}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Nome e Cognome del Dirigente o Allenatore */}
                              <div className="pt-0.5">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                                  {isCoach ? 'Allenatore Sanzionato:' : isDirigente ? 'Dirigente Sanzionato:' : 'Membro Staff Sanzionato:'}
                                </span>
                                <h4 className="text-sm font-black text-white tracking-wide flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[#CCFF00]">👤</span>
                                  {sanz.nome}
                                </h4>
                              </div>

                              {/* Sanzione / Inibizione */}
                              <div className="p-2.5 rounded-lg bg-[#0F131D] border border-rose-500/30 space-y-1">
                                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">
                                  Sanzione / Provvedimento:
                                </span>
                                <p className="text-xs font-bold text-rose-200 leading-snug">
                                  {sanz.sanzione}
                                </p>
                              </div>

                              {/* Motivazione Ufficiale */}
                              {sanz.motivo && (
                                <div className="pt-1 border-t border-[#161B26] text-xs space-y-0.5">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                    Motivazione Giudice Sportivo:
                                  </span>
                                  <p className="text-slate-300 text-xs italic leading-relaxed font-medium">
                                    &ldquo;{sanz.motivo}&rdquo;
                                  </p>
                                </div>
                              )}

                              {/* Link Comunicato PDF */}
                              {sanz.urlComunicato && (
                                <div className="pt-1 flex justify-end">
                                  <a
                                    href={sanz.urlComunicato}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] text-[#CCFF00] hover:underline flex items-center gap-1 font-mono"
                                  >
                                    <span>Consulta comunicato ufficiale PDF</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 sm:p-5 rounded-xl bg-[#090C13] border border-dashed border-[#1E2436] flex flex-col items-center justify-center text-center space-y-2">
                        <ShieldAlert className="w-7 h-7 text-slate-600" />
                        <div>
                          <p className="text-xs font-bold text-slate-300">
                            Nessun provvedimento disciplinare per dirigenti o allenatori
                          </p>
                          <p className="text-[11px] text-slate-500 max-w-md mt-0.5">
                            Non risultano squalifiche o inibizioni a carico di allenatori, dirigenti o membri dello staff nei comunicati del Giudice Sportivo (Campionato Eccellenza e Coppa Italia).
                          </p>
                        </div>
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
                type="button"
                onClick={handleCloseTeam}
                className="px-5 py-2.5 bg-[#141824] hover:bg-[#1E2435] text-xs font-bold text-slate-300 rounded-xl border border-[#212638] transition-all hover:text-white cursor-pointer active:scale-95 shadow-sm"
              >
                Chiudi Scheda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODALE SINGOLO CALCIATORE (APRIBILE DALLA ROSA DELLA SQUADRA) */}
      {selectedPlayer && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClosePlayer();
          }}
        >
          <div
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#0D0F16] border border-[#212638] shadow-2xl p-6 md:p-8 text-slate-100 space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Player Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1E2333] pb-5">
              <div className="flex items-center gap-3.5">
                <div className="relative group/playerlogo">
                  <PlayerBadge
                    player={selectedPlayer}
                    firstName={selectedPlayer.firstName}
                    lastName={selectedPlayer.lastName}
                    photoUrl={selectedPlayer.photoUrl}
                    role={selectedPlayer.role}
                    teamName={selectedPlayer.teamName}
                    size="xl"
                    className="shadow-[0_0_12px_rgba(204,255,0,0.2)] cursor-pointer"
                    onClick={() =>
                      handleOpenAvatarModal(
                        'player',
                        selectedPlayer.id,
                        `${selectedPlayer.firstName} ${selectedPlayer.lastName}`,
                        selectedPlayer.photoUrl,
                        `${selectedPlayer.teamName} • ${selectedPlayer.role}`,
                        selectedPlayer.role
                      )
                    }
                    showEditOverlay={true}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      handleOpenAvatarModal(
                        'player',
                        selectedPlayer.id,
                        `${selectedPlayer.firstName} ${selectedPlayer.lastName}`,
                        selectedPlayer.photoUrl,
                        `${selectedPlayer.teamName} • ${selectedPlayer.role}`,
                        selectedPlayer.role
                      )
                    }
                    className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-[#161B26] hover:bg-[#CCFF00] text-slate-300 hover:text-black border border-[#2B3245] shadow-md transition-all cursor-pointer"
                    title="Modifica Foto Calciatore (URL)"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
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

              {/* Player edit trigger + Close button */}
              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                {isEditingPlayer ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSavePlayerEdit}
                      className="flex items-center gap-1.5 px-4 py-2 bg-[#CCFF00] hover:bg-[#D8FF33] text-black font-black text-xs rounded-xl shadow-[0_0_12px_rgba(204,255,0,0.35)] transition-all cursor-pointer"
                    >
                      <Check className="w-4 h-4" /> Salva Dati
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingPlayer(false)}
                      className="px-3.5 py-2 bg-[#141824] hover:bg-[#1E2435] text-slate-300 text-xs font-bold rounded-xl border border-[#212638] transition-all cursor-pointer"
                    >
                      Annulla
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingPlayer(true);
                      setEditPlayerForm(selectedPlayer);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-[#141824] hover:bg-[#1E2435] text-slate-200 border border-[#212638] font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-[#CCFF00]" /> Modifica Dati & Tag
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleClosePlayer}
                  className="p-2 rounded-xl bg-[#141824] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-[#212638] hover:border-rose-500/40 transition-all cursor-pointer shadow-sm shrink-0 active:scale-95"
                  title="Chiudi Scheda Calciatore (Esc)"
                  aria-label="Chiudi Scheda Calciatore"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Provvedimenti Disciplinari: Squalifiche (nota con motivazione) e Diffide (alert evidente) */}
            <PlayerDisciplinaryAlert player={selectedPlayer} variant="banner" />

            {/* In-place Player Photo URL input when editing */}
            {isEditingPlayer && (
              <div className="p-4 rounded-2xl bg-[#11141D] border border-[#212638] space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-400 block">
                  Foto Calciatore (URL immagine web)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="url"
                    value={editPlayerForm.photoUrl || ''}
                    onChange={(e) => setEditPlayerForm({ ...editPlayerForm, photoUrl: e.target.value })}
                    placeholder="https://esempio.com/foto-calciatore.jpg"
                    className="flex-1 bg-[#0D0F16] border border-[#212638] rounded-xl p-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00]"
                  />
                  <PlayerBadge
                    firstName={editPlayerForm.firstName || selectedPlayer.firstName}
                    lastName={editPlayerForm.lastName || selectedPlayer.lastName}
                    photoUrl={editPlayerForm.photoUrl}
                    role={editPlayerForm.role || selectedPlayer.role}
                    size="md"
                    enableZoom={false}
                  />
                </div>
              </div>
            )}

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
                    Note Arbitrali sul Calciatore ({playerNotes.length})
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Osservazioni su condotta, falli tattici e atteggiamento inserite dai colleghi arbitri
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

            {/* Note Video & Clip Episodi sul Calciatore */}
            <div className="p-5 rounded-2xl bg-[#11141D] border border-[#212638] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <Video className="w-4 h-4 text-[#FF334B]" />
                    Note Video & Clip Episodi ({playerVideos.length})
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Analisi video, falli, condotta e situazioni di gioco relative al calciatore
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddVideoForPlayer(selectedPlayer)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1A1F2E] hover:bg-[#252C40] text-white border border-[#2D364D] hover:border-[#FF334B]/40 font-black text-xs shadow-sm transition-all cursor-pointer active:scale-95"
                >
                  <Plus className="w-4 h-4 text-[#FF334B]" /> Aggiungi Nota Video
                </button>
              </div>

              {playerVideos.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {playerVideos.map((vid) => {
                    const ytId = getYoutubeVideoId(vid.externalUrl);
                    const isImg =
                      vid.mediaType === 'image' ||
                      Boolean(vid.externalUrl && vid.externalUrl.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i));
                    const isDirectVideo = !ytId && !isImg && Boolean(vid.externalUrl);

                    const handleCardPlay = () => {
                      if (vid.externalUrl) {
                        setActiveViewerMedia({
                          id: vid.id,
                          url: vid.externalUrl,
                          title: vid.title,
                          subtitle: `${selectedPlayer.firstName} ${selectedPlayer.lastName} • ${vid.targetName}`,
                          description: vid.description,
                          timestampMark: vid.timestampMark,
                          mediaType: isImg ? 'image' : 'video',
                          targetType: vid.targetType,
                          targetId: vid.targetId,
                          targetName: vid.targetName,
                          homeTeamId: vid.homeTeamId,
                          homeTeamName: vid.homeTeamName,
                          awayTeamId: vid.awayTeamId,
                          awayTeamName: vid.awayTeamName,
                        });
                        setIsViewerOpen(true);
                      }
                    };

                    return (
                      <div
                        key={vid.id}
                        className="rounded-xl bg-[#0D0F16] border border-[#212638] overflow-hidden hover:border-[#FF334B]/40 transition-all flex flex-col justify-between group shadow-md"
                      >
                        {/* Video Thumbnail / Preview Header */}
                        <div
                          onClick={handleCardPlay}
                          className="relative w-full aspect-video bg-black cursor-pointer overflow-hidden group/thumb"
                        >
                          {ytId ? (
                            <img
                              src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                              alt={vid.title}
                              className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300"
                            />
                          ) : isImg ? (
                            <img
                              src={vid.externalUrl}
                              alt={vid.title}
                              className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300"
                            />
                          ) : isDirectVideo ? (
                            <video
                              src={vid.externalUrl}
                              className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300"
                              preload="metadata"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-[#141824] text-slate-600">
                              <Film className="w-10 h-10" />
                            </div>
                          )}

                          {/* Glowing play overlay on hover */}
                          <div className="absolute inset-0 bg-black/40 group-hover/thumb:bg-black/20 flex items-center justify-center transition-colors">
                            <div className="w-10 h-10 rounded-full bg-[#CCFF00]/90 text-black flex items-center justify-center shadow-[0_0_15px_rgba(204,255,0,0.5)] group-hover/thumb:scale-110 transition-transform">
                              <Play className="w-4 h-4 fill-black ml-0.5" />
                            </div>
                          </div>

                          {/* Source / Format Badge */}
                          <div className="absolute top-2 left-2 flex items-center gap-1">
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-black/80 backdrop-blur-md text-white border border-white/20 flex items-center gap-1">
                              {isImg ? (
                                <ImageIcon className="w-2.5 h-2.5 text-[#CCFF00]" />
                              ) : ytId ? (
                                <span className="text-[#FF334B]">YouTube</span>
                              ) : (
                                <Film className="w-2.5 h-2.5 text-[#CCFF00]" />
                              )}
                              <span>{isImg ? 'Foto' : ytId ? 'Clip' : 'Video Locale'}</span>
                            </span>
                          </div>

                          {/* Minute / Timestamp Badge */}
                          {vid.timestampMark && (
                            <div className="absolute bottom-2 right-2">
                              <span className="flex items-center gap-1 text-[9px] font-mono font-black text-black bg-[#CCFF00] px-2 py-0.5 rounded-full shadow-md">
                                <Clock className="w-2.5 h-2.5" /> Min. {vid.timestampMark}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Video Info */}
                        <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                          <div className="space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <h5 className="font-bold text-xs text-white line-clamp-1 group-hover:text-[#CCFF00] transition-colors">
                                {vid.title}
                              </h5>
                              {(() => {
                                const isOwnerOrAdmin = Boolean(
                                  isAdmin ||
                                  user?.role === 'admin' ||
                                  !vid.authorId ||
                                  (user?.username && vid.authorId.toLowerCase().trim() === user.username.toLowerCase().trim())
                                );

                                if (!isOwnerOrAdmin) return null;

                                return (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditPlayerVideo(vid);
                                      }}
                                      className="text-slate-500 hover:text-[#CCFF00] p-1 rounded-md hover:bg-[#141824] transition-colors cursor-pointer"
                                      title="Modifica Nota Video"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeletePlayerVideo(vid.id);
                                      }}
                                      className="text-slate-500 hover:text-rose-400 p-1 rounded-md hover:bg-[#141824] transition-colors cursor-pointer"
                                      title="Elimina Nota Video"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                );
                              })()}
                            </div>
                            {vid.description && (
                              <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                                {vid.description}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-[#1C2130] text-[10px] text-slate-500">
                            <span className="font-mono">
                              {new Date(vid.createdAt).toLocaleDateString('it-IT')}
                            </span>
                            <button
                              type="button"
                              onClick={handleCardPlay}
                              className="text-[#CCFF00] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Play className="w-3 h-3 fill-[#CCFF00]" /> Guarda
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-6 text-center text-slate-500 text-xs italic bg-[#0D0F16] rounded-xl border border-dashed border-[#212638]">
                  Nessuna nota video presente per questo calciatore. Clicca &quot;Aggiungi Nota Video&quot; per caricare o collegare una clip.
                </div>
              )}
            </div>

            {/* Footer Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#1C2130]">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleAddNoteForPlayer(selectedPlayer)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#12151E] hover:bg-[#181C28] text-xs font-bold text-slate-200 border border-[#242B3C] transition-colors cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-[#CCFF00]" />
                  Aggiungi Nota Calciatore
                </button>
                <button
                  type="button"
                  onClick={() => handleAddVideoForPlayer(selectedPlayer)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#12151E] hover:bg-[#181C28] text-xs font-bold text-slate-200 border border-[#242B3C] transition-colors cursor-pointer"
                >
                  <Video className="w-4 h-4 text-[#FF334B]" />
                  Aggiungi Clip Episodio
                </button>
              </div>

              <button
                type="button"
                onClick={handleClosePlayer}
                className="px-5 py-2.5 bg-[#141824] hover:bg-[#1E2435] text-xs font-bold text-slate-300 rounded-xl border border-[#212638] transition-all hover:text-white cursor-pointer active:scale-95 shadow-sm"
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

      {/* Dedicated Staff & Coach Note Modal (Profilo Arbitrale) */}
      <StaffNoteModal
        isOpen={isStaffNoteModalOpen}
        onClose={() => {
          setIsStaffNoteModalOpen(false);
          setEditingStaffNote(null);
        }}
        teamId={selectedTeam?.id || ''}
        teamName={selectedTeam?.name || ''}
        coachName={selectedTeam?.coachName}
        existingNote={editingStaffNote}
        onSave={handleSaveStaffNote}
      />

      {/* Video Modal (Supports Create and Edit) */}
      <VideoModal
        isOpen={isVideoModalOpen}
        onClose={() => {
          setIsVideoModalOpen(false);
          setEditingVideo(null);
        }}
        existingVideo={editingVideo}
        initialTargetType={videoModalTargetType}
        initialTargetId={videoModalTargetId}
        initialTargetName={videoModalTargetName}
        onSave={async (data, existingVideoId) => {
          try {
            if (existingVideoId) {
              await DbService.updateVideoAsync(existingVideoId, data, user?.username, user?.role);
            } else {
              DbService.addVideo({
                ...data,
                authorId: user?.username || 'samueleromini',
                authorName: user?.displayName || 'Arbitro',
              });
            }
            if (selectedPlayer && data.targetType === 'giocatore') {
              setPlayerVideos(DbService.getVideos('giocatore', selectedPlayer.id, `${selectedPlayer.firstName} ${selectedPlayer.lastName}`));
            }
            if (selectedTeam && data.targetType === 'squadra') {
              setTeamVideos(DbService.getVideos('squadra', selectedTeam.id));
            }
            setIsVideoModalOpen(false);
            setEditingVideo(null);
          } catch (err: any) {
            alert(err.message || 'Errore durante il salvataggio della nota video');
          }
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

      {/* Quick Avatar / Logo URL Modal */}
      <AvatarUrlModal
        isOpen={avatarModalState.isOpen}
        onClose={() => setAvatarModalState((prev) => ({ ...prev, isOpen: false }))}
        type={avatarModalState.type}
        title={avatarModalState.title}
        subtitle={avatarModalState.subtitle}
        currentUrl={avatarModalState.currentUrl}
        role={avatarModalState.role}
        onSave={handleSaveAvatarUrl}
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
