from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = Path(os.getenv("DB_PATH", str(BASE_DIR.parent / "backend-data" / "aimefilms.sqlite")))
ADMIN_NAME = os.getenv("ADMIN_NAME", "hybert")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "hybertmfashwanayo@gmail.com").strip().lower()
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "%bert123{}@")
TOKEN_SECRET = os.getenv("TOKEN_SECRET", "change-this-token-secret")
TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7

app = FastAPI(title="AimeFilms API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MOVIE_FIELDS = [
    "id", "name", "brand", "category", "section", "is_hidden", "description",
    "highlights", "pros", "image_url", "logo_url", "link", "video_url",
    "full_movie_url", "rating", "year", "duration", "cast", "synopsis",
    "is_trending", "is_new", "genre", "match_score", "price",
]
JSON_FIELDS = {"highlights", "pros", "cast", "genre"}
BOOLEAN_FIELDS = {"is_hidden", "is_trending", "is_new"}
MOVIE_DEFAULTS: dict[str, Any] = {
    "name": "Untitled movie", "brand": "aimefilms", "category": "General Entertainment",
    "section": "english", "is_hidden": False, "description": "", "highlights": [],
    "pros": [], "image_url": "", "logo_url": "", "link": "", "video_url": "",
    "full_movie_url": "", "rating": "0", "year": "", "duration": "", "cast": [],
    "synopsis": "", "is_trending": False, "is_new": False, "genre": [],
    "match_score": 0, "price": None,
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 120_000)
    return base64.urlsafe_b64encode(salt).decode() + "$" + base64.urlsafe_b64encode(digest).decode()


