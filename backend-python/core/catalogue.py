from __future__ import annotations

import json
import uuid
from typing import Any

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


def insert_movie(connection: Any, movie: dict[str, Any]) -> None:
    columns = ",".join(f'"{field}"' for field in MOVIE_FIELDS)
    placeholders = ",".join("%s" for _ in MOVIE_FIELDS)
    connection.execute(
        f"INSERT INTO movies ({columns}) VALUES ({placeholders}) ON CONFLICT DO NOTHING",
        movie_values(movie),
    )
