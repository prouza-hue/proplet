#!/usr/bin/env python3
"""Real historical reward races in the existing disposable loopback database.

Never accepts a remote host or imports actual player data. All players are
synthetic; production transport is absent.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
import argparse
import hashlib
import json
import re
import sys
import threading

import psycopg
from psycopg.types.json import Jsonb

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.contracts import ResultCreate
from backend.results import build_command, result_identity, canonical_digest

PLAYER = "41040000-0000-4000-8000-000000000001"

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database-report", type=Path, required=True)
    parser.add_argument("--password-file", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    prior = json.loads(args.database_report.read_text())
    if prior.get("host") != "127.0.0.1" or prior.get("syntheticOnly") is not True:
        parser.error("Only the isolated synthetic database report is accepted")
    name = prior["database"]
    if not re.fullmatch(r"proplet_test_[a-z0-9_]{1,40}", name):
        parser.error("Refusing a non-test database")
    options = dict(host="127.0.0.1", port=55432, user="proplet_test_admin",
        password=args.password_file.read_text().strip(), dbname=name, autocommit=True)
    checks = []
    def connect():
        return psycopg.connect(**options)
    def command(puzzle, level, generation=3, attempt=None, points=100, difficulty="hardcore"):
        payload = ResultCreate(puzzle_id=puzzle, challenge_key="free:"+puzzle, mode="free",
            difficulty=difficulty, elapsed_ms=42000, moves=12, clean_solve=True,
            attempt_id=attempt or "historical:"+puzzle, completed_at="2026-10-04T10:00:00+00:00")
        return build_command(result_identity(PLAYER, payload), payload,
            completed_at=payload.completed_at, points=points, content_generation=generation,
            free_level=level, legacy_reward_slot={"difficulty": difficulty, "level": level} if generation<=3 else None,
            team_code_at_completion=None)
    def submit(value, barrier=None):
        with connect() as c:
            c.execute("set role service_role")
            if barrier is not None:
                barrier.wait(timeout=15)
            return c.execute("select public.proplet_submit_result_v1(%s,%s,%s,%s,%s)",
                (PLAYER, value["idempotencyKey"], value["requestDigest"], value["commandDigest"], Jsonb(value))).fetchone()[0]
    def result_points(puzzle):
        with connect() as c:
            return c.execute("select points from results where player_id=%s and puzzle_id=%s",
                (PLAYER,puzzle)).fetchone()[0]
    def claimed(level):
        with connect() as c:
            return c.execute("select count(*) from historical_free_slot_rewards where player_id=%s and level=%s",
                (PLAYER,level)).fetchone()[0]

    with connect() as c:
        c.execute("insert into players(id,name,family_code,token_hash) values(%s,'Historical synthetic','SOLO_TEST','historical-reward-isolation-fixture')",(PLAYER,))
    # Reproduce a valid G4 transition claim. It must remain unchanged and
    # must not reserve the unpaid historical hard level 29.
    g4 = command("historical-synthetic-g4-h-029",29,generation=4,points=550,difficulty="hard")
    submit(g4)
    with connect() as c:
        c.execute("insert into free_slot_rewards(id,player_id,difficulty,level,source_puzzle_id,content_generation,points,earned_at) values(gen_random_uuid(),%s,'hard',29,%s,4,50,now())",
            (PLAYER,g4["puzzleId"]))
        c.execute("insert into results(id,player_id,puzzle_id,challenge_key,mode,difficulty,best_elapsed_ms,best_moves,points,completed_at,content_generation,content_level,content_lineage_confidence) values(gen_random_uuid(),%s,'x-014','free:x-014','free','hardcore',42000,12,100,'2026-08-12T10:00:00+00:00',1,10,'exact')",(PLAYER,))
        # Preserve the exact oldest metadata shape, including unknown generation.
        c.execute("update results set content_generation=null,content_level=10,content_lineage_confidence='exact' where player_id=%s and puzzle_id='x-014'",(PLAYER,))
        before_results=c.execute("select count(*),sum(points) from results where player_id=%s",(PLAYER,)).fetchone()
        before_claims=c.execute("select jsonb_agg(to_jsonb(f) order by f.id) from free_slot_rewards f").fetchone()[0]
        c.execute((ROOT/"supabase/prepared/historical_free_rewards.sql").read_text())
        assert c.execute("select count(*),sum(points) from results where player_id=%s",(PLAYER,)).fetchone()==before_results
        assert c.execute("select jsonb_agg(to_jsonb(f) order by f.id) from free_slot_rewards f").fetchone()[0]==before_claims
        assert c.execute("select content_generation,source_puzzle_id from historical_free_slot_rewards where player_id=%s and level=10",(PLAYER,)).fetchone()==(None,"x-014")
    checks.append("seed/reconcile preserves results XP, old claims, and unknown-generation exact levels")
    archive = command("historical-synthetic-g3-h-029",29,points=50,difficulty="hard")
    assert submit(archive)["awardedPoints"]==50
    assert result_points(archive["puzzleId"])==50
    assert submit(command("historical-synthetic-g3-x-010",10))["awardedPoints"]==0
    checks.append("G4 result/claim never blocks new historical XP; paid G1 exact slot blocks G3")
    with connect() as c:
        assert c.execute("select jsonb_agg(to_jsonb(f) order by f.id) from free_slot_rewards f").fetchone()[0]==before_claims

    a=command("historical-synthetic-g2-x-041",41,generation=2)
    b=command("historical-synthetic-g3-x-041",41,generation=3)
    barrier=threading.Barrier(2)
    with ThreadPoolExecutor(max_workers=2) as pool:
        receipts=list(pool.map(lambda value:submit(value,barrier),(a,b)))
    assert sorted(r["awardedPoints"] for r in receipts)==[0,100]
    assert claimed(41)==1
    assert result_points(a["puzzleId"])+result_points(b["puzzleId"])==100
    checks.append("parallel G2/G3 same slot: two results, one claim, exactly 100 XP")
    one=command("historical-synthetic-g3-x-042",42)
    barrier=threading.Barrier(10)
    with ThreadPoolExecutor(max_workers=10) as pool:
        retries=list(pool.map(lambda _:submit(one,barrier),range(10)))
    assert all(r==retries[0] for r in retries) and claimed(42)==1
    assert result_points(one["puzzleId"])==100
    changed_server_command={**one,"points":0}
    changed_server_command.pop("commandDigest")
    changed_server_command["commandDigest"]=canonical_digest(changed_server_command)
    assert submit(changed_server_command)==retries[0]
    with ThreadPoolExecutor(max_workers=5) as pool:
        repeats=list(pool.map(lambda i:submit(command(one["puzzleId"],42,attempt="historical-other-attempt-"+str(i))),range(5)))
    assert all(r["awardedPoints"]==0 for r in repeats)
    assert claimed(42)==1
    checks.append("same-board attempts and exact retry: one result/claim; server recalculation retains receipt")

    # A pre-existing zero result must never consume another slot on retry.
    duplicate=command("historical-synthetic-existing-zero",43)
    with connect() as c:
        c.execute("insert into results(id,player_id,puzzle_id,challenge_key,mode,difficulty,best_elapsed_ms,best_moves,points,completed_at,content_generation,content_level) values(gen_random_uuid(),%s,%s,%s,'free','hardcore',42000,12,0,'2026-10-04T09:00:00+00:00',3,43)",
            (PLAYER,duplicate["puzzleId"],duplicate["challengeKey"]))
    assert submit(duplicate)["awardedPoints"]==0 and claimed(43)==0
    checks.append("existing-result conflict cannot burn a new claim or alter recorded XP")

    failing=command("historical-synthetic-rollback",44)
    with connect() as c:
        c.execute("""create function public.proplet_test_historical_fail() returns trigger language plpgsql as $$
        begin if new.player_id='41040000-0000-4000-8000-000000000001'::uuid and new.content_level=44 then
          raise exception 'HISTORICAL_TEST_INJECTED_AFTER_CLAIM'; end if; return new; end; $$""")
        c.execute("create trigger proplet_test_historical_fail before update of points on results for each row execute function public.proplet_test_historical_fail()")
    try:
        try:
            submit(failing)
            raise AssertionError("injected failure committed")
        except psycopg.errors.RaiseException as exc:
            assert "HISTORICAL_TEST_INJECTED_AFTER_CLAIM" in str(exc)
        with connect() as c:
            assert c.execute("select count(*) from results where player_id=%s and challenge_key=%s",(PLAYER,failing["challengeKey"])).fetchone()[0]==0
            assert c.execute("select count(*) from result_commands where player_id=%s and idempotency_key=%s",(PLAYER,failing["idempotencyKey"])).fetchone()[0]==0
            assert c.execute("select count(*) from puzzle_runs where player_id=%s and challenge_key=%s",(PLAYER,failing["challengeKey"])).fetchone()[0]==0
        assert claimed(44)==0
    finally:
        with connect() as c:
            c.execute("drop trigger proplet_test_historical_fail on results")
            c.execute("drop function public.proplet_test_historical_fail()")
    assert submit(failing)["awardedPoints"]==100 and claimed(44)==1
    checks.append("failure after claim rolls back every write; retry subsequently awards once")

    # The shared pool is per player and per difficulty, not a global cap.
    assert submit(command("historical-synthetic-easy-041",41,points=15,difficulty="easy"))["awardedPoints"]==15
    assert submit(command("historical-synthetic-g4-x-041",41,generation=4))["awardedPoints"]==100
    assert submit(command("historical-synthetic-g6-x-041",41,generation=6))["awardedPoints"]==100
    checks.append("different difficulty and all G4+ concrete boards remain independent")

    with connect() as c:
        assert c.execute("select relrowsecurity from pg_class where oid='public.historical_free_slot_rewards'::regclass").fetchone()[0]
        for role in ("anon","authenticated"):
            assert not c.execute("select has_table_privilege(%s,'public.historical_free_slot_rewards','select')",(role,)).fetchone()[0]
            assert not c.execute("select has_function_privilege(%s,'public.proplet_submit_result_v1(uuid,text,text,text,jsonb)','execute')",(role,)).fetchone()[0]
        assert c.execute("select has_table_privilege('service_role','public.historical_free_slot_rewards','select')").fetchone()[0]
        assert not c.execute("select has_table_privilege('service_role','public.historical_free_slot_rewards','insert')").fetchone()[0]
    checks.append("RLS enabled, anon/authenticated denied, service reads ledger only; RPC remains service-only")
    report={"finishedAt":datetime.now(timezone.utc).isoformat(),"host":"127.0.0.1","database":name,
        "syntheticOnly":True,"checks":checks,
        "limitations":["Loopback PostgreSQL schema from repository, not production data; Archive UI remains disabled."]}
    args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps({"passed":checks},ensure_ascii=False))

if __name__=="__main__":
    main()
