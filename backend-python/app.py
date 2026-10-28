from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, quote, unquote, urlparse

from dotenv import load_dotenv
import psycopg
import requests
from psycopg.rows import dict_row
from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.security import HTTPBearer
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

load_dotenv(Path(__file__).resolve().parent / ".env")

# All credentials are provided by the backend environment (Render), never by the
# browser or checked-in source. DATABASE_URL must be the PostgreSQL connection
# string from Supabase's Connect panel, not the https://<project>.supabase.co URL.
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
ADMIN_NAME = os.getenv("ADMIN_NAME", "").strip()
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "").strip().lower()
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
TOKEN_SECRET = os.getenv("TOKEN_SECRET", "")
TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7

# Video uploads use Supabase Storage. Keep this key private and server-side.
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


app = FastAPI(
    title="AimeFilms API",
    version="1.0.0",
    description="Backend API for the AimeFilms movie catalogue, accounts, watchlists, messages, and admin tools.",
)

video_upload_bearer = HTTPBearer(auto_error=False)

@app.middleware("http")
async def reject_oversized_video_uploads(request: Request, call_next):
    """Reject oversized uploads early when Content-Length is supplied."""
    if request.url.path == "/api/admin/videos/upload":
        declared = request.headers.get("content-length")
        if declared:
            try:
                if int(declared) > MAX_VIDEO_UPLOAD_BYTES + (1024 * 1024):
                    return JSONResponse(
                        status_code=413,
                        content={
                            "success": False,
                            "message": f"Video upload exceeds the configured {MAX_VIDEO_UPLOAD_MB} MB limit.",
                        },
                    )
            except ValueError:
                return JSONResponse(status_code=400, content={"success": False, "message": "Invalid Content-Length."})
    return await call_next(request)


@app.exception_handler(HTTPException)
async def http_error_response(request: Request, exc: HTTPException) -> JSONResponse:
    """Keep API error bodies easy for the React client to display."""
    message = str(exc.detail) if exc.detail is not None else "Request failed."
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "message": message, "detail": message},
        headers=exc.headers,
    )
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

MOVIE_FIELDS = [
    "id", "name", "brand", "category", "section", "is_hidden", "description",
    "highlights", "pros", "image_url", "logo_url", "link", "video_url",
    "full_movie_url", "rating", "year", "duration", "cast", "synopsis",
    "is_trending", "is_new", "genre", "match_score", "price", "tmdb_id", "version",
    "subcategory", "preview_text", "landscape_image_url", "director", "producer",
    "languages", "tags", "subtitle_tracks", "audio_tracks",
]
JSON_FIELDS = {"highlights", "pros", "cast", "genre", "languages", "tags", "subtitle_tracks", "audio_tracks"}
BOOLEAN_FIELDS = {"is_hidden", "is_trending", "is_new"}
MOVIE_DEFAULTS: dict[str, Any] = {
    "name": "Untitled movie", "brand": "aimefilms", "category": "General Entertainment",
    "section": "english", "is_hidden": False, "description": "", "highlights": [],
    "pros": [], "image_url": "", "logo_url": "", "link": "", "video_url": "",
    "full_movie_url": "", "rating": "0", "year": "", "duration": "", "cast": [],
    "synopsis": "", "is_trending": False, "is_new": False, "genre": [],
    "match_score": 0, "price": None, "tmdb_id": "", "version": "", "subcategory": "",
    "preview_text": "", "landscape_image_url": "", "director": "", "producer": "",
    "languages": [], "tags": [], "subtitle_tracks": [], "audio_tracks": [],
}


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


def db() -> psycopg.Connection:
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not configured. Set it in the backend environment.")
    return psycopg.connect(
        DATABASE_URL,
        row_factory=dict_row,
        sslmode="require",
        connect_timeout=10,
    )


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 240_000)
    return base64.urlsafe_b64encode(salt).decode() + "$" + base64.urlsafe_b64encode(digest).decode()


