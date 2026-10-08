"""Server-only RPC transport through the existing Supabase Postgres connection.

Fallback is allowed only before the business function starts. An uncertain write
must never be retried through PostgREST. Roles and claims are transaction-local.
"""
from __future__ import annotations

import logging
import os
import re
import threading
import time
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode, unquote

from psycopg import sql
from psycopg.types.json import Json, Jsonb
from psycopg_pool import ConnectionPool

logger = logging.getLogger("proplet")
UNAVAILABLE = object()
_lock = threading.Lock()
_pool = None
_pool_url = None
_retry_after = 0.0
_signatures = {}
_status = "postgrest"


def configured_dsn(supabase_url):
    if os.getenv("PROPLET_DB_RPC_TRANSPORT") != "postgres" or os.getenv("VERCEL_ENV") != "production":
        return None
    dsn = os.getenv("POSTGRES_URL", "")
    project = urlsplit(supabase_url).hostname or ""
    if not project.endswith(".supabase.co"):
        return None
    project = project.removesuffix(".supabase.co")
    try:
        parsed = urlsplit(dsn)
        host = parsed.hostname or ""
        user = unquote(parsed.username or "")
        if parsed.scheme not in {"postgres", "postgresql"} or not parsed.password or not project:
            return None
        direct = host == "db." + project + ".supabase.co"
        pooled = host.endswith(".pooler.supabase.com") and user.endswith("." + project)
        if not (direct or pooled):
            return None
        # Integration/Prisma URIs sometimes include client-only query options.
        query = [(k,v) for k,v in parse_qsl(parsed.query) if k not in {"pgbouncer", "connection_limit", "pool_timeout", "schema", "sslmode", "connect_timeout"}]
        query += [("sslmode", "require"), ("connect_timeout", "3")]
        return urlunsplit(parsed._replace(query=urlencode(query)))
    except (ValueError, TypeError):
        return None


def transport_status():
    return _status


def _connection_pool(dsn):
    global _pool, _pool_url
    with _lock:
        if _pool is None:
            _pool = ConnectionPool(dsn, min_size=0, max_size=3, max_idle=20,
                                   timeout=4, reconnect_timeout=4, name="proplet-rpc",
                                   kwargs={"autocommit": True, "prepare_threshold": None})
            _pool_url = dsn
        if _pool_url != dsn:
            return None
        return _pool


def _signature(connection, function, body):
    key = (function, tuple(sorted(body)))
    with _lock:
        cached = _signatures.get(key)
    if cached and cached[0] > time.monotonic():
        return cached[1]
    rows = connection.execute("""
        select p.proargnames[1:p.pronargs],
               array(select pg_catalog.format_type(t,null) from unnest(p.proargtypes::oid[]) t),
               p.pronargs-p.pronargdefaults, p.proretset,
               rt.typname, rt.typtype
        from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid=p.pronamespace
        join pg_catalog.pg_type rt on rt.oid=p.prorettype
        where n.nspname='public' and p.proname=%s
          and p.prokind='f' and p.provariadic=0
    """, (function,)).fetchall()
    matches = []
    for names, types, required, returns_set, result_type, type_kind in rows:
        names = names or []
        if set(body).issubset(names) and set(names[:required]).issubset(body):
            matches.append((names, types, returns_set or type_kind == 'c' or result_type == 'record', result_type))
    if len(matches) != 1:
        return None
    with _lock:
        _signatures[key] = (time.monotonic() + 60, matches[0])
    return matches[0]


def execute_on_connection(connection, function, body, signature):
    """One execution, no retries. Used by the disposable PG acceptance test too."""
    names, types, returns_rows, result_type = signature
    params, arguments = [], []
    for name, arg_type in zip(names, types):
        if name not in body:
            continue
        value = body[name]
        if value is not None and arg_type in {"json", "jsonb"}:
            value = Jsonb(value) if arg_type == "jsonb" else Json(value)
        # Types come exclusively from pg_catalog, never from the request body.
        arguments.append(sql.SQL("{} => %s::{}").format(sql.Identifier(name), sql.SQL(arg_type)))
        params.append(value)
    call = sql.SQL("public.{}({})").format(sql.Identifier(function), sql.SQL(", ").join(arguments))
    if returns_rows:
        statement = sql.SQL("select pg_catalog.to_jsonb(t) from {} as t").format(call)
    elif result_type == "void":
        statement = sql.SQL("select {} is null").format(call)
    else:
        statement = sql.SQL("select pg_catalog.to_jsonb({})").format(call)
    rows = connection.execute(statement, params).fetchall()
    if result_type == "void":
        return None
    if returns_rows:
        return [row[0] for row in rows]
    return rows[0][0] if rows else None


def try_execute(function, body, supabase_url):
    global _retry_after, _status
    if not re.fullmatch(r"proplet_[a-z0-9_]+", function):
        return UNAVAILABLE
    dsn = configured_dsn(supabase_url)
    if not dsn or time.monotonic() < _retry_after:
        return UNAVAILABLE
    started = False
    try:
        pool = _connection_pool(dsn)
        if pool is None:
            return UNAVAILABLE
        with pool.connection() as connection:
            with connection.transaction():
                connection.execute("set local role service_role")
                connection.execute("set local search_path = ''")
                connection.execute("set local statement_timeout = '10s'")
                connection.execute("select pg_catalog.set_config('request.jwt.claims', %s, true)", ('{"role":"service_role"}',))
                signature = _signature(connection, function, body)
                if signature is None:
                    return UNAVAILABLE
                started = True
                result = execute_on_connection(connection, function, body, signature)
            # Commit errors propagate too: no replay after an uncertain commit.
        _status = "postgres"
        return result
    except Exception as exc:
        if started:
            logger.warning("Postgres RPC failed function=%s sqlstate=%s", function, getattr(exc, "sqlstate", None))
            raise
        _retry_after = time.monotonic() + 60
        _status = "postgrest-fallback"
        logger.warning("Postgres RPC unavailable before execution; using PostgREST for 60s")
        return UNAVAILABLE


def error_payload(exc):
    state = getattr(exc, "sqlstate", None)
    diag = getattr(exc, "diag", None)
    payload = {"code": state, "message": getattr(diag, "message_primary", None),
               "details": getattr(diag, "message_detail", None), "hint": getattr(diag, "message_hint", None)}
    if state and state.startswith("PT") and state[2:].isdigit():
        return int(state[2:]), payload
    if state == "23505":
        return 409, payload
    if state in {"P0001", "22023", "22P02", "23503", "23514"}:
        return 400, payload
    return 503, payload
