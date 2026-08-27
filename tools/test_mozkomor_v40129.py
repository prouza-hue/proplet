#!/usr/bin/env python3
"""Mozkomor v4.01.29 progression and reward regression contract."""
from __future__ import annotations

from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))

import server


def puzzle(pid: str, diff: str, level: int, *, rolling: bool=False) -> dict:
    return {
        "id": pid,
        "difficulty": diff,
        "rows": 10,
        "cols": 10,
        "mask": list(range(72)),
        "letters": ["A"] * 100,
        "lengths": [5] * 10,
        "answers": [],
        "meta": {
            "level": level,
            "contentGeneration": 4,
            **({"availableFrom": "2026-08-01"} if rolling else {}),
        },
    }


def result(pid: str, diff: str) -> dict:
    return {
        "id": f"r-{pid}",
        "puzzle_id": pid,
        "mode": "free",
        "difficulty": diff,
        "points": server.POINTS[diff],
    }


def main() -> None:
    assert "mozkomor" in server.FREE_DIFFICULTIES
    assert "mozkomor" not in server.ROLLING_DIFFICULTIES
    assert server.POINTS["mozkomor"] == 200
    assert server.MOZKOMOR_UNLOCK_BASE_LEVELS == 200

    base_hardcore=[puzzle(f"g4-x-{i:03d}","hardcore",i) for i in range(1,201)]
    base_mozkomor=[puzzle(f"g4-z-{i:03d}","mozkomor",i) for i in range(1,101)]
    rolling_hardcore=[puzzle("g4-x-201","hardcore",201,rolling=True)]
    data={
        "freeGeneration":4,
        "free":{"easy":[],"medium":[],"hard":[],"hardcore":base_hardcore,"mozkomor":base_mozkomor},
        "mozkomorUnlock":{"requiresDifficulty":"hardcore","requiresCurrentBaseLevels":200},
    }
    rolling={
        "version":1,
        "releaseEnabled":True,
        "puzzles":{"easy":[],"medium":[],"hard":[],"hardcore":rolling_hardcore},
        "batches":[],
    }

    orig_puzzles,orig_rolling=server.load_puzzles,server.load_rolling_content
    try:
        server.load_puzzles=lambda: data
        server.load_rolling_content=lambda: rolling

        rows199=[result(f"g4-x-{i:03d}","hardcore") for i in range(1,200)]
        summary=server.free_slot_summary(rows199)
        assert summary["baseCurrent"]["hardcore"] == 199
        assert server.mozkomor_unlocked_from_rows(rows199) is False

        # Weekly/rolling Hardcore #201 cannot substitute for missing base #200.
        with_rolling=rows199+[result("g4-x-201","hardcore")]
        summary=server.free_slot_summary(with_rolling)
        assert summary["current"]["hardcore"] == 200
        assert summary["baseCurrent"]["hardcore"] == 199
        assert server.mozkomor_unlocked_from_rows(with_rolling) is False

        rows200=rows199+[result("g4-x-200","hardcore")]
        summary=server.free_slot_summary(rows200)
        assert summary["baseCurrent"]["hardcore"] == 200
        assert server.mozkomor_unlocked_from_rows(rows200) is True

        # Once a Mozkomor result exists, later content-generation churn must not relock it.
        persisted=rows199+[result("g4-z-001","mozkomor")]
        assert server.mozkomor_unlocked_from_rows(persisted) is True

        info=server.free_puzzle_info("g4-z-001","mozkomor")
        assert info and info["difficulty"]=="mozkomor" and info["level"]==1
        assert info["generation"]==4 and info["legacy"] is False
        points,transferred=server.claim_free_slot_points("p",info,server.POINTS["mozkomor"],"g4-z-001")
        assert (points,transferred)==(200,False)
    finally:
        server.load_puzzles=orig_puzzles
        server.load_rolling_content=orig_rolling

    migration=(ROOT/"SUPABASE_MIGRATION_V4_01_29_MOZKOMOR.sql").read_text(encoding="utf-8").lower()
    for table in ("results","puzzle_attempts","free_slot_rewards"):
        assert f"alter table public.{table}" in migration
    assert migration.count("'mozkomor'::text") >= 3

    print("Mozkomor v4.01.29 server progression contract: OK")


if __name__=="__main__":
    main()
