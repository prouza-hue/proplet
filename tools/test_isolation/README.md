# Offline current gate

`tools/test_current.py` creates a child-only environment from a portable runtime
allowlist. It drops inherited Proplet/Vercel toggles, cloud credentials, remote
DSNs, proxy settings and arbitrary Node startup options. The calling shell is
unchanged. Explicit loopback `PGHOST` plus local libpq connection options remain
available; service/passfile configuration is not inherited.

Python `sitecustomize` installs a socket audit hook and Node `NODE_OPTIONS` loads
a socket/DNS guard. Remote TCP, UDP and DNS attempts fail before connection.
Loopback fixture servers and mocked HTTP transports work normally. The guards
propagate through the suite's Python/Node subprocess patterns, including explicit
replacement environments and Python `-I`/`-S` launches. Test-created synthetic
configuration remains available to children for configuration/build assertions.

There is no live-network opt-in in the ordinary gate. Live browser smoke and
isolated database acceptance remain separate explicitly targeted commands.

This is accident prevention for trusted repository tests, **not an OS sandbox**:
intentional bypasses, arbitrary native executables and native libraries that do
not use Python/Node sockets are outside its enforcement. Such tests must retain
mocked transports or run in their separately scoped acceptance environment.
Do not put a live probe or a database integration command in the ordinary manifest.

For a focused rerun, use `python tools/test_current.py --only tests/current/example.py`
with one or more exact paths already registered in the manifest. Isolation is
identical; only the global asset/syntax scan is skipped. No arguments still run
the complete gate. Unknown paths are rejected before any test is launched.
