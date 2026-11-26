#!/usr/bin/env python3
"""Keep historic editions stable at the daily cutover and resolve real published games."""

from __future__ import annotations

import json
import os
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from unittest.mock import Mock, patch

from fastapi import HTTPException

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
import server  # noqa: E402


def released_slot(day: date) -> int | None:
    with (
        patch.object(server, "TAJENKA_RELEASE_ENABLED", True),
        patch.object(server, "VERCEL_ENV", "production"),
        patch.object(server, "current_prague_date", return_value=day),
    ):
        if not server.tajenka_is_live(day):
            return None
        response = server.current_tajenka(week=None)
        return int(json.loads(response.body)["week"])


def assert_unavailable(day: date) -> None:
    with (
        patch.object(server, "TAJENKA_RELEASE_ENABLED", True),
        patch.object(server, "VERCEL_ENV", "production"),
        patch.object(server, "current_prague_date", return_value=day),
    ):
        assert server.tajenka_is_live(day) is False
        try:
            server.current_tajenka(week=None)
        except HTTPException as error:
            assert error.status_code == 404
            assert error.detail == "Tajenka zatím není vydaná"
        else:
            raise AssertionError("unreleased Tajenka must not be served")


assert_unavailable(date(2026, 8, 28))

# Keep the two already released Saturday puzzles exactly where players saw them.
for day in (date(2026, 8, 29), date(2026, 9, 2), date(2026, 9, 4)):
    assert released_slot(day) == 1, day
for day in (date(2026, 9, 5), date(2026, 9, 9), date(2026, 9, 11)):
    assert released_slot(day) == 2, day

# Starting 12 Sep, a new puzzle arrives Saturday and Wednesday.
for day in (date(2026, 9, 12), date(2026, 9, 13), date(2026, 9, 15)):
    assert released_slot(day) == 3, day
for day in (date(2026, 9, 16), date(2026, 9, 17), date(2026, 9, 18)):
    assert released_slot(day) == 4, day
assert released_slot(date(2026, 9, 19)) == 5

assert released_slot(date(2026, 10, 7)) == 10
assert released_slot(date(2026, 10, 10)) == 11
assert released_slot(date(2026, 11, 25)) == 24
# Prague reaches midnight one hour before UTC at the November switch.
before_midnight = datetime.fromisoformat("2026-11-26T22:59:59+00:00").astimezone(server.TZ)
after_midnight = datetime.fromisoformat("2026-11-26T23:00:00+00:00").astimezone(server.TZ)
assert released_slot(before_midnight.date()) == 24 and released_slot(after_midnight.date()) == 25
assert [released_slot(date(2026, 11, day)) for day in (28, 29, 30)] == [63, 65, 66]
# A high-numbered bridge edition must not unlock as-yet unpublished puzzles.
assert server.released_tajenka("tajenka-v2-week-63", date(2026, 11, 28))
assert not server.released_tajenka("tajenka-v2-week-26", date(2026, 11, 30))
assert not server.released_tajenka("tajenka-v2-week-64", date(2026, 11, 30))
assert released_slot(date(2026, 12, 1)) == 26
assert released_slot(date(2026, 12, 2)) == 27
assert released_slot(date(2026, 12, 12)) == 37

prepared = len(server.load_tajenka_bank()["puzzles"])
last_date = date(2026, 11, 27) + timedelta(days=prepared - 25)
daily_period = [released_slot(date(2026, 11, 27) + timedelta(days=offset)) for offset in range(prepared - 24)]
assert sorted(daily_period) == list(range(25, prepared + 1))
sources = json.loads((ROOT / "content/tajenka-v2/daily-editions.json").read_text())["boards"]
for edition in sources:
    assert released_slot(date.fromisoformat(edition["releaseDate"])) == edition["week"]
assert_unavailable(last_date + timedelta(days=1))

