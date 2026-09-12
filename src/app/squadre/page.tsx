'use client';

import React, { useState, useEffect } from 'react';
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
  Flame,
  Award,
  Crown,
  Eye,
  Paperclip,
  Calendar,
  Globe,
  Lock,
} from 'lucide-react';
import { DbService } from '@/lib/repository/db-service';
import { Team, Player, Note, VideoClip, RefereeCustomTag } from '@/types/refstudio';
import { RatingStars } from '@/components/common/RatingStars';
import { RoleBadge } from '@/components/common/RoleBadge';
import { TagBadge } from '@/components/common/TagBadge';
import { useAuth } from '@/lib/auth/auth-context';
import { NoteModal } from '@/components/modals/NoteModal';
import { VideoModal } from '@/components/modals/VideoModal';
import { useRealtimeSync } from '@/lib/supabase/realtime-context';

const AVAILABLE_TAGS: RefereeCustomTag[] = [
  'proteste frequenti',
  'simulatore',
  'corretto',
  'leader squadra',
  'aggressivo',
  'osservare',
];

function SquadreContent() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') || '';

  const { user, isAdmin } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [gironeFilter, setGironeFilter] = useState<'ALL' | 'A' | 'B'>('ALL');
  const [searchQuery, setSearchQuery] = useState(initialQ);

  // Selected team state
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamRoster, setTeamRoster] = useState<Player[]>([]);
  const [teamNotes, setTeamNotes] = useState<Note[]>([]);
  const [teamVideos, setTeamVideos] = useState<VideoClip[]>([]);

  // Team Admin edit mode
  const [isEditingTeam, setIsEditingTeam] = useState(false);
  const [editTeamForm, setEditTeamForm] = useState<Partial<Team>>({});

  // Selected Player from Roster state
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [playerNotes, setPlayerNotes] = useState<Note[]>([]);
  const [playerVideos, setPlayerVideos] = useState<VideoClip[]>([]);
  const [isEditingPlayer, setIsEditingPlayer] = useState(false);
  const [editPlayerForm, setEditPlayerForm] = useState<Partial<Player>>({});

  // Note Modal state (for both Team and Player, creating and editing)
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

  const loadTeams = React.useCallback(() => {
    const list = DbService.getTeams(gironeFilter === 'ALL' ? undefined : gironeFilter);
    setTeams(list);

    // Se c'è una squadra aperta nella scheda, aggiorna i dati in tempo reale
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
  }, [gironeFilter, selectedTeam, selectedPlayer, user?.username]);

  // Sottoscrizione Realtime multi-dispositivo
  useRealtimeSync(loadTeams);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  useEffect(() => {
    if (initialQ) {
      setSearchQuery(initialQ);
    }
  }, [initialQ]);

  const handleSelectTeam = (team: Team) => {
    setSelectedTeam(team);
    setEditTeamForm(team);
    setIsEditingTeam(false);
    setSelectedPlayer(null);

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
      loadTeams();
    } catch (err) {
      console.error(err);
    }
  };

  // Open Player from Roster
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
      // update player in roster
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

  // Open note modal for player
  const handleAddNoteForPlayer = (player: Player) => {
    setEditingNote(null);
    setNoteModalTargetType('giocatore');
    setNoteModalTargetId(player.id);
    setNoteModalTargetName(`${player.firstName} ${player.lastName} (${player.teamName})`);
    setIsNoteModalOpen(true);
  };

  // Open note modal for editing player note
  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setNoteModalTargetType(note.targetType as any);
    setNoteModalTargetId(note.targetId);
    setNoteModalTargetName(note.targetName);
    setIsNoteModalOpen(true);
  };

  // Delete note
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

  // Save note (either create or update)
  const handleSaveNote = (noteData: any) => {
    try {
      if (noteData.id) {
        // Update
        DbService.updateNote(noteData.id, noteData, user?.username);
      } else {
        // Create
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

  const filteredTeams = teams.filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      (t.city && t.city.toLowerCase().includes(q)) ||
      (t.stadium && t.stadium.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-[#CCFF00]" />
            Squadre & Rose Ufficiali
          </h1>
          <p className="text-xs text-slate-400">
            Seleziona una squadra per consultare l&apos;organico, visualizzare e gestire le note dei calciatori
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 sm:flex-initial sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca squadra o stadio..."
              className="w-full bg-[#11141D] border border-[#212638] rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#CCFF00]/40 focus:border-[#CCFF00]"
            />
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          </div>

          <div className="flex rounded-xl bg-[#0D0F16] border border-[#1F2433] p-1 shrink-0">
            {(['ALL', 'A', 'B'] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGironeFilter(g)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                  gironeFilter === g
                    ? 'bg-[#CCFF00] text-black shadow-[0_0_12px_rgba(204,255,0,0.35)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {g === 'ALL' ? 'Tutti i Gironi' : `Girone ${g}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid of Teams */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTeams.map((team) => (
          <div
            key={team.id}
            onClick={() => handleSelectTeam(team)}
            className="group cursor-pointer rounded-2xl bg-[#0D0F16] border border-[#1F2433] p-5 hover:border-[#CCFF00]/40 transition-all hover:shadow-2xl flex flex-col justify-between space-y-4"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-[#141824] border border-[#242A3C] flex items-center justify-center font-black text-sm text-[#CCFF00]">
                    {team.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white group-hover:text-[#CCFF00] transition-colors">
                      {team.name}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {team.city ? team.city : 'Eccellenza'} • Girone {team.girone}
                    </p>
                  </div>
                </div>

                {team.stats && (
                  <span className="text-xs font-mono font-black px-2.5 py-0.5 rounded-lg bg-[#11141D] border border-[#212638] text-[#CCFF00]">
                    {team.stats.points} pt
                  </span>
                )}
              </div>

              {/* Technical & Aggression Ratings */}
              <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-[#1A1F2C]">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Livello Tecnico
                  </span>
                  <RatingStars value={team.technicalLevel} type="technical" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Aggressività
                  </span>
                  <RatingStars value={team.aggressionLevel} type="aggression" />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-[#1A1F2C]">
              <span className="truncate max-w-[180px]">
                🏟️ {team.stadium || 'Stadio non specificato'}
              </span>
              <span className="text-[#CCFF00] font-bold group-hover:underline">
                Visualizza rosa →
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Team Detail Modal */}
      {selectedTeam && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#0D0F16] border border-[#212638] shadow-2xl p-6 md:p-8 text-slate-100 space-y-6">
            <button
              onClick={() => setSelectedTeam(null)}
              className="absolute right-6 top-6 text-slate-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1E2333] pb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#CCFF00]/15 border border-[#CCFF00]/30 flex items-center justify-center text-[#CCFF00] font-black text-lg">
                  {selectedTeam.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-white">{selectedTeam.name}</h2>
                  <p className="text-xs text-slate-400">
                    Girone {selectedTeam.girone} • Eccellenza Emilia-Romagna
                  </p>
                </div>
              </div>

              {/* Admin edit trigger */}
              {isAdmin && (
                <div className="flex items-center gap-2">
                  {isEditingTeam ? (
                    <>
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
                    </>
                  ) : (
                    <button
                      onClick={() => setIsEditingTeam(true)}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-[#141824] hover:bg-[#1E2435] text-slate-200 border border-[#212638] font-bold text-xs rounded-xl transition-all"
                    >
                      <Edit3 className="w-4 h-4 text-[#CCFF00]" /> Modifica Squadra (Admin)
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Team Attributes Box */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-[#11141D] border border-[#212638] space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#CCFF00]" />
                  Impianto & Superficie
                </h4>
                {isEditingTeam ? (
                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="text-slate-400 block mb-1 font-bold">Nome Stadio</label>
                      <input
                        type="text"
                        value={editTeamForm.stadium || ''}
                        onChange={(e) => setEditTeamForm({ ...editTeamForm, stadium: e.target.value })}
                        placeholder="Nome stadio"
                        className="w-full bg-[#0D0F16] border border-[#212638] rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#CCFF00]"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1 font-bold">Città</label>
                      <input
                        type="text"
                        value={editTeamForm.city || ''}
                        onChange={(e) => setEditTeamForm({ ...editTeamForm, city: e.target.value })}
                        placeholder="Città"
                        className="w-full bg-[#0D0F16] border border-[#212638] rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#CCFF00]"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-300 space-y-1.5 pt-1">
                    <p><span className="text-slate-500 font-bold">Stadio:</span> {selectedTeam.stadium || 'Non specificato'}</p>
                    <p><span className="text-slate-500 font-bold">Città:</span> {selectedTeam.city || 'Non specificata'}</p>
                  </div>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-[#11141D] border border-[#212638] space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Valutazione Panchina & Allenatore
                </h4>
                {isEditingTeam ? (
                  <div className="space-y-2 text-xs">
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
                      <span className="text-slate-500 font-bold">Tecnica:</span>
                      <RatingStars value={selectedTeam.technicalLevel} type="technical" />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500 font-bold">Aggressività:</span>
                      <RatingStars value={selectedTeam.aggressionLevel} type="aggression" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Note Arbitro Squadra */}
            <div className="p-5 rounded-2xl bg-[#11141D] border border-[#212638] space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Note Riservate sulla Squadra
                </h4>
                <button
                  onClick={() => {
                    setEditingNote(null);
                    setNoteModalTargetType('squadra');
                    setNoteModalTargetId(selectedTeam.id);
                    setNoteModalTargetName(selectedTeam.name);
                    setIsNoteModalOpen(true);
                  }}
                  className="text-xs font-black text-[#CCFF00] hover:underline flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Aggiungi Nota Squadra
                </button>
              </div>

              {teamNotes.length > 0 ? (
                <div className="space-y-2.5 mt-2">
                  {teamNotes.map((n) => (
                    <div key={n.id} className="p-3.5 bg-[#0D0F16] rounded-xl text-xs space-y-2 border border-[#212638]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-black text-[#CCFF00] uppercase tracking-wider px-2 py-0.5 rounded bg-[#11141D] border border-[#212638]">
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
                                title="Modifica Nota (sei il proprietario)"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteNote(n.id, false)}
                                className="text-slate-400 hover:text-rose-400 p-1 transition-colors"
                                title="Elimina Nota (sei il proprietario)"
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
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">Nessuna nota archiviata per questa squadra.</p>
              )}
            </div>

            {/* ROSA CALCIATORI (Access Point Principale Calciatori) */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#CCFF00]" />
                    Rosa Calciatori Ufficiale ({teamRoster.length})
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Clicca su un calciatore per visualizzare la scheda, gestire note riservate e tag arbitrali
                  </p>
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto rounded-2xl border border-[#212638] divide-y divide-[#1C2130] bg-[#0A0C10]">
                {teamRoster.map((player) => (
                  <div
                    key={player.id}
                    onClick={() => handleOpenPlayerFromRoster(player)}
                    className="p-3.5 flex items-center justify-between text-xs hover:bg-[#CCFF00]/10 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <RoleBadge role={player.role} />
                      <div>
                        <span className="font-bold text-white group-hover:text-[#CCFF00] transition-colors">
                          {player.firstName} {player.lastName}
                        </span>
                        {player.age && (
                          <span className="text-slate-500 ml-1.5">({player.age} anni)</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        {player.customTags.map((t, idx) => (
                          <TagBadge key={idx} tag={t} size="sm" />
                        ))}
                      </div>

                      <div className="flex items-center gap-2 text-slate-400 font-mono">
                        <span>{player.appearances || 0} pres</span>
                        <span className="text-yellow-400 font-bold">{player.yellowCards} 🟨</span>
                        <span className="text-rose-400 font-bold">{player.redCards} 🟥</span>
                      </div>

                      <span className="text-[11px] font-black text-[#CCFF00] opacity-0 group-hover:opacity-100 transition-opacity">
                        Apri scheda →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Close */}
            <div className="pt-4 border-t border-[#1C2130] flex justify-end">
              <button
                onClick={() => setSelectedTeam(null)}
                className="px-5 py-2.5 bg-[#141824] hover:bg-[#1E2435] text-xs font-bold text-slate-300 rounded-xl border border-[#212638] transition-all hover:text-white"
              >
                Chiudi Scheda Squadra
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED PLAYER MODAL (Raggiungibile solo dalla rosa) */}
      {selectedPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
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

              {/* Admin edit trigger */}
              {isAdmin && (
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
                      <Edit3 className="w-4 h-4 text-[#CCFF00]" /> Modifica Dati (Admin)
                    </button>
                  )}
                </div>
              )}
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

            {/* GESTIONE NOTE CALCIATORE (Visualizza, Aggiungi, Modifica, Elimina) */}
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
                                title="Modifica Nota (sei il proprietario)"
                              >
                                <Edit3 className="w-3.5 h-3.5" /> Modifica
                              </button>
                              <button
                                onClick={() => handleDeleteNote(note.id, true)}
                                className="text-slate-400 hover:text-rose-400 flex items-center gap-1 font-semibold transition-colors"
                                title="Elimina Nota (sei il proprietario)"
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
                            <a
                              key={i}
                              href={att}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] text-[#CCFF00] bg-[#141824] border border-[#212638] px-2.5 py-1 rounded-lg hover:border-[#CCFF00]/40 transition-colors"
                            >
                              <Paperclip className="w-3 h-3" /> Allegato {i + 1}
                            </a>
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
