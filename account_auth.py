from __future__ import annotations

import inspect

from account_auth_core import *  # noqa: F401,F403
from account_auth_core import install_account_auth as _install_account_auth_core
from push_diagnostics_v3329 import install_push_diagnostics as _install_push_diagnostics


def install_account_auth(app, **kwargs):
    """Keep the v3.31.8 identity bridge intact and attach v3.32.9 push diagnostics."""
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
