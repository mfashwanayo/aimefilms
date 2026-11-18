from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
ADMIN_NAME = os.getenv("ADMIN_NAME", "").strip()
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "").strip().lower()
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
TOKEN_SECRET = os.getenv("TOKEN_SECRET", "")
TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7

# Local development writes to backend-python/storage/public/films. Production
# can keep direct-to-Supabase uploads by setting VIDEO_STORAGE_DRIVER=supabase.
VIDEO_STORAGE_DRIVER = os.getenv("VIDEO_STORAGE_DRIVER", "local").strip().lower()
_raw_storage_dir = Path(os.getenv("VIDEO_STORAGE_DIR", "storage")).expanduser()
VIDEO_STORAGE_ROOT = (_raw_storage_dir if _raw_storage_dir.is_absolute() else BACKEND_DIR / _raw_storage_dir).resolve()
VIDEO_PUBLIC_DIR = (VIDEO_STORAGE_ROOT / "public").resolve()
VIDEO_TEMP_DIR = (VIDEO_STORAGE_ROOT / ".tmp").resolve()

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
SUPABASE_PUBLISHABLE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY", "").strip()
SUPABASE_VIDEO_BUCKET = os.getenv("SUPABASE_VIDEO_BUCKET", "aimefilms-videos").strip()
TMDB_API_KEY = os.getenv("TMDB_API_KEY", "").strip()

try:
    MAX_VIDEO_UPLOAD_MB = max(1, int(os.getenv("MAX_VIDEO_UPLOAD_MB", "3900")))
except ValueError:
    MAX_VIDEO_UPLOAD_MB = 3900
MAX_VIDEO_UPLOAD_BYTES = MAX_VIDEO_UPLOAD_MB * 1_000_000
VIDEO_MIME_BY_EXTENSION = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".mkv": "video/x-matroska",
}

FRONTEND_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.getenv("FRONTEND_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

DB_POOL_MIN_SIZE = max(1, int(os.getenv("DB_POOL_MIN_SIZE", "1")))
DB_POOL_MAX_SIZE = max(DB_POOL_MIN_SIZE, int(os.getenv("DB_POOL_MAX_SIZE", "10")))


def validate_config() -> None:
    missing = [
        key for key, value in (
            ("DATABASE_URL", DATABASE_URL),
            ("ADMIN_NAME", ADMIN_NAME),
            ("ADMIN_EMAIL", ADMIN_EMAIL),
            ("ADMIN_PASSWORD", ADMIN_PASSWORD),
            ("TOKEN_SECRET", TOKEN_SECRET),
        ) if not value
    ]
    if missing:
        raise RuntimeError("Missing required environment variables: " + ", ".join(missing))
    if not DATABASE_URL.startswith(("postgresql://", "postgres://")):
        raise RuntimeError("DATABASE_URL must be a PostgreSQL connection string from Supabase Connect.")
    if len(ADMIN_PASSWORD) < 12:
        raise RuntimeError("ADMIN_PASSWORD must be at least 12 characters long.")
    if len(TOKEN_SECRET) < 32:
        raise RuntimeError("TOKEN_SECRET must be at least 32 characters long.")
    if VIDEO_STORAGE_DRIVER not in {"local", "supabase"}:
        raise RuntimeError("VIDEO_STORAGE_DRIVER must be either 'local' or 'supabase'.")
    if VIDEO_STORAGE_DRIVER == "supabase" and not (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY):
        raise RuntimeError("Supabase video storage requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
