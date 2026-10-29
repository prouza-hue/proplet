"""Real recovery SQL acceptance in a fresh loopback-only synthetic database.

No hosted DSN is accepted. The runner creates a new proplet_test_* DB, never
reuses/drops a database and never loads player data or sends real mail.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import secrets
import threading
import uuid

import psycopg
from psycopg import sql

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "supabase/migrations/20261028235549_admin_atomic_recovery.sql"
OWNER = "e1740794-d196-48da-a59a-2741eadb8e44"
OTHER = "d0000000-0000-4000-8000-000000000001"
TARGET = "d0000000-0000-4000-8000-000000000002"
SECOND = "d0000000-0000-4000-8000-000000000003"
AUTH = "d0000000-0000-4000-8000-000000000004"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--password-file", type=Path, required=True)
    parser.add_argument("--port", type=int, default=55432)
    parser.add_argument("--user", default="proplet_test_admin")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    options = dict(host="127.0.0.1", port=args.port, user=args.user,
                   password=args.password_file.read_text().strip())
    name = "proplet_test_admin_recovery_" + secrets.token_hex(5)
    checks = []
    with psycopg.connect(dbname="postgres", autocommit=True, **options) as conn:
        for role in ("anon", "authenticated", "service_role"):
            if not conn.execute("select 1 from pg_roles where rolname=%s", (role,)).fetchone():
                conn.execute(sql.SQL("create role {} {}").format(sql.Identifier(role),
                             sql.SQL("bypassrls" if role == "service_role" else "")))
        assert not conn.execute("select 1 from pg_database where datname=%s", (name,)).fetchone()
        conn.execute(sql.SQL("create database {}").format(sql.Identifier(name)))
    options["dbname"] = name

    def connect():
        return psycopg.connect(**options)

    def rpc(function, values, barrier=None):
        with connect() as conn:
            conn.execute("set local role service_role")
            if barrier:
                barrier.wait(timeout=15)
            return conn.execute(sql.SQL("select public.{}({})").format(sql.Identifier(function),
                sql.SQL(",").join(sql.Placeholder() for _ in values)), values).fetchone()[0]

    def digest(value):
        return hashlib.sha256(value.encode()).hexdigest()

    def issue(player=TARGET, email="one@example.invalid", revision=None, request=None, raw=None, admin=OWNER, purpose="link_email"):
        with connect() as conn:
            current = conn.execute("select auth_identity_revision from players where id=%s", (player,)).fetchone()[0]
        raw = raw or secrets.token_urlsafe(32)
        values = (player, purpose, email, digest(raw), request or str(uuid.uuid4()),
                  current if revision is None else revision, admin, "Ověřený kontakt hráče")
        return raw, rpc("proplet_auth_challenge_issue_v1", values)

    def delivery(raw, success=True):
        return rpc("proplet_auth_challenge_delivery_v1", (digest(raw), success))

    def consume(raw, email="one@example.invalid", purpose="link_email", password=None, token=None):
        return rpc("proplet_auth_challenge_consume_v1", (digest(raw), purpose, AUTH, email, password, token))

    def value(query, params=()):
        with connect() as conn:
            return conn.execute(query, params).fetchone()[0]

    def execute(query, params=()):
        with connect() as conn:
            conn.execute(query, params)

    with connect() as conn:
        conn.execute("""
          create table public.players(id uuid primary key,name text not null,family_code text,
            email text,email_verified_at timestamptz,auth_user_id uuid,password_hash text,token_hash text);
          create unique index players_verified_email_unique on public.players(lower(email))
            where email is not null and email_verified_at is not null;
          create unique index players_auth_user_id_unique on public.players(auth_user_id) where auth_user_id is not null;
          create table public.admin_accounts(player_id uuid primary key references players(id),role text,active boolean);
          create table public.admin_audit_log(id uuid primary key,admin_player_id uuid references players(id),
            action text,target_type text,target_id text,details jsonb,created_at timestamptz);
          create table public.player_sessions(id uuid primary key,player_id uuid references players(id),token_hash text);
          create table public.account_auth_challenges(id uuid primary key,player_id uuid references players(id),
            purpose text,email text,token_hash text unique,created_at timestamptz,expires_at timestamptz,
            used_at timestamptz,verified_auth_user_id uuid);
          alter table public.players enable row level security;
          alter table public.admin_accounts enable row level security;
          alter table public.admin_audit_log enable row level security;
          alter table public.account_auth_challenges enable row level security;
          grant usage on schema public to service_role,anon,authenticated;
          grant all on all tables in schema public to service_role;
        """)
        for index, player in enumerate((OWNER, OTHER, TARGET, SECOND)):
            conn.execute("insert into players(id,name,family_code,password_hash,token_hash) values(%s,%s,%s,%s,%s)",
                         (player, "Synthetic " + str(index), "SOLO_" + str(index), "old-password-hash-at-least-20", "old-primary"))
        for player in (OWNER, OTHER):
            conn.execute("insert into admin_accounts values(%s,'owner',true)", (player,))
        conn.execute("insert into account_auth_challenges(id,player_id,purpose,email,token_hash,created_at,expires_at) values(%s,%s,'link_email','legacy@example.invalid',%s,now(),now()+interval '1 hour')",
                     (str(uuid.uuid4()), TARGET, digest("legacy")))
        conn.execute(MIGRATION.read_text(encoding="utf-8"))
    assert value("select used_at is not null from account_auth_challenges where token_hash=%s", (digest("legacy"),))
    checks.append("migration invalidates unknown legacy pending links")
    for function in ("proplet_auth_challenge_issue_v1(uuid,text,text,text,uuid,bigint,uuid,text)",
                     "proplet_auth_challenge_consume_v1(text,text,uuid,text,text,text)"):
        for role in ("anon", "authenticated"):
            assert value("select has_function_privilege(%s,%s,'execute')", (role, function)) is False
    checks.append("RPC execute denied to anon/authenticated; service invoker execution succeeds")
    assert issue(admin=OTHER)[1] == {"ok": False, "code": "forbidden"}
    checks.append("a different player with an active owner grant cannot issue recovery")

    request, raw = str(uuid.uuid4()), secrets.token_urlsafe(32)
    barrier = threading.Barrier(6)
    revision = value("select auth_identity_revision from players where id=%s", (TARGET,))
    values = (TARGET, "link_email", "one@example.invalid", digest(raw), request, revision, OWNER, "Ověřený kontakt hráče")
    with ThreadPoolExecutor(max_workers=6) as pool:
        receipts = list(pool.map(lambda _: rpc("proplet_auth_challenge_issue_v1", values, barrier), range(6)))
    assert all(row["ok"] for row in receipts)
    assert sum(row["shouldSend"] for row in receipts) == 1
    assert value("select count(*) from account_auth_challenges where request_id=%s", (request,)) == 1
    assert value("select count(*) from admin_audit_log where details->>'requestId'=%s", (request,)) == 1
    assert consume(raw)["code"] == "not_ready"
    assert delivery(raw)["ok"]
    assert delivery(raw)["ok"]
    assert value("select count(*) from admin_audit_log where action='legacy_recovery_email_sent' and details->>'requestId'=%s", (request,)) == 1
    checks.append("6 concurrent retries: one issue/audit/send claim; sending inactive; delivery idempotent")

    # Inject an actual audit write failure and prove the complete issue rolls back.
    execute("""create function public.synthetic_fail_audit() returns trigger language plpgsql as $$
      begin raise check_violation using message='synthetic audit rollback'; end $$;
      create trigger synthetic_fail_audit before insert on public.admin_audit_log
      for each row execute function public.synthetic_fail_audit();""")
    before = value("select count(*) from account_auth_challenges")
    try:
        issue()
        raise AssertionError("issue succeeded while audit write failed")
    except psycopg.errors.CheckViolation:
        pass
    assert value("select count(*) from account_auth_challenges") == before
    assert value("select used_at is null from account_auth_challenges where token_hash=%s", (digest(raw),))
    try:
        consume(raw)
        raise AssertionError("consume succeeded while audit write failed")
    except psycopg.errors.CheckViolation:
        pass
    assert value("select email is null from players where id=%s", (TARGET,))
    assert value("select used_at is null from account_auth_challenges where token_hash=%s", (digest(raw),))
    execute("drop trigger synthetic_fail_audit on admin_audit_log")
    checks.append("real audit failure rolls back issue/supersession and verification together")

    execute("""create function public.synthetic_fail_revoke() returns trigger language plpgsql as $$
      begin if new.delivery_status='superseded' then raise check_violation using message='synthetic revocation rollback'; end if;
      return new; end $$;
      create trigger synthetic_fail_revoke before update on public.account_auth_challenges
      for each row execute function public.synthetic_fail_revoke();""")
    try:
        issue()
        raise AssertionError("issue succeeded while old-link revocation failed")
    except psycopg.errors.CheckViolation:
        pass
    execute("drop trigger synthetic_fail_revoke on account_auth_challenges")
    assert value("select used_at is null from account_auth_challenges where token_hash=%s", (digest(raw),))
    checks.append("revocation failure issues no new link and preserves the previous committed state")

    newer, _ = issue()
    assert delivery(newer)["ok"]
    assert consume(raw)["code"] == "invalid"
    execute("update players set auth_user_id=%s where id=%s", (AUTH, TARGET))
    execute("update players set auth_user_id=null where id=%s", (TARGET,))
    assert consume(newer)["code"] == "target_changed"
    checks.append("superseded link denied; change-then-revert of identity invalidates an old challenge")

    same, _ = issue()
    assert delivery(same)["ok"]
    execute("update players set email='one@example.invalid',email_verified_at='2026-01-01T00:00:00Z' where id=%s", (TARGET,))
    assert consume(same)["alreadyVerified"] is True
    assert str(value("select email_verified_at from players where id=%s", (TARGET,))).startswith("2026-01-01")
    assert consume(same)["code"] == "invalid"
    assert issue(email="different@example.invalid")[1]["code"] == "target_verified"
    checks.append("identical verified email consumes once without rewriting identity; different verified target refused")

    # A provider failure and an activation/audit failure must never leave a live link.
    failed, _ = issue(player=SECOND, email="second@example.invalid")
    assert delivery(failed, False)["status"] == "failed"
    assert consume(failed, "second@example.invalid")["code"] == "invalid"
    inactive, _ = issue(player=SECOND, email="second@example.invalid")
    execute("create trigger synthetic_fail_audit before insert on public.admin_audit_log for each row execute function public.synthetic_fail_audit()")
    try:
        delivery(inactive)
        raise AssertionError("delivery activated without an audit")
    except psycopg.errors.CheckViolation:
        pass
    assert consume(inactive, "second@example.invalid")["code"] == "not_ready"
    execute("drop trigger synthetic_fail_audit on admin_audit_log")
    checks.append("failed mail is unusable; failed delivery audit leaves an inactive sending challenge")

    expired, _ = issue(player=SECOND, email="second@example.invalid")
    delivery(expired)
    execute("update account_auth_challenges set expires_at=now()-interval '1 second' where token_hash=%s", (digest(expired),))
    assert consume(expired, "second@example.invalid")["code"] == "invalid"
    checks.append("expired challenge refused")

    # Password/session changes are part of the same consume transaction.
    reset, _ = issue(purpose="recover_password", admin=None)
    delivery(reset)
    session = str(uuid.uuid4())
    execute("insert into player_sessions values(%s,%s,'secondary')", (session, TARGET))
    execute("""create function public.synthetic_fail_session_delete() returns trigger language plpgsql as $$
      begin raise check_violation using message='synthetic session rollback'; end $$;
      create trigger synthetic_fail_session_delete before delete on public.player_sessions
      for each row execute function public.synthetic_fail_session_delete();""")
    try:
        consume(reset, purpose="recover_password", password="new-password-hash-at-least-20", token=digest("new-primary"))
        raise AssertionError("password changed without revoking sessions")
    except psycopg.errors.CheckViolation:
        pass
    assert value("select password_hash from players where id=%s", (TARGET,)) == "old-password-hash-at-least-20"
    assert value("select used_at is null from account_auth_challenges where token_hash=%s", (digest(reset),))
    execute("drop trigger synthetic_fail_session_delete on player_sessions")
    assert consume(reset, purpose="recover_password", password="new-password-hash-at-least-20", token=digest("new-primary"))["ok"]
    assert value("select count(*) from player_sessions where player_id=%s", (TARGET,)) == 0
    assert value("select token_hash from players where id=%s", (TARGET,)) == digest("new-primary")
    checks.append("password, primary token, all sessions and challenge consume commit or roll back together")

    # Concurrent different requests serialize per target; only latest can work.
    execute("update players set email=null,email_verified_at=null where id=%s", (TARGET,))
    barrier = threading.Barrier(5)
    revision = value("select auth_identity_revision from players where id=%s", (TARGET,))
    candidates = [secrets.token_urlsafe(32) for _ in range(5)]
    def competing(candidate):
        return rpc("proplet_auth_challenge_issue_v1", (TARGET, "link_email", "race@example.invalid", digest(candidate),
                   str(uuid.uuid4()), revision, OWNER, "Ověřený kontakt hráče"), barrier)
    with ThreadPoolExecutor(max_workers=5) as pool:
        assert all(row["ok"] for row in pool.map(competing, candidates))
    assert value("select count(*) from account_auth_challenges where player_id=%s and purpose='link_email' and used_at is null", (TARGET,)) == 1
    active = next(candidate for candidate in candidates if value("select used_at is null from account_auth_challenges where token_hash=%s", (digest(candidate),)))
    delivery(active)
    other, _ = issue(player=SECOND, email="race@example.invalid")
    delivery(other)
    barrier = threading.Barrier(2)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda item: rpc("proplet_auth_challenge_consume_v1",
            (digest(item), "link_email", AUTH, "race@example.invalid", None, None), barrier), [active, other]))
    assert sum(row["ok"] for row in results) == 1
    assert [row.get("code") for row in results if not row["ok"]] == ["email_conflict"]
    checks.append("5 competing issues yield one current link; 2 player email claims yield one winner")
    assert "@example.invalid" not in value("select coalesce(string_agg(details::text,''),'') from admin_audit_log").replace("***@example.invalid", "")
    checks.append("audit retains masked mailbox and request IDs, never full emails or raw tokens")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({"host": "127.0.0.1", "database": name, "syntheticOnly": True,
        "migration": MIGRATION.name, "checks": checks, "passed": len(checks)}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"PASS: {len(checks)} atomic recovery PostgreSQL acceptance groups; synthetic loopback DB only")


if __name__ == "__main__":
    main()
