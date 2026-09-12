'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Video,
  Plus,
  Trash2,
  Edit3,
  ExternalLink,
  Play,
  Paperclip,
  AlertTriangle,
  Search,
  Filter,
  Globe,
  Lock,
  User,
} from 'lucide-react';
import { DbService } from '@/lib/repository/db-service';
import { Note, VideoClip, NoteTargetType } from '@/types/refstudio';
import { NoteModal } from '@/components/modals/NoteModal';
import { VideoModal } from '@/components/modals/VideoModal';
import { useRealtimeSync } from '@/lib/supabase/realtime-context';
import { useAuth } from '@/lib/auth/auth-context';

export default function NotesVideosPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'NOTE' | 'VIDEO'>('NOTE');
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [notes, setNotes] = useState<Note[]>([]);
  const [videos, setVideos] = useState<VideoClip[]>([]);

  // Note Modal state (supports creating and editing)
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  // Video Modal state
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);

  const loadContent = useCallback(() => {
    const filter = targetTypeFilter === 'ALL' ? undefined : targetTypeFilter;
    setNotes(DbService.getNotes(filter, undefined, user?.username));
    setVideos(DbService.getVideos(filter));
  }, [targetTypeFilter, user?.username]);

  useRealtimeSync(loadContent);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setIsNoteModalOpen(true);
  };

  const handleDeleteNote = (id: string) => {
    if (confirm('Sei sicuro di voler eliminare questa nota arbitrale?')) {
      try {
        DbService.deleteNote(id, user?.username);
        loadContent();
      } catch (err: any) {
        alert(err.message || 'Non sei autorizzato a eliminare questa nota.');
      }
    }
  };

  const handleSaveNote = (noteData: any) => {
    try {
      if (noteData.id) {
        // Update existing note
        DbService.updateNote(noteData.id, noteData, user?.username);
      } else {
        // Create new note
        DbService.addNote({
          ...noteData,
          authorId: user?.username || 'samueleromini',
          authorName: user?.displayName || 'Arbitro',
          authorRole: user?.refereeRole || 'AE',
          authorAvatar: user?.avatarUrl || '',
          authorSection: user?.sectionAia || '',
        });
      }
      setIsNoteModalOpen(false);
      setEditingNote(null);
      loadContent();
    } catch (err: any) {
      alert(err.message || 'Errore durante il salvataggio della nota');
    }
  };

  const handleDeleteVideo = (id: string) => {
    if (confirm('Sei sicuro di voler eliminare questo video clip?')) {
      DbService.deleteVideo(id);
      loadContent();
    }
  };

  const getYoutubeEmbedUrl = (url?: string) => {
    if (!url) return null;
    try {
      if (url.includes('youtube.com/watch?v=')) {
        const id = url.split('watch?v=')[1].split('&')[0];
        return `https://www.youtube.com/embed/${id}`;
      } else if (url.includes('youtu.be/')) {
        const id = url.split('youtu.be/')[1].split('?')[0];
        return `https://www.youtube.com/embed/${id}`;
      }
    } catch {
      return null;
    }
    return null;
  };

  // Filter notes
  const filteredNotes = notes.filter((n) => {
    if (priorityFilter !== 'ALL' && n.priority !== priorityFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        n.targetName.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.targetType.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-[#CCFF00]" />
            Scheda Dedicata Note & Video Arbitrali
          </h1>
          <p className="text-xs text-slate-400">
            Archivio centralizzato di tutte le note e clip video su calciatori, squadre, allenatori e gare
          </p>
        </div>

        {/* Tab Switcher & New Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl bg-[#0D0F16] border border-[#1F2433] p-1">
            <button
              onClick={() => setActiveTab('NOTE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                activeTab === 'NOTE'
                  ? 'bg-[#CCFF00] text-black shadow-[0_0_12px_rgba(204,255,0,0.35)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> Note Arbitrali ({notes.length})
            </button>
            <button
              onClick={() => setActiveTab('VIDEO')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                activeTab === 'VIDEO'
                  ? 'bg-[#FF334B] text-black shadow-[0_0_12px_rgba(255,51,75,0.35)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Video className="w-3.5 h-3.5" /> Videoteca ({videos.length})
            </button>
          </div>

          {activeTab === 'NOTE' ? (
            <button
              onClick={() => {
                setEditingNote(null);
                setIsNoteModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#CCFF00] hover:bg-[#d8ff33] text-black text-xs font-black shadow-[0_0_15px_rgba(204,255,0,0.3)] transition-all"
            >
              <Plus className="w-4 h-4" /> Nuova Nota
            </button>
          ) : (
            <button
              onClick={() => setIsVideoModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FF334B] hover:bg-[#ff4d63] text-black text-xs font-black shadow-[0_0_15px_rgba(255,51,75,0.3)] transition-all"
            >
              <Plus className="w-4 h-4" /> Nuovo Video
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      {activeTab === 'NOTE' && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0D0F16] p-3.5 rounded-2xl border border-[#1F2433]">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca per testo, soggetto o destinatario..."
                className="w-full bg-[#12151E] border border-[#212638] rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#CCFF00]/40 focus:border-[#CCFF00]"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            </div>

            <select
              value={targetTypeFilter}
              onChange={(e) => setTargetTypeFilter(e.target.value)}
              className="bg-[#12151E] border border-[#212638] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#CCFF00]"
            >
              <option value="ALL">Tutti i Soggetti</option>
              <option value="giocatore">Solo Calciatori</option>
              <option value="squadra">Solo Squadre</option>
              <option value="allenatore">Solo Allenatori</option>
              <option value="dirigente">Solo Dirigenti</option>
              <option value="partita">Solo Partite</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-[#12151E] border border-[#212638] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#CCFF00]"
            >
              <option value="ALL">Tutte le Priorità</option>
              <option value="HIGH">Alta Priorità</option>
              <option value="NORMAL">Normale</option>
              <option value="LOW">Bassa</option>
            </select>
          </div>

          <div className="text-xs text-slate-400 font-medium">
            Visualizzate <strong className="text-[#CCFF00] font-mono">{filteredNotes.length}</strong> note
          </div>
        </div>
      )}

      {/* Content Area */}
      {activeTab === 'NOTE' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNotes.map((note) => (
            <div
              key={note.id}
              className="rounded-2xl bg-[#0D0F16] border border-[#1F2433] p-5 hover:border-[#CCFF00]/40 transition-all flex flex-col justify-between space-y-3.5 group shadow-lg"
            >
              <div>
                {/* Note Top Bar */}
                <div className="flex items-center justify-between text-xs text-slate-400 border-b border-[#1A1F2C] pb-2.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`font-black uppercase px-2 py-0.5 rounded text-[10px] tracking-wider ${
                        note.targetType === 'giocatore'
                          ? 'bg-[#181C28] text-sky-400 border border-sky-500/30'
                          : note.targetType === 'squadra'
                          ? 'bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/30'
                          : 'bg-[#181C28] text-slate-300 border border-[#262C3D]'
                      }`}
                    >
                      {note.targetType}
                    </span>

                    {/* Visibilità Badge */}
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

                  {note.priority === 'HIGH' && (
                    <span className="flex items-center gap-1 text-[10px] font-black text-[#FF334B] bg-[#FF334B]/15 px-2 py-0.5 rounded border border-[#FF334B]/30">
                      <AlertTriangle className="w-3 h-3" /> Alta Priorità
                    </span>
                  )}
                </div>

                {/* Author Info Banner */}
                <div className="flex items-center justify-between pt-2 text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-[#181C28] border border-[#2B3142] flex items-center justify-center text-[9px] font-black text-[#CCFF00] overflow-hidden">
                      {note.authorAvatar ? (
                        <img src={note.authorAvatar} alt={note.authorName || 'Autore'} className="w-full h-full object-cover" />
                      ) : (
                        <span>{(note.authorName || note.authorId || 'A').charAt(0)}</span>
                      )}
                    </div>
                    <span className="font-bold text-white text-xs">{note.authorName || note.authorId || 'Arbitro'}</span>
                    {note.authorRole && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-black bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/30">
                        {note.authorRole}
                      </span>
                    )}
                  </div>
                  {note.authorSection && (
                    <span className="text-[10px] text-slate-500 truncate max-w-[130px]">
                      {note.authorSection}
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-sm text-white mt-2.5 group-hover:text-[#CCFF00] transition-colors">{note.targetName}</h3>
                <p className="text-xs text-slate-300 mt-2 whitespace-pre-line leading-relaxed">
                  {note.content}
                </p>

                {note.attachments && note.attachments.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-[#1A1F2C] flex flex-wrap gap-1.5">
                    {note.attachments.map((att, i) => (
                      <a
                        key={i}
                        href={att}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-[#181C28] text-[#CCFF00] hover:underline border border-[#282E40]"
                      >
                        <Paperclip className="w-3 h-3" /> Allegato {i + 1}
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Actions: Modifica ed Elimina abilitati SOLO al proprietario */}
              <div className="pt-3 border-t border-[#1A1F2C] flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>{new Date(note.createdAt).toLocaleDateString('it-IT')}</span>

                {user && note.authorId && note.authorId.toLowerCase() === user.username.toLowerCase() ? (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleEditNote(note)}
                      className="flex items-center gap-1 text-slate-400 hover:text-[#CCFF00] font-bold transition-colors"
                      title="Modifica questa nota (sei il proprietario)"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Modifica
                    </button>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="flex items-center gap-1 text-slate-400 hover:text-[#FF334B] font-bold transition-colors"
                      title="Elimina questa nota (sei il proprietario)"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Elimina
                    </button>
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-500 italic flex items-center gap-1">
                    <Lock className="w-3 h-3 text-slate-600" /> Sola lettura
                  </span>
                )}
              </div>
            </div>
          ))}

          {filteredNotes.length === 0 && (
            <div className="col-span-full py-20 text-center text-slate-500 text-sm">
              Nessuna nota trovata con i filtri selezionati. Clicca &quot;Nuova Nota&quot; per crearne una.
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Video Player Preview */}
          {activeVideoUrl && (
            <div className="p-4 rounded-2xl bg-[#0D0F16] border border-[#212638] shadow-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-[#FF334B] tracking-wider">Player Episodio</span>
                <button
                  onClick={() => setActiveVideoUrl(null)}
                  className="text-xs font-bold text-slate-400 hover:text-white"
                >
                  Chiudi Player ✕
                </button>
              </div>
              <div className="aspect-video w-full max-w-2xl mx-auto rounded-xl overflow-hidden bg-black border border-[#212638]">
                <iframe
                  src={activeVideoUrl}
                  title="Video Player"
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
            </div>
          )}

          {/* Videos Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((vid) => {
              const embedUrl = getYoutubeEmbedUrl(vid.externalUrl);
              return (
                <div
                  key={vid.id}
                  className="rounded-2xl bg-[#0D0F16] border border-[#1F2433] p-5 hover:border-[#CCFF00]/40 transition-all flex flex-col justify-between space-y-3 group"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-400 border-b border-[#1A1F2C] pb-2.5">
                      <span className="font-extrabold uppercase px-2 py-0.5 rounded text-[10px] bg-[#181C28] text-slate-300 border border-[#262C3D]">
                        {vid.targetType}
                      </span>
                      {vid.timestampMark && (
                        <span className="font-mono text-xs font-black text-[#CCFF00] bg-[#CCFF00]/15 px-2 py-0.5 rounded border border-[#CCFF00]/30">
                          Minuto {vid.timestampMark}
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-sm text-white mt-2.5 group-hover:text-[#CCFF00] transition-colors">{vid.title}</h3>
                    <p className="text-xs font-bold text-[#CCFF00] mt-0.5">{vid.targetName}</p>

                    {vid.description && (
                      <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                        {vid.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[#1A1F2C] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {embedUrl ? (
                        <button
                          onClick={() => setActiveVideoUrl(embedUrl)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#CCFF00] hover:bg-[#d8ff33] text-black text-xs font-black transition-all shadow-[0_0_12px_rgba(204,255,0,0.3)]"
                        >
                          <Play className="w-3.5 h-3.5 fill-black text-black" /> Guarda Clip
                        </button>
                      ) : vid.externalUrl ? (
                        <a
                          href={vid.externalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#181C28] hover:bg-[#202534] text-slate-200 border border-[#282E40] text-xs font-bold"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-[#CCFF00]" /> Apri Link
                        </a>
                      ) : null}
                    </div>

                    <button
                      onClick={() => handleDeleteVideo(vid.id)}
                      className="text-slate-500 hover:text-[#FF334B] p-1 transition-colors"
                      title="Elimina video"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
            {videos.length === 0 && (
              <div className="col-span-full py-16 text-center text-slate-500 text-sm">
                Nessun video associato. Clicca &quot;Nuovo Video&quot; per collegare clip da YouTube o file locali.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Note Modal (Supports both Create and Edit) */}
      <NoteModal
        isOpen={isNoteModalOpen}
        onClose={() => {
          setIsNoteModalOpen(false);
          setEditingNote(null);
        }}
        existingNote={editingNote}
        onSave={handleSaveNote}
      />

      {/* Video Modal */}
      <VideoModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        onSave={(data) => {
          DbService.addVideo(data);
          loadContent();
        }}
      />
    </div>
  );
}
