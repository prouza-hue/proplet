#!/usr/bin/env python3
"""Run weekly trophy SQL against synthetic, disposable local PostgreSQL only.

No production configuration is imported. --emit-sql also permits execution by
the local PGlite PostgreSQL runtime when native Postgres is unavailable.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "supabase/migrations/20260927200003_weekly_team_victories.sql"
SCENARIOS = ROOT / "tools/weekly_team_victories_db_cases.sql"

BOOTSTRAP = r"""
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE TABLE public.players (
  id uuid PRIMARY KEY, name text, family_code text, team_joined_at timestamptz,
  public_rankings boolean DEFAULT true, created_at timestamptz DEFAULT now()
);
CREATE TABLE public.leagues (
  code text PRIMARY KEY, name text, public_name text, public_opt_in boolean DEFAULT false,
  public_enabled_at timestamptz, created_at timestamptz DEFAULT now()
);
CREATE TABLE public.team_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), player_id uuid REFERENCES public.players(id),
  team_code text, joined_at timestamptz, left_at timestamptz, created_at timestamptz DEFAULT now()
);
CREATE TABLE public.results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), player_id uuid REFERENCES public.players(id),
  points integer DEFAULT 0, completed_at timestamptz, created_at timestamptz DEFAULT now(),
  calm_mode boolean DEFAULT false, team_code_at_completion text, mode text DEFAULT 'free',
  daily_date date, puzzle_id text
);
CREATE TABLE public.account_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), player_id uuid REFERENCES public.players(id),
  points integer, granted_at timestamptz
);
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON public.players, public.leagues, public.results, public.team_memberships TO service_role;
-- Supabase projects may grant broad default table privileges. The migration
-- must explicitly remove these before granting append-only trophy access.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
"""


def sql_bundle() -> str:
    migration = MIGRATION.read_text()
    if not migration.strip():
        raise SystemExit("Migration is empty; refusing a meaningless pass")
    return BOOTSTRAP + "\n" + migration + "\n" + SCENARIOS.read_text()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database-url", help="Explicit loopback test database only")
    parser.add_argument("--emit-sql", type=Path)
    args = parser.parse_args()
    sql = sql_bundle()
    if args.emit_sql:
        args.emit_sql.write_text(sql)
        print(f"Wrote synthetic PostgreSQL scenarios: {args.emit_sql}")
        return
    if not args.database_url:
        parser.error("--database-url or --emit-sql is required")
    url = urlparse(args.database_url)
    if url.scheme not in ("postgres", "postgresql") or url.hostname not in ("127.0.0.1", "localhost", "::1"):
        parser.error("Only an explicit loopback PostgreSQL URL is allowed")
    if not url.path.lstrip("/").startswith("proplet_weekly_test"):
        parser.error("Database name must begin with proplet_weekly_test")
    import psycopg

    with psycopg.connect(args.database_url, autocommit=True) as conn:
        if conn.execute("select to_regclass('public.players')").fetchone()[0]:
            raise SystemExit("Database is not empty; refusing to run")
        conn.execute(sql, prepare=False)
        # Deterministic separate sessions: hold the scheduler lock in one
        # transaction and verify another invocation yields instead of double-awarding.
        with psycopg.connect(args.database_url, autocommit=False) as lock_conn:
            lock_conn.execute("SELECT pg_advisory_xact_lock(873912046502::bigint)")
            busy = conn.execute("SELECT public.proplet_finalize_team_victories_v1()").fetchone()[0]
            if busy.get("busy") is not True or busy.get("finalized") != 0:
                raise AssertionError("Concurrent scheduler must yield without granting")
            lock_conn.rollback()
        conn.execute("INSERT INTO weekly_test_passes VALUES ('separate-session scheduler lock')")
        rows = conn.execute("SELECT name FROM weekly_test_passes ORDER BY name").fetchall()
    print(json.dumps({"engine": "PostgreSQL", "passed": [r[0] for r in rows]}, indent=2))


if __name__ == "__main__":
    main()
