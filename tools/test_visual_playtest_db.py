"""Real pilot RPC/RLS and concurrent displays, synthetic loopback database only."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import re
import threading
import uuid

import psycopg

ROOT = Path(__file__).resolve().parents[1]
CAMPAIGN = "visual-refresh-20261027-v1"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database-report", type=Path, required=True)
    parser.add_argument("--password-file", type=Path, required=True)
    args = parser.parse_args()
    source = json.loads(args.database_report.read_text())
    if (source.get("host") != "127.0.0.1" or source.get("syntheticOnly") is not True
            or not re.fullmatch(r"proplet_test_[a-z0-9_]{1,40}", source.get("database", ""))):
        parser.error("Refusing non-disposable database target")
    options = dict(host="127.0.0.1", port=55432, user="proplet_test_admin",
                   password=args.password_file.read_text().strip(), dbname=source["database"])
    with psycopg.connect(**options, autocommit=True) as conn:
        conn.execute("select set_config('proplet.visual_pilot_test','isolated',false)")
        conn.execute((ROOT / "supabase/tests/visual_playtest_pilot.sql").read_text())
    print("PASS pilot SQL: inactive/outsider/reviewer, service-only/RLS, read-only GET, cap2/snooze7d, persistent edit/revoke")

    # Separate real transactions prove the row lock, not a Python simulation.
    player = uuid.uuid4()
    with psycopg.connect(**options) as conn:
        conn.execute("insert into players(id,name,family_code,token_hash) values(%s,'Pilot race',%s,%s)",
                     (player, "SOLO_" + player.hex[:8], player.hex))
        conn.execute("update visual_playtest_campaigns set active=true where campaign_id=%s", (CAMPAIGN,))
        conn.execute("insert into visual_playtest_participants(campaign_id,player_id) values(%s,%s)", (CAMPAIGN, player))
    try:
        barrier = threading.Barrier(4)
        def shown(_):
            with psycopg.connect(**options) as conn:
                conn.execute("set local statement_timeout='10s'")
                conn.execute("set local role service_role")
                barrier.wait(timeout=10)
                return conn.execute("select proplet_visual_playtest_v1(%s,%s,'shown')", (CAMPAIGN,player)).fetchone()[0]
        with ThreadPoolExecutor(4) as pool:
            results = list(pool.map(shown, range(4)))
        assert sum(value["displayGranted"] is True for value in results) == 1, results
        assert all(value["shownCount"] == 1 for value in results), results
        with psycopg.connect(**options) as conn:
            for role in ("anon", "authenticated"):
                with conn.transaction():
                    conn.execute("set local role " + role)
                    try:
                        with conn.transaction():
                            conn.execute("select proplet_visual_playtest_v1(%s,%s)", (CAMPAIGN,player))
                    except psycopg.errors.InsufficientPrivilege:
                        pass
                    else:
                        raise AssertionError("Public role executed pilot RPC")
        print("PASS pilot concurrency: 4 requests reserve one display; service_role works, public roles denied")
    finally:
        with psycopg.connect(**options) as conn:
            conn.execute("delete from players where id=%s", (player,))
            conn.execute("update visual_playtest_campaigns set active=false where campaign_id=%s", (CAMPAIGN,))


if __name__ == "__main__":
    main()