def verify_password(password: str, stored: str) -> bool:
    try:
        salt_text, digest_text = stored.split("$", 1)
        salt = base64.urlsafe_b64decode(salt_text.encode())
        expected = base64.urlsafe_b64decode(digest_text.encode())
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 240_000)
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def init_db() -> None:
    schema_statements = [
        """CREATE TABLE IF NOT EXISTS users (
            email TEXT PRIMARY KEY, name TEXT NOT NULL, password_hash TEXT NOT NULL,
            avatar TEXT, role TEXT NOT NULL DEFAULT 'user', is_verified SMALLINT NOT NULL DEFAULT 1,
            can_download SMALLINT NOT NULL DEFAULT 1, language TEXT NOT NULL DEFAULT 'EN',
            is_blocked SMALLINT NOT NULL DEFAULT 0, joined_at TEXT NOT NULL
        )""",
        """CREATE TABLE IF NOT EXISTS movies (
            id TEXT PRIMARY KEY, ordinal BIGSERIAL UNIQUE,
            name TEXT NOT NULL, brand TEXT NOT NULL DEFAULT 'aimefilms',
            category TEXT NOT NULL DEFAULT 'General Entertainment', section TEXT NOT NULL DEFAULT 'english',
            is_hidden SMALLINT NOT NULL DEFAULT 0, description TEXT NOT NULL DEFAULT '',
            highlights TEXT NOT NULL DEFAULT '[]', pros TEXT NOT NULL DEFAULT '[]', image_url TEXT NOT NULL DEFAULT '',
            logo_url TEXT NOT NULL DEFAULT '', link TEXT NOT NULL DEFAULT '', video_url TEXT NOT NULL DEFAULT '',
            full_movie_url TEXT NOT NULL DEFAULT '', rating TEXT NOT NULL DEFAULT '0', year TEXT NOT NULL DEFAULT '',
            duration TEXT NOT NULL DEFAULT '', "cast" TEXT NOT NULL DEFAULT '[]', synopsis TEXT NOT NULL DEFAULT '',
            is_trending SMALLINT NOT NULL DEFAULT 0, is_new SMALLINT NOT NULL DEFAULT 0,
            genre TEXT NOT NULL DEFAULT '[]', match_score DOUBLE PRECISION NOT NULL DEFAULT 0, price TEXT,
            tmdb_id TEXT NOT NULL DEFAULT '', version TEXT NOT NULL DEFAULT '', subcategory TEXT NOT NULL DEFAULT '',
            preview_text TEXT NOT NULL DEFAULT '', landscape_image_url TEXT NOT NULL DEFAULT '',
            director TEXT NOT NULL DEFAULT '', producer TEXT NOT NULL DEFAULT '', languages TEXT NOT NULL DEFAULT '[]',
            tags TEXT NOT NULL DEFAULT '[]', subtitle_tracks TEXT NOT NULL DEFAULT '[]', audio_tracks TEXT NOT NULL DEFAULT '[]'
        )""",
        "ALTER TABLE movies ADD COLUMN IF NOT EXISTS ordinal BIGSERIAL",
        "ALTER TABLE movies ADD COLUMN IF NOT EXISTS tmdb_id TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE movies ADD COLUMN IF NOT EXISTS version TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE movies ADD COLUMN IF NOT EXISTS subcategory TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE movies ADD COLUMN IF NOT EXISTS preview_text TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE movies ADD COLUMN IF NOT EXISTS landscape_image_url TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE movies ADD COLUMN IF NOT EXISTS director TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE movies ADD COLUMN IF NOT EXISTS producer TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE movies ADD COLUMN IF NOT EXISTS languages TEXT NOT NULL DEFAULT '[]'",
        "ALTER TABLE movies ADD COLUMN IF NOT EXISTS tags TEXT NOT NULL DEFAULT '[]'",
        "ALTER TABLE movies ADD COLUMN IF NOT EXISTS subtitle_tracks TEXT NOT NULL DEFAULT '[]'",
        "ALTER TABLE movies ADD COLUMN IF NOT EXISTS audio_tracks TEXT NOT NULL DEFAULT '[]'",
        "CREATE INDEX IF NOT EXISTS movies_ordinal_idx ON movies (ordinal DESC)",
        """CREATE TABLE IF NOT EXISTS views (
            movie_id TEXT PRIMARY KEY, view_count BIGINT NOT NULL DEFAULT 0, updated_at TEXT NOT NULL
        )""",
        """CREATE TABLE IF NOT EXISTS logs (
            id TEXT PRIMARY KEY, type TEXT NOT NULL, details TEXT NOT NULL, user_email TEXT, timestamp TEXT NOT NULL
        )""",
        """CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY, to_email TEXT NOT NULL, from_name TEXT NOT NULL,
            subject TEXT NOT NULL, body TEXT NOT NULL, timestamp TEXT NOT NULL,
            is_read SMALLINT NOT NULL DEFAULT 0
        )""",
        """CREATE TABLE IF NOT EXISTS user_lists (
            email TEXT NOT NULL, list_type TEXT NOT NULL, movie_id TEXT NOT NULL,
            created_at TEXT NOT NULL, PRIMARY KEY (email, list_type, movie_id)
        )""",
    ]
    with db() as connection:
        for statement in schema_statements:
            connection.execute(statement)

        # The configured administrator is authoritative. This resets that
        # account's password to the secret in Render whenever the service starts.
        connection.execute(
            """INSERT INTO users
               (email, name, password_hash, role, is_verified, can_download, joined_at, is_blocked)
               VALUES (%s, %s, %s, 'admin', 1, 1, %s, 0)
               ON CONFLICT (email) DO UPDATE SET
                 name = EXCLUDED.name,
                 password_hash = EXCLUDED.password_hash,
                 role = 'admin',
                 is_blocked = 0""",
            (ADMIN_EMAIL, ADMIN_NAME, hash_password(ADMIN_PASSWORD), utc_now()),
        )

        # No table is directly exposed to anonymous browser access through the
        # Supabase Data API. The trusted backend connects using DATABASE_URL.
        for table in ("users", "movies", "views", "logs", "messages", "user_lists"):
            connection.execute(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY')


def encode_token(user: dict[str, Any]) -> str:
    payload = {"email": user["email"], "exp": int(time.time()) + TOKEN_TTL_SECONDS}
    encoded = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode()).decode().rstrip("=")
    signature = hmac.new(TOKEN_SECRET.encode(), encoded.encode(), hashlib.sha256).hexdigest()
    return encoded + "." + signature