with (
    patch.object(server, "TAJENKA_RELEASE_ENABLED", True),
    patch.object(server, "VERCEL_ENV", "production"),
    patch.object(server, "current_prague_date", return_value=date(2026, 12, 3)),
    patch.object(server, "enforce_rate_limit"),
):
    history = json.loads(server.recent_tajenky(review=True).body)
    assert history["date"] == "2026-12-03" and history["dailyFrom"] == "2026-11-27"
    assert [(e["week"], e["date"]) for e in history["editions"]] == [
        (28, "2026-12-03"), (27, "2026-12-02"), (26, "2026-12-01"), (66, "2026-11-30"),
        (65, "2026-11-29"), (63, "2026-11-28"), (25, "2026-11-27"),
    ]
    for e in history["editions"]:
        assert set(e) == {"id", "week", "date", "difficulty"}
        opened = json.loads(server.shared_puzzle(Mock(), "tajenka", e["id"], None).body)["puzzle"]
        assert (opened["week"], opened["difficulty"]) == (e["week"], e["difficulty"])
    future_id = server.tajenka_puzzle_for_week(29)["id"]
    try:
        server.shared_puzzle(Mock(), "tajenka", future_id, None)
    except HTTPException as error:
        assert error.status_code == 404
    else:
        raise AssertionError("future shared puzzle must not reveal its solution")
    # The old explicit selector is available only on isolated previews.
    assert json.loads(server.current_tajenka(week=29).body)["week"] == 28

with (
    patch.object(server, "TAJENKA_RELEASE_ENABLED", False),
    patch.object(server, "VERCEL_ENV", "preview"),
    patch.object(server, "VERCEL_GIT_COMMIT_REF", "feature/denni-tajenka-prosinec-2026"),
    patch.object(server, "LIVE_PLAYER_PREVIEW", False),
    patch.object(server, "current_prague_date", return_value=date(2026, 11, 25)),
):
    assert json.loads(server.recent_tajenky().body)["editions"][0]["week"] == 24
    assert json.loads(server.recent_tajenky(review=True).body)["date"] == "2026-12-19"
    with patch.object(server, "LIVE_PLAYER_PREVIEW", True), patch.object(server, "TAJENKA_RELEASE_ENABLED", True):
        assert json.loads(server.recent_tajenky(review=True).body)["date"] == "2026-11-25"

with (
    patch.object(server, "TAJENKA_RELEASE_ENABLED", True),
    patch.object(server, "current_prague_date", return_value=last_date + timedelta(days=30)),
):
    tail = json.loads(server.recent_tajenky().body)["editions"]
    assert [e["week"] for e in tail] == list(reversed(daily_period[-7:]))
    assert tail[0]["date"] == last_date.isoformat()

with (
    patch.object(server, "TAJENKA_RELEASE_ENABLED", False),
    patch.object(server, "VERCEL_ENV", "production"),
):
    try:
        server.recent_tajenky(review=True)
    except HTTPException as error:
        assert error.status_code == 404
    else:
        raise AssertionError("disabled production release must stay closed")

# The shareable review URL can never inherit a live database or send push events.
with patch.dict(os.environ, {
    "VERCEL_ENV": "preview", "VERCEL_GIT_COMMIT_REF": "feature/denni-tajenka-prosinec-2026",
    "SUPABASE_URL": "https://production.example", "SUPABASE_SECRET_KEY": "fixture",
    "VAPID_PRIVATE_KEY": "fixture", "CRON_SECRET": "fixture",
}, clear=True):
    config = server.backend_config.load_settings()
    assert not any((config.live_player_preview, config.supabase_url, config.supabase_secret_key,
                    config.vapid_private_key, config.cron_secret))

# Frontend and backend must use the same transition marker and split-week calculation.
app = (ROOT / "public" / "app.js").read_text(encoding="utf-8")
assert "TAJENKA_TWICE_WEEKLY_START" in app
assert "function tajenkaReleaseSlotForISO" in app
assert "cadenceOffset%7>=4" in app
assert "TAJENKA_RELEASE_ENABLED&&activeTajenkaWeek" in app

print("PASS: historical slots, Prague daily cutover, seven published editions, isolated review and future rejection")
