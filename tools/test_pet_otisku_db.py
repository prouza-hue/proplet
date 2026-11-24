"""Exercise the real gift API and score isolation inside the patron SQL fixture."""
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path

import psycopg


def gift_series_acceptance(client, owner_headers, other_headers, opts, owner):
    path = "/api/pet-otisku"
    content = Path(__file__).resolve().parents[1] / "public/app/content/pet-otisku.json"
    boards = json.loads(content.read_text(encoding="utf8"))["boards"]

    def finish(board, headers=owner_headers):
        paths = [answer["path"] for answer in boards[board - 1]["answers"]]
        return client.post(f"{path}/complete", headers=headers, json={"board": board, "solution": paths})

    def totals(db):
        xp = db.execute("select result_xp,reward_xp from public.proplet_account_xp_v1(array[%s::uuid])",
                        (owner,)).fetchone()
        regular = db.execute("select count(*),coalesce(sum(points),0) from public.results where player_id=%s",
                             (owner,)).fetchone()
        bonuses = db.execute("select count(*),coalesce(sum(points),0) from public.account_rewards where player_id=%s",
                             (owner,)).fetchone()
        return xp, regular, bonuses

    assert client.get(path).status_code == 401
    assert client.get(path, headers=owner_headers).json()["eligible"]
    assert not client.get(path, headers=other_headers).json()["eligible"]
    assert finish(1, other_headers).status_code == 403
    assert finish(2).status_code == 409
    assert client.post(path + "/complete", headers=owner_headers, json={"board": 1, "solution": [[0]]}).status_code == 422
    assert client.post(path + "/seen", headers=owner_headers, json={"kind": "gift"}).json()["claimed"]
    assert not client.post(path + "/seen", headers=owner_headers, json={"kind": "gift"}).json()["claimed"]
    with psycopg.connect(**opts) as db:
        before, regular, bonuses = totals(db)
        with ThreadPoolExecutor(max_workers=2) as pool:
            concurrent = list(pool.map(lambda _: finish(1).json()["awardedXp"], range(2)))
        assert sorted(concurrent) == [0, 300]
        for number in range(2, 6):
            assert finish(number).json()["awardedXp"] == 300
        assert finish(2).json()["awardedXp"] == 0
        assert client.get(path, headers=owner_headers).json()["completed"] == [1, 2, 3, 4, 5]
        assert totals(db) == ((before[0], before[1] + 1500), regular, bonuses)
        assert not db.execute("select has_function_privilege('authenticated','public.proplet_pet_otisku_v1(uuid,text,integer)','execute')").fetchone()[0]
    print("PASS gift series: five verified solutions, authenticated eligibility, sequential unlock, concurrent retries, personal-only XP")
