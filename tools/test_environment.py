"""Environment boundary for the offline current gate (not an OS sandbox)."""
from __future__ import annotations
import os
from pathlib import Path

# Keep host/runtime discovery working without forwarding arbitrary application,
# deployment, mail, database, cloud or OAuth configuration into unit tests.
_PORTABLE = set('PATH PATHEXT SYSTEMROOT WINDIR COMSPEC SYSTEMDRIVE TEMP TMP TMPDIR HOME USERPROFILE HOMEDRIVE HOMEPATH APPDATA LOCALAPPDATA PROGRAMDATA PROGRAMFILES PROGRAMFILES(X86) PROGRAMW6432 PROCESSOR_ARCHITECTURE NUMBER_OF_PROCESSORS LANG LC_ALL LC_CTYPE TZ TERM CI VIRTUAL_ENV PYTHONHOME PYTHONPATH NODE_PATH PLAYWRIGHT_MODULE PLAYWRIGHT_BROWSERS_PATH CHROME_PATH CODEX_PRIMARY_RUNTIME_NODE_MODULES'.split())

def isolated_environment(root: Path, source: dict[str, str] | None = None) -> dict[str, str]:
    source = dict(os.environ if source is None else source)
    env = {key: value for key, value in source.items() if key.upper() in _PORTABLE}
    # Only explicitly local libpq options can cross this boundary. Production
    # DSNs/PGSERVICE/PGPASSFILE are never inherited. Tests may inject mock values.
    host = source.get('PGHOST', '')
    if host in ('localhost', '127.0.0.1', '::1'):
        for key in ('PGHOST', 'PGPORT', 'PGUSER', 'PGDATABASE', 'PGPASSWORD'):
            if key in source:
                env[key] = source[key]
    guard = Path(__file__).resolve().parent / 'test_isolation'
    env['PYTHONPATH'] = os.pathsep.join([str(guard), str(root.resolve()), env.get('PYTHONPATH', '')]).rstrip(os.pathsep)
    env['PYTHONDONTWRITEBYTECODE'] = '1'
    env['PYTHONUTF8'] = '1'
    env['NODE_OPTIONS'] = '--require "' + (guard / 'node_guard.cjs').as_posix() + '"'
    env['PROPLET_TEST_ISOLATED'] = '1'
    env['NO_PROXY'] = '*'
    env['no_proxy'] = '*'
    return env