def current_user(request: Request) -> dict[str, Any]:
    header = request.headers.get("authorization", "")
    try:
        if not header.lower().startswith("bearer "):
            raise ValueError("missing bearer token")
        encoded, signature = header.split(" ", 1)[1].split(".", 1)
        expected = hmac.new(TOKEN_SECRET.encode(), encoded.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError("invalid signature")
        payload = json.loads(base64.urlsafe_b64decode((encoded + "===").encode()).decode())
        if int(payload["exp"]) < int(time.time()):
            raise ValueError("expired token")
    except (ValueError, KeyError, TypeError, json.JSONDecodeError, IndexError):
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    with db() as connection:
        user = connection.execute("SELECT * FROM users WHERE email = %s", (payload["email"],)).fetchone()
    if not user or user["is_blocked"]:
        raise HTTPException(status_code=403, detail="Account is unavailable.")
    return user


def admin_user(request: Request) -> dict[str, Any]:
    user = current_user(request)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Administrator access required.")
    return user


def public_user(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": user["name"], "email": user["email"], "avatar": user.get("avatar"),
        "role": user["role"], "isVerified": bool(user.get("is_verified", 1)),
        "canDownload": bool(user.get("can_download", 1)), "language": user.get("language", "EN"),
        "isBlocked": bool(user.get("is_blocked", 0)), "joinedAt": user.get("joined_at"),
    }


def parse_json(value: Any, default: Any) -> Any:
    if value in (None, ""):
        return default
    try:
        return json.loads(value) if isinstance(value, str) else value
    except (TypeError, json.JSONDecodeError):
        return default


def movie_from_row(row: dict[str, Any]) -> dict[str, Any]:
    value = dict(row)
    return {
        "id": value["id"], "name": value["name"], "brand": value["brand"], "category": value["category"],
        "section": value["section"], "isHidden": bool(value["is_hidden"]), "description": value["description"],
        "highlights": parse_json(value["highlights"], []), "pros": parse_json(value["pros"], []),
        "imageUrl": value["image_url"], "logoUrl": value["logo_url"], "link": value["link"],
        "videoUrl": value["video_url"], "fullMovieUrl": value["full_movie_url"], "rating": value["rating"],
        "year": value["year"], "duration": value["duration"], "cast": parse_json(value["cast"], []),
        "synopsis": value["synopsis"], "isTrending": bool(value["is_trending"]), "isNew": bool(value["is_new"]),
        "genre": parse_json(value["genre"], []), "matchScore": float(value["match_score"]), "price": value["price"],
        "tmdbId": value.get("tmdb_id", ""), "version": value.get("version", ""),
        "subcategory": value.get("subcategory", ""), "previewText": value.get("preview_text", ""),
        "landscapeImageUrl": value.get("landscape_image_url", ""), "director": value.get("director", ""),
        "producer": value.get("producer", ""), "languages": parse_json(value.get("languages"), []),
        "tags": parse_json(value.get("tags"), []), "subtitleTracks": parse_json(value.get("subtitle_tracks"), []),
        "audioTracks": parse_json(value.get("audio_tracks"), []),
    }


def normalize_movie(data: dict[str, Any], movie_id: str | None = None) -> dict[str, Any]:
    movie = {**MOVIE_DEFAULTS, **data}
    aliases = {
        "imageUrl": "image_url", "logoUrl": "logo_url", "videoUrl": "video_url",
        "fullMovieUrl": "full_movie_url", "isHidden": "is_hidden", "isTrending": "is_trending",
        "isNew": "is_new", "matchScore": "match_score", "tmdbId": "tmdb_id",
        "previewText": "preview_text", "landscapeImageUrl": "landscape_image_url",
        "subtitleTracks": "subtitle_tracks", "audioTracks": "audio_tracks",
    }
    for source, target in aliases.items():
        if source in movie:
            movie[target] = movie.pop(source)
    movie["id"] = movie_id or movie.get("id") or uuid.uuid4().hex
    for field in JSON_FIELDS:
        if not isinstance(movie.get(field), list):
            movie[field] = []
    for field in BOOLEAN_FIELDS:
        movie[field] = bool(movie.get(field))
    # PostgreSQL is stricter than SQLite about values stored in TEXT columns.
    for field in ("name", "brand", "category", "section", "description", "image_url", "logo_url",
                  "link", "video_url", "full_movie_url", "rating", "year", "duration", "synopsis",
                  "tmdb_id", "version", "subcategory", "preview_text", "landscape_image_url", "director", "producer"):
        if movie.get(field) is None:
            movie[field] = ""
        elif not isinstance(movie[field], str):
            movie[field] = str(movie[field])
    if movie.get("price") is not None and not isinstance(movie["price"], str):
        movie["price"] = str(movie["price"])
    return movie


def movie_values(movie: dict[str, Any]) -> tuple[Any, ...]:
    return tuple(
        json.dumps(movie[field]) if field in JSON_FIELDS
        else int(movie[field]) if field in BOOLEAN_FIELDS
        else movie.get(field)
        for field in MOVIE_FIELDS
    )


def insert_movie(connection: psycopg.Connection, movie: dict[str, Any]) -> None:
    columns = ",".join(f'"{field}"' for field in MOVIE_FIELDS)
    placeholders = ",".join("%s" for _ in MOVIE_FIELDS)
    connection.execute(
        f"INSERT INTO movies ({columns}) VALUES ({placeholders}) ON CONFLICT DO NOTHING",
        movie_values(movie),
    )


def record_log(connection: psycopg.Connection, event_type: str, details: str, email: str | None = None) -> None:
    connection.execute(
        "INSERT INTO logs (id, type, details, user_email, timestamp) VALUES (%s, %s, %s, %s, %s)",
        (uuid.uuid4().hex, event_type, details, email, utc_now()),
    )


def remove_managed_video_objects(public_urls: list[str]) -> None:
    """Remove only video objects owned by this application's configured Storage bucket."""
    bucket_prefix = f"/storage/v1/object/public/{SUPABASE_VIDEO_BUCKET}/"
    base = urlparse(SUPABASE_URL) if SUPABASE_URL else None
    object_paths: list[str] = []
    for value in public_urls:
        if not value:
            continue
        parsed = urlparse(str(value))
        if not parsed.path.startswith(bucket_prefix):
            continue
        if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY or base is None:
            raise HTTPException(status_code=503, detail="The private Supabase Storage key is not configured; the movie was not deleted.")
        if parsed.scheme != base.scheme or parsed.netloc != base.netloc:
            continue
        object_path = unquote(parsed.path[len(bucket_prefix):])
        segments = object_path.split("/")
        if not object_path or any(segment in ("", ".", "..") for segment in segments):
            raise HTTPException(status_code=422, detail="A stored video URL contains an invalid object path.")
        if object_path not in object_paths:
            object_paths.append(object_path)

    if not object_paths:
        return
    bucket_segment = quote(SUPABASE_VIDEO_BUCKET, safe="")
    try:
        response = requests.delete(
            f"{SUPABASE_URL}/storage/v1/object/{bucket_segment}",
            headers={
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "Content-Type": "application/json",
            },
            json={"prefixes": object_paths},
            timeout=(10, 60),
        )
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="Could not reach Supabase Storage. The movie was not deleted.")
    if not response.ok:
        raise HTTPException(status_code=502, detail="Supabase Storage could not delete the video's files. The movie was not deleted.")


async def json_body(request: Request) -> dict[str, Any]:
    try:
        value = await request.json()
        return value if isinstance(value, dict) else {}
    except Exception:
        return {}


@app.on_event("startup")
def startup() -> None:
    validate_config()
    init_db()


@app.get("/")
def root() -> dict[str, str]:
    return {"name": "AimeFilms API", "docs": "/docs", "health": "/health"}


@app.get("/health")
@app.get("/api/health")
def health() -> dict[str, Any]:
    # Report unhealthy if PostgreSQL is unavailable; a process-only health check
    # can otherwise make a broken deployment look healthy.
    try:
        with db() as connection:
            connection.execute("SELECT 1")
    except Exception:
        raise HTTPException(status_code=503, detail="Database connection is unavailable.")
    return {"ok": True, "database": "connected"}


@app.get("/api/movies")
def get_movies() -> dict[str, Any]:
    with db() as connection:
        rows = connection.execute("SELECT * FROM movies WHERE is_hidden = 0 ORDER BY ordinal DESC").fetchall()
    return {"success": True, "movies": [movie_from_row(row) for row in rows]}


@app.get("/api/movies/search")
def search_movies(q: str = "") -> dict[str, Any]:
    query = f"%{q.strip().lower()}%"
    with db() as connection:
        rows = connection.execute(
            """SELECT * FROM movies WHERE is_hidden = 0 AND (
               lower(name) LIKE %s OR lower(description) LIKE %s OR lower(synopsis) LIKE %s OR lower(genre) LIKE %s
            ) ORDER BY ordinal DESC""",
            (query, query, query, query),
        ).fetchall()
    return {"success": True, "movies": [movie_from_row(row) for row in rows]}


@app.post("/api/seed")
async def seed_movies(request: Request) -> dict[str, Any]:
    # Seeding shared catalogue content is an administrator-only operation.
    administrator = admin_user(request)
    body = await json_body(request)
    movies = body.get("movies", [])
    if not isinstance(movies, list):
        raise HTTPException(status_code=422, detail="movies must be a list.")
    if len(movies) > 1000:
        raise HTTPException(status_code=413, detail="A single seed request may contain at most 1000 movies.")
    if any(not isinstance(value, dict) for value in movies):
        raise HTTPException(status_code=422, detail="Every movie must be an object.")
    with db() as connection:
        existing = connection.execute("SELECT COUNT(*) AS count FROM movies").fetchone()["count"]
        inserted = 0
        if existing == 0:
            for value in movies:
                movie = normalize_movie(value if isinstance(value, dict) else {})
                insert_movie(connection, movie)
                inserted += 1
            record_log(connection, "SYSTEM", f"Database seeded with {inserted} movies", administrator["email"])
        rows = connection.execute("SELECT * FROM movies WHERE is_hidden = 0 ORDER BY ordinal DESC").fetchall()
    return {"success": True, "inserted": inserted, "movies": [movie_from_row(row) for row in rows]}


