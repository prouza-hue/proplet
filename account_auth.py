from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Optional

from account_auth_core import *  # noqa: F401,F403
from account_auth_core import install_account_auth as _install_account_auth_core
from account_bonus_v3331 import install_account_bonus as _install_account_bonus
from account_integrity_v33210 import install_account_integrity as _install_account_integrity
from competitive_sharing_v3331 import install_competitive_sharing as _install_competitive_sharing
from preview_auth_v334 import install_preview_auth_v334 as _install_preview_auth_v334
from push_diagnostics_v3329 import install_push_diagnostics as _install_push_diagnostics
from rescue_limit_v40115 import install_rescue_limit_v40115 as _install_rescue_limit_v40115
from word_recognition_v3330 import install_word_recognition as _install_word_recognition


@dataclass(frozen=True)
class AppServices:
    """Explicit callbacks/configuration used by the additive account installers.

    The canonical account installer dependencies remain available as named
    fields here too, so one assembly point owns the complete feature boundary.
    No installer needs to inspect its caller's module globals.
    """

    supabase_url: str
    supabase_key: str
    tz: Any
    db_select: Callable
    db_insert: Callable
    db_update: Callable
    db_delete: Callable
    auth_player: Callable
    new_session: Callable
    hash_password: Callable
    verify_password: Callable
    enforce_rate_limit: Callable
    player_stats: Callable
    public_family_code: Callable
    league_name_for: Callable
    db_rpc: Optional[Callable] = None
    save_quality_snapshot_if_monday: Optional[Callable] = None
    current_prague_date: Optional[Callable] = None
    released_batches: Optional[Callable] = None
    logger: Any = None
    norm_family: Optional[Callable] = None
    resolved_puzzle: Optional[Callable] = None
    puzzle_exists: Optional[Callable] = None
    daily_puzzle_matches_date: Optional[Callable] = None
    telemetry_actor: Optional[Callable] = None
    app_version: str = ""
    vercel_env: str = ""
    canonical_origin: str = "https://hrajproplet.cz"

    @classmethod
    def from_legacy_kwargs(cls, values: dict[str, Any]) -> "AppServices":
        """Keep the pre-Sprint-06 Python entry point usable for local callers."""
        required = {
            "supabase_url", "supabase_key", "tz", "db_select", "db_insert",
            "db_update", "db_delete", "auth_player", "new_session", "hash_password",
            "verify_password", "enforce_rate_limit", "player_stats", "public_family_code",
            "league_name_for",
        }
        missing = sorted(name for name in required if name not in values)
        if missing:
            raise TypeError(f"missing AppServices dependencies: {', '.join(missing)}")
        return cls(**{name: values[name] for name in cls.__dataclass_fields__ if name in values})


def install_account_auth(app, services: AppServices | None = None, **legacy_kwargs):
    """Install canonical auth and additive safeguards from one explicit assembly point."""
    if services is None:
        services = AppServices.from_legacy_kwargs(legacy_kwargs)
    elif legacy_kwargs:
        raise TypeError("pass either services or legacy installer dependencies, not both")

    _install_account_auth_core(
        app,
        supabase_url=services.supabase_url,
        supabase_key=services.supabase_key,
        tz=services.tz,
        db_select=services.db_select,
        db_insert=services.db_insert,
        db_update=services.db_update,
        db_delete=services.db_delete,
        auth_player=services.auth_player,
        new_session=services.new_session,
        hash_password=services.hash_password,
        verify_password=services.verify_password,
        enforce_rate_limit=services.enforce_rate_limit,
        player_stats=services.player_stats,
        public_family_code=services.public_family_code,
        league_name_for=services.league_name_for,
    )
    _install_push_diagnostics(
        app,
        tz=services.tz,
        db_select=services.db_select,
        db_insert=services.db_insert,
        db_update=services.db_update,
        db_delete=services.db_delete,
        auth_player=services.auth_player,
        enforce_rate_limit=services.enforce_rate_limit,
        db_rpc=services.db_rpc,
        save_quality_snapshot_if_monday=services.save_quality_snapshot_if_monday,
        current_prague_date=services.current_prague_date,
        released_batches=services.released_batches,
        logger=services.logger,
        canonical_origin=services.canonical_origin,
    )
    _install_account_integrity(
        app,
        tz=services.tz,
        db_select=services.db_select,
        auth_player=services.auth_player,
        new_session=services.new_session,
        verify_password=services.verify_password,
        enforce_rate_limit=services.enforce_rate_limit,
        player_stats=services.player_stats,
        public_family_code=services.public_family_code,
        league_name_for=services.league_name_for,
        norm_family=services.norm_family,
    )
    _install_word_recognition(
        app,
        enforce_rate_limit=services.enforce_rate_limit,
        db_select=services.db_select,
        db_insert=services.db_insert,
        db_rpc=services.db_rpc,
        auth_player=services.auth_player,
        tz=services.tz,
        resolved_puzzle=services.resolved_puzzle,
        puzzle_exists=services.puzzle_exists,
        daily_puzzle_matches_date=services.daily_puzzle_matches_date,
        vercel_env=services.vercel_env,
    )
    _install_competitive_sharing(
        app,
        db_insert=services.db_insert,
        enforce_rate_limit=services.enforce_rate_limit,
        tz=services.tz,
        telemetry_actor=services.telemetry_actor,
        app_version=services.app_version,
        vercel_env=services.vercel_env,
    )
    _install_account_bonus(
        app,
        db_select=services.db_select,
        db_insert=services.db_insert,
        auth_player=services.auth_player,
        enforce_rate_limit=services.enforce_rate_limit,
        tz=services.tz,
        telemetry_actor=services.telemetry_actor,
        app_version=services.app_version,
        vercel_env=services.vercel_env,
    )
    _install_rescue_limit_v40115(
        app,
        db_select=services.db_select,
        db_update=services.db_update,
        auth_player=services.auth_player,
        enforce_rate_limit=services.enforce_rate_limit,
        player_stats=services.player_stats,
        tz=services.tz,
    )
    _install_preview_auth_v334(app)
