#!/usr/bin/env python3
"""Balanced v2 calibration profile for v3.34 playtesting.

Keeps the independent-path / zero forced handoff model from the v1 lab, but
reduces path curl so Medium remains readable and early Hard can plausibly land
around the agreed ~120 s calibration centre. This is still calibration-only.
"""
from __future__ import annotations

import json
from pathlib import Path

import generate_v334_calibration as cal

ROOT = Path(__file__).resolve().parents[1]
LEXICAL_DECISIONS = ROOT / "data" / "target_generation_exclusions_v334.json"

# Product-owner lexical decisions are applied to calibration immediately, while
# recognition remains untouched. Pending review words are not auto-excluded.
if LEXICAL_DECISIONS.exists():
    payload = json.loads(LEXICAL_DECISIONS.read_text(encoding="utf-8"))
    cal.MUST_REVIEW |= {
        str(word).casefold()
        for word in payload.get("remove_from_target_generation", [])
        if str(word).strip()
    }

cal.PROFILES["medium"].update({
    "cells": (44, 49),
    "turn_bias": 0.45,
    "min_curvy_share": 0.25,
    "max_mean_straight_share": 0.60,
    "geometry_profile": "v334-medium-independent-v2-balanced",
})
cal.PROFILES["hard"].update({
    "cells": (54, 60),
    "turn_bias": 1.05,
    "min_curvy_share": 0.50,
    "max_mean_straight_share": 0.54,
    "geometry_profile": "v334-hard-independent-v2-balanced",
})


def balanced_min_turns(length: int, difficulty: str) -> int:
    if difficulty == "medium":
        return 1 if length >= 7 else 0
    if length >= 8:
        return 2
    if length >= 5:
        return 1
    return 0


cal.min_turns_for = balanced_min_turns

if __name__ == "__main__":
    cal.main()