def verify_password(password: str, stored: str) -> bool:
    try:
        salt_text, digest_text = stored.split("$", 1)
        salt = base64.urlsafe_b64decode(salt_text.encode())
        expected = base64.urlsafe_b64decode(digest_text.encode())
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 120_000)
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def init_db() -> None:
    connection = db()
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            email TEXT PRIMARY KEY, name TEXT NOT NULL, password_hash TEXT NOT NULL,
            avatar TEXT, role TEXT NOT NULL DEFAULT 'user', is_verified INTEGER NOT NULL DEFAULT 1,
            can_download INTEGER NOT NULL DEFAULT 1, language TEXT NOT NULL DEFAULT 'EN',
            is_blocked INTEGER NOT NULL DEFAULT 0, joined_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS movies (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, brand TEXT NOT NULL DEFAULT 'aimefilms',
            category TEXT NOT NULL DEFAULT 'General Entertainment', section TEXT NOT NULL DEFAULT 'english',
            is_hidden INTEGER NOT NULL DEFAULT 0, description TEXT NOT NULL DEFAULT '',
            highlights TEXT NOT NULL DEFAULT '[]', pros TEXT NOT NULL DEFAULT '[]', image_url TEXT NOT NULL DEFAULT '',
            logo_url TEXT NOT NULL DEFAULT '', link TEXT NOT NULL DEFAULT '', video_url TEXT NOT NULL DEFAULT '',
            full_movie_url TEXT NOT NULL DEFAULT '', rating TEXT NOT NULL DEFAULT '0', year TEXT NOT NULL DEFAULT '',
            duration TEXT NOT NULL DEFAULT '', cast TEXT NOT NULL DEFAULT '[]', synopsis TEXT NOT NULL DEFAULT '',
            is_trending INTEGER NOT NULL DEFAULT 0, is_new INTEGER NOT NULL DEFAULT 0,
            genre TEXT NOT NULL DEFAULT '[]', match_score REAL NOT NULL DEFAULT 0, price TEXT
        );
        CREATE TABLE IF NOT EXISTS views (movie_id TEXT PRIMARY KEY, view_count INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS logs (id TEXT PRIMARY KEY, type TEXT NOT NULL, details TEXT NOT NULL, user_email TEXT, timestamp TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, to_email TEXT NOT NULL, from_name TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, timestamp TEXT NOT NULL, is_read INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS user_lists (email TEXT NOT NULL, list_type TEXT NOT NULL, movie_id TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (email, list_type, movie_id));
        """
    )
    if not connection.execute("SELECT email FROM users WHERE email = ?", (ADMIN_EMAIL,)).fetchone():
        connection.execute(
            "INSERT INTO users (email, name, password_hash, role, is_verified, can_download, joined_at) VALUES (?, ?, ?, 'admin', 1, 1, ?)",
            (ADMIN_EMAIL, ADMIN_NAME, hash_password(ADMIN_PASSWORD), utc_now()),
        )
    connection.commit()
    connection.close()


def encode_token(user: sqlite3.Row) -> str:
    payload = {"email": user["email"], "exp": int(time.time()) + TOKEN_TTL_SECONDS}
    encoded = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode()).decode().rstrip("=")
    signature = hmac.new(TOKEN_SECRET.encode(), encoded.encode(), hashlib.sha256).hexdigest()
    return encoded + "." + signature


def current_user(request: Request) -> sqlite3.Row:
    header = request.headers.get("authorization", "")
    try:
        encoded, signature = header.split(" ", 1)[1].split(".", 1)
        expected = hmac.new(TOKEN_SECRET.encode(), encoded.encode(), hashlib.sha256).hexdigest()
        if not header.lower().startswith("bearer ") or not hmac.compare_digest(signature, expected):
            raise ValueError("invalid token")
        payload = json.loads(base64.urlsafe_b64decode((encoded + "===").encode()).decode())
        if int(payload["exp"]) < int(time.time()):
            raise ValueError("expired token")
    except (ValueError, KeyError, TypeError, json.JSONDecodeError, IndexError):
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    connection = db()
    user = connection.execute("SELECT * FROM users WHERE email = ?", (payload["email"],)).fetchone()
    connection.close()
    if not user or user["is_blocked"]:
        raise HTTPException(status_code=403, detail="Account is unavailable.")
    return user


def admin_user(request: Request) -> sqlite3.Row:
    user = current_user(request)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Administrator access required.")
    return user


def public_user(user: sqlite3.Row | dict[str, Any]) -> dict[str, Any]:
    value = dict(user)
    return {
        "name": value["name"], "email": value["email"], "avatar": value.get("avatar"),
        "role": value["role"], "isVerified": bool(value.get("is_verified", 1)),
        "canDownload": bool(value.get("can_download", 1)), "language": value.get("language", "EN"),
        "isBlocked": bool(value.get("is_blocked", 0)), "joinedAt": value.get("joined_at"),
    }


def parse_json(value: Any, default: Any) -> Any:
    if value in (None, ""):
        return default
    try:
        return json.loads(value) if isinstance(value, str) else value
    except (TypeError, json.JSONDecodeError):
        return default


def movie_from_row(row: sqlite3.Row | dict[str, Any]) -> dict[str, Any]:
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
    }


def normalize_movie(data: dict[str, Any], movie_id: str | None = None) -> dict[str, Any]:
    movie = {**MOVIE_DEFAULTS, **data}
    aliases = {"imageUrl": "image_url", "logoUrl": "logo_url", "videoUrl": "video_url", "fullMovieUrl": "full_movie_url", "isHidden": "is_hidden", "isTrending": "is_trending", "isNew": "is_new", "matchScore": "match_score"}
    for source, target in aliases.items():
        if source in movie:
            movie[target] = movie.pop(source)
    movie["id"] = movie_id or movie.get("id") or uuid.uuid4().hex
    for field in JSON_FIELDS:
        if not isinstance(movie.get(field), list):
            movie[field] = []
    for field in BOOLEAN_FIELDS:
        movie[field] = bool(movie.get(field))
    return movie


def movie_values(movie: dict[str, Any]) -> tuple[Any, ...]:
    return tuple(json.dumps(movie[field]) if field in JSON_FIELDS else int(movie[field]) if field in BOOLEAN_FIELDS else movie.get(field) for field in MOVIE_FIELDS)


def insert_movie(connection: sqlite3.Connection, movie: dict[str, Any]) -> None:
    columns = ",".join(MOVIE_FIELDS)
    placeholders = ",".join("?" for _ in MOVIE_FIELDS)
    connection.execute(f"INSERT OR IGNORE INTO movies ({columns}) VALUES ({placeholders})", movie_values(movie))


def record_log(connection: sqlite3.Connection, event_type: str, details: str, email: str | None = None) -> None:
    connection.execute("INSERT INTO logs (id, type, details, user_email, timestamp) VALUES (?, ?, ?, ?, ?)", (uuid.uuid4().hex, event_type, details, email, utc_now()))


async def json_body(request: Request) -> dict[str, Any]:
    try:
        value = await request.json()
        return value if isinstance(value, dict) else {}
    except Exception:
        return {}


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/health")
@app.get("/api/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.get("/api/movies")
def get_movies() -> dict[str, Any]:
    connection = db()
    rows = connection.execute("SELECT * FROM movies WHERE is_hidden = 0 ORDER BY rowid DESC").fetchall()
    connection.close()
    return {"success": True, "movies": [movie_from_row(row) for row in rows]}


@app.get("/api/movies/search")
def search_movies(q: str = "") -> dict[str, Any]:
    query = f"%{q.strip().lower()}%"
    connection = db()
    rows = connection.execute(
        "SELECT * FROM movies WHERE is_hidden = 0 AND (lower(name) LIKE ? OR lower(description) LIKE ? OR lower(synopsis) LIKE ? OR lower(genre) LIKE ?) ORDER BY rowid DESC",
        (query, query, query, query),
    ).fetchall()
    connection.close()
    return {"success": True, "movies": [movie_from_row(row) for row in rows]}


@app.post("/api/seed")
async def seed_movies(request: Request) -> dict[str, Any]:
    body = await json_body(request)
    movies = body.get("movies", [])
    connection = db()
    existing = connection.execute("SELECT COUNT(*) AS count FROM movies").fetchone()["count"]
    inserted = 0
    if existing == 0:
        for value in movies:
            movie = normalize_movie(value if isinstance(value, dict) else {})
            insert_movie(connection, movie)
            inserted += 1
        record_log(connection, "SYSTEM", f"Database seeded with {inserted} movies")
    connection.commit()
    rows = connection.execute("SELECT * FROM movies WHERE is_hidden = 0 ORDER BY rowid DESC").fetchall()
    connection.close()
    return {"success": True, "inserted": inserted, "movies": [movie_from_row(row) for row in rows]}


@app.post("/api/auth/login")
async def login(request: Request) -> dict[str, Any]:
    body = await json_body(request)
    identifier = str(body.get("identifier", "")).strip().lower()
    password = str(body.get("password", ""))
    connection = db()
    user = connection.execute("SELECT * FROM users WHERE lower(email) = ? OR lower(name) = ?", (identifier, identifier)).fetchone()
    if not user or user["is_blocked"] or not verify_password(password, user["password_hash"]):
        connection.close()
        raise HTTPException(status_code=401, detail="Identity check failed.")
    record_log(connection, "LOGIN", "User logged in", user["email"])
    connection.commit()
    token = encode_token(user)
    result = public_user(user)
    connection.close()
    return {"success": True, "token": token, "user": result}


@app.post("/api/auth/register")
async def register(request: Request) -> dict[str, Any]:
    body = await json_body(request)
    name = str(body.get("name", "")).strip()
    email = str(body.get("email", "")).strip().lower()
    password = str(body.get("password", ""))
    if not name or not email or len(password) < 6:
        raise HTTPException(status_code=422, detail="Name, email, and a password of at least six characters are required.")
    connection = db()
    if connection.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone():
        connection.close()
        raise HTTPException(status_code=409, detail="Email is already in the registry.")
    connection.execute("INSERT INTO users (email, name, password_hash, role, is_verified, joined_at) VALUES (?, ?, ?, 'user', 1, ?)", (email, name, hash_password(password), utc_now()))
    record_log(connection, "REGISTER", f"New user registered: {email}", email)
    connection.commit()
    connection.close()
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
    connection = db()
    connection.execute("INSERT INTO views (movie_id, view_count, updated_at) VALUES (?, 1, ?) ON CONFLICT(movie_id) DO UPDATE SET view_count = view_count + 1, updated_at = excluded.updated_at", (movie_id, utc_now()))
    record_log(connection, "VIEW", f"Viewed movie: {movie_id}", email)
    connection.commit()
    connection.close()
    return {"success": True}


@app.get("/api/admin/analytics")
def analytics(request: Request) -> dict[str, Any]:
    admin_user(request)
    connection = db()
    movies = connection.execute("SELECT * FROM movies").fetchall()
    top_rows = connection.execute("SELECT movie_id, view_count FROM views ORDER BY view_count DESC LIMIT 10").fetchall()
    movie_map = {row["id"]: movie_from_row(row) for row in movies}
    top_movies = []
    for row in top_rows:
        movie = movie_map.get(row["movie_id"], {})
        top_movies.append({"id": row["movie_id"], "name": movie.get("name", "Unknown Asset"), "views": row["view_count"], "brand": movie.get("brand", "aimefilms"), "rating": float(movie.get("rating", 0) or 0), "engagement": min(100, row["view_count"] * 5)})
    brand_stats = {brand: {"views": 0, "movies": sum(1 for movie in movie_map.values() if movie.get("brand") == brand)} for brand in ("aimefilms", "filmsnyarwanda", "princefilms")}
    for row in connection.execute("SELECT movie_id, view_count FROM views").fetchall():
        brand = movie_map.get(row["movie_id"], {}).get("brand")
        if brand in brand_stats:
            brand_stats[brand]["views"] += row["view_count"]
    users = [public_user(row) for row in connection.execute("SELECT * FROM users ORDER BY joined_at DESC LIMIT 10").fetchall()]
    logs = [dict(row) for row in connection.execute("SELECT id, type, details, user_email AS userEmail, timestamp FROM logs ORDER BY timestamp DESC LIMIT 20").fetchall()]
    total_views = connection.execute("SELECT COALESCE(SUM(view_count), 0) AS total FROM views").fetchone()["total"]
    connection.close()
    return {"success": True, "analytics": {"topMovies": top_movies, "totalViews": total_views, "newUsers": users, "recentActivity": logs, "brandStats": brand_stats}}


@app.get("/api/admin/users")
def admin_users(request: Request) -> dict[str, Any]:
    admin_user(request)
    connection = db()
    users = [public_user(row) for row in connection.execute("SELECT * FROM users ORDER BY joined_at DESC").fetchall()]
    connection.close()
    return {"success": True, "users": users}


@app.post("/api/admin/users/{email}/toggle-block")
def toggle_block(email: str, request: Request) -> dict[str, Any]:
    admin_user(request)
    connection = db()
    user = connection.execute("SELECT is_blocked FROM users WHERE email = ?", (email.lower(),)).fetchone()
    if not user:
        connection.close()
        raise HTTPException(status_code=404, detail="User not found.")
    blocked = not bool(user["is_blocked"])
    connection.execute("UPDATE users SET is_blocked = ? WHERE email = ?", (int(blocked), email.lower()))
    record_log(connection, "BLOCK", f"{'Blocked' if blocked else 'Unblocked'} user: {email}")
    connection.commit()
    connection.close()
    return {"success": True, "isBlocked": blocked}


@app.get("/api/admin/logs")
def get_logs(request: Request) -> dict[str, Any]:
    admin_user(request)
    connection = db()
    rows = connection.execute("SELECT id, type, details, user_email AS userEmail, timestamp FROM logs ORDER BY timestamp DESC").fetchall()
    connection.close()
    return {"success": True, "logs": [dict(row) for row in rows]}


@app.delete("/api/admin/logs")
def clear_logs(request: Request) -> dict[str, Any]:
    admin_user(request)
    connection = db()
    connection.execute("DELETE FROM logs")
    connection.commit()
    connection.close()
    return {"success": True}


@app.post("/api/admin/movies")
async def add_movie(request: Request) -> dict[str, Any]:
    admin_user(request)
    movie = normalize_movie(await json_body(request))
    connection = db()
    insert_movie(connection, movie)
    record_log(connection, "UPLOAD", f"Uploaded movie: {movie['name']}")
    connection.commit()
    connection.close()
    return {"success": True, "movie": movie}


@app.put("/api/admin/movies/{movie_id}")
async def update_movie(movie_id: str, request: Request) -> dict[str, Any]:
    admin_user(request)
    connection = db()
    existing = connection.execute("SELECT * FROM movies WHERE id = ?", (movie_id,)).fetchone()
    if not existing:
        connection.close()
        raise HTTPException(status_code=404, detail="Movie not found.")
    current = movie_from_row(existing)
    current.update(await json_body(request))
    movie = normalize_movie(current, movie_id)
    fields = [field for field in MOVIE_FIELDS if field != "id"]
    assignments = ",".join(f"{field} = ?" for field in fields)
    values = movie_values(movie)
    connection.execute(f"UPDATE movies SET {assignments} WHERE id = ?", tuple(values[MOVIE_FIELDS.index(field)] for field in fields) + (movie_id,))
    connection.commit()
    connection.close()
    return {"success": True, "movie": movie}


@app.delete("/api/admin/movies/{movie_id}")
def delete_movie(movie_id: str, request: Request) -> dict[str, Any]:
    admin_user(request)
    connection = db()
    connection.execute("DELETE FROM movies WHERE id = ?", (movie_id,))
    connection.execute("DELETE FROM views WHERE movie_id = ?", (movie_id,))
    connection.execute("DELETE FROM user_lists WHERE movie_id = ?", (movie_id,))
    record_log(connection, "DELETE", f"Deleted movie: {movie_id}")
    connection.commit()
    connection.close()
    return {"success": True}


@app.get("/api/admin/messages")
def admin_messages(request: Request) -> dict[str, Any]:
    admin_user(request)
    connection = db()
    rows = connection.execute("SELECT id, to_email AS toEmail, from_name AS fromName, subject, body, timestamp, is_read AS isRead FROM messages ORDER BY timestamp DESC").fetchall()
    connection.close()
    return {"success": True, "messages": [dict(row) for row in rows]}


@app.post("/api/messages")
async def send_message(request: Request) -> dict[str, Any]:
    user = current_user(request)
    body = await json_body(request)
    message_id = uuid.uuid4().hex
    connection = db()
    connection.execute("INSERT INTO messages (id, to_email, from_name, subject, body, timestamp) VALUES (?, ?, ?, ?, ?, ?)", (message_id, str(body.get("toEmail", "")), str(body.get("fromName", user["name"])), str(body.get("subject", "")), str(body.get("body", "")), utc_now()))
    record_log(connection, "MESSAGE", f"Message sent to {body.get('toEmail', '')}", user["email"])
    connection.commit()
    connection.close()
    return {"success": True, "id": message_id}


@app.get("/api/messages")
def get_messages(request: Request) -> dict[str, Any]:
    user = current_user(request)
    connection = db()
    rows = connection.execute("SELECT id, to_email AS toEmail, from_name AS fromName, subject, body, timestamp, is_read AS isRead FROM messages WHERE lower(to_email) = lower(?) ORDER BY timestamp DESC", (user["email"],)).fetchall()
    connection.close()
    return {"success": True, "messages": [{**dict(row), "isRead": bool(row["isRead"])} for row in rows]}


@app.post("/api/messages/{message_id}/read")
def mark_message_read(message_id: str, request: Request) -> dict[str, Any]:
    user = current_user(request)
    connection = db()
    connection.execute("UPDATE messages SET is_read = 1 WHERE id = ? AND lower(to_email) = lower(?)", (message_id, user["email"]))
    connection.commit()
    connection.close()
    return {"success": True}


@app.delete("/api/messages/{message_id}")
def delete_message(message_id: str, request: Request) -> dict[str, Any]:
    user = current_user(request)
    connection = db()
    connection.execute("DELETE FROM messages WHERE id = ? AND lower(to_email) = lower(?)", (message_id, user["email"]))
    connection.commit()
    connection.close()
    return {"success": True}


def replace_list(request: Request, list_type: str, ids: list[str]) -> dict[str, Any]:
    user = current_user(request)
    connection = db()
    connection.execute("DELETE FROM user_lists WHERE email = ? AND list_type = ?", (user["email"], list_type))
    for movie_id in ids:
        connection.execute("INSERT OR IGNORE INTO user_lists (email, list_type, movie_id, created_at) VALUES (?, ?, ?, ?)", (user["email"], list_type, str(movie_id), utc_now()))
    connection.commit()
    connection.close()
    return {"success": True, "ids": ids}


@app.post("/api/watchlist")
async def set_watchlist(request: Request) -> dict[str, Any]:
    body = await json_body(request)
    return replace_list(request, "watchlist", body.get("ids", []))


@app.get("/api/watchlist")
def get_watchlist(request: Request) -> dict[str, Any]:
    user = current_user(request)
    connection = db()
    rows = connection.execute("SELECT movie_id FROM user_lists WHERE email = ? AND list_type = ? ORDER BY created_at", (user["email"], "watchlist")).fetchall()
    connection.close()
    return {"success": True, "ids": [row["movie_id"] for row in rows]}


@app.post("/api/continue-watching")
async def set_continue_watching(request: Request) -> dict[str, Any]:
    body = await json_body(request)
    return replace_list(request, "continue", body.get("ids", []))


@app.get("/api/continue-watching")
def get_continue_watching(request: Request) -> dict[str, Any]:
    user = current_user(request)
    connection = db()
    rows = connection.execute("SELECT movie_id FROM user_lists WHERE email = ? AND list_type = ? ORDER BY created_at", (user["email"], "continue")).fetchall()
    connection.close()
    return {"success": True, "ids": [row["movie_id"] for row in rows]}


@app.put("/api/user/profile")
async def update_profile(request: Request) -> dict[str, Any]:
    user = current_user(request)
    body = await json_body(request)
    connection = db()
    connection.execute("UPDATE users SET name = ?, avatar = ? WHERE email = ?", (str(body.get("name", user["name"])), body.get("avatar"), user["email"]))
    connection.commit()
    connection.close()
    return {"success": True}


init_db()
