"""Exercise the real gift API and score isolation inside the patron SQL fixture."""
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from uuid import uuid4
from psycopg import sql
import json
from pathlib import Path

import psycopg


@contextmanager
def fixture_day(opts, day):
    """Change clocks only on the loopback disposable database used by this suite."""
    assert opts["host"] == "127.0.0.1" and opts["dbname"].startswith("proplet_test_")
    with psycopg.connect(**opts) as db:
        def definition(name):
            return db.execute("select pg_get_functiondef(%s::regprocedure)", (name,)).fetchone()[0]
        actual_day = definition("proplet_private.gift_local_day()")
        actual_meter = definition("public.proplet_patron_state_v1(uuid,boolean)")
        try:
            db.execute(sql.SQL("create or replace function proplet_private.gift_local_day() returns date language sql stable as $$select {}::date$$").format(sql.Literal(day)))
            clock = sql.Literal(day + " 12:00 Europe/Prague").as_string(db) + "::timestamptz"
            assert "t:=clock_timestamp()" in actual_meter
            db.execute(actual_meter.replace("t:=clock_timestamp()", "t:=" + clock))
            yield db
        finally:
            db.execute(actual_meter)
            db.execute(actual_day)


def gift_series_acceptance(client, owner_headers, other_headers, opts, owner):
    with fixture_day(opts, "2026-11-26"):
        november_acceptance(client, owner_headers, other_headers, opts, owner)
    monthly_acceptance(client, owner_headers, other_headers, opts, owner)


def november_acceptance(client, owner_headers, other_headers, opts, owner):
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


def monthly_acceptance(client, headers, unpaid, opts, owner):
    path = "/api/gift-editions/2026-12"
    boards = json.loads((Path(__file__).resolve().parents[1] / "public/app/content/2026-12.json").read_text())["boards"]

    def state(h):
        result = client.get(path, headers=h)
        assert result.status_code == 200, result.text
        return result.json()

    def claim(h, kind):
        return client.post(path + "/seen", headers=h, json={"kind": kind}).json()["claimed"]

    def finish(board):
        paths = [answer["path"] for answer in boards[board - 1]["answers"]]
        return client.post(path + "/complete", headers=headers, json={"board": board, "solution": paths})

    def race(fn):
        with ThreadPoolExecutor(max_workers=2) as pool:
            return sorted(pool.map(lambda _: fn(), range(2)))

    def xp(db):
        return db.execute("select reward_xp from public.proplet_account_xp_v1(array[%s::uuid])", (owner,)).fetchone()[0]

    def bank_receipt(db, intent_id, amount, day):
        payment = db.execute("""insert into proplet_private.patron_payments
            (intent_id,bank_account,bank_transaction_id,reference,amount_czk,currency,confirmed_by)
            select id,recipient_account,%s,reference,%s,'CZK',%s from proplet_private.patron_intents
            where id=%s returning id""",(str(uuid4()),amount,owner,intent_id)).fetchone()[0]
        db.execute("insert into proplet_private.patron_payment_dates(payment_id,paid_on,recorded_by) values(%s,%s,%s)",(payment,day,owner))

    with fixture_day(opts, "2026-11-30"):
        assert client.get(path).status_code == 401
        assert state(headers)["editions"] == ["2026-11"] and not state(headers)["eligible"]
        assert not claim(headers, "gift") and finish(1).status_code == 403
    with fixture_day(opts, "2026-12-01") as db:
        assert state(headers)["editions"] == ["2026-12", "2026-11"]
        assert not client.post("/api/pet-otisku/seen", headers=headers, json={"kind":"gift"}).json()["claimed"]
        assert race(lambda: claim(headers, "gift")) == [False, True]
        assert finish(2).status_code == 409
        before = xp(db)
        regular = db.execute("select count(*) from public.results where player_id=%s", (owner,)).fetchone()
        assert race(lambda: finish(1).json()["awardedXp"]) == [0, 300]
        for n in range(2,6):
            assert finish(n).json()["awardedXp"] == 300
        assert finish(3).json()["awardedXp"] == 0 and xp(db) == before + 1500
        assert regular == db.execute("select count(*) from public.results where player_id=%s", (owner,)).fetchone()
        assert not state(unpaid)["askActive"]
    with fixture_day(opts, "2026-12-24"):
        assert not claim(unpaid, "ask")
    with fixture_day(opts, "2026-12-25") as db:
        # Other account has an unconfirmed manually created QR. Age it out to test
        # the same seven-day policy used by the patron status endpoint.
        assert state(unpaid)["pending"] and not state(unpaid)["askActive"]
        # Use the authenticated API to obtain an intent bound to the exact fixture owner.
        intent = client.post("/api/patrons/intents", headers=unpaid, json={"requestId":str(uuid4()),"amountCzk":99}).json()["intent"]
        db.execute("update proplet_private.patron_intents set created_at=now()-interval '14 days' where player_id=(select player_id from proplet_private.patron_intents where id=%s)",(intent["id"],))
        client.post("/api/patrons/preferences", headers=unpaid, json={"offersDisabled":True})
        assert not claim(unpaid, "ask")
        client.post("/api/patrons/preferences", headers=unpaid, json={"offersDisabled":False})
        meter = client.get("/api/patrons",headers=unpaid).json()["monthFunding"]
        assert state(unpaid)["remainingCzk"] == meter["remainingCzk"] and state(unpaid)["askActive"]
        assert race(lambda: claim(unpaid, "ask")) == [False, True]
        assert not state(headers)["askActive"]
        owner_intent = db.execute("select id from proplet_private.patron_intents where player_id=%s limit 1",(owner,)).fetchone()[0]
        bank_receipt(db,owner_intent,2000,"2026-12-25")
        assert state(unpaid)["remainingCzk"] == 0 and not state(unpaid)["askActive"]
        assert state(headers)["eligible"]
    with fixture_day(opts, "2027-01-01") as db:
        assert not state(unpaid)["askActive"] and not claim(unpaid,"ask")
        assert state(headers)["eligible"] and state(headers)["completed"] == [1,2,3,4,5]
        assert not state(unpaid)["eligible"]
        # A December bank transfer confirmed after the calendar flips belongs to December.
        bank_receipt(db,intent["id"],99,"2026-12-31")
        assert state(unpaid)["editions"] == ["2026-12"] and not claim(unpaid,"gift")
    print("PASS monthly series: release boundary, two-device awards/receipts, archive, late bank date, opt-out, pending and meter.")
