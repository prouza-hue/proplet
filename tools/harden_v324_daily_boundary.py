#!/usr/bin/env python3
"""Tighten Daily Gen3 validation at the 2026-08-17 generation boundary.

Cached historical generations remain accepted for their date mapping, but a
future Gen3 board must never be accepted for a pre-switch Daily date.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SERVER = ROOT / "server.py"

OLD = '''    active = data.get("daily", [])
    if active:
        base = str(data.get("dailyRotationBaseDate") or data.get("dailyGeneration3From") or "2026-01-01")
        ids.add(active[daily_rotation_index(daily_date, len(active), base)]["id"])
'''

NEW = '''    active = data.get("daily", [])
    switch3_raw = data.get("dailyGeneration3From")
    try:
        requested_date = date.fromisoformat(daily_date)
        switch3 = date.fromisoformat(str(switch3_raw)) if switch3_raw else None
    except ValueError:
        raise HTTPException(400, "Neplatné datum")
    if active and (switch3 is None or requested_date >= switch3):
        base = str(data.get("dailyRotationBaseDate") or data.get("dailyGeneration3From") or "2026-01-01")
        ids.add(active[daily_rotation_index(daily_date, len(active), base)]["id"])
'''


def main() -> None:
    text = SERVER.read_text(encoding="utf-8")
    if NEW in text:
        print("Daily generation boundary already hardened.")
        return
    count = text.count(OLD)
    if count != 1:
        raise RuntimeError(f"Expected one Daily active-generation validation block, found {count}.")
    SERVER.write_text(text.replace(OLD, NEW, 1), encoding="utf-8")
    print("Hardened Daily Generation 3 switch boundary.")


if __name__ == "__main__":
    main()
