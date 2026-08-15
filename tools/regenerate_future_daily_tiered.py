#!/usr/bin/env python3
"""Regenerate only future Daily puzzles with the tiered vocabulary.

Past/today Daily puzzles are immutable.  This makes the content upgrade safe for existing results.
Free and rescue banks are intentionally untouched until we have a global manifest of started puzzle IDs.
"""
from __future__ import annotations

from datetime import date
from pathlib import Path
from collections import Counter
import argparse
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import generate_puzzles as gp  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from-date", default="2026-08-13")
    ap.add_argument("--seed", type=int, default=3110813)
    args = ap.parse_args()

    start_date = date.fromisoformat(args.from_date)
    base = date(2026, 1, 1)
    start_idx = (start_date - base).days
    if not 0 <= start_idx < 365:
        raise SystemExit("--from-date must be within the first 365-day Daily rotation")

    server_out = ROOT / "data" / "puzzles.json"
    public_out = ROOT / "public" / "puzzles.json"
    data = json.loads(server_out.read_text(encoding="utf-8"))
    if len(data.get("daily", [])) != 365:
        raise SystemExit("Expected a 365-puzzle Daily bank")

    tiers, tier_of = gp.load_answer_tiers()
    pools = gp.build_answer_pools(tiers)
    freq = gp.load_frequency_words()
    all_answers = [w for tier in ("A", "B", "C", "D") for w in tiers[tier]]
    dictionary = [w for w, _ in freq if w not in gp.FUNCTION_WORDS]
    dictionary = dictionary[:12000] + [w for w in all_answers if w not in dictionary[:12000]]

    used = set()
    for bank in data.get("free", {}).values():
        for p in bank:
            used.add((p["rows"], p["cols"], tuple(p["letters"])))
    for p in data.get("daily", [])[:start_idx]:
        used.add((p["rows"], p["cols"], tuple(p["letters"])))
    for p in data.get("rescue", []):
        used.add((p["rows"], p["cols"], tuple(p["letters"])))

    old_future = data["daily"][start_idx:]
    new_future = []
    for offset, old in enumerate(old_future):
        idx = start_idx + offset
        geom = old.get("difficulty") or "medium"
        retry = 0
        while True:
            seed = (args.seed * 1000003 + (idx + 1) * 7919 + retry * 104729) % (2**31 - 2) + 1
            retry += 1
            try:
                p = gp.create_puzzle(
                    geom, seed, pools["daily"], dictionary, f"d11-{idx+1:03d}",
                    variant_index=idx if geom == "hard" else None,
                    tier_of=tier_of, vocab_key="daily",
                )
            except RuntimeError:
                continue
            sig = (p["rows"], p["cols"], tuple(p["letters"]))
            if sig in used:
                continue
            used.add(sig)
            p.setdefault("meta", {})["tieredVocabulary"] = True
            p["meta"]["rotationIndex"] = idx
            new_future.append(p)
            break
        if (offset + 1) % 20 == 0 or offset + 1 == len(old_future):
            print(f"future Daily {offset+1}/{len(old_future)}", flush=True)

    data["daily"] = data["daily"][:start_idx] + new_future
    data["version"] = max(int(data.get("version") or 0), 8)
    data["generatedAt"] = "2026-08-12"
    data["dictionarySize"] = len(dictionary)
    data["dailyRotationSize"] = len(data["daily"])
    data["vocabularyVersion"] = 1
    data["vocabularyTierCounts"] = {k: len(v) for k, v in tiers.items()}
    data["tieredDailyFrom"] = args.from_date

    raw = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    server_out.write_text(raw, encoding="utf-8")
    public_out.write_text(raw, encoding="utf-8")

    counts = Counter(tier_of[a["word"].lower()] for p in new_future for a in p["answers"])
    print("DONE", {"preservedDaily": start_idx, "regeneratedDaily": len(new_future), "tierCounts": dict(counts)})


if __name__ == "__main__":
    main()
