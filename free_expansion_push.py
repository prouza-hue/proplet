"""One finite content variant of the existing 3 November morning notification."""
from datetime import datetime
from functools import lru_cache
import json
from pathlib import Path
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Europe/Prague")
START = datetime(2026, 11, 3, 8, 0, tzinfo=TZ)
END = datetime(2026, 11, 3, 9, 0, tzinfo=TZ)
DAY = START.date().isoformat()
DELIVERY_KEY = "daily:" + DAY
CAMPAIGN_ID = "free-expansion-600-20261102"
DIFFICULTIES = ("easy", "medium", "hard", "hardcore", "mozkomor", "mozkokalypsa")


def in_window(now):
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("Expansion push requires an aware clock")
    return START <= now < END


def payload(origin):
    return {"title": "600 nových úrovní",
            "body": "Po 100 v každé obtížnosti. Vyber si, co si dnes rozpleteš.",
            "url": origin.rstrip("/") + "/?open=free&via=push-content",
            "tag": "proplet-" + CAMPAIGN_ID,
            "campaignId": CAMPAIGN_ID}


@lru_cache(maxsize=1)
def load_content():
    return json.loads((Path(__file__).resolve().parent / "data/puzzles.json").read_bytes())


def validate_content(content):
    release = content.get("freeExpansionRelease") or {}
    if (release.get("batchId") != CAMPAIGN_ID or release.get("totalNewLevels") != 600
            or release.get("newLevelCounts") != {d: 100 for d in DIFFICULTIES}
            or content.get("freeGeneration") != 4 or content.get("contentGeneration") != 4):
        return False
    all_new = []
    for difficulty in DIFFICULTIES:
        added = [p for p in content.get("free", {}).get(difficulty, [])
                 if str(p.get("id", "")).startswith("g6-expansion-")]
        if {p.get("id") for p in added} != {f"g6-expansion-{difficulty}-{i:03d}" for i in range(1, 101)} or len(added) != 100:
            return False
        for board in added:
            meta = board.get("meta") or {}
            if (board.get("difficulty") != difficulty or meta.get("releaseBatch") != CAMPAIGN_ID
                    or meta.get("contentGeneration") != 4 or meta.get("generatorGeneration") != 6
                    or meta.get("candidateOnly") is not False or meta.get("playtestOnly") is not False
                    or str(meta.get("availableFrom") or "9999") > DAY):
                return False
        all_new.extend(p["id"] for p in added)
    return len(all_new) == len(set(all_new)) == 600
