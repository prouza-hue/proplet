"""The deployed Python function can advertise CDN content without public/ bundled."""
from pathlib import Path
import hashlib
import json
import os
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
for key in list(os.environ):
    if key.lower().endswith("_proxy"):
        os.environ.pop(key, None)
import server


class OfflineManifest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.raw = b'{"public":"released-game-content"}'
        self.digest = hashlib.sha256(self.raw).hexdigest()
        (self.root / "content").mkdir()
        self.manifest = self.root / "content/generation-manifest.json"
        self.manifest.write_text(json.dumps({"canonicalBuild": {"output": {"sha256": self.digest}}}))
        self.override = patch.object(server, "ROOT", self.root)
        self.override.start()
        server.offline_bank_version.cache_clear()

    def tearDown(self):
        self.override.stop()
        server.offline_bank_version.cache_clear()
        self.temp.cleanup()

    def test_serverless_function_without_static_assets_uses_pinned_hash(self):
        self.assertEqual(server.offline_bank_version(), self.digest)

    def test_available_static_bytes_must_match_the_declared_release(self):
        (self.root / "public").mkdir()
        (self.root / "public/puzzles.json").write_bytes(b"changed-content")
        with self.assertRaises(server.HTTPException) as error:
            server.offline_bank_version()
        self.assertEqual(error.exception.status_code, 503)

    def test_missing_or_invalid_build_hash_fails_closed(self):
        self.manifest.write_text('{"canonicalBuild":{"output":{"sha256":"invalid"}}}')
        with self.assertRaises(server.HTTPException) as error:
            server.offline_bank_version()
        self.assertEqual(error.exception.status_code, 503)


if __name__ == "__main__":
    unittest.main()
