"""Live-player preview uses canonical reward/actor paths; all services are in-memory fakes."""
from dataclasses import replace
from datetime import datetime, timezone
from pathlib import Path
import sys
from unittest.mock import DEFAULT, patch

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import account_auth
from account_bonus_v3331 import install_account_bonus
from competitive_sharing_v3331 import install_competitive_sharing
import word_recognition_v3330 as words


class Services:
    def __init__(self):
        self.rows = []
        self.writes = []
        self.rpcs = []
        self.rates = []
        self.actors = []
        self.rpc_failure = False
        self.bonus_race = False
        self.special_allowed = True

    def auth(self, token):
        if token != "Bearer synthetic":
            raise HTTPException(401, "synthetic auth required")
        return {"id": "synthetic-player"}

    def actor(self, authorization, anonymous_id):
        self.actors.append((authorization, anonymous_id))
        if authorization:
            return {"player_id": self.auth(authorization)["id"], "anonymous_id": None}
        if anonymous_id != "synthetic-anonymous":
            raise HTTPException(400, "synthetic actor required")
        return {"player_id": None, "anonymous_id": anonymous_id}

    def select(self, table, **filters):
        assert table == "account_rewards"
        return [row for row in self.rows if all(row.get(key) == value for key, value in filters.items())]

    def insert(self, table, row):
        self.writes.append((table, dict(row)))
        if table == "account_rewards":
            self.rows.append(dict(row))
            if self.bonus_race:
                raise HTTPException(409, "synthetic unique-key race")

    def rpc(self, name, params):
        self.rpcs.append((name, dict(params)))
        assert name == "proplet_claim_word_discovery"
        assert params["p_player_id"] == "synthetic-player"
        if self.rpc_failure:
            raise HTTPException(503, "synthetic RPC failure")
        key = words._discovery_reward_key(params["p_puzzle_id"], params["p_word"])
        self.rows.append({"player_id": params["p_player_id"], "reward_key": key,
                          "points": 1, "granted_at": datetime.now(timezone.utc).isoformat()})
        return [{"newly_granted": True, "awarded_points": 1, "reward_key": key, "reason": "granted"}]

    def rate(self, request, action, **limits):
        self.rates.append((action, limits))

    def special_identity(self, payload):
        if not self.special_allowed or payload.challenge_key != "daily-special:2026-10-25:hardcore":
            raise HTTPException(400, "synthetic immutable binding denied")


PUZZLE = {"rows": 1, "cols": 4, "mask": [0, 1, 2, 3], "letters": list("STÁJ"), "answers": []}
CLAIM = {"puzzle_id": "synthetic-board", "mode": "free", "difficulty": "easy",
         "word": "STÁJ", "path": [0, 1, 2, 3]}
AUTH = {"Authorization": "Bearer synthetic"}
UNSET = object()


def client_for(flag=UNSET, environment="preview", rpc=True):
    services, app = Services(), FastAPI()
    options = {"vercel_env": environment}
    if flag is not UNSET:
        options["live_player_preview"] = flag
    install_account_bonus(app, db_select=services.select, db_insert=services.insert,
                          auth_player=services.auth, enforce_rate_limit=services.rate,
                          tz=timezone.utc, telemetry_actor=services.actor, **options)
    install_competitive_sharing(app, db_insert=services.insert, enforce_rate_limit=services.rate,
                                tz=timezone.utc, telemetry_actor=services.actor, **options)
    words.install_word_recognition(
        app, db_select=services.select, db_rpc=services.rpc if rpc else None,
        auth_player=services.auth, enforce_rate_limit=services.rate, tz=timezone.utc,
        resolved_puzzle=lambda *_args: PUZZLE,
        puzzle_exists=lambda puzzle_id, *_args: puzzle_id == CLAIM["puzzle_id"],
        daily_puzzle_matches_date=lambda _puzzle_id, date: date == "2026-10-25",
        daily_special_discovery_identity=services.special_identity, **options,
    )
    return TestClient(app), services


