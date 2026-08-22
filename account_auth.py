from __future__ import annotations

import inspect

from account_auth_core import *  # noqa: F401,F403
from account_auth_core import install_account_auth as _install_account_auth_core
from account_bonus_v3331 import install_account_bonus as _install_account_bonus
from account_integrity_v33210 import install_account_integrity as _install_account_integrity
from competitive_sharing_v3331 import install_competitive_sharing as _install_competitive_sharing
from push_diagnostics_v3329 import install_push_diagnostics as _install_push_diagnostics
from word_recognition_v3330 import install_word_recognition as _install_word_recognition


def install_account_auth(app, **kwargs):
    """Keep canonical identity/auth intact and attach additive launch/runtime safeguards."""
    _install_account_auth_core(app, **kwargs)
    frame = inspect.currentframe()
    caller_globals = frame.f_back.f_globals if frame and frame.f_back else {}
    _install_push_diagnostics(
        app,
        **kwargs,
        db_rpc=caller_globals.get("db_rpc"),
        save_quality_snapshot_if_monday=caller_globals.get("save_quality_snapshot_if_monday"),
        current_prague_date=caller_globals.get("current_prague_date"),
        logger=caller_globals.get("logger"),
    )
    _install_account_integrity(
        app,
        **kwargs,
        norm_family=caller_globals.get("norm_family"),
    )
    _install_word_recognition(
        app,
        **kwargs,
    )
    _install_competitive_sharing(
        app,
        **kwargs,
        telemetry_actor=caller_globals.get("telemetry_actor"),
        app_version=caller_globals.get("APP_VERSION") or "",
        vercel_env=caller_globals.get("VERCEL_ENV") or "",
    )
    _install_account_bonus(
        app,
        **kwargs,
        telemetry_actor=caller_globals.get("telemetry_actor"),
        app_version=caller_globals.get("APP_VERSION") or "",
        vercel_env=caller_globals.get("VERCEL_ENV") or "",
    )
