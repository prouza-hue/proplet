"""Exercise overlapping HTTP claims using two connections to the isolated CI database."""
from concurrent.futures import ThreadPoolExecutor
from contextlib import ExitStack
from time import monotonic, sleep
from uuid import uuid4
from zoneinfo import ZoneInfo

import psycopg
from psycopg import sql
from fastapi import FastAPI
from fastapi.testclient import TestClient

from word_recognition_v3330 import install_word_recognition


def device(connection, player, board):
    def select(table, *, columns, player_id, reward_key=None):
        assert table == "account_rewards" and player_id == player
        projection = sql.SQL(",").join(map(sql.Identifier, columns.split(",")))
        predicate = sql.SQL(" and reward_key = %s") if reward_key is not None else sql.SQL("")
        params = (player, reward_key) if reward_key is not None else (player,)
        query = sql.SQL(
            "select row_to_json(r) as row from (select {} from public.account_rewards "
            "where player_id = %s{} order by id) r"
        ).format(projection, predicate)
        return [r["row"] for r in connection.execute(query, params)]

    def rpc(name, payload):
        assert name == "proplet_claim_word_discovery"
        return connection.execute(
            "select * from public.proplet_claim_word_discovery(%s, %s, %s)",
            (payload["p_player_id"], payload["p_puzzle_id"], payload["p_word"]),
        ).fetchall()

    app = FastAPI()
    puzzle = {"rows": 1, "cols": 4, "letters": list("JILM"), "mask": list(range(4)), "answers": []}
    install_word_recognition(
        app, db_select=select, db_rpc=rpc, auth_player=lambda _: {"id": player},
        tz=ZoneInfo("Europe/Prague"), resolved_puzzle=lambda *_: puzzle,
        puzzle_exists=lambda puzzle_id, *_: puzzle_id == board,
    )
    return TestClient(app)


def check_word_discovery_race(options, *, recovered):
    player = str(uuid4())
    board = "synthetic-xp-race"
    key = f"word_discovery_v1:{board}:jilm"
    payload = {"puzzle_id": board, "word": "JILM", "mode": "free", "difficulty": "easy", "path": list(range(4))}
    with ExitStack() as stack:
        control = stack.enter_context(psycopg.connect(**options))
        control.execute(
            "insert into public.players(id,name,family_code,token_hash) values(%s,%s,%s,%s)",
            (player, "Synthetic XP race", "SOLO_" + player[:8].upper(), "synthetic-" + player),
        )
        stack.callback(control.execute, "delete from public.players where id=%s", (player,))
        if recovered:
            control.execute(
                "insert into public.account_rewards(id,player_id,reward_key,points,puzzle_id,reward_type) "
                "values(%s,%s,%s,1,%s,'word_discovery')",
                (uuid4(), player, "word_discovery_recovery_v1:" + board, board),
            )

        connections = [stack.enter_context(psycopg.connect(**options)) for _ in range(2)]
        clients = [stack.enter_context(device(c, player, board)) for c in connections]
        pids = [c.info.backend_pid for c in connections]
        with ThreadPoolExecutor(max_workers=2) as executor:
            # Readers can finish validation and their first SELECT. Hold writes until
            # both independently dispatched SQL calls are waiting inside PostgreSQL.
            with control.transaction():
                control.execute("lock table public.account_rewards in share mode")
                futures = [executor.submit(client.post, "/api/word-discovery/claim", json=payload) for client in clients]
                deadline = monotonic() + 15
                while True:
                    blocked = control.execute(
                        "select count(*) as n from unnest(%s::integer[]) p(pid) "
                        "where cardinality(pg_blocking_pids(pid)) > 0", (pids,),
                    ).fetchone()["n"]
                    if blocked == 2:
                        break
                    for future in futures:
                        if future.done():
                            raise AssertionError(f"claim ended before overlap: {future.result().text}")
                    if monotonic() >= deadline:
                        raise AssertionError(f"only {blocked} of two claims reached lock contention")
                    sleep(0.02)
            responses = [f.result(timeout=10) for f in futures]

        for response in responses:
            assert response.status_code == 200, response.text
        replies = [r.json() for r in responses]
        expected_reasons = {"duplicate", "recovered" if recovered else "granted"}
        assert {r["limitReason"] for r in replies} == expected_reasons, replies
        assert sum(r["awardedPoints"] for r in replies) == (0 if recovered else 1), replies
        snapshot = {"rewardKeys": [key], "totalDiscoveryXp": 1, "dailyDiscoveryXp": 1, "discoveredWords": 1}
        for reply, client in zip(replies, clients):
            assert reply["boardDiscoveryXp"] == 1
            status = client.get("/api/word-discovery/status").json()
            for field, expected in snapshot.items():
                assert reply[field] == status[field] == expected, (field, reply, status)
        balance = control.execute(
            "select count(*) filter (where reward_key=%s) as keys, sum(points) as total "
            "from public.account_rewards where player_id=%s and "
            "(reward_key like 'word_discovery_v1:%%' or reward_key like 'word_discovery_recovery_v1:%%')", (key, player),
        ).fetchone()
        assert balance["keys"] == balance["total"] == 1, balance
        print(f"PASS two overlapping word claims: {sorted(expected_reasons)}, one word key, both clients at 1 XP")
