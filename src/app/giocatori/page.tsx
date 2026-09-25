'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Users, Search, Filter, Edit3, Check, X, FileText, Video, AlertCircle, Camera } from 'lucide-react';
import { DbService } from '@/lib/repository/db-service';
import { Player, RefereeCustomTag, DisciplinaryStatus, RoleCategory } from '@/types/refstudio';
import { RoleBadge } from '@/components/common/RoleBadge';
import { TagBadge } from '@/components/common/TagBadge';
import { PlayerBadge } from '@/components/common/AvatarBadge';
import { useAuth } from '@/lib/auth/auth-context';
import { NoteModal } from '@/components/modals/NoteModal';
import { VideoModal } from '@/components/modals/VideoModal';
import { AvatarUrlModal } from '@/components/modals/AvatarUrlModal';
import { useRealtimeSync } from '@/lib/supabase/realtime-context';

const AVAILABLE_TAGS: RefereeCustomTag[] = [
  'proteste frequenti',
  'simulatore',
  'corretto',
  'leader squadra',
  'aggressivo',
  'osservare',
];

function PlayersContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const { user, isAdmin } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [gironeFilter, setGironeFilter] = useState<string>('ALL');
  const [tagFilter, setTagFilter] = useState<string>('ALL');
  const [disciplinaryFilter, setDisciplinaryFilter] = useState<string>('ALL');

  // Selected player for detail/edit
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Player>>({});

  // Modals
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

  const handleSaveAvatarUrl = (newUrl: string) => {
    if (!selectedPlayer) return;
    try {
      const updated = DbService.updatePlayer(selectedPlayer.id, { photoUrl: newUrl });
      setSelectedPlayer(updated);
      setEditForm((prev) => ({ ...prev, photoUrl: newUrl }));
      loadPlayers();
    } catch (err) {
      console.error(err);
    }
  };

  const loadPlayers = useCallback(() => {
    const list = DbService.getPlayers();
    setPlayers(list);
    setSelectedPlayer((prev) => {
      if (!prev) return null;
      const fresh = list.find((p) => p.id === prev.id);
      return fresh || prev;
    });
  }, []);

  useRealtimeSync(loadPlayers);

  useEffect(() => {
    loadPlayers();
  }, [loadPlayers]);

  // Gestione tasto Escape per chiusura modale calciatore
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAvatarModalOpen) {
          setIsAvatarModalOpen(false);
        } else if (isNoteModalOpen) {
          setIsNoteModalOpen(false);
        } else if (isVideoModalOpen) {
          setIsVideoModalOpen(false);
        } else if (selectedPlayer) {
          setSelectedPlayer(null);
          setIsEditing(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAvatarModalOpen, isNoteModalOpen, isVideoModalOpen, selectedPlayer]);

  const handleSelectPlayer = (player: Player) => {
    setSelectedPlayer(player);
    setEditForm(player);
    setIsEditing(false);
  };

  const handleToggleTag = (tag: RefereeCustomTag) => {
    const currentTags = editForm.customTags || [];
    if (currentTags.includes(tag)) {
      setEditForm({
        ...editForm,
        customTags: currentTags.filter((t) => t !== tag),
      });
    } else {
      setEditForm({
        ...editForm,
        customTags: [...currentTags, tag],
      });
    }
  };

  const handleSaveEdit = () => {
    if (!selectedPlayer) return;
    try {
      const updated = DbService.updatePlayer(selectedPlayer.id, editForm);
      setSelectedPlayer(updated);
      setIsEditing(false);
      loadPlayers();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredPlayers = players.filter((p) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        p.firstName.toLowerCase().includes(q) ||
        p.lastName.toLowerCase().includes(q) ||
        p.teamName.toLowerCase().includes(q);
      if (!match) return false;
    }

    if (roleFilter !== 'ALL' && p.role !== roleFilter) return false;
    if (gironeFilter !== 'ALL' && p.girone !== gironeFilter) return false;
    if (tagFilter !== 'ALL' && !p.customTags.includes(tagFilter as any)) return false;
    if (disciplinaryFilter !== 'ALL' && p.disciplinaryStatus !== disciplinaryFilter) return false;

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-[#CCFF00]" />
            Archivio Calciatori & Radar
          </h1>
          <p className="text-xs text-slate-400">
            Monitoraggio cartellini, profili comportamentali e note arbitrali
          </p>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:flex md:flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="relative col-span-1 sm:col-span-2 md:w-56">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca nome o squadra..."
              className="w-full bg-[#11141D] border border-[#212638] rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#CCFF00]/40 focus:border-[#CCFF00]"
            />
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full sm:w-auto bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#CCFF00]"
          >
            <option value="ALL">Tutti i Ruoli</option>
            <option value="POR">Portieri (POR)</option>
            <option value="DIF">Difensori (DIF)</option>
            <option value="CEN">Centrocampisti (CEN)</option>
            <option value="ATT">Attaccanti (ATT)</option>
          </select>

          <select
            value={gironeFilter}
            onChange={(e) => setGironeFilter(e.target.value)}
            className="w-full sm:w-auto bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#CCFF00]"
          >
            <option value="ALL">Gironi A & B</option>
            <option value="A">Girone A</option>
            <option value="B">Girone B</option>
          </select>

          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="w-full sm:w-auto bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#CCFF00]"
          >
            <option value="ALL">Tutti i Tag</option>
            {AVAILABLE_TAGS.map((t) => (
              <option key={t} value={t}>
                Tag: {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results Count & Quick Tag Shortcuts */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
        <span>Trovati {filteredPlayers.length} calciatori</span>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setTagFilter(tagFilter === 'proteste frequenti' ? 'ALL' : 'proteste frequenti')}
            className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-colors ${
              tagFilter === 'proteste frequenti'
                ? 'bg-[#FF334B] text-black font-black border-[#FF334B]'
                : 'bg-[#12151E] text-[#FF334B] border-[#FF334B]/30'
            }`}
          >
            🔥 Proteste
          </button>
          <button
            onClick={() => setTagFilter(tagFilter === 'simulatore' ? 'ALL' : 'simulatore')}
            className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-colors ${
              tagFilter === 'simulatore'
                ? 'bg-amber-400 text-black font-black border-amber-400'
                : 'bg-[#12151E] text-amber-300 border-amber-500/30'
            }`}
          >
            ⚠️ Simulatori
          </button>
          <button
            onClick={() => setDisciplinaryFilter(disciplinaryFilter === 'DIFFIDATO' ? 'ALL' : 'DIFFIDATO')}
            className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-colors ${
              disciplinaryFilter === 'DIFFIDATO'
                ? 'bg-[#CCFF00] text-black font-black border-[#CCFF00] shadow-[0_0_10px_rgba(204,255,0,0.4)]'
                : 'bg-[#12151E] text-[#CCFF00] border-[#CCFF00]/30'
            }`}
          >
            🟨 Diffidati
          </button>
        </div>
      </div>

      {/* Player Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
        {filteredPlayers.slice(0, 48).map((player) => (
          <div
            key={player.id}
            onClick={() => handleSelectPlayer(player)}
            className="group cursor-pointer rounded-2xl bg-[#0D0F16] border border-[#1F2433] p-4 hover:border-[#CCFF00]/40 hover:shadow-xl transition-all flex flex-col justify-between space-y-3"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <PlayerBadge
                    firstName={player.firstName}
                    lastName={player.lastName}
                    photoUrl={player.photoUrl}
                    role={player.role}
                    size="sm"
                  />
                  <div>
                    <h3 className="font-bold text-sm text-white group-hover:text-[#CCFF00] transition-colors">
                      {player.firstName} {player.lastName}
                    </h3>
                    <p className="text-[11px] text-slate-400 truncate max-w-[150px]">
                      {player.teamName}
                    </p>
                  </div>
                </div>
                <RoleBadge role={player.role} />
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1 mt-3">
                {player.customTags.map((tag, idx) => (
                  <TagBadge key={idx} tag={tag} size="sm" />
                ))}
              </div>
            </div>

            {/* Bottom stats */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-500">
                {player.age ? `${player.age} anni` : 'Età n.d.'}
              </span>
              <div className="flex items-center gap-2 text-slate-400">
                <span className="text-yellow-400 font-bold">{player.yellowCards} 🟨</span>
                <span className="text-rose-400 font-bold">{player.redCards} 🟥</span>
                <span className="text-slate-300 font-bold">{player.goals} ⚽</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredPlayers.length > 48 && (
        <div className="text-center py-4 text-xs text-slate-500">
          Visualizzati primi 48 di {filteredPlayers.length} calciatori. Usa la ricerca per raffinare.
        </div>
      )}

      {/* Player Detail & In-Place Admin Edit Modal */}
      {selectedPlayer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedPlayer(null);
          }}
        >
          <div
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#0D0F16] border border-[#212638] shadow-2xl p-6 md:p-8 text-slate-100 space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1E2333] pb-4">
              <div className="flex items-center gap-3">
                <div className="relative group/playerlogo">
                  <PlayerBadge
                    firstName={selectedPlayer.firstName}
                    lastName={selectedPlayer.lastName}
                    photoUrl={selectedPlayer.photoUrl}
                    role={selectedPlayer.role}
                    size="xl"
                    className="shadow-[0_0_12px_rgba(204,255,0,0.2)] cursor-pointer"
                    onClick={() => setIsAvatarModalOpen(true)}
                    showEditOverlay={true}
                  />
                  <button
                    type="button"
                    onClick={() => setIsAvatarModalOpen(true)}
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

              {/* Edit Trigger & Close Button */}
              <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                {isEditing ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#CCFF00] hover:bg-[#d8ff33] text-black font-black text-xs rounded-lg shadow-[0_0_12px_rgba(204,255,0,0.3)] transition-all cursor-pointer"
                    >
                      <Check className="w-4 h-4 text-black" /> Salva Modifiche
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1.5 bg-[#181C28] hover:bg-[#202534] text-slate-300 text-xs rounded-lg border border-[#282E40] transition-all cursor-pointer"
                    >
                      Annulla
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#12151E] hover:bg-[#181C28] text-slate-200 border border-[#262C3D] font-bold text-xs rounded-lg transition-all cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4 text-[#CCFF00]" /> Modifica Dati & Tag
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedPlayer(null)}
                  className="p-2 rounded-xl bg-[#141824] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-[#212638] hover:border-rose-500/40 transition-all cursor-pointer active:scale-95 shadow-sm shrink-0"
                  title="Chiudi (Esc)"
                  aria-label="Chiudi"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Campo Modifica Foto Calciatore */}
            {isEditing && (
              <div className="p-4 rounded-2xl bg-[#12151E] border border-[#212638] space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-400 block">
                  Foto Calciatore (URL immagine web)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="url"
                    value={editForm.photoUrl || ''}
                    onChange={(e) => setEditForm({ ...editForm, photoUrl: e.target.value })}
                    placeholder="https://esempio.com/foto-calciatore.jpg"
                    className="flex-1 bg-[#181C28] border border-[#2B3245] rounded-xl p-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00]"
                  />
                  <PlayerBadge
                    firstName={editForm.firstName || selectedPlayer.firstName}
                    lastName={editForm.lastName || selectedPlayer.lastName}
                    photoUrl={editForm.photoUrl}
                    role={editForm.role || selectedPlayer.role}
                    size="md"
                  />
                </div>
              </div>
            )}

            {/* Editable Information Fields */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-[#12151E] border border-[#212638] text-xs">
                <span className="text-slate-400 block font-semibold">Ruolo</span>
                {isEditing ? (
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value as any })}
                    className="w-full bg-[#181C28] border border-[#2B3245] rounded p-1 text-slate-200 mt-1"
                  >
                    <option value="POR">POR</option>
                    <option value="DIF">DIF</option>
                    <option value="CEN">CEN</option>
                    <option value="ATT">ATT</option>
                  </select>
                ) : (
                  <span className="font-bold text-white mt-1 block">{selectedPlayer.role}</span>
                )}
              </div>

              <div className="p-3 rounded-xl bg-[#12151E] border border-[#212638] text-xs">
                <span className="text-slate-400 block font-semibold">Numero Maglia</span>
                {isEditing ? (
                  <input
                    type="number"
                    value={editForm.kitNumber || ''}
                    onChange={(e) => setEditForm({ ...editForm, kitNumber: parseInt(e.target.value, 10) || undefined })}
                    placeholder="Es. 9"
                    className="w-full bg-[#181C28] border border-[#2B3245] rounded p-1 text-slate-200 mt-1"
                  />
                ) : (
                  <span className="font-bold text-[#CCFF00] mt-1 block">
                    {selectedPlayer.kitNumber ? `#${selectedPlayer.kitNumber}` : 'Non assegnato'}
                  </span>
                )}
              </div>

              <div className="p-3 rounded-xl bg-[#12151E] border border-[#212638] text-xs">
                <span className="text-slate-400 block font-semibold">Altezza (cm)</span>
                {isEditing ? (
                  <input
                    type="number"
                    value={editForm.heightCm || ''}
                    onChange={(e) => setEditForm({ ...editForm, heightCm: parseInt(e.target.value, 10) || undefined })}
                    placeholder="Es. 185"
                    className="w-full bg-[#181C28] border border-[#2B3245] rounded p-1 text-slate-200 mt-1"
                  />
                ) : (
                  <span className="font-bold text-white mt-1 block">
                    {selectedPlayer.heightCm ? `${selectedPlayer.heightCm} cm` : 'Non specificata'}
                  </span>
                )}
              </div>

              <div className="p-3 rounded-xl bg-[#12151E] border border-[#212638] text-xs">
                <span className="text-slate-400 block font-semibold">Piede Preferito</span>
                {isEditing ? (
                  <select
                    value={editForm.preferredFoot || ''}
                    onChange={(e) => setEditForm({ ...editForm, preferredFoot: e.target.value as any })}
                    className="w-full bg-[#181C28] border border-[#2B3245] rounded p-1 text-slate-200 mt-1"
                  >
                    <option value="">Non indicato</option>
                    <option value="Destro">Destro</option>
                    <option value="Sinistro">Sinistro</option>
                    <option value="Ambidestro">Ambidestro</option>
                  </select>
                ) : (
                  <span className="font-bold text-white mt-1 block">
                    {selectedPlayer.preferredFoot || 'Non indicato'}
                  </span>
                )}
              </div>
            </div>

            {/* Tag Selection Matrix */}
            <div className="p-4 rounded-xl bg-[#12151E] border border-[#212638] space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Tag Arbitrali Personalizzati
              </h4>
              {isEditing ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {AVAILABLE_TAGS.map((tag) => {
                    const isChecked = editForm.customTags?.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleToggleTag(tag)}
                        className={`p-2 rounded-lg border text-left text-xs font-semibold flex items-center justify-between transition-all ${
                          isChecked
                            ? 'bg-[#CCFF00]/15 text-[#CCFF00] border-[#CCFF00]/40'
                            : 'bg-[#181C28] text-slate-400 border-[#282E40]'
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
                    <span className="text-xs text-slate-500 italic">Nessun tag arbitrale assegnato.</span>
                  )}
                </div>
              )}
            </div>

            {/* Note Arbitro */}
            <div className="p-4 rounded-xl bg-[#12151E] border border-[#212638] space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Note Riservate sul Calciatore
              </h4>
              {isEditing ? (
                <textarea
                  rows={3}
                  value={editForm.refereeNotes || ''}
                  onChange={(e) => setEditForm({ ...editForm, refereeNotes: e.target.value })}
                  placeholder="Inserisci osservazioni sul comportamento in campo..."
                  className="w-full bg-[#181C28] border border-[#282E40] rounded p-2 text-xs text-slate-200"
                />
              ) : (
                <p className="text-xs text-slate-300 italic">
                  {selectedPlayer.refereeNotes || 'Nessuna nota presente per questo calciatore.'}
                </p>
              )}
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#1F2433]">
              <div className="flex gap-2">
                <button
                  onClick={() => setIsNoteModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#12151E] hover:bg-[#181C28] text-xs font-bold text-slate-200 border border-[#242B3C] transition-colors"
                >
                  <FileText className="w-4 h-4 text-[#CCFF00]" />
                  Aggiungi Nota Calciatore
                </button>
                <button
                  onClick={() => setIsVideoModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#12151E] hover:bg-[#181C28] text-xs font-bold text-slate-200 border border-[#242B3C] transition-colors"
                >
                  <Video className="w-4 h-4 text-[#FF334B]" />
                  Aggiungi Clip Episodio
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPlayer(null)}
                className="px-5 py-2 bg-[#181C28] hover:bg-[#202534] text-xs font-bold text-slate-300 border border-[#282E40] rounded-xl cursor-pointer active:scale-95 shadow-sm hover:text-white transition-all"
              >
                Chiudi Scheda Calciatore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {selectedPlayer && (
        <>
          <NoteModal
            isOpen={isNoteModalOpen}
            onClose={() => setIsNoteModalOpen(false)}
            initialTargetType="giocatore"
            initialTargetId={selectedPlayer.id}
            initialTargetName={`${selectedPlayer.firstName} ${selectedPlayer.lastName} (${selectedPlayer.teamName})`}
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
            }}
          />

          <VideoModal
            isOpen={isVideoModalOpen}
            onClose={() => setIsVideoModalOpen(false)}
            initialTargetType="giocatore"
            initialTargetId={selectedPlayer.id}
            initialTargetName={`${selectedPlayer.firstName} ${selectedPlayer.lastName} (${selectedPlayer.teamName})`}
            onSave={(data) => {
              DbService.addVideo(data);
            }}
          />

          <AvatarUrlModal
            isOpen={isAvatarModalOpen}
            onClose={() => setIsAvatarModalOpen(false)}
            type="player"
            title={`${selectedPlayer.firstName} ${selectedPlayer.lastName}`}
            subtitle={`${selectedPlayer.teamName} • ${selectedPlayer.role}`}
            currentUrl={selectedPlayer.photoUrl}
            role={selectedPlayer.role}
            onSave={handleSaveAvatarUrl}
          />
        </>
      )}
    </div>
  );
}

export default function PlayersPage() {
  return (
    <React.Suspense fallback={<div className="py-20 text-center text-slate-500 text-xs">Caricamento archivio calciatori...</div>}>
      <PlayersContent />
    </React.Suspense>
  );
}