@app.post("/api/auth/login")
async def login(request: Request) -> dict[str, Any]:
    body = await json_body(request)
    identifier = str(body.get("identifier", "")).strip().lower()
    password = str(body.get("password", ""))
    with db() as connection:
        user = connection.execute(
            "SELECT * FROM users WHERE lower(email) = %s OR lower(name) = %s",
            (identifier, identifier),
        ).fetchone()
        if not user or user["is_blocked"] or not verify_password(password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Identity check failed.")
        record_log(connection, "LOGIN", "User logged in", user["email"])
        result = public_user(user)
        token = encode_token(user)
    return {"success": True, "token": token, "user": result}


@app.post("/api/auth/register")
async def register(request: Request) -> dict[str, Any]:
    body = await json_body(request)
    name = str(body.get("name", "")).strip()
    email = str(body.get("email", "")).strip().lower()
    password = str(body.get("password", ""))
    if not name or len(name) > 120 or len(email) > 254 or not email or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email) or len(password) < 12 or len(password) > 1024:
        raise HTTPException(status_code=422, detail="A valid name and email plus a password of 12–1024 characters are required.")
    with db() as connection:
        if connection.execute("SELECT 1 FROM users WHERE email = %s", (email,)).fetchone():
            raise HTTPException(status_code=409, detail="Email is already in the registry.")
        connection.execute(
            "INSERT INTO users (email, name, password_hash, role, is_verified, joined_at) VALUES (%s, %s, %s, 'user', 1, %s)",
            (email, name, hash_password(password), utc_now()),
        )
        record_log(connection, "REGISTER", f"New user registered: {email}", email)
    return {"success": True, "message": "Success."}


@app.post("/api/views/track")
async def track_view(request: Request) -> dict[str, Any]:
    body = await json_body(request)
    movie_id = str(body.get("movieId", "")).strip()
    if not movie_id:
        raise HTTPException(status_code=422, detail="movieId is required.")
    email = None
    try:
        email = current_user(request)["email"]
    except HTTPException:
        pass
    with db() as connection:
        connection.execute(
            """INSERT INTO views (movie_id, view_count, updated_at) VALUES (%s, 1, %s)
               ON CONFLICT (movie_id) DO UPDATE SET view_count = views.view_count + 1, updated_at = EXCLUDED.updated_at""",
            (movie_id, utc_now()),
        )
        record_log(connection, "VIEW", f"Viewed movie: {movie_id}", email)
    return {"success": True}


@app.get("/api/admin/analytics")
def analytics(request: Request) -> dict[str, Any]:
    admin_user(request)
    with db() as connection:
        movies = connection.execute("SELECT * FROM movies").fetchall()
        top_rows = connection.execute("SELECT movie_id, view_count FROM views ORDER BY view_count DESC LIMIT 10").fetchall()
        movie_map = {row["id"]: movie_from_row(row) for row in movies}
        top_movies = []
        for row in top_rows:
            movie = movie_map.get(row["movie_id"], {})
            top_movies.append({
                "id": row["movie_id"], "name": movie.get("name", "Unknown Asset"), "views": row["view_count"],
                "brand": movie.get("brand", "aimefilms"), "rating": float(movie.get("rating", 0) or 0),
                "engagement": min(100, row["view_count"] * 5),
            })
        brand_stats = {
            brand: {"views": 0, "movies": sum(1 for movie in movie_map.values() if movie.get("brand") == brand)}
            for brand in ("aimefilms", "filmsnyarwanda", "princefilms")
        }
        for row in connection.execute("SELECT movie_id, view_count FROM views").fetchall():
            brand = movie_map.get(row["movie_id"], {}).get("brand")
            if brand in brand_stats:
                brand_stats[brand]["views"] += row["view_count"]
        users = [public_user(row) for row in connection.execute("SELECT * FROM users ORDER BY joined_at DESC LIMIT 10").fetchall()]
        logs = [dict(row) for row in connection.execute(
            "SELECT id, type, details, user_email AS \"userEmail\", timestamp FROM logs ORDER BY timestamp DESC LIMIT 20"
        ).fetchall()]
        total_views = connection.execute("SELECT COALESCE(SUM(view_count), 0) AS total FROM views").fetchone()["total"]
    return {"success": True, "analytics": {
        "topMovies": top_movies, "totalViews": total_views, "newUsers": users,
        "recentActivity": logs, "brandStats": brand_stats,
    }}


@app.get("/api/admin/users")
def admin_users(request: Request) -> dict[str, Any]:
    admin_user(request)
    with db() as connection:
        users = [public_user(row) for row in connection.execute("SELECT * FROM users ORDER BY joined_at DESC").fetchall()]
    return {"success": True, "users": users}


@app.post("/api/admin/users/{email}/toggle-block")
def toggle_block(email: str, request: Request) -> dict[str, Any]:
    administrator = admin_user(request)
    normalized_email = email.strip().lower()
    with db() as connection:
        target = connection.execute(
            "SELECT role, is_blocked FROM users WHERE lower(email) = %s",
            (normalized_email,),
        ).fetchone()
        if not target:
            raise HTTPException(status_code=404, detail="User not found.")
        if target["role"] == "admin":
            raise HTTPException(status_code=403, detail="Administrator accounts cannot be blocked from this screen.")
        blocked = not bool(target["is_blocked"])
        connection.execute("UPDATE users SET is_blocked = %s WHERE lower(email) = %s", (int(blocked), normalized_email))
        record_log(connection, "BLOCK", f"{'Blocked' if blocked else 'Unblocked'} user: {normalized_email}", administrator["email"])
    return {"success": True, "isBlocked": blocked}


@app.put("/api/admin/users/{email}")
async def update_admin_user(email: str, request: Request) -> dict[str, Any]:
    """Update safe account metadata; credentials and roles remain server-managed."""
    administrator = admin_user(request)
    normalized_email = email.strip().lower()
    body = await json_body(request)

    with db() as connection:
        target = connection.execute(
            "SELECT * FROM users WHERE lower(email) = %s",
            (normalized_email,),
        ).fetchone()
        if not target:
            raise HTTPException(status_code=404, detail="User not found.")
        if target["role"] == "admin":
            raise HTTPException(status_code=403, detail="Administrator accounts are protected from edits in the user registry.")

        updates: dict[str, Any] = {}
        if "name" in body:
            name = body["name"]
            if not isinstance(name, str) or not name.strip() or len(name.strip()) > 120:
                raise HTTPException(status_code=422, detail="Name must contain 1 to 120 characters.")
            updates["name"] = name.strip()

        if "avatar" in body:
            avatar = body["avatar"]
            if avatar is not None and (not isinstance(avatar, str) or len(avatar) > 2_000_000):
                raise HTTPException(status_code=422, detail="Avatar URL must be text shorter than 2 MB.")
            updates["avatar"] = avatar

        if "language" in body:
            language = body["language"]
            if language not in ("EN", "RW", "FR", "SW", "ZH"):
                raise HTTPException(status_code=422, detail="Choose a supported account language.")
            updates["language"] = language

        for public_key, database_key in (("isVerified", "is_verified"), ("canDownload", "can_download")):
            if public_key in body:
                flag = body[public_key]
                if not isinstance(flag, bool):
                    raise HTTPException(status_code=422, detail=f"{public_key} must be true or false.")
                updates[database_key] = int(flag)

        if not updates:
            raise HTTPException(status_code=422, detail="No editable account fields were supplied.")

        assignments = ", ".join(f'"{column}" = %s' for column in updates)
        connection.execute(
            f"UPDATE users SET {assignments} WHERE email = %s",
            tuple(updates.values()) + (normalized_email,),
        )
        record_log(connection, "USER_UPDATE", f"Updated account settings: {normalized_email}", administrator["email"])
        updated = connection.execute(
            "SELECT * FROM users WHERE lower(email) = %s",
            (normalized_email,),
        ).fetchone()

    return {"success": True, "user": public_user(updated)}


