-- ==============================================================================
-- REFSTUDIO - Aggiornamento Vincolo Video per Supporto Note Video Staff
-- Esegui questo script nell'SQL Editor di Supabase se desideri consentire
-- i target_type 'staff', 'allenatore', 'dirigente' direttamente nella tabella videos.
-- ==============================================================================

ALTER TABLE public.videos DROP CONSTRAINT IF EXISTS videos_target_type_check;
ALTER TABLE public.videos ADD CONSTRAINT videos_target_type_check 
  CHECK (target_type IN ('squadra', 'giocatore', 'partita', 'staff', 'allenatore', 'dirigente'));