with patch.object(words, "_recognize_source", side_effect=lambda word: "synthetic-lexicon" if word == "stáj" else None):
    # Omitted/default/False and a truthy string must remain ordinary safe preview.
    for flag in (UNSET, False, "true"):
        client, services = client_for(flag)
        assert client.post("/api/account-bonus/claim").status_code == 401
        assert client.post("/api/word-discovery/claim", json=CLAIM).status_code == 401
        bonus = client.post("/api/account-bonus/claim", headers=AUTH).json()
        word = client.post("/api/word-discovery/claim", headers=AUTH, json=CLAIM).json()
        assert bonus["simulated"] is True and bonus["bonusXp"] == 500
        assert word["simulated"] is True and word["awardedPoints"] == words.WORD_DISCOVERY_XP
        for endpoint, event in (("account-bonus-event", "account_bonus_offer_seen"),
                                ("challenge-event", "daily_share_clicked")):
            assert client.post("/api/" + endpoint, json={"event_type": event}).json()["ignored"] is True
            assert client.post("/api/" + endpoint, json={"event_type": "unapproved_event"}).status_code == 400
        assert not services.writes and not services.rpcs and not services.actors

    # Explicit live preview and existing production take the same validated paths.
    for flag, environment in ((True, "preview"), (False, "production")):
        client, services = client_for(flag, environment)
        for endpoint in ("/api/account-bonus/claim", "/api/word-discovery/claim"):
            response = client.post(endpoint, json=CLAIM if "word" in endpoint else None)
            assert response.status_code == 401
        assert not services.writes and not services.rpcs
        for changed in ({"path": [0, 1, 1, 3]}, {"puzzle_id": "unpublished-board"},
                        {"mode": "daily", "daily_date": "2026-10-24"},
                        {"mode": "daily_special", "difficulty": "hardcore",
                         "daily_date": "2026-10-25", "challenge_key": "daily:2026-10-25"}):
            assert client.post("/api/word-discovery/claim", headers=AUTH, json={**CLAIM, **changed}).status_code == 400
        assert not services.rpcs

        bonus = client.post("/api/account-bonus/claim", headers=AUTH).json()
        assert "simulated" not in bonus and bonus["newlyGranted"] is True and bonus["bonusXp"] == 500
        assert services.writes[0][0] == "account_rewards"
        assert services.writes[0][1]["player_id"] == "synthetic-player"
        assert client.post("/api/account-bonus/claim", headers=AUTH).json()["newlyGranted"] is False
        assert len(services.writes) == 1

        word = client.post("/api/word-discovery/claim", headers=AUTH, json=CLAIM).json()
        assert "simulated" not in word and word["awardedPoints"] == 1
        assert services.rpcs == [("proplet_claim_word_discovery", {
            "p_player_id": "synthetic-player", "p_puzzle_id": "synthetic-board", "p_word": "stáj"})]
        repeat = client.post("/api/word-discovery/claim", headers=AUTH, json=CLAIM).json()
        assert repeat["newlyGranted"] is False and repeat["awardedPoints"] == 0 and len(services.rpcs) == 1

        for endpoint, event in (("account-bonus-event", "account_bonus_offer_seen"),
                                ("challenge-event", "daily_share_clicked")):
            assert client.post("/api/" + endpoint, json={"event_type": event},
                               headers={"Authorization": "Bearer invalid"}).status_code == 401
            response = client.post("/api/" + endpoint, headers=AUTH, json={"event_type": event})
            assert response.status_code == 200 and response.json() == {"ok": True}
            assert services.writes[-1][0] == "product_events"
            assert services.writes[-1][1]["event_type"] == event
            assert services.writes[-1][1]["player_id"] == "synthetic-player"
            assert client.post("/api/" + endpoint, headers=AUTH, json={"event_type": "unapproved_event"}).status_code == 400
        assert {row[0] for row in services.rates} >= {"account_bonus_claim", "word_discovery_claim", "account_bonus_event", "challenge_event"}

    client, services = client_for(True)
    services.bonus_race = True
    raced = client.post("/api/account-bonus/claim", headers=AUTH).json()
    assert raced["newlyGranted"] is False and raced["bonusXp"] == 500 and "simulated" not in raced
    for rpc_available in (False, True):
        client, services = client_for(True, rpc=rpc_available)
        services.rpc_failure = True
        assert client.post("/api/word-discovery/claim", headers=AUTH, json=CLAIM).status_code == 503
        assert not services.rows, "RPC failure must never become simulated or optimistic XP"

# Assembly must preserve preview identity and forward only the explicit bool.
fake = lambda *_args, **_kwargs: None
required = {name: fake for name in ("db_select", "db_insert", "db_update", "db_delete", "auth_player", "new_session",
                                   "hash_password", "verify_password", "enforce_rate_limit", "player_stats",
                                   "public_family_code", "league_name_for")}
services = account_auth.AppServices(supabase_url="https://example.invalid", supabase_key="synthetic-key",
                                   tz=timezone.utc, vercel_env="preview", **required)
assert services.live_player_preview is False
assert account_auth.AppServices.from_legacy_kwargs({**required, "supabase_url": "", "supabase_key": "", "tz": timezone.utc}).live_player_preview is False
installers = ("_install_account_auth_core", "_install_push_diagnostics", "_install_account_integrity",
              "_install_word_recognition", "_install_competitive_sharing", "_install_account_bonus",
              "_install_rescue_limit_v40115", "_install_preview_auth_v334")
for enabled in (False, True):
    with patch.multiple(account_auth, **{name: DEFAULT for name in installers}) as mocked:
        account_auth.install_account_auth(object(), services=replace(services, live_player_preview=enabled))
        for name in ("_install_word_recognition", "_install_competitive_sharing", "_install_account_bonus"):
            assert mocked[name].call_args.kwargs["live_player_preview"] is enabled
            assert mocked[name].call_args.kwargs["vercel_env"] == "preview"

print("PASS live-player preview: explicit opt-in, unchanged auth/binding/rate guards, canonical RPC/grant/dedup, actor events, ordinary preview simulation, no network or database")
