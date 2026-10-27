-- AimeFilms PostgreSQL schema for Supabase.
-- The Python API connects server-side using DATABASE_URL. Do not put the
-- database password or a Supabase secret/service-role key in frontend code.

CREATE TABLE IF NOT EXISTS public.users (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  avatar TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  is_verified SMALLINT NOT NULL DEFAULT 1,
  can_download SMALLINT NOT NULL DEFAULT 1,
  language TEXT NOT NULL DEFAULT 'EN',
  is_blocked SMALLINT NOT NULL DEFAULT 0,
  joined_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.movies (
  id TEXT PRIMARY KEY,
  ordinal BIGSERIAL UNIQUE,
  name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT 'aimefilms',
  category TEXT NOT NULL DEFAULT 'General Entertainment',
  section TEXT NOT NULL DEFAULT 'english',
  is_hidden SMALLINT NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  highlights TEXT NOT NULL DEFAULT '[]',
  pros TEXT NOT NULL DEFAULT '[]',
  image_url TEXT NOT NULL DEFAULT '',
  logo_url TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  video_url TEXT NOT NULL DEFAULT '',
  full_movie_url TEXT NOT NULL DEFAULT '',
  rating TEXT NOT NULL DEFAULT '0',
  year TEXT NOT NULL DEFAULT '',
  duration TEXT NOT NULL DEFAULT '',
  cast TEXT NOT NULL DEFAULT '[]',
  synopsis TEXT NOT NULL DEFAULT '',
  is_trending SMALLINT NOT NULL DEFAULT 0,
  is_new SMALLINT NOT NULL DEFAULT 0,
  genre TEXT NOT NULL DEFAULT '[]',
  match_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  price TEXT
);
CREATE INDEX IF NOT EXISTS movies_ordinal_idx ON public.movies (ordinal DESC);

CREATE TABLE IF NOT EXISTS public.views (
  movie_id TEXT PRIMARY KEY,
  view_count BIGINT NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS public.logs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  details TEXT NOT NULL,
  user_email TEXT,
  timestamp TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS public.messages (
  id TEXT PRIMARY KEY,
  to_email TEXT NOT NULL,
  from_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  is_read SMALLINT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS public.user_lists (
  email TEXT NOT NULL,
  list_type TEXT NOT NULL,
  movie_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (email, list_type, movie_id)
);

-- Browser/anon API users get no direct table access by default. The trusted
-- backend talks to Postgres with DATABASE_URL. Do not add anon policies for
-- private user, message, log, or admin data.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_lists ENABLE ROW LEVEL SECURITY;

-- Publicly readable streaming assets; uploads are performed only by the
-- trusted FastAPI backend using SUPABASE_SERVICE_ROLE_KEY.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'aimefilms-videos',
  'aimefilms-videos',
  TRUE,
  3900000000,
  ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
