"""Disposable PostgreSQL acceptance. Refuses every non-local database URL."""
from __future__ import annotations
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import os
import threading
from urllib.parse import urlsplit
import uuid
import psycopg

ROOT = Path(__file__).resolve().parents[1]
dsn = os.environ.get("PROPLET_REFERRAL_TEST_DSN", "")
target = urlsplit(dsn)
if target.hostname not in {"localhost", "127.0.0.1"} or target.path != "/referral_qa":
    raise SystemExit("Refusing non-disposable or external database target")

with psycopg.connect(dsn, autocommit=True) as conn:
    conn.execute((ROOT / "tests/current/referral_schema_fixture.sql").read_text())
    conn.execute((ROOT / "supabase/prepared/referral_v1.sql").read_text())
    conn.execute((ROOT / "tests/current/referral_database_acceptance.sql").read_text())
print("PASS database: signup, modes, atomic fault/retry, XP periods, dismissal")

# Distinct fifth/sixth boards and duplicate retries use separate real transactions.
for case in range(8):
    inviter, invitee = uuid.uuid4(), uuid.uuid4()
    code = "race_" + uuid.uuid4().hex
    with psycopg.connect(dsn) as conn:
        conn.execute("insert into public.players(id,name) values(%s,%s)", (inviter, "Race inviter"))
        conn.execute("select public.proplet_referral_create_v1(%s,%s)", (inviter, code))
        conn.execute("select set_config('request.headers',%s,true)", ('{"x-proplet-referral-invite":"' + code + '"}',))
        conn.execute("insert into public.players(id,name) values(%s,%s)", (invitee, "Race invitee"))
        for i in range(4):
            conn.execute("insert into public.results(player_id,puzzle_id,challenge_key,mode) values(%s,%s,%s,'free')",
                         (invitee, f"race-{case}-{i}", f"race-{case}-{i}"))
    barrier = threading.Barrier(4)
    def complete(index):
        # Two unique boards, each retried by another parallel request.
        key = f"race-{case}-final-{index % 2}"
        with psycopg.connect(dsn) as conn:
            conn.execute("set local statement_timeout='10s'")
            barrier.wait(timeout=10)
            conn.execute("insert into public.results(player_id,puzzle_id,challenge_key,mode) values(%s,%s,%s,'free') on conflict(player_id,challenge_key) do nothing", (invitee,key,key))
    with ThreadPoolExecutor(4) as pool:
        list(pool.map(complete, range(4)))
    with psycopg.connect(dsn) as conn:
        count, paid = conn.execute("select completed_boards,paid_at is not null from public.referral_claims where invitee_id=%s", (invitee,)).fetchone()
        amount, rows = conn.execute("select sum(points),count(*) from public.account_rewards where player_id in (%s,%s) and reward_key like 'referral_v1:%%'", (inviter, invitee)).fetchone()
        assert (count, paid, amount, rows) == (5, True, 2000, 2), (count, paid, amount, rows)
        period = conn.execute("select period_xp from public.proplet_rankings_xp_aggregate(now()-interval '1 day') where row_kind='player' and entity_id=%s", (str(inviter),)).fetchone()[0]
        assert period == 0, period
print("PASS concurrency: 8 real fifth/sixth-board and retry races; exactly one shared award")

with psycopg.connect(dsn) as conn:
    # No user-facing role may read the referral ledger or execute its internal API.
    for role in ("anon", "authenticated"):
        assert not conn.execute("select has_table_privilege(%s,'public.referral_claims','SELECT')", (role,)).fetchone()[0]
        assert not conn.execute("select has_function_privilege(%s,'public.proplet_referral_status_v1(uuid)','EXECUTE')", (role,)).fetchone()[0]
print("PASS permissions: ledger and referral RPCs are server-only")
