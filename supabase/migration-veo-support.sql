-- ==============================================================================
-- REFSTUDIO - Aggiornamento Vincolo Video Source per Supporto Veo
-- Da incollare ed eseguire nell'SQL Editor di Supabase se si desidera aggiornare
-- formalmente il vincolo di tabella per 'VEO' sul database cloud.
-- ==============================================================================

ALTER TABLE public.videos DROP CONSTRAINT IF EXISTS videos_video_source_check;
ALTER TABLE public.videos ADD CONSTRAINT videos_video_source_check CHECK (video_source IN ('YOUTUBE', 'LOCAL', 'STORAGE', 'VEO'));
