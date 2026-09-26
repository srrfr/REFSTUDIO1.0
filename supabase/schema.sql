-- ==============================================================================
-- REFSTUDIO - Schema Database Supabase (PostgreSQL)
-- Piattaforma Gestionale & Match Operations per Arbitri di Calcio
-- ==============================================================================

-- 1. Tabella: SQUADRE (teams)
CREATE TABLE IF NOT EXISTS public.teams (
    id TEXT PRIMARY KEY,
    championship_id TEXT DEFAULT 'eccellenza-er',
    name TEXT NOT NULL,
    normalized_name TEXT,
    girone TEXT NOT NULL,
    city TEXT,
    logo_url TEXT,
    stadium TEXT,
    stadium_address TEXT,
    pitch_surface TEXT,
    tuttocampo_url TEXT,
    technical_level INTEGER DEFAULT 3 CHECK (technical_level BETWEEN 1 AND 5),
    aggression_level INTEGER DEFAULT 3 CHECK (aggression_level BETWEEN 1 AND 5),
    bench_attitude TEXT,
    coach_attitude TEXT,
    coach_name TEXT,
    manager_name TEXT,
    referee_notes TEXT,
    stats JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indici squadre
CREATE INDEX IF NOT EXISTS idx_teams_girone ON public.teams(girone);
CREATE INDEX IF NOT EXISTS idx_teams_name ON public.teams(name);

-- 2. Tabella: CALCIATORI (players)
CREATE TABLE IF NOT EXISTS public.players (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    team_name TEXT NOT NULL,
    championship_id TEXT DEFAULT 'eccellenza-er',
    girone TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    birth_date TEXT,
    age INTEGER,
    role TEXT NOT NULL CHECK (role IN ('POR', 'DIF', 'CEN', 'ATT', 'SCONOSCIUTO')),
    kit_number INTEGER,
    height_cm INTEGER,
    preferred_foot TEXT,
    goals INTEGER DEFAULT 0,
    appearances INTEGER DEFAULT 0,
    yellow_cards INTEGER DEFAULT 0,
    red_cards INTEGER DEFAULT 0,
    disciplinary_status TEXT DEFAULT 'REGOLARE' CHECK (disciplinary_status IN ('REGOLARE', 'DIFFIDATO', 'SQUALIFICATO', 'IN_DUBBIO')),
    custom_tags TEXT[] DEFAULT '{}',
    referee_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indici calciatori
CREATE INDEX IF NOT EXISTS idx_players_team_id ON public.players(team_id);
CREATE INDEX IF NOT EXISTS idx_players_girone ON public.players(girone);
CREATE INDEX IF NOT EXISTS idx_players_role ON public.players(role);
CREATE INDEX IF NOT EXISTS idx_players_cards ON public.players(yellow_cards DESC, red_cards DESC);

-- 3. Tabella: PARTITE (matches)
CREATE TABLE IF NOT EXISTS public.matches (
    id TEXT PRIMARY KEY,
    championship_id TEXT DEFAULT 'eccellenza-er',
    girone TEXT NOT NULL,
    match_day INTEGER NOT NULL,
    date_text TEXT,
    match_date TIMESTAMPTZ,
    played BOOLEAN DEFAULT false NOT NULL,
    home_team_id TEXT NOT NULL,
    home_team_name TEXT NOT NULL,
    away_team_id TEXT NOT NULL,
    away_team_name TEXT NOT NULL,
    home_score INTEGER,
    away_score INTEGER,
    referee_name TEXT,
    match_field TEXT,
    observations TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indici partite
CREATE INDEX IF NOT EXISTS idx_matches_girone_day ON public.matches(girone, match_day);
CREATE INDEX IF NOT EXISTS idx_matches_home_away ON public.matches(home_team_id, away_team_id);

-- 4. Tabella: CLASSIFICHE (standings)
CREATE TABLE IF NOT EXISTS public.standings (
    id TEXT PRIMARY KEY,
    girone TEXT NOT NULL,
    position INTEGER NOT NULL,
    team_name TEXT NOT NULL,
    team_id TEXT,
    points INTEGER DEFAULT 0 NOT NULL,
    played INTEGER DEFAULT 0 NOT NULL,
    won INTEGER DEFAULT 0 NOT NULL,
    drawn INTEGER DEFAULT 0 NOT NULL,
    lost INTEGER DEFAULT 0 NOT NULL,
    goals_for INTEGER DEFAULT 0 NOT NULL,
    goals_against INTEGER DEFAULT 0 NOT NULL,
    goal_difference INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indici classifiche
CREATE INDEX IF NOT EXISTS idx_standings_girone ON public.standings(girone, position);

-- 5. Tabella: NOTE CONFIDENZIALI ARBITRO (notes)
CREATE TABLE IF NOT EXISTS public.notes (
    id TEXT PRIMARY KEY,
    author_id TEXT DEFAULT 'samueleromini' NOT NULL,
    author_name TEXT,
    author_role TEXT DEFAULT 'AE',
    author_avatar TEXT,
    author_section TEXT,
    is_public BOOLEAN DEFAULT true NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('squadra', 'giocatore', 'allenatore', 'dirigente', 'partita')),
    target_id TEXT NOT NULL,
    target_name TEXT NOT NULL,
    content TEXT NOT NULL,
    priority TEXT DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH')),
    attachments TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Assicura l'esistenza delle nuove colonne se la tabella notes esisteva già in precedenza
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS author_role TEXT DEFAULT 'AE';
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS author_avatar TEXT;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS author_section TEXT;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true NOT NULL;

-- Indici note
CREATE INDEX IF NOT EXISTS idx_notes_target ON public.notes(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_notes_priority ON public.notes(priority);
CREATE INDEX IF NOT EXISTS idx_notes_author ON public.notes(author_id);
CREATE INDEX IF NOT EXISTS idx_notes_public ON public.notes(is_public);

-- 6. Tabella: VIDEO & CLIP ANALISI (videos)
CREATE TABLE IF NOT EXISTS public.videos (
    id TEXT PRIMARY KEY,
    author_id TEXT DEFAULT 'ref-1' NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('squadra', 'giocatore', 'partita')),
    target_id TEXT NOT NULL,
    target_name TEXT NOT NULL,
    video_source TEXT DEFAULT 'YOUTUBE' CHECK (video_source IN ('YOUTUBE', 'LOCAL', 'STORAGE', 'VEO')),
    external_url TEXT,
    storage_path TEXT,
    title TEXT NOT NULL,
    description TEXT,
    timestamp_mark TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indici video
CREATE INDEX IF NOT EXISTS idx_videos_target ON public.videos(target_type, target_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Configurate per consentire lettura e scrittura agli operatori della piattaforma
-- ==============================================================================

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- Policy per consentire SELECT su tutte le tabelle agli utenti anonimi / autenticati
DROP POLICY IF EXISTS "Allow select on teams" ON public.teams;
CREATE POLICY "Allow select on teams" ON public.teams FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow select on players" ON public.players;
CREATE POLICY "Allow select on players" ON public.players FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow select on matches" ON public.matches;
CREATE POLICY "Allow select on matches" ON public.matches FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow select on standings" ON public.standings;
CREATE POLICY "Allow select on standings" ON public.standings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow select on notes" ON public.notes;
CREATE POLICY "Allow select on notes" ON public.notes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow select on videos" ON public.videos;
CREATE POLICY "Allow select on videos" ON public.videos FOR SELECT USING (true);

-- Policy per consentire INSERT / UPDATE / DELETE su tutte le tabelle
DROP POLICY IF EXISTS "Allow insert on teams" ON public.teams;
CREATE POLICY "Allow insert on teams" ON public.teams FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow update on teams" ON public.teams;
CREATE POLICY "Allow update on teams" ON public.teams FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow delete on teams" ON public.teams;
CREATE POLICY "Allow delete on teams" ON public.teams FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow insert on players" ON public.players;
CREATE POLICY "Allow insert on players" ON public.players FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow update on players" ON public.players;
CREATE POLICY "Allow update on players" ON public.players FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow delete on players" ON public.players;
CREATE POLICY "Allow delete on players" ON public.players FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow insert on matches" ON public.matches;
CREATE POLICY "Allow insert on matches" ON public.matches FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow update on matches" ON public.matches;
CREATE POLICY "Allow update on matches" ON public.matches FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow delete on matches" ON public.matches;
CREATE POLICY "Allow delete on matches" ON public.matches FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow insert on standings" ON public.standings;
CREATE POLICY "Allow insert on standings" ON public.standings FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow update on standings" ON public.standings;
CREATE POLICY "Allow update on standings" ON public.standings FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow delete on standings" ON public.standings;
CREATE POLICY "Allow delete on standings" ON public.standings FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow insert on notes" ON public.notes;
CREATE POLICY "Allow insert on notes" ON public.notes FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow update on notes" ON public.notes;
CREATE POLICY "Allow update on notes" ON public.notes FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow delete on notes" ON public.notes;
CREATE POLICY "Allow delete on notes" ON public.notes FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow insert on videos" ON public.videos;
CREATE POLICY "Allow insert on videos" ON public.videos FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow update on videos" ON public.videos;
CREATE POLICY "Allow update on videos" ON public.videos FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow delete on videos" ON public.videos;
CREATE POLICY "Allow delete on videos" ON public.videos FOR DELETE USING (true);

-- 7. Tabella: PROFILI UTENTI ARBITRI (profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    display_name TEXT NOT NULL,
    email TEXT,
    role TEXT DEFAULT 'arbitro' NOT NULL, -- 'arbitro' | 'admin'
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

-- Inserimento profili utenti ufficiali RefStudio
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

-- ==============================================================================
-- REALTIME SUBSCRIPTIONS & REPLICA IDENTITY
-- Abilita il broadcast in tempo reale delle modifiche di squadra, note e partite
-- ==============================================================================

ALTER TABLE public.teams REPLICA IDENTITY FULL;
ALTER TABLE public.players REPLICA IDENTITY FULL;
ALTER TABLE public.matches REPLICA IDENTITY FULL;
ALTER TABLE public.standings REPLICA IDENTITY FULL;
ALTER TABLE public.notes REPLICA IDENTITY FULL;
ALTER TABLE public.videos REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

DO $$
BEGIN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.teams; EXCEPTION WHEN duplicate_object THEN END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.players; EXCEPTION WHEN duplicate_object THEN END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.matches; EXCEPTION WHEN duplicate_object THEN END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.standings; EXCEPTION WHEN duplicate_object THEN END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notes; EXCEPTION WHEN duplicate_object THEN END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.videos; EXCEPTION WHEN duplicate_object THEN END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles; EXCEPTION WHEN duplicate_object THEN END;
END $$;
