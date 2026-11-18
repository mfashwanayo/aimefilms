from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Any

from fastapi import HTTPException, Request

from .config import TOKEN_SECRET, TOKEN_TTL_SECONDS
from .database import db


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
