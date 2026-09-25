import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const BUCKET_NAME = 'refstudio-media';

function getMediaDetails(originalName: string, mimeType: string) {
  const extMatch = originalName.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : (mimeType.includes('image') ? 'jpg' : 'mp4');
  const isImage = mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext);
  const isVideo = mimeType.startsWith('video/') || ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v', 'ogv'].includes(ext);
  const category = isImage ? 'images' : 'videos';
  const mediaType: 'image' | 'video' = isImage ? 'image' : 'video';
  const baseClean = originalName
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 40);
  const safeFileName = `${Date.now()}_${baseClean}.${ext}`;
  const storagePath = `${category}/${safeFileName}`;

  return { ext, isImage, isVideo, category, mediaType, safeFileName, storagePath };
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    // 1. GESTIONE RICHIESTA URL FIRMATO PER UPLOAD DIRETTO (BYPASS DEI LIMITI DI RETE E SERVERLESS)
    if (contentType.includes('application/json')) {
      const body = await req.json().catch(() => ({}));
      if (body.action === 'get-signed-url') {
        const originalName = body.fileName || 'uploaded_media.mp4';
        const mimeType = body.mimeType || '';

        const { ext, isImage, isVideo, category, mediaType, safeFileName, storagePath } = getMediaDetails(originalName, mimeType);

        if (!isImage && !isVideo) {
          return NextResponse.json(
            { success: false, message: 'Formato non supportato. Carica un file video (MP4, WebM, MOV) o immagine (JPG, PNG, WebP).' },
            { status: 400 }
          );
        }

        if (supabaseUrl && serviceRoleKey) {
          try {
            const supabase = createClient(supabaseUrl, serviceRoleKey);
            const { data: signData, error: signError } = await supabase.storage
              .from(BUCKET_NAME)
              .createSignedUploadUrl(storagePath);

            if (!signError && signData) {
              const { data: pubData } = supabase.storage
                .from(BUCKET_NAME)
                .getPublicUrl(storagePath);

              return NextResponse.json({
                success: true,
                signedUrl: signData.signedUrl,
                token: signData.token,
                path: signData.path,
                publicUrl: pubData.publicUrl,
                safeFileName,
                originalName,
                mediaType,
                mimeType,
                storagePath,
              });
            } else if (signError) {
              console.warn('Avviso creazione Signed URL Supabase:', signError.message);
            }
          } catch (cloudErr) {
            console.warn('Errore connessione Supabase Storage Signed URL:', cloudErr);
          }
        }

        return NextResponse.json({
          success: false,
          fallbackToLocal: true,
          message: 'Cloud Storage non configurato per upload diretto, passaggio a fallback multipart.',
        });
      }
    }

    // 2. GESTIONE UPLOAD STANDARD MULTIPART (per file caricati direttamente via FormData)
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, message: 'Nessun file caricato' },
        { status: 400 }
      );
    }

    const mimeType = file.type || '';
    const originalName = file.name || 'uploaded_media';
    const { ext, isImage, isVideo, category, mediaType, safeFileName, storagePath } = getMediaDetails(originalName, mimeType);

    if (!isImage && !isVideo) {
      return NextResponse.json(
        { success: false, message: 'Formato non supportato. Carica un file video (MP4, WebM, MOV) o immagine (JPG, PNG, WebP).' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Salvataggio locale in public/uploads/...
    const localRelativePath = `/uploads/${category}/${safeFileName}`;
    const uploadDirPath = path.join(process.cwd(), 'public', 'uploads', category);
    await fs.promises.mkdir(uploadDirPath, { recursive: true });
    const localFilePath = path.join(uploadDirPath, safeFileName);
    await fs.promises.writeFile(localFilePath, buffer);

    // 2. Salvataggio cloud in Supabase Storage (se configurato)
    let cloudUrl: string | null = null;
    if (supabaseUrl && serviceRoleKey) {
      try {
        const supabase = createClient(supabaseUrl, serviceRoleKey);

        const { error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(storagePath, buffer, {
            contentType: mimeType || (isImage ? 'image/jpeg' : 'video/mp4'),
            upsert: true,
          });

        if (!uploadError) {
          const { data: pubData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(storagePath);
          if (pubData && pubData.publicUrl) {
            cloudUrl = pubData.publicUrl;
          }
        } else {
          console.warn('Avviso upload Supabase Storage:', uploadError.message);
        }
      } catch (cloudErr) {
        console.warn('Errore connessione Supabase Storage:', cloudErr);
      }
    }

    // Priorità URL: Cloud URL se disponibile per accesso multipiattaforma, altrimenti Local URL
    const finalUrl = cloudUrl || localRelativePath;

    return NextResponse.json({
      success: true,
      url: finalUrl,
      localUrl: localRelativePath,
      cloudUrl: cloudUrl || undefined,
      fileName: safeFileName,
      originalName,
      fileSize: buffer.length,
      mediaType,
      mimeType,
    });
  } catch (error: any) {
    console.error('Errore durante il caricamento del file:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Errore interno del server durante il caricamento' },
      { status: 500 }
    );
  }
}
