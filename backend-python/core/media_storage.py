from __future__ import annotations

import os
import time
import uuid
from pathlib import Path
from typing import BinaryIO
from urllib.parse import quote, unquote, urlparse

from .config import VIDEO_PUBLIC_DIR, VIDEO_STORAGE_ROOT, VIDEO_TEMP_DIR

CHUNK_SIZE = 1024 * 1024


def ensure_storage_dirs() -> None:
    VIDEO_PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    VIDEO_TEMP_DIR.mkdir(parents=True, exist_ok=True)


def store_local_file(file_obj: BinaryIO, relative_folder: str, extension: str, max_bytes: int) -> tuple[str, int]:
    """Stream an upload to disk in bounded chunks, then atomically publish it."""
    safe_parts = [part for part in relative_folder.replace("\\", "/").split("/") if part]
    if not safe_parts or any(
        part in {".", ".."} or not all(ch.isalnum() or ch in "-_" for ch in part)
        for part in safe_parts
    ):
        raise ValueError("Invalid local media folder.")
    if not extension.startswith(".") or not extension[1:].isalnum():
        raise ValueError("Invalid file extension.")

    ensure_storage_dirs()
    root = VIDEO_PUBLIC_DIR.resolve()
    destination_dir = (root / Path(*safe_parts)).resolve()
    if root not in destination_dir.parents:
        raise ValueError("Local media folder escaped the storage directory.")
    destination_dir.mkdir(parents=True, exist_ok=True)

    filename = uuid.uuid4().hex + extension.lower()
    final_path = destination_dir / filename
    temporary_path = VIDEO_TEMP_DIR / (uuid.uuid4().hex + ".part")
    total = 0
    try:
        file_obj.seek(0)
        with temporary_path.open("wb") as output:
            while True:
                chunk = file_obj.read(CHUNK_SIZE)
                if not chunk:
                    break
                total += len(chunk)
                if total > max_bytes:
                    raise ValueError(f"File exceeds the configured upload limit of {max_bytes // 1_000_000} MB.")
                output.write(chunk)
            output.flush()
            os.fsync(output.fileno())
        if total <= 0:
            raise ValueError("The uploaded file is empty.")
        os.replace(temporary_path, final_path)
        return final_path.relative_to(root).as_posix(), total
    except Exception:
        temporary_path.unlink(missing_ok=True)
        final_path.unlink(missing_ok=True)
        raise


def local_media_url(base_url: str, relative_path: str) -> str:
    return f"{base_url.rstrip('/')}/media/{quote(relative_path, safe='/')}"


def delete_local_media_url(value: str) -> bool:
    """Delete only files served from the application's /media mount."""
    if not value:
        return False
    parsed = urlparse(str(value))
    marker = "/media/"
    if marker not in parsed.path:
        return False
    relative = unquote(parsed.path.split(marker, 1)[1])
    root = VIDEO_PUBLIC_DIR.resolve()
    candidate = (root / relative).resolve()
    if root not in candidate.parents or not candidate.is_file():
        return False
    candidate.unlink(missing_ok=True)
    try:
        parent = candidate.parent
        while parent != root:
            parent.rmdir()
            parent = parent.parent
    except OSError:
        pass
    return True


def clean_stale_upload_parts(max_age_seconds: int = 24 * 60 * 60) -> int:
    """Remove abandoned temporary uploads older than the configured retention window."""
    ensure_storage_dirs()
    cutoff = time.time() - max_age_seconds
    removed = 0
    for part in VIDEO_TEMP_DIR.glob("*.part"):
        try:
            if part.stat().st_mtime < cutoff:
                part.unlink(missing_ok=True)
                removed += 1
        except OSError:
            continue
    return removed
