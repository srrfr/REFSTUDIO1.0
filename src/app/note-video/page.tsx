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
  Globe,
  Lock,
  Film,
  Image as ImageIcon,
  UploadCloud,
  Clock,
  Sparkles,
} from 'lucide-react';
import { DbService } from '@/lib/repository/db-service';
import { Note, VideoClip, NoteTargetType } from '@/types/refstudio';
import { NoteModal } from '@/components/modals/NoteModal';
import { VideoModal } from '@/components/modals/VideoModal';
import { MediaViewerModal, MediaViewerItem } from '@/components/media/MediaViewerModal';
import { MediaDropzone, UploadResult } from '@/components/media/MediaDropzone';
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

  // Video Modal state & quick drop state
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [droppedMedia, setDroppedMedia] = useState<UploadResult | null>(null);

  // Universal In-App Media Viewer state
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [activeViewerMedia, setActiveViewerMedia] = useState<MediaViewerItem | null>(null);

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

  const openMediaViewer = (item: MediaViewerItem) => {
    setActiveViewerMedia(item);
    setIsViewerOpen(true);
  };

  const handleQuickUpload = (result: UploadResult) => {
    setDroppedMedia(result);
    setIsVideoModalOpen(true);
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

  // Filter videos
  const filteredVideos = videos.filter((v) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        v.title.toLowerCase().includes(q) ||
        v.targetName.toLowerCase().includes(q) ||
        (v.description && v.description.toLowerCase().includes(q)) ||
        v.targetType.toLowerCase().includes(q);
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
            Scheda Dedicata Note & Videoteca Arbitrale
          </h1>
          <p className="text-xs text-slate-400">
            Archivio centralizzato con supporto Drag & Drop e riproduzione video/immagini direttamente in-app
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
              <Film className="w-3.5 h-3.5" /> Videoteca ({videos.length})
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
              onClick={() => {
                setDroppedMedia(null);
                setIsVideoModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FF334B] hover:bg-[#ff4d63] text-black text-xs font-black shadow-[0_0_15px_rgba(255,51,75,0.3)] transition-all"
            >
              <Plus className="w-4 h-4" /> Nuovo Video / Immagine
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
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

          {activeTab === 'NOTE' && (
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
          )}
        </div>

        <div className="text-xs text-slate-400 font-medium">
          {activeTab === 'NOTE' ? (
            <>Visualizzate <strong className="text-[#CCFF00] font-mono">{filteredNotes.length}</strong> note</>
          ) : (
            <>Visualizzati <strong className="text-[#FF334B] font-mono">{filteredVideos.length}</strong> clip video</>
          )}
        </div>
      </div>

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

                {/* Visual attachments preview gallery with in-app viewer */}
                {note.attachments && note.attachments.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-[#1A1F2C] space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Allegati Multimediali ({note.attachments.length}):
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {note.attachments.map((att, i) => {
                        const isImg = att.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i);
                        const isVid = att.match(/\.(mp4|webm|mov|mkv)(\?.*)?$/i) || att.includes('/videos/');

                        return (
                          <div
                            key={i}
                            onClick={() =>
                              openMediaViewer({
                                url: att,
                                title: `${note.targetName} - Allegato ${i + 1}`,
                                subtitle: `Nota arbitrale di ${note.authorName || 'Arbitro'}`,
                                description: note.content,
                                mediaType: isImg ? 'image' : 'video',
                              })
                            }
                            className="relative group/att cursor-pointer rounded-xl bg-[#141824] border border-[#212638] overflow-hidden p-1.5 hover:border-[#CCFF00]/60 transition-all flex items-center gap-2"
                          >
                            <div className="w-10 h-10 rounded-lg bg-black/60 overflow-hidden flex items-center justify-center flex-shrink-0 relative">
                              {isImg ? (
                                <img src={att} alt="Allegato" className="w-full h-full object-cover group-hover/att:scale-110 transition-transform" />
                              ) : isVid ? (
                                <div className="flex items-center justify-center w-full h-full bg-[#FF334B]/10">
                                  <Play className="w-4 h-4 text-[#FF334B] fill-[#FF334B]" />
                                </div>
                              ) : (
                                <Paperclip className="w-4 h-4 text-[#CCFF00]" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-[10px] font-bold text-slate-200 block truncate group-hover/att:text-[#CCFF00] transition-colors">
                                {isImg ? 'Guarda Foto' : isVid ? 'Riproduci Video' : 'Apri File'}
                              </span>
                              <span className="text-[9px] text-slate-500 font-mono">
                                In-App Viewer
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
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
          {/* Quick Drag & Drop Zone at the top of Videoteca */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#0D0F16] border border-[#212638] shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[#CCFF00]/10 border border-[#CCFF00]/30 text-[#CCFF00]">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-white">Caricamento Rapido da PC (Drag & Drop)</h3>
                  <p className="text-[11px] text-slate-400">Trascina un file multimediale direttamente dal tuo computer per catalogarlo subito</p>
                </div>
              </div>
              <span className="hidden sm:inline-flex text-[10px] font-mono px-2 py-0.5 rounded bg-[#181C28] text-slate-400 border border-[#262D40]">
                MP4 • WebM • MOV • JPG • PNG
              </span>
            </div>

            <MediaDropzone
              onUploaded={handleQuickUpload}
              accept="all"
              compact={true}
              helperText="Rilascia qui il tuo file video o immagine: si aprirà la scheda di archiviazione con anteprima istantanea"
            />
          </div>

          {/* Videos Grid with Playable In-App Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVideos.map((vid) => {
              const ytId = getYoutubeVideoId(vid.externalUrl);
              const isImg =
                vid.mediaType === 'image' ||
                Boolean(vid.externalUrl && vid.externalUrl.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i));
              const isDirectVideo = !ytId && !isImg && Boolean(vid.externalUrl);

              const handleCardPlay = () => {
                if (vid.externalUrl) {
                  openMediaViewer({
                    url: vid.externalUrl,
                    title: vid.title,
                    subtitle: vid.targetName,
                    description: vid.description,
                    timestampMark: vid.timestampMark,
                    mediaType: isImg ? 'image' : 'video',
                  });
                }
              };

              return (
                <div
                  key={vid.id}
                  className="rounded-2xl bg-[#0D0F16] border border-[#1F2433] overflow-hidden hover:border-[#CCFF00]/40 transition-all flex flex-col justify-between group shadow-lg"
                >
                  {/* Media Thumbnail / Preview Header */}
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
                        <Film className="w-12 h-12" />
                      </div>
                    )}

                    {/* Glowing play overlay on hover / click */}
                    <div className="absolute inset-0 bg-black/40 group-hover/thumb:bg-black/20 flex items-center justify-center transition-colors">
                      <div className="w-12 h-12 rounded-full bg-[#CCFF00]/90 text-black flex items-center justify-center shadow-[0_0_20px_rgba(204,255,0,0.5)] group-hover/thumb:scale-110 transition-transform">
                        <Play className="w-5 h-5 fill-black ml-0.5" />
                      </div>
                    </div>

                    {/* Source / Format Badge */}
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-black/80 backdrop-blur-md text-white border border-white/20 flex items-center gap-1">
                        {isImg ? (
                          <ImageIcon className="w-3 h-3 text-[#CCFF00]" />
                        ) : ytId ? (
                          <span className="text-[#FF334B]">YouTube</span>
                        ) : (
                          <Film className="w-3 h-3 text-[#CCFF00]" />
                        )}
                        <span>{isImg ? 'Foto' : ytId ? 'Clip' : 'File Locale'}</span>
                      </span>
                    </div>

                    {/* Minute / Timestamp Badge */}
                    {vid.timestampMark && (
                      <div className="absolute bottom-2.5 right-2.5">
                        <span className="flex items-center gap-1 text-[10px] font-mono font-black text-black bg-[#CCFF00] px-2 py-0.5 rounded-full shadow-md">
                          <Clock className="w-3 h-3" /> Min. {vid.timestampMark}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Body */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400 border-b border-[#1A1F2C] pb-2">
                        <span className="font-extrabold uppercase px-2 py-0.5 rounded text-[10px] bg-[#181C28] text-slate-300 border border-[#262C3D]">
                          {vid.targetType}
                        </span>
                        <span className="text-[11px] font-bold text-[#CCFF00] truncate max-w-[150px]">
                          {vid.targetName}
                        </span>
                      </div>

                      <h3
                        onClick={handleCardPlay}
                        className="font-bold text-sm text-white mt-2.5 group-hover:text-[#CCFF00] transition-colors cursor-pointer"
                      >
                        {vid.title}
                      </h3>

                      {vid.description && (
                        <p className="text-xs text-slate-300 mt-1.5 leading-relaxed line-clamp-2">
                          {vid.description}
                        </p>
                      )}
                    </div>

                    {/* Card Actions */}
                    <div className="pt-3 border-t border-[#1A1F2C] flex items-center justify-between">
                      <button
                        onClick={handleCardPlay}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#CCFF00] hover:bg-[#d8ff33] text-black text-xs font-black transition-all shadow-[0_0_12px_rgba(204,255,0,0.3)]"
                      >
                        <Play className="w-3.5 h-3.5 fill-black text-black" />
                        <span>Riproduci in App</span>
                      </button>

                      <div className="flex items-center gap-2">
                        {vid.externalUrl && (
                          <a
                            href={vid.externalUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                            title="Apri sorgente esterna"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}

                        <button
                          onClick={() => handleDeleteVideo(vid.id)}
                          className="p-1.5 text-slate-500 hover:text-[#FF334B] rounded-lg hover:bg-rose-500/10 transition-colors"
                          title="Elimina clip"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredVideos.length === 0 && (
              <div className="col-span-full py-16 text-center text-slate-500 text-sm">
                Nessun contenuto multimediale trovato. Trascina un file nel riquadro superiore o clicca &quot;Nuovo Video / Immagine&quot;.
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

      {/* Video Modal with Drag & Drop */}
      <VideoModal
        isOpen={isVideoModalOpen}
        onClose={() => {
          setIsVideoModalOpen(false);
          setDroppedMedia(null);
        }}
        initialUploadedMedia={droppedMedia}
        onSave={(data) => {
          DbService.addVideo(data);
          loadContent();
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