@app.get("/api/admin/logs")
def get_logs(request: Request) -> dict[str, Any]:
    admin_user(request)
    with db() as connection:
        rows = connection.execute(
            "SELECT id, type, details, user_email AS \"userEmail\", timestamp FROM logs ORDER BY timestamp DESC"
        ).fetchall()
    return {"success": True, "logs": [dict(row) for row in rows]}


@app.delete("/api/admin/logs")
def clear_logs(request: Request) -> dict[str, Any]:
    admin_user(request)
    with db() as connection:
        connection.execute("DELETE FROM logs")
    return {"success": True}


@app.post("/api/admin/videos/create-upload")
async def create_video_upload(request: Request) -> dict[str, Any]:
    """Mint a short-lived, single-object signed token for direct resumable upload."""
    user = admin_user(request)
    body = await json_body(request)
    movie_id = str(body.get("movieId", "")).strip()
    filename = Path(str(body.get("filename", "video.mp4"))).name
    content_type = str(body.get("contentType", "")).split(";", 1)[0].strip().lower()
    try:
        size_bytes = int(body.get("sizeBytes", 0))
    except (ValueError, TypeError):
        size_bytes = 0
    field = str(body.get("field", "fullMovieUrl"))

    field_to_column = {"videoUrl": "video_url", "fullMovieUrl": "full_movie_url"}
    if field not in field_to_column:
        raise HTTPException(status_code=422, detail="field must be videoUrl or fullMovieUrl.")
    if not movie_id or len(movie_id) > 128:
        raise HTTPException(status_code=422, detail="A valid movieId is required.")
    if size_bytes <= 0 or size_bytes > MAX_VIDEO_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Video must be between 1 byte and {MAX_VIDEO_UPLOAD_MB} MB.",
        )

    extension = Path(filename).suffix.lower()
    expected_content_type = VIDEO_MIME_BY_EXTENSION.get(extension)
    if not expected_content_type:
        raise HTTPException(status_code=415, detail="Supported video files: MP4, WebM, MOV, MKV.")
    if content_type not in ("", "application/octet-stream", expected_content_type):
        raise HTTPException(status_code=415, detail="Video content type does not match its file extension.")

    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY or not SUPABASE_PUBLISHABLE_KEY:
        raise HTTPException(
            status_code=503,
            detail="Video storage requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_PUBLISHABLE_KEY.",
        )
    if not SUPABASE_URL.startswith("https://"):
        raise HTTPException(status_code=503, detail="SUPABASE_URL must be an HTTPS Supabase project URL.")

    with db() as connection:
        movie = connection.execute("SELECT id FROM movies WHERE id = %s", (movie_id,)).fetchone()
    if not movie:
        raise HTTPException(status_code=404, detail="Save the movie metadata before uploading its video.")

    safe_movie_id = re.sub(r"[^A-Za-z0-9_-]", "", movie_id)[:80] or "movie"
    object_path = f"films/{safe_movie_id}/{uuid.uuid4().hex}{extension}"
    bucket_segment = quote(SUPABASE_VIDEO_BUCKET, safe="")
    object_segment = quote(object_path, safe="/")
    sign_url = f"{SUPABASE_URL}/storage/v1/object/upload/sign/{bucket_segment}/{object_segment}"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }

    try:
        signed_response = requests.post(sign_url, headers=headers, json={"upsert": False}, timeout=(15, 30))
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="Could not reach Supabase Storage to create a signed upload.")
    if not signed_response.ok:
        raise HTTPException(
            status_code=502,
            detail="Supabase could not create the upload token. Check the storage bucket, plan limit, and server-side key.",
        )
    try:
        signed_data = signed_response.json()
    except ValueError:
        signed_data = {}
    signed_token = signed_data.get("token")
    if not signed_token and signed_data.get("url"):
        signed_token = parse_qs(urlparse(str(signed_data["url"])).query).get("token", [None])[0]
    if not signed_token:
        raise HTTPException(status_code=502, detail="Supabase did not return a signed upload token.")

    project_ref = urlparse(SUPABASE_URL).hostname.split(".")[0]
    upload_endpoint = f"https://{project_ref}.storage.supabase.co/storage/v1/upload/resumable"
    public_url = f"{SUPABASE_URL}/storage/v1/object/public/{bucket_segment}/{object_segment}"
    record_log_text = f"Created signed video upload for movie {movie_id}"
    with db() as connection:
        record_log(connection, "VIDEO_UPLOAD_START", record_log_text, user["email"])

    return {
        "success": True,
        "bucket": SUPABASE_VIDEO_BUCKET,
        "path": object_path,
        "signedToken": signed_token,
        "uploadEndpoint": upload_endpoint,
        "publicUrl": public_url,
        "publishableKey": SUPABASE_PUBLISHABLE_KEY,
        "sizeBytes": size_bytes,
        "maxFileSizeBytes": MAX_VIDEO_UPLOAD_BYTES,
        "chunkSizeBytes": 6 * 1024 * 1024,
        "movieId": movie_id,
        "field": field,
    }


@app.post("/api/admin/videos/complete-upload")
async def complete_video_upload(request: Request) -> dict[str, Any]:
    """Verify the stored object exists and immediately persist its URL to the movie row."""
    user = admin_user(request)
    body = await json_body(request)
    movie_id = str(body.get("movieId", "")).strip()
    object_path = str(body.get("path", "")).strip()
    field = str(body.get("field", "fullMovieUrl"))
    field_to_column = {"videoUrl": "video_url", "fullMovieUrl": "full_movie_url"}
    if field not in field_to_column:
        raise HTTPException(status_code=422, detail="field must be videoUrl or fullMovieUrl.")
    if not movie_id or len(movie_id) > 128:
        raise HTTPException(status_code=422, detail="A valid movieId is required.")

    safe_movie_id = re.sub(r"[^A-Za-z0-9_-]", "", movie_id)[:80] or "movie"
    allowed_prefix = f"films/{safe_movie_id}/"
    if not object_path.startswith(allowed_prefix) or not re.fullmatch(r"films/[A-Za-z0-9_-]+/[a-f0-9]{32}\.(mp4|webm|mov|mkv)", object_path):
        raise HTTPException(status_code=422, detail="Invalid video object path.")

    bucket_segment = quote(SUPABASE_VIDEO_BUCKET, safe="")
    object_segment = quote(object_path, safe="/")
    info_url = f"{SUPABASE_URL}/storage/v1/object/info/{bucket_segment}/{object_segment}"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    }
    try:
        verify_response = requests.get(info_url, headers=headers, timeout=(10, 30))
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="Could not verify the uploaded video in Supabase Storage.")
    if not verify_response.ok:
        raise HTTPException(status_code=409, detail="Video is not visible in Storage yet. Wait a moment and retry the save step.")

    public_url = f"{SUPABASE_URL}/storage/v1/object/public/{bucket_segment}/{object_segment}"
    with db() as connection:
        movie = connection.execute("SELECT id FROM movies WHERE id = %s", (movie_id,)).fetchone()
        if not movie:
            raise HTTPException(status_code=404, detail="Movie not found.")
        column = field_to_column[field]
        connection.execute(f'UPDATE movies SET "{column}" = %s WHERE id = %s', (public_url, movie_id))
        record_log(connection, "VIDEO_UPLOAD", f"Saved video to {object_path} and updated {field}", user["email"])
    return {
        "success": True,
        "movieId": movie_id,
        "field": field,
        "path": object_path,
        "url": public_url,
        "movieUrlUpdated": True,
    }


