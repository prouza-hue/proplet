"""Exercise the real weekly route, Prague midnight, launch weekend and finite content bank."""

import json
import os
from datetime import date, datetime, timedelta
from pathlib import Path
from shutil import copytree
from tempfile import TemporaryDirectory
from unittest.mock import patch

from fastapi.testclient import TestClient

import server
from backend import spojky
from tools.build_vercel import SPOJKY_REVIEW_FILES, prepare_spojky_output


bank = json.loads(spojky.BANK.read_text(encoding="utf-8"))
boards = bank["boards"]
launch = date(2026, 11, 27)
first_monday = date(2026, 11, 30)
assert bank["launchDate"] == launch.isoformat()
assert [b["start"] for b in boards[:8]] == [(first_monday + timedelta(weeks=i)).isoformat() for i in range(8)]
assert [b["id"] for b in boards[:4]] == [f"spojky-cross-{i:02d}-v1" for i in range(1, 5)]
client = TestClient(server.app)


def get(iso, query=""):
    with patch.object(server, "current_prague_date", return_value=date.fromisoformat(iso)):
        response = client.get("/api/spojky" + query)
    assert "no-store" in response.headers["cache-control"]
    assert response.status_code == 200, (response.status_code, response.text)
    return response.json()


with patch.object(server, "VERCEL_ENV", "production"):
    before = get("2026-11-26")
    assert before == {"available": False, "date": "2026-11-26", "week": None, "start": None,
                      "end": None, "nextStart": launch.isoformat(), "board": None}

    # Real UTC instants on each side of Prague midnight. Monday inside the launch window keeps the same ID.
    for instant, week in (("2026-11-26T22:59:59+00:00", None), ("2026-11-26T23:00:00+00:00", 1),
                          ("2026-11-29T23:00:00+00:00", 1), ("2026-12-06T22:59:59+00:00", 1),
                          ("2026-12-06T23:00:00+00:00", 2)):
        with patch.object(server, "datetime", wraps=datetime) as clock:
            clock.now.side_effect = lambda tz: datetime.fromisoformat(instant).astimezone(tz)
            assert client.get("/api/spojky").json()["week"] == week

    for i, board in enumerate(boards):
        monday = date.fromisoformat(board["start"])
        start = monday if i else launch
        end = monday + timedelta(days=6)
        following = boards[i + 1]["start"] if i + 1 < len(boards) else None
        for day in (start, end):
            assert get(day.isoformat()) == {"available": True, "date": day.isoformat(), "week": i + 1,
                                           "start": start.isoformat(), "end": end.isoformat(),
                                           "nextStart": following, "board": board}
    exhausted = get((date.fromisoformat(boards[-1]["start"]) + timedelta(days=7)).isoformat())
    assert not exhausted["available"] and exhausted["board"] is None and exhausted["nextStart"] is None

    for selector in ("2027-01-18", "editions", ""):
        response = client.get("/api/spojky", params={"review": selector})
        assert response.status_code == 404 and "no-store" in response.headers["cache-control"]
    # Unknown query parameters must never select a different board.
    assert get("2026-12-06", "?week=8&datum=2027-01-18")["board"] == boards[0]
    for private_path in ("/data/spojky_weeks.json", "/content/spojky/crossings.json"):
        assert client.get(private_path).status_code == 404

with (patch.object(server, "VERCEL_ENV", "preview"), patch.object(server, "LIVE_PLAYER_PREVIEW", False),
      patch.object(server, "VERCEL_GIT_COMMIT_REF", server.backend_config.SPOJKY_REVIEW_BRANCH)):
    assert get("2026-11-26", "?review=2027-01-18")["board"] == boards[7]
    dates = get("2026-11-26", "?review=editions")["editions"]
    assert dates[0] == {"week": 1, "start": "2026-11-27", "end": "2026-12-06"}
    assert len(dates) == len(boards) and all(set(entry) == {"week", "start", "end"} for entry in dates)
    assert client.get("/api/spojky?review=2026-02-30").status_code == 400
    with patch.object(server, "VERCEL_GIT_COMMIT_REF", "preview/spojky-davka-20270125"):
        assert get("2027-01-18", "?review=editions")["editions"] == dates
    for branch in ("another-preview", "preview/spojky-davka-20270125-extra", "preview/spojky-davka-2027125"):
        with patch.object(server, "VERCEL_GIT_COMMIT_REF", branch):
            assert client.get("/api/spojky?review=editions").status_code == 404
    with patch.object(server, "LIVE_PLAYER_PREVIEW", True):
        assert client.get("/api/spojky?review=2027-01-18").status_code == 404

for branch in (server.backend_config.SPOJKY_REVIEW_BRANCH, "preview/spojky-davka-20270125"):
    with patch.dict(os.environ, {"VERCEL_ENV": "preview", "VERCEL_GIT_COMMIT_REF": branch,
                                 "SUPABASE_URL": "https://production.example", "SUPABASE_SECRET_KEY": "fixture",
                                 "VAPID_PRIVATE_KEY": "fixture", "CRON_SECRET": "fixture"}, clear=True):
        settings = server.backend_config.load_settings()
        assert not any((settings.live_player_preview, settings.supabase_url, settings.supabase_secret_key,
                        settings.vapid_private_key, settings.cron_secret))

with TemporaryDirectory() as tmp:
    public = Path(tmp) / "public"
    files = public / "design/spojky"
    copytree(server.ROOT / "public/design/spojky", files)
    original = {p.name: p.read_bytes() for p in files.iterdir() if p.is_file()}
    prepare_spojky_output(public, "preview")
    assert all((files / name).read_bytes() == data for name, data in original.items())
    prepare_spojky_output(public, "production")
    for name, data in original.items():
        packaged = (files / name).read_bytes()
        if name not in SPOJKY_REVIEW_FILES:
            assert packaged == data, name
        elif name.endswith(".html"):
            assert b'/?open=spojky' in packaged and b'<script' not in packaged, name
        else:
            assert packaged == b"", name

print("PASS: Spojky Prague launch, weekly boundaries, finite bank, isolated editorial review and production privacy")
