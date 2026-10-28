"""Immutable runtime configuration for the Proplet backend.

Environment and filesystem selection is evaluated once at import time.  The
legacy names remain re-exported by ``server.py`` for compatibility with
versioned installers and tests.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from zoneinfo import ZoneInfo

from proplet_version import (
    APP_VERSION as RELEASE_VERSION,
    PHONE_LANDSCAPE_BLOCKING as RELEASE_PHONE_LANDSCAPE_BLOCKING,
    TABLET_LANDSCAPE_BREAKPOINT_PX as RELEASE_TABLET_LANDSCAPE_BREAKPOINT_PX,
)


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def live_player_preview_enabled() -> bool:
    """Only explicitly approved preview branches may serve players against the live DB."""
    return (
        _env("PROPLET_LIVE_PLAYER_PREVIEW_ENABLED").lower() in {"1", "true", "yes"}
        and _env("VERCEL_ENV").lower() == "preview"
        and _env("VERCEL_GIT_COMMIT_REF") in {"codex/studio-edition", "codex/today-one-screen"}
        and _env("SUPABASE_URL").rstrip("/") == "https://iopyhluayfszskyqqpuc.supabase.co"
    )


def monthly_preview_qa_enabled(supabase_url: str | None = None) -> bool:
    """The QA clock is confined to one branch and its disposable database."""
    return (
        _env("VERCEL_ENV") == "preview"
        and _env("VERCEL_GIT_COMMIT_REF") == "codex/monthly-competition-202611"
        and (supabase_url if supabase_url is not None else _env("SUPABASE_URL")).rstrip("/") == "https://eanzztstmwlamwfdskbf.supabase.co"
        and _env("PROPLET_MONTHLY_QA_ENABLED").lower() == "true"
        and len(_env("PROPLET_MONTHLY_QA_SECRET")) >= 32
    )


@dataclass(frozen=True, slots=True)
class Settings:
    root: Path
    tz: ZoneInfo
    app_version: str
    phone_landscape_blocking: bool
    tablet_landscape_breakpoint_px: int
    supabase_url: str
    supabase_secret_key: str
    vapid_public_key: str
    vapid_private_key: str
    vapid_subject: str
    cron_secret: str
    vercel_env: str
    vercel_git_commit_ref: str
    live_player_preview: bool
    gen4_preview_branch: str
    gen4_candidate_preview: bool
    gen5_candidate_preview: bool
    puzzles_path: Path
    rolling_content_path: Path
    content_catalog_path: Path
    tajenka_bank_path: Path
    tajenka_release_enabled: bool
    atomic_result_v1_enabled: bool
    historical_free_rewards_enabled: bool
    archive_enabled: bool


def load_settings() -> Settings:
    root = Path(__file__).resolve().parents[1]
    vercel_env = _env("VERCEL_ENV").lower()
    vercel_git_commit_ref = _env("VERCEL_GIT_COMMIT_REF")
    live_player_preview = live_player_preview_enabled()
    monthly_preview = vercel_env == "preview" and vercel_git_commit_ref == "codex/monthly-competition-202611"
    if monthly_preview and _env("SUPABASE_URL").rstrip("/") not in {"", "https://eanzztstmwlamwfdskbf.supabase.co"}:
        raise RuntimeError("Monthly competition preview requires the isolated test database")
    if _env("PROPLET_MONTHLY_QA_SECRET") or _env("PROPLET_MONTHLY_QA_ENABLED"):
        if not monthly_preview_qa_enabled():
            raise RuntimeError("Monthly QA requires its exact preview branch, isolated database and dedicated secret")
    gen4_preview_branch = "agent/v3340-medium-calibration-v3"
    gen4_candidate_preview = vercel_env == "preview" and vercel_git_commit_ref == gen4_preview_branch
    gen5_candidate_preview = vercel_env == "preview" and vercel_git_commit_ref == "feat/gen5-lab"
    # A preview must fail closed before any database client can be constructed.
    if vercel_git_commit_ref == "feat/pestre-poradi-production" or _env("PROPLET_ORDER_TEST_ONLY") == "true":
        if vercel_env != "preview" or _env("SUPABASE_URL").rstrip("/") != "https://eanzztstmwlamwfdskbf.supabase.co":
            raise RuntimeError("Order preview requires the existing isolated test database")
    if vercel_git_commit_ref == "work/daily-specials-integrated-20261012" or _env("PROPLET_DAILY_SPECIALS_PREVIEW_DATE"):
        if (vercel_env != "preview" or vercel_git_commit_ref != "work/daily-specials-integrated-20261012"
                or _env("SUPABASE_URL").rstrip("/") != "https://eanzztstmwlamwfdskbf.supabase.co"):
            raise RuntimeError("Daily specials preview requires its exact branch and isolated test database")
    playtest_preview = vercel_env == "preview" and vercel_git_commit_ref in {"feat/mozkokalypsa-playtest", "feat/mozkokalypsa-round2-release", "feat/mozkokalypsa-round2-invite", "feat/mozkokalypsa-round3-release"}
    data_root = root / "data"
    return Settings(
        root=root,
        tz=ZoneInfo("Europe/Prague"),
        app_version=RELEASE_VERSION,
        phone_landscape_blocking=RELEASE_PHONE_LANDSCAPE_BLOCKING,
        tablet_landscape_breakpoint_px=RELEASE_TABLET_LANDSCAPE_BREAKPOINT_PX,
        # Preserve the historical parsing exactly: URL only lost trailing
        # slashes and the secret was not whitespace-normalized.
        supabase_url="" if playtest_preview else os.environ.get("SUPABASE_URL", "").rstrip("/"),
        # A monthly preview must never inherit the project's production secret.
        supabase_secret_key=(os.environ.get("PROPLET_MONTHLY_TEST_KEY", "") if monthly_preview else
                             "" if playtest_preview else os.environ.get("SUPABASE_SECRET_KEY", "")),
        vapid_public_key="" if playtest_preview else _env("VAPID_PUBLIC_KEY"),
        vapid_private_key="" if playtest_preview else _env("VAPID_PRIVATE_KEY"),
        vapid_subject=_env("VAPID_SUBJECT", "https://proplet-nine.vercel.app"),
        cron_secret="" if playtest_preview else _env("CRON_SECRET"),
        vercel_env=vercel_env,
        vercel_git_commit_ref=vercel_git_commit_ref,
        live_player_preview=live_player_preview,
        gen4_preview_branch=gen4_preview_branch,
        gen4_candidate_preview=gen4_candidate_preview,
        gen5_candidate_preview=gen5_candidate_preview,
        puzzles_path=data_root / ("gen5_preview_puzzles.json" if gen5_candidate_preview else "puzzles_gen4_candidate_v334.json" if gen4_candidate_preview else "puzzles.json"),
        rolling_content_path=data_root / (
            "gen5_preview_rolling.json" if gen5_candidate_preview else "rolling_content_gen4_candidate_v334.json" if gen4_candidate_preview else "rolling_content_v1.json"
        ),
        content_catalog_path=data_root / "content_catalog_v334.json",
        tajenka_bank_path=data_root / "tajenka_weekend_v2.json",
        tajenka_release_enabled=(
            (vercel_env == "production" or live_player_preview or monthly_preview_qa_enabled())
            and _env("PROPLET_TAJENKA_RELEASE_ENABLED", "true").lower() in {"1", "true", "yes"}
        ),
        atomic_result_v1_enabled=(
            _env("PROPLET_ATOMIC_RESULT_V1_ENABLED", "false").lower() in {"1", "true", "yes"}
        ),
        # Closed by default until content and reward acceptance are complete.
        historical_free_rewards_enabled=(
            _env("PROPLET_HISTORICAL_FREE_REWARDS_ENABLED", "false").lower() in {"1", "true", "yes"}
        ),
        archive_enabled=_env("PROPLET_ARCHIVE_ENABLED", "false").lower() in {"1", "true", "yes"},
    )


settings = load_settings()

# Compatibility-friendly aliases for consumers that prefer module constants.
APP_VERSION = settings.app_version
PHONE_LANDSCAPE_BLOCKING = settings.phone_landscape_blocking
TABLET_LANDSCAPE_BREAKPOINT_PX = settings.tablet_landscape_breakpoint_px
ROOT = settings.root
TZ = settings.tz
SUPABASE_URL = settings.supabase_url
SUPABASE_SECRET_KEY = settings.supabase_secret_key
VAPID_PUBLIC_KEY = settings.vapid_public_key
VAPID_PRIVATE_KEY = settings.vapid_private_key
VAPID_SUBJECT = settings.vapid_subject
CRON_SECRET = settings.cron_secret
VERCEL_ENV = settings.vercel_env
VERCEL_GIT_COMMIT_REF = settings.vercel_git_commit_ref
LIVE_PLAYER_PREVIEW = settings.live_player_preview
GEN4_PREVIEW_BRANCH = settings.gen4_preview_branch
GEN4_CANDIDATE_PREVIEW = settings.gen4_candidate_preview
GEN5_CANDIDATE_PREVIEW = settings.gen5_candidate_preview
PUZZLES_PATH = settings.puzzles_path
ROLLING_CONTENT_PATH = settings.rolling_content_path
CONTENT_CATALOG_PATH = settings.content_catalog_path
TAJENKA_BANK_PATH = settings.tajenka_bank_path
TAJENKA_RELEASE_ENABLED = settings.tajenka_release_enabled
ATOMIC_RESULT_V1_ENABLED = settings.atomic_result_v1_enabled
HISTORICAL_FREE_REWARDS_ENABLED = settings.historical_free_rewards_enabled
ARCHIVE_ENABLED = settings.archive_enabled