@app.post("/api/admin/videos/upload")
def upload_video(
    request: Request,
    file: UploadFile = File(..., description="MP4, WebM, MOV, or MKV video file"),
    movie_id: str | None = Form(default=None, description="Optional existing movie ID to update"),
    field: str = Form(default="fullMovieUrl", description="Either fullMovieUrl or videoUrl"),
    bearer_credentials: Any = Depends(video_upload_bearer),
) -> dict[str, Any]:
    """Upload a video to Supabase Storage. Only authenticated admins may upload."""
    user = admin_user(request)

    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=503,
            detail="Video storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the backend.",
        )
    if not SUPABASE_URL.startswith("https://"):
        raise HTTPException(status_code=503, detail="SUPABASE_URL must be an HTTPS Supabase project URL.")

    field_to_column = {"videoUrl": "video_url", "fullMovieUrl": "full_movie_url"}
    if field not in field_to_column:
        raise HTTPException(status_code=422, detail="field must be videoUrl or fullMovieUrl.")

    if movie_id:
        movie_id = movie_id.strip()
        if not movie_id or len(movie_id) > 128:
            raise HTTPException(status_code=422, detail="movie_id must be between 1 and 128 characters.")
        with db() as connection:
            exists = connection.execute("SELECT id FROM movies WHERE id = %s", (movie_id,)).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Movie not found. Create the movie first or omit movie_id to upload a standalone video.")

    original_name = Path(file.filename or "").name
    extension = Path(original_name).suffix.lower()
    expected_content_type = VIDEO_MIME_BY_EXTENSION.get(extension)
    if not expected_content_type:
        raise HTTPException(status_code=415, detail="Unsupported video type. Upload an MP4, WebM, MOV, or MKV file.")

    declared_content_type = (file.content_type or "").split(";", 1)[0].strip().lower()
    if declared_content_type and declared_content_type not in (expected_content_type, "application/octet-stream"):
        raise HTTPException(status_code=415, detail="The file content type does not match its video extension.")

    try:
        file.file.seek(0, os.SEEK_END)
        file_size = file.file.tell()
        file.file.seek(0)
    except (OSError, ValueError):
        raise HTTPException(status_code=400, detail="Unable to read the uploaded video.")
    if file_size <= 0:
        raise HTTPException(status_code=422, detail="The uploaded video is empty.")
    if file_size > MAX_VIDEO_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Video is too large. The configured limit is {MAX_VIDEO_UPLOAD_MB} MB.",
        )

    # Use a generated path rather than trusting a user-supplied filename.
    folder = re.sub(r"[^A-Za-z0-9_-]", "", movie_id or "")[:80] or "unassigned"
    object_path = f"{folder}/{uuid.uuid4().hex}{extension}"
    bucket_segment = quote(SUPABASE_VIDEO_BUCKET, safe="")
    object_segment = quote(object_path, safe="/")
    upload_url = f"{SUPABASE_URL}/storage/v1/object/{bucket_segment}/{object_segment}"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": expected_content_type,
        "Cache-Control": "3600",
        "x-upsert": "false",
    }

    try:
        file.file.seek(0)
        storage_response = requests.post(
            upload_url,
            data=file.file,
            headers=headers,
            timeout=(15, 300),
        )
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="Could not reach Supabase Storage. Check the backend storage settings and try again.")

    if not storage_response.ok:
        if storage_response.status_code == 413:
            raise HTTPException(status_code=413, detail="Supabase Storage rejected the video because it exceeds the project's upload limit.")
        if storage_response.status_code == 409:
            raise HTTPException(status_code=409, detail="A video already exists at this storage path. Please retry the upload.")
        raise HTTPException(
            status_code=502,
            detail="Supabase Storage rejected the video. Check the storage bucket and server-side key configuration.",
        )

    public_url = f"{SUPABASE_URL}/storage/v1/object/public/{bucket_segment}/{object_segment}"
    response: dict[str, Any] = {
        "success": True,
        "bucket": SUPABASE_VIDEO_BUCKET,
        "path": object_path,
        "url": public_url,
        "sizeBytes": file_size,
        "contentType": expected_content_type,
    }

    if movie_id:
        target_column = field_to_column[field]
        with db() as connection:
            connection.execute(
                f'UPDATE movies SET "{target_column}" = %s WHERE id = %s',
                (public_url, movie_id),
            )
            record_log(connection, "VIDEO_UPLOAD", f"Uploaded video to {field} for movie {movie_id}", user["email"])
        response["movieId"] = movie_id
        response["field"] = field
        response["movieUrlUpdated"] = True
    else:
        response["movieUrlUpdated"] = False
        response["message"] = "Video uploaded. Save the returned URL in the movie's videoUrl or fullMovieUrl field."

    return response


