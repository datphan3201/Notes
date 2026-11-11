import datetime as dt
import hashlib
import importlib.util
import io
import pathlib
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    "planner_backup", pathlib.Path(__file__).resolve().parents[1] / "planner_backup.py"
)
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class BackupTests(unittest.TestCase):
    def test_private_objects_are_checked_and_encrypted(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            key = root / "key" / "archive.key"
            backup.secure_key(key)
            content = b"private file bytes"
            config = {"PLANNER_SUPABASE_STORAGE_BUCKET": "private", "PLANNER_SUPABASE_SERVICE_ROLE_KEY": "test", "PLANNER_SUPABASE_URL": "https://example.invalid"}
            checksum = hashlib.sha256(content).hexdigest()
            with patch.object(backup.urllib.request, "urlopen", return_value=io.BytesIO(content)):
                objects = backup.capture_objects(config, [("user/file", len(content))], {"user/file": checksum}, root, key)
            assert objects[0]["sha256"] == checksum
            encrypted = root / objects[0]["file"]
            assert content not in encrypted.read_bytes()
            with patch.object(backup.urllib.request, "urlopen", return_value=io.BytesIO(b"changed")):
                with self.assertRaises(RuntimeError):
                    backup.capture_objects(config, [("other", 7)], {"other": checksum}, root, key)

    def test_encryption_round_trip_and_private_key(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            key = root / "key" / "archive.key"
            backup.secure_key(key)
            encrypted = root / "object.enc"
            backup.encrypt_bytes(b"private snapshot", encrypted, key)
            result = subprocess.run(
                ["openssl", "enc", "-d", "-aes-256-cbc", "-pbkdf2", "-iter", "200000",
                 "-pass", f"file:{key}", "-in", str(encrypted)],
                capture_output=True, check=True,
            )
            self.assertEqual(result.stdout, b"private snapshot")
            self.assertEqual(key.stat().st_mode & 0o777, 0o600)
            self.assertEqual(encrypted.stat().st_mode & 0o777, 0o600)

    def test_retention_never_removes_unrecognized_directories(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            other = root / "backup-user-data"
            other.mkdir()
            start = dt.date(2026, 11, 11)
            for index in range(50):
                day = start - dt.timedelta(days=index)
                (root / f"backup-{day:%Y%m%d}T120000Z-abcdef").mkdir()
            (root / f"backup-{start:%Y%m%d}T130000Z-abcdef").mkdir()
            backup.keep_versions(root)
            kept = [p for p in root.iterdir() if p != other]
            self.assertTrue(other.is_dir())
            self.assertGreaterEqual(len(kept), 7)
            self.assertLessEqual(len(kept), 11)
            for index in range(1, 7):
                day = start - dt.timedelta(days=index)
                self.assertTrue((root / f"backup-{day:%Y%m%d}T120000Z-abcdef").is_dir())


if __name__ == "__main__":
    unittest.main()
