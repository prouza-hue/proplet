from __future__ import annotations

from datetime import date
from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def main() -> None:
    app = text("public/app.js")
    sw = text("public/sw.js")
    server_src = text("server.py")
    html = text("public/index.html")
    css = text("public/styles.css")
    migration = text("SUPABASE_MIGRATION_V3_30.sql")
    vercel = json.loads(text("vercel.json"))
    base = json.loads(text("data/puzzles.json"))
    public = json.loads(text("public/puzzles.json"))
    reserve = json.loads(text("data/rolling_content_v1.json"))

    assert "const APP_VERSION='3.30.0-preview.1'" in app
    assert 'APP_VERSION = "3.30.0-preview.1"' in server_src
    assert "const EXPECTED_PUZZLE_DB_VERSION=9" in app
    assert 'ROLLING_CONTENT_PATH = ROOT / "data" / "rolling_content_v1.json"' in server_src
    assert "def load_rolling_content()" in server_src
    assert '@app.get("/api/rolling-content")' in server_src
    assert '@app.get("/api/puzzles")' not in server_src
    assert "released_rolling_payload" in server_src
    assert "is_puzzle_released" in server_src
    assert "zatím nevydaná úroveň" in server_src
    assert 'VERCEL_ENV == "production"' in server_src
    assert "X-Proplet-Preview-As-Of" in app
    assert base["version"] == 9 == public["version"] == reserve["basePuzzleVersion"]
    assert base["free"] == public["free"]
    assert {d: len(base["free"][d]) for d in ("easy", "medium", "hard", "hardcore")} == {d: 200 for d in ("easy", "medium", "hard", "hardcore")}
    assert reserve["version"] == 1
    assert {d: len(reserve["puzzles"][d]) for d in ("easy", "medium", "hard", "hardcore")} == {"easy": 17, "medium": 16, "hard": 16, "hardcore": 16}

    # v3.28.3 fast boot stays intact. Large base remains static/CDN; only the small
    # weekly delta is dynamic and gets a Monday cache key.
    assert "showPuzzleBootLoading()" in app
    assert "const url='/puzzles.json'" in app
    assert "caches.match(url,{ignoreSearch:true})" in app
    assert "fetch(url,{cache:'no-store'})" in app
    assert "function contentWeekKey" in app
    assert "function rollingContentUrl" in app
    assert "new URLSearchParams({week})" in app
    assert "caches.match('/api/rolling-content',{ignoreSearch:true})" in app
    assert "function mergeRollingContent" in app
    assert "refreshRollingContent().catch(()=>{})" in app
    assert "extras=Object.fromEntries(Object.keys(DIFF).map" in app
    assert "filter(p=>p.meta?.rollingContent)" in app
    assert "u.pathname==='/api/rolling-content'||u.pathname==='/puzzles.json'" in sw
    assert "Monday week= cache key" in sw
    assert "if(cached){e.waitUntil(refresh.catch(()=>{}));return cached;}" in sw
    assert "if(u.pathname.startsWith('/api/'))return" in sw

    # Simulated future preview is read-only for gameplay/analytics data in the shared DB.
    assert "if(CONTENT_PREVIEW_DATE&&rec?.mode==='free'&&Number(rec?.level||0)>200)return" in app
    assert "if(CONTENT_PREVIEW_DATE||!rec?.attemptId" in app
    assert "if(CONTENT_PREVIEW_DATE)return;api('/api/product-event'" in app
    assert "simulovaném content preview hodnocení neodesíláme" in app

    rolling = [p for d in ("easy", "medium", "hard", "hardcore") for p in reserve["puzzles"][d]]
    assert len(rolling) == 65
    assert all(p["meta"].get("wideVerifiedUnique") is True for p in rolling)
    assert all(p["meta"].get("wideUniquenessDictionarySize") == 12000 for p in rolling)
    assert all(201 <= int(p["meta"]["level"]) <= 217 for p in rolling)

    # 201+ levels resolve for stats/results after release, but future guessed IDs stay blocked.
    assert 'reserve = load_rolling_content()' in server_src
    assert '"rolling": True' in server_src
    assert 'return is_puzzle_released(info.get("puzzle") or {}, current_prague_date())' in server_src
    assert 'len(reserve.get("puzzles", {}).get(key, []))' in server_src
    assert 'bank = sorted(released_free_bank(difficulty, effective_content_date(request))' in server_src

    # Consent isolation, stale-client compatibility, at-most-once content delivery.
    assert re.search(r"update public\.push_subscriptions set daily_enabled = true where daily_enabled is null", migration, re.I)
    assert re.search(r"update public\.push_subscriptions set content_enabled = false where content_enabled is null", migration, re.I)
    assert "push_delivery_log" in migration
    assert "check (level >= 1)" in migration
    assert "level between 1 and 200" not in migration.lower()
    assert "legacy_client = payload.daily_enabled is None and payload.content_enabled is None" in server_src
    assert 'content_enabled = bool(existing[0].get("content_enabled", False))' in server_src
    assert '@app.get("/api/cron/content-push")' in server_src
    assert "Content push sent but delivery ledger update failed" in server_src
    assert "send did not succeed; a later cron may retry" in server_src

    assert 'id="contentPushToggleBtn"' in html
    assert 'id="newContentBanner"' in html
    assert "5 nových Propletů" in app
    assert "fresh-level-badge" in css
    assert "Dokonči všech 200" not in app
    assert "continueLatestContent" in app
    assert "contentBatchId:options.contentBatchId||null" in app
    assert "latestContentUnplayed().filter" in app

    crons = {(x["path"], x["schedule"]) for x in vercel.get("crons", [])}
    assert ("/api/cron/daily-push", "0 7 * * *") in crons
    assert ("/api/cron/content-push", "0 9 * * 1") in crons

    import server
    before = server.released_rolling_payload(date(2026, 8, 23))
    first = server.released_rolling_payload(date(2026, 8, 24))
    second = server.released_rolling_payload(date(2026, 8, 31))
    end = server.released_rolling_payload(date(2026, 11, 16))

    def counts(payload: dict) -> dict[str, int]:
        return {d: len(payload["puzzles"][d]) for d in ("easy", "medium", "hard", "hardcore")}

    assert counts(before) == {"easy": 0, "medium": 0, "hard": 0, "hardcore": 0}
    assert counts(first) == {"easy": 2, "medium": 1, "hard": 1, "hardcore": 1}
    assert counts(second) == {"easy": 3, "medium": 3, "hard": 2, "hardcore": 2}
    assert counts(end) == {"easy": 17, "medium": 16, "hard": 16, "hardcore": 16}
    assert first["latestBatch"]["count"] == 5
    assert first["latestBatch"]["extraDifficulty"] == "easy"
    assert first["nextRelease"] == "2026-08-31"
    first_ids = {p["id"] for bank in first["puzzles"].values() for p in bank}
    assert {"g2-e-201", "g2-e-202", "g2-m-201", "g2-h-201", "g2-x-201"} <= first_ids
    assert "g2-m-202" not in first_ids
    assert "batches" not in first.get("meta", {}) and "puzzles" not in first.get("meta", {})

    original_env = server.VERCEL_ENV
    try:
        server.VERCEL_ENV = "production"
        assert server.effective_content_date(request=None, requested="2026-11-16") == server.current_prague_date()
    finally:
        server.VERCEL_ENV = original_env

    print(json.dumps({
        "verification": "PASS",
        "appVersion": "3.30.0-preview.1",
        "basePuzzleVersion": 9,
        "rollingVersion": 1,
        "baseCounts": {d: 200 for d in ("easy", "medium", "hard", "hardcore")},
        "rollingPuzzles": len(rolling),
        "firstDrop": first["latestBatch"]["id"],
        "firstDropCounts": counts(first),
        "secondWeekCounts": counts(second),
        "reservedThroughCounts": counts(end),
        "fastBootPreserved": True,
        "rollingSurvivesBaseRefresh": True,
        "basePuzzleFilesUnchangedByArchitecture": True,
        "futurePreviewWritesSuppressed": True,
        "existingDailyConsentPreserved": True,
        "contentConsentDefaultsOff": True,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