@app.get("/api/admin/tmdb/{tmdb_id}")
def fetch_tmdb_metadata(tmdb_id: str, request: Request) -> dict[str, Any]:
    """Fetch metadata through TMDB; the API key remains backend-only."""
    admin_user(request)
    if not TMDB_API_KEY: raise HTTPException(status_code=503, detail="TMDB import is not configured. Add TMDB_API_KEY to the backend environment and restart the service.")
    if not tmdb_id.isdigit() or len(tmdb_id) > 12: raise HTTPException(status_code=422, detail="Enter a numeric TMDB movie ID.")
    params = {"api_key": TMDB_API_KEY, "language": "en-US"}
    try:
        response = requests.get(f"https://api.themoviedb.org/3/movie/{tmdb_id}", params=params, timeout=(8, 20))
        if response.status_code == 404: raise HTTPException(status_code=404, detail="TMDB did not find a movie with that ID.")
        response.raise_for_status(); movie = response.json()
        credits_response = requests.get(f"https://api.themoviedb.org/3/movie/{tmdb_id}/credits", params=params, timeout=(8, 20))
        credits_response.raise_for_status(); credits = credits_response.json()
    except HTTPException: raise
    except requests.RequestException: raise HTTPException(status_code=502, detail="TMDB is temporarily unavailable. Try again or enter details manually.")
    overview = str(movie.get("overview") or ""); release_date = str(movie.get("release_date") or ""); runtime = int(movie.get("runtime") or 0)
    genres = [str(item.get("name", "")).strip() for item in movie.get("genres", []) if item.get("name")]
    languages = [str(item.get("english_name") or item.get("name") or "").strip() for item in movie.get("spoken_languages", []) if item.get("english_name") or item.get("name")]
    companies = [str(item.get("name", "")).strip() for item in movie.get("production_companies", []) if item.get("name")]
    crew, cast = credits.get("crew", []), credits.get("cast", [])
    directors = [str(item.get("name", "")).strip() for item in crew if item.get("job") == "Director" and item.get("name")]
    poster_path, backdrop_path = movie.get("poster_path"), movie.get("backdrop_path")
    details = {"tmdbId": str(tmdb_id), "name": str(movie.get("title") or movie.get("name") or ""), "description": overview, "previewText": overview[:240], "synopsis": overview,
        "year": release_date[:4], "duration": f"{runtime // 60}h {runtime % 60}m" if runtime else "", "rating": str(round(float(movie.get("vote_average") or 0), 1)),
        "genre": genres, "tags": genres, "subcategory": genres[0] if genres else "", "languages": languages,
        "imageUrl": f"https://image.tmdb.org/t/p/w500{poster_path}" if poster_path else "", "landscapeImageUrl": f"https://image.tmdb.org/t/p/w1280{backdrop_path}" if backdrop_path else "",
        "director": ", ".join(directors), "producer": ", ".join(companies[:4]), "cast": [str(item.get("name", "")).strip() for item in cast[:12] if item.get("name")]}
    return {"success": True, "movie": details}


