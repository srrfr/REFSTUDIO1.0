-- ==============================================================================
-- REFSTUDIO - Script di Aggiornamento Incrementale (Migration)
-- Da incollare ed eseguire nell'SQL Editor di Supabase se avevi già eseguito il vecchio schema
-- ==============================================================================

-- 1. Aggiorna colonne della tabella notes se la tabella esiste già
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS author_role TEXT DEFAULT 'AE';
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS author_avatar TEXT;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS author_section TEXT;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_notes_author ON public.notes(author_id);
CREATE INDEX IF NOT EXISTS idx_notes_public ON public.notes(is_public);

-- 2. Crea la nuova tabella profiles per la gestione account arbitrali
CREATE TABLE IF NOT EXISTS public.profiles (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    display_name TEXT NOT NULL,
    email TEXT,
    role TEXT DEFAULT 'arbitro' NOT NULL,
    referee_role TEXT DEFAULT 'AE' NOT NULL CHECK (referee_role IN ('AE', 'AA', 'OA')),
    section_aia TEXT DEFAULT 'Bologna' NOT NULL,
    category_aia TEXT DEFAULT 'Eccellenza' NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select on profiles" ON public.profiles;
CREATE POLICY "Allow select on profiles" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert on profiles" ON public.profiles;
CREATE POLICY "Allow insert on profiles" ON public.profiles FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update on profiles" ON public.profiles;
CREATE POLICY "Allow update on profiles" ON public.profiles FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow delete on profiles" ON public.profiles;
CREATE POLICY "Allow delete on profiles" ON public.profiles FOR DELETE USING (true);

-- 3. Inserimento dei 5 profili arbitri ufficiali con credenziali
INSERT INTO public.profiles (username, password, display_name, email, role, referee_role, section_aia, category_aia)
VALUES
    ('samueleromini', 'samueleromini1', 'Samuele Romini', 'samuele.romini@refstudio.internal', 'admin', 'AE', 'Sezione AIA Bologna', 'Eccellenza'),
    ('lucaghirardi', 'lucaghirardi1', 'Luca Ghirardi', 'luca.ghirardi@refstudio.internal', 'arbitro', 'AA', 'Sezione AIA Parma', 'Eccellenza'),
    ('simoneclemente', 'simoneclemente1', 'Simone Clemente', 'simone.clemente@refstudio.internal', 'arbitro', 'AE', 'Sezione AIA Forlì', 'Eccellenza'),
    ('karimpalombo', 'karimpalombo1', 'Karim Palombo', 'karim.palombo@refstudio.internal', 'arbitro', 'AA', 'Sezione AIA Ravenna', 'Eccellenza'),
    ('riccardosamaritani', 'riccardosamaritani1', 'Riccardo Samaritani', 'riccardo.samaritani@refstudio.internal', 'arbitro', 'OA', 'Sezione AIA Ferrara', 'Eccellenza')
ON CONFLICT (username) DO UPDATE SET
    password = EXCLUDED.password,
    display_name = EXCLUDED.display_name,
    referee_role = EXCLUDED.referee_role,
    section_aia = EXCLUDED.section_aia,
    category_aia = EXCLUDED.category_aia,
    role = EXCLUDED.role,
    updated_at = timezone('utc'::text, now());

-- 4. Abilita Realtime per la tabella profiles
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
    EXCEPTION WHEN duplicate_object THEN
        -- Già presente nella pubblicazione, ignora
    END;
END $$;
