from __future__ import annotations

import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from core import media_storage


class LocalMediaStorageTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        base = Path(self.temp_dir.name)
        self.public_dir = base / "public"
        self.temp_upload_dir = base / ".tmp"
        self.patches = patch.multiple(
            media_storage,
            VIDEO_PUBLIC_DIR=self.public_dir,
            VIDEO_TEMP_DIR=self.temp_upload_dir,
            VIDEO_STORAGE_ROOT=base,
        )
        self.patches.start()

    def tearDown(self) -> None:
        self.patches.stop()
        self.temp_dir.cleanup()

    def test_upload_streams_file_to_movie_folder(self) -> None:
        source = io.BytesIO(b"sample-video-bytes")
        relative_path, size = media_storage.store_local_file(
            source, "films/movie_123", ".mp4", max_bytes=1024
        )

        saved_file = self.public_dir / relative_path
        self.assertTrue(saved_file.is_file())
        self.assertEqual(size, len(b"sample-video-bytes"))
        self.assertEqual(saved_file.read_bytes(), b"sample-video-bytes")
        self.assertTrue(relative_path.startswith("films/movie_123/"))
        self.assertEqual(list(self.temp_upload_dir.glob("*.part")), [])

    def test_rejects_path_traversal(self) -> None:
        with self.assertRaises(ValueError):
            media_storage.store_local_file(io.BytesIO(b"x"), "../outside", ".mp4", 1024)

    def test_rejects_oversized_file_and_removes_partial_file(self) -> None:
        with self.assertRaises(ValueError):
            media_storage.store_local_file(io.BytesIO(b"video-too-large"), "films/movie_123", ".mp4", 4)

        self.assertEqual(list(self.temp_upload_dir.glob("*.part")), [])
        self.assertEqual(list(self.public_dir.rglob("*")) if self.public_dir.exists() else [], [])

    def test_deletes_only_files_beneath_public_media_directory(self) -> None:
        relative_path, _ = media_storage.store_local_file(
            io.BytesIO(b"media"), "films/movie_123", ".mp4", 1024
        )
        local_url = media_storage.local_media_url("http://localhost:8001", relative_path)

        self.assertTrue(media_storage.delete_local_media_url(local_url))
        self.assertFalse((self.public_dir / relative_path).exists())
        self.assertFalse(media_storage.delete_local_media_url("https://example.com/video.mp4"))


if __name__ == "__main__":
    unittest.main()