@app.post("/api/admin/media-assets/upload")
def upload_media_asset(request: Request, file: UploadFile = File(...), movie_id: str = Form(...), kind: str = Form(...), language: str = Form(default="English")) -> dict[str, Any]:
    """Upload and persist a subtitle or alternate-audio file."""
    user = admin_user(request)
    if kind not in ("subtitle", "audio"): raise HTTPException(status_code=422, detail="kind must be subtitle or audio.")
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY: raise HTTPException(status_code=503, detail="Media storage is not configured on the backend.")
    movie_id = movie_id.strip()
    if not movie_id or len(movie_id) > 128: raise HTTPException(status_code=422, detail="A valid movie_id is required.")
    original_name = Path(file.filename or "").name; extension = Path(original_name).suffix.lower()
    subtitle_types = {".srt": "text/plain", ".vtt": "text/vtt"}
    audio_types = {".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".aac": "audio/aac", ".ogg": "audio/ogg", ".wav": "audio/wav", ".flac": "audio/flac"}
    allowed_types = subtitle_types if kind == "subtitle" else audio_types; content_type = allowed_types.get(extension)
    if not content_type: raise HTTPException(status_code=415, detail=f"Unsupported {kind} format. Supported files: {', '.join(sorted(allowed_types))}.")
    try: file.file.seek(0, os.SEEK_END); file_size = file.file.tell(); file.file.seek(0)
    except (OSError, ValueError): raise HTTPException(status_code=400, detail="Unable to read the uploaded file.")
    if file_size <= 0 or file_size > 200_000_000: raise HTTPException(status_code=413, detail="Subtitle/audio files must be between 1 byte and 200 MB.")
    with db() as connection: movie_exists = connection.execute("SELECT id FROM movies WHERE id = %s", (movie_id,)).fetchone()
    if not movie_exists: raise HTTPException(status_code=404, detail="Movie not found. Save its details before uploading media tracks.")
    safe_movie_id = re.sub(r"[^A-Za-z0-9_-]", "", movie_id)[:80] or "movie"
    object_path = f"films/{safe_movie_id}/{kind}/{uuid.uuid4().hex}{extension}"
    bucket_segment, object_segment = quote(SUPABASE_VIDEO_BUCKET, safe=""), quote(object_path, safe="/")
    upload_url = f"{SUPABASE_URL}/storage/v1/object/{bucket_segment}/{object_segment}"
    headers = {"apikey": SUPABASE_SERVICE_ROLE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}", "Content-Type": content_type, "Cache-Control": "3600", "x-upsert": "false"}
    try: file.file.seek(0); storage_response = requests.post(upload_url, data=file.file, headers=headers, timeout=(15, 180))
    except requests.RequestException: raise HTTPException(status_code=502, detail="Could not reach Supabase Storage for this media file.")
    if not storage_response.ok:
        if storage_response.status_code == 413: raise HTTPException(status_code=413, detail="Supabase Storage rejected the file because of the project's upload limit.")
        raise HTTPException(status_code=502, detail="Supabase Storage rejected this file. Check the bucket and server-side key settings.")
    public_url = f"{SUPABASE_URL}/storage/v1/object/public/{bucket_segment}/{object_segment}"
    if kind == "subtitle" and extension == ".srt":
        # Browser video players require WebVTT; convert SRT timings before uploading.
        raise HTTPException(status_code=415, detail="Please convert SRT captions to WebVTT (.vtt) before upload for browser playback.")
    track = {"language": (language or "English").strip()[:40], "url": public_url, "fileName": original_name, "path": object_path}
    column = "subtitle_tracks" if kind == "subtitle" else "audio_tracks"
    with db() as connection:
        row = connection.execute(f'SELECT "{column}" FROM movies WHERE id = %s', (movie_id,)).fetchone()
        if not row: raise HTTPException(status_code=404, detail="Movie not found.")
        tracks = parse_json(row[column], []); tracks.append(track)
        connection.execute(f'UPDATE movies SET "{column}" = %s WHERE id = %s', (json.dumps(tracks), movie_id))
        record_log(connection, "MEDIA_UPLOAD", f"Uploaded {kind} track ({language}) for movie {movie_id}", user["email"])
    return {"success": True, "movieId": movie_id, "kind": kind, "track": track}


@app.get("/api/admin/movies")
def admin_movies(request: Request) -> dict[str, Any]:
    """Return all catalogue items, including hidden movies, to the admin."""
    admin_user(request)
    with db() as connection:
        rows = connection.execute("SELECT * FROM movies ORDER BY ordinal DESC").fetchall()
    return {"success": True, "movies": [movie_from_row(row) for row in rows]}


@app.post("/api/admin/movies")
async def add_movie(request: Request) -> dict[str, Any]:
    administrator = admin_user(request)
    movie = normalize_movie(await json_body(request))
    with db() as connection:
        insert_movie(connection, movie)
        record_log(connection, "UPLOAD", f"Uploaded movie: {movie['name']}", administrator["email"])
    return {"success": True, "movie": movie}


@app.put("/api/admin/movies/{movie_id}")
async def update_movie(movie_id: str, request: Request) -> dict[str, Any]:
    administrator = admin_user(request)
    with db() as connection:
        existing = connection.execute("SELECT * FROM movies WHERE id = %s", (movie_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Movie not found.")
        current = movie_from_row(existing)
        current.update(await json_body(request))
        movie = normalize_movie(current, movie_id)
        fields = [field for field in MOVIE_FIELDS if field != "id"]
        assignments = ",".join(f'"{field}" = %s' for field in fields)
        values = movie_values(movie)
        connection.execute(
            f"UPDATE movies SET {assignments} WHERE id = %s",
            tuple(values[MOVIE_FIELDS.index(field)] for field in fields) + (movie_id,),
        )
        record_log(connection, "UPDATE", f"Updated movie: {movie['name']}", administrator["email"])
    return {"success": True, "movie": movie}


@app.delete("/api/admin/movies/{movie_id}")
def delete_movie(movie_id: str, request: Request) -> dict[str, Any]:
    administrator = admin_user(request)
    with db() as connection:
        movie = connection.execute(
            "SELECT id, name, video_url, full_movie_url FROM movies WHERE id = %s",
            (movie_id,),
        ).fetchone()
        if not movie:
            raise HTTPException(status_code=404, detail="Movie not found.")
        # Preserve the row when Storage cannot delete the managed video objects.
        remove_managed_video_objects([movie.get("video_url") or "", movie.get("full_movie_url") or ""])
        connection.execute("DELETE FROM movies WHERE id = %s", (movie_id,))
        connection.execute("DELETE FROM views WHERE movie_id = %s", (movie_id,))
        connection.execute("DELETE FROM user_lists WHERE movie_id = %s", (movie_id,))
        record_log(connection, "DELETE", f"Deleted movie and its stored videos: {movie['name']}", administrator["email"])
    return {"success": True, "deletedId": movie_id}


@app.get("/api/admin/messages")
def admin_messages(request: Request) -> dict[str, Any]:
    admin_user(request)
    with db() as connection:
        rows = connection.execute(
            """SELECT id, to_email AS \"toEmail\", from_name AS \"fromName\", subject, body,
               timestamp, is_read AS \"isRead\" FROM messages ORDER BY timestamp DESC"""
        ).fetchall()
    return {"success": True, "messages": [dict(row) for row in rows]}


@app.post("/api/messages")
async def send_message(request: Request) -> dict[str, Any]:
    user = current_user(request)
    body = await json_body(request)
    to_email = str(body.get("toEmail", "")).strip().lower()
    subject = str(body.get("subject", "")).strip()
    message_body = str(body.get("body", "")).strip()
    if not to_email or not subject or not message_body:
        raise HTTPException(status_code=422, detail="Recipient, subject, and message are required.")
    if len(subject) > 200 or len(message_body) > 10000:
        raise HTTPException(status_code=413, detail="Subject or message is too long.")
    message_id = uuid.uuid4().hex
    with db() as connection:
        recipient = connection.execute("SELECT email FROM users WHERE lower(email) = %s", (to_email,)).fetchone()
        if not recipient:
            raise HTTPException(status_code=404, detail="Recipient account was not found.")
        connection.execute(
            "INSERT INTO messages (id, to_email, from_name, subject, body, timestamp) VALUES (%s, %s, %s, %s, %s, %s)",
            (message_id, to_email, user["name"], subject, message_body, utc_now()),
        )
        record_log(connection, "MESSAGE", f"Message sent to {to_email}", user["email"])
    return {"success": True, "id": message_id}


@app.get("/api/messages")
def get_messages(request: Request) -> dict[str, Any]:
    user = current_user(request)
    with db() as connection:
        rows = connection.execute(
            """SELECT id, to_email AS \"toEmail\", from_name AS \"fromName\", subject, body,
               timestamp, is_read AS \"isRead\" FROM messages WHERE lower(to_email) = lower(%s) ORDER BY timestamp DESC""",
            (user["email"],),
        ).fetchall()
    return {"success": True, "messages": [{**dict(row), "isRead": bool(row["isRead"])} for row in rows]}


@app.post("/api/messages/{message_id}/read")
def mark_message_read(message_id: str, request: Request) -> dict[str, Any]:
    user = current_user(request)
    with db() as connection:
        connection.execute(
            "UPDATE messages SET is_read = 1 WHERE id = %s AND lower(to_email) = lower(%s)",
            (message_id, user["email"]),
        )
    return {"success": True}


@app.delete("/api/messages/{message_id}")
def delete_message(message_id: str, request: Request) -> dict[str, Any]:
    user = current_user(request)
    with db() as connection:
        connection.execute(
            "DELETE FROM messages WHERE id = %s AND lower(to_email) = lower(%s)",
            (message_id, user["email"]),
        )
    return {"success": True}


def replace_list(request: Request, list_type: str, ids: list[str]) -> dict[str, Any]:
    user = current_user(request)
    if not isinstance(ids, list) or len(ids) > 500 or any(not isinstance(value, (str, int)) for value in ids):
        raise HTTPException(status_code=422, detail="ids must be a list of at most 500 movie IDs.")
    ids = [str(value) for value in ids]
    with db() as connection:
        connection.execute("DELETE FROM user_lists WHERE email = %s AND list_type = %s", (user["email"], list_type))
        for movie_id in ids:
            connection.execute(
                """INSERT INTO user_lists (email, list_type, movie_id, created_at)
                   VALUES (%s, %s, %s, %s) ON CONFLICT DO NOTHING""",
                (user["email"], list_type, str(movie_id), utc_now()),
            )
    return {"success": True, "ids": ids}


@app.post("/api/watchlist")
async def set_watchlist(request: Request) -> dict[str, Any]:
    body = await json_body(request)
    return replace_list(request, "watchlist", body.get("ids", []))


@app.get("/api/watchlist")
def get_watchlist(request: Request) -> dict[str, Any]:
    user = current_user(request)
    with db() as connection:
        rows = connection.execute(
            "SELECT movie_id FROM user_lists WHERE email = %s AND list_type = %s ORDER BY created_at",
            (user["email"], "watchlist"),
        ).fetchall()
    return {"success": True, "ids": [row["movie_id"] for row in rows]}


@app.post("/api/continue-watching")
async def set_continue_watching(request: Request) -> dict[str, Any]:
    body = await json_body(request)
    return replace_list(request, "continue", body.get("ids", []))


@app.get("/api/continue-watching")
def get_continue_watching(request: Request) -> dict[str, Any]:
    user = current_user(request)
    with db() as connection:
        rows = connection.execute(
            "SELECT movie_id FROM user_lists WHERE email = %s AND list_type = %s ORDER BY created_at",
            (user["email"], "continue"),
        ).fetchall()
    return {"success": True, "ids": [row["movie_id"] for row in rows]}


@app.put("/api/user/profile")
async def update_profile(request: Request) -> dict[str, Any]:
    user = current_user(request)
    body = await json_body(request)
    with db() as connection:
        connection.execute(
            "UPDATE users SET name = %s, avatar = %s WHERE email = %s",
            (str(body.get("name", user["name"])), body.get("avatar"), user["email"]),
        )
    return {"success": True}