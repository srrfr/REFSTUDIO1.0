'use client';

import React, { useState, useRef, useCallback } from 'react';
import { UploadCloud, Film, Image as ImageIcon, CheckCircle, AlertCircle, X, Loader2 } from 'lucide-react';

export interface UploadResult {
  url: string;
  localUrl: string;
  cloudUrl?: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  mediaType: 'image' | 'video';
  mimeType?: string;
}

interface MediaDropzoneProps {
  onUploaded: (result: UploadResult) => void;
  accept?: 'video' | 'image' | 'all';
  compact?: boolean;
  currentPreviewUrl?: string;
  onClear?: () => void;
  helperText?: string;
}

export const MediaDropzone: React.FC<MediaDropzoneProps> = ({
  onUploaded,
  accept = 'all',
  compact = false,
  currentPreviewUrl,
  onClear,
  helperText,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; type: 'image' | 'video'; name: string; size?: number } | null>(
    currentPreviewUrl
      ? {
          url: currentPreviewUrl,
          type: currentPreviewUrl.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i) ? 'image' : 'video',
          name: 'File caricato',
        }
      : null
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const acceptedMimeTypes =
    accept === 'video'
      ? 'video/mp4,video/webm,video/quicktime,video/x-matroska'
      : accept === 'image'
      ? 'image/jpeg,image/png,image/webp,image/gif'
      : 'video/mp4,video/webm,video/quicktime,video/x-matroska,image/jpeg,image/png,image/webp,image/gif';

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const processFile = useCallback(
    async (file: File) => {
      setUploadError(null);

      // Controllo tipo file
      const isImg = file.type.startsWith('image/');
      const isVid = file.type.startsWith('video/') || file.name.match(/\.(mp4|webm|mov|mkv)$/i);

      if (accept === 'video' && !isVid) {
        setUploadError('Formato non consentito: seleziona un video (MP4, WebM, MOV).');
        return;
      }
      if (accept === 'image' && !isImg) {
        setUploadError('Formato non consentito: seleziona un\'immagine (JPG, PNG, WebP).');
        return;
      }
      if (!isImg && !isVid) {
        setUploadError('Seleziona un file valido: video (MP4, WebM, MOV) o immagine (JPG, PNG, WebP).');
        return;
      }

      // Limite dimensione (150MB per video, 25MB per immagini)
      const maxSize = isVid ? 150 * 1024 * 1024 : 25 * 1024 * 1024;
      if (file.size > maxSize) {
        setUploadError(
          `Il file supera il limite consentito di ${isVid ? '150 MB' : '25 MB'}. Riduci le dimensioni.`
        );
        return;
      }

      // Imposta preview locale istantanea prima dell'invio
      const localBlobUrl = URL.createObjectURL(file);
      setPreview({
        url: localBlobUrl,
        type: isImg ? 'image' : 'video',
        name: file.name,
        size: file.size,
      });

      setIsUploading(true);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Errore durante il caricamento del file');
        }

        onUploaded({
          url: data.url,
          localUrl: data.localUrl,
          cloudUrl: data.cloudUrl,
          fileName: data.fileName,
          originalName: data.originalName,
          fileSize: data.fileSize,
          mediaType: data.mediaType,
          mimeType: data.mimeType,
        });

        setPreview({
          url: data.url,
          type: data.mediaType,
          name: data.originalName,
          size: data.fileSize,
        });
      } catch (err: any) {
        console.error('Upload failed:', err);
        setUploadError(err.message || 'Errore di connessione durante l\'upload.');
      } finally {
        setIsUploading(false);
      }
    },
    [accept, onUploaded]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleClearPreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreview(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (onClear) onClear();
  };

  return (
    <div className="w-full space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedMimeTypes}
        onChange={handleFileChange}
        className="hidden"
      />

      {preview && !uploadError ? (
        <div className="relative rounded-2xl bg-[#0B0D14] border border-[#212638] overflow-hidden p-3.5 flex items-center justify-between gap-3 shadow-lg group">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="relative w-16 h-16 rounded-xl bg-black/60 border border-[#23293B] overflow-hidden flex items-center justify-center flex-shrink-0">
              {preview.type === 'image' ? (
                <img src={preview.url} alt={preview.name} className="w-full h-full object-cover" />
              ) : (
                <video src={preview.url} className="w-full h-full object-cover" />
              )}
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                {preview.type === 'video' ? (
                  <Film className="w-5 h-5 text-[#FF334B]" />
                ) : (
                  <ImageIcon className="w-5 h-5 text-[#CCFF00]" />
                )}
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white truncate max-w-[200px] sm:max-w-[280px]">
                  {preview.name}
                </span>
                {isUploading ? (
                  <span className="flex items-center gap-1 text-[10px] font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    <Loader2 className="w-3 h-3 animate-spin" /> Caricamento...
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-black text-[#CCFF00] bg-[#CCFF00]/10 px-2 py-0.5 rounded-full border border-[#CCFF00]/25">
                    <CheckCircle className="w-3 h-3 text-[#CCFF00]" /> Pronto
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                {preview.type === 'video' ? 'Video Clip' : 'Immagine'} • {formatFileSize(preview.size)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-2.5 py-1.5 rounded-lg bg-[#141824] hover:bg-[#1E2435] text-slate-300 text-xs font-bold border border-[#212638] transition-all"
            >
              Cambia
            </button>
            <button
              type="button"
              onClick={handleClearPreview}
              disabled={isUploading}
              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/20 transition-all"
              title="Rimuovi file"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200 flex flex-col items-center justify-center text-center select-none ${
            compact ? 'py-5 px-4' : 'py-8 px-6'
          } ${
            isDragging
              ? 'border-[#CCFF00] bg-[#CCFF00]/10 shadow-[0_0_25px_rgba(204,255,0,0.2)] scale-[1.01]'
              : 'border-[#262D42] bg-[#0A0D15]/80 hover:border-[#CCFF00]/60 hover:bg-[#121622]'
          }`}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-[#CCFF00] animate-spin" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-white">Caricamento in corso...</p>
                <p className="text-[11px] text-slate-400">Elaborazione e ottimizzazione file multimediale</p>
              </div>
            </div>
          ) : (
            <>
              <div className="p-3 rounded-2xl bg-[#141824] border border-[#262D42] mb-3 text-slate-300 shadow-md flex items-center gap-2 group-hover:border-[#CCFF00]/40 transition-colors">
                <UploadCloud className="w-6 h-6 text-[#CCFF00]" />
                <div className="flex items-center gap-1 pl-1 border-l border-slate-700">
                  <Film className="w-3.5 h-3.5 text-[#FF334B]" />
                  <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-black text-white tracking-wide">
                  <span className="text-[#CCFF00] underline underline-offset-4">Trascina e rilascia</span> qui il tuo file o{' '}
                  <span className="text-[#CCFF00]">sfoglia dal PC</span>
                </p>
                <p className="text-[11px] text-slate-400">
                  {helperText ||
                    (accept === 'video'
                      ? 'Supporta video MP4, WebM, MOV fino a 150MB'
                      : accept === 'image'
                      ? 'Supporta immagini JPG, PNG, WebP fino a 25MB'
                      : 'Supporta video (MP4, WebM, MOV) e immagini (JPG, PNG, WebP)')}
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {uploadError && (
        <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/25 p-2.5 rounded-xl animate-in fade-in">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}
    </div>
  );
};
