"""Preview configuration must never select the inherited production database key."""
import os
import unittest
from unittest.mock import patch

from backend.config import ADMIN_PREVIEW_DATABASE, canonical_origin, load_settings


class AdminPreviewBoundaryTests(unittest.TestCase):
    def test_exact_preview_uses_only_test_credential_and_disables_delivery_jobs(self):
        with patch.dict(os.environ, {
            "VERCEL_ENV": "preview", "VERCEL_GIT_COMMIT_REF": "codex/admin-modernization",
            "SUPABASE_URL": ADMIN_PREVIEW_DATABASE,
            "PROPLET_MONTHLY_TEST_KEY": "isolated-test-key",
            "SUPABASE_SECRET_KEY": "inherited-production-key",
            "VAPID_PRIVATE_KEY": "inherited-vapid", "CRON_SECRET": "inherited-cron",
            "VERCEL_URL": "proplet-qa-pavel-prouzas-projects.vercel.app",
        }, clear=True):
            settings = load_settings()
            self.assertEqual(settings.supabase_url, ADMIN_PREVIEW_DATABASE)
            self.assertEqual(settings.supabase_secret_key, "isolated-test-key")
            self.assertEqual(settings.vapid_private_key, "")
            self.assertEqual(settings.cron_secret, "")
            self.assertEqual(canonical_origin(), "https://proplet-qa-pavel-prouzas-projects.vercel.app")

    def test_missing_wrong_database_or_production_environment_fails_before_client_creation(self):
        valid = {
            "VERCEL_ENV": "preview", "VERCEL_GIT_COMMIT_REF": "codex/admin-modernization",
            "SUPABASE_URL": ADMIN_PREVIEW_DATABASE, "PROPLET_MONTHLY_TEST_KEY": "test-key",
        }
        for change in (
            {"SUPABASE_URL": "https://iopyhluayfszskyqqpuc.supabase.co"},
            {"VERCEL_ENV": "production"}, {"PROPLET_MONTHLY_TEST_KEY": ""},
            {"VERCEL_GIT_COMMIT_REF": "other-branch", "PROPLET_ADMIN_PREVIEW_ENABLED": "true"},
        ):
            with self.subTest(change=change), patch.dict(os.environ, valid | change, clear=True):
                with self.assertRaises(RuntimeError):
                    load_settings()

    def test_callback_origin_rejects_client_or_unrelated_hosts(self):
        for hostname in ("evil.example", "hrajproplet.cz", "proplet-qa.vercel.app", "proplet-qa-pavel-prouzas-projects.vercel.app/path"):
            with self.subTest(hostname=hostname), patch.dict(os.environ, {
                "VERCEL_ENV": "preview", "VERCEL_GIT_COMMIT_REF": "codex/admin-modernization",
                "VERCEL_URL": hostname,
            }, clear=True):
                self.assertEqual(canonical_origin(), "")

    def test_production_behavior_is_unchanged(self):
        with patch.dict(os.environ, {"VERCEL_ENV": "production", "VERCEL_GIT_COMMIT_REF": "main",
                                     "SUPABASE_URL": "https://iopyhluayfszskyqqpuc.supabase.co",
                                     "SUPABASE_SECRET_KEY": "production-key"}, clear=True):
            self.assertEqual(load_settings().supabase_secret_key, "production-key")
            self.assertEqual(canonical_origin(), "https://hrajproplet.cz")


if __name__ == "__main__":
    unittest.main()
