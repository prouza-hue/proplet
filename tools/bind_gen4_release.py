#!/usr/bin/env python3
"""Bind an audited paused Gen4 candidate to explicitly approved release dates."""
from __future__ import annotations

import argparse
from datetime import date, timedelta
import json
from pathlib import Path


def monday_on_or_before(day: date) -> date:
    return day - timedelta(days=day.weekday())


def monday_after(day: date) -> date:
    return day + timedelta(days=(7 - day.weekday()) or 7)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--puzzles", type=Path, required=True)
    parser.add_argument("--rolling", type=Path, required=True)
    parser.add_argument("--release-date", required=True, help="Production cutover in Europe/Prague, YYYY-MM-DD")
    parser.add_argument("--approved-by", required=True)
    parser.add_argument("--puzzles-output", type=Path, required=True)
    parser.add_argument("--rolling-output", type=Path, required=True)
    args = parser.parse_args()
    release_date = date.fromisoformat(args.release_date)
    if args.approved_by.strip().casefold() != "pavel":
        raise SystemExit("Production binding requires explicit --approved-by Pavel")

    puzzles = json.loads(args.puzzles.read_text(encoding="utf-8"))
    rolling = json.loads(args.rolling.read_text(encoding="utf-8"))
    if int(puzzles.get("contentGeneration") or 0) != 4 or int(rolling.get("contentGeneration") or 0) != 4:
        raise SystemExit("Inputs are not a Generation 4 candidate")
    if (puzzles.get("release") or {}).get("productionApproved") is not False:
        raise SystemExit("Expected a paused, unapproved runtime candidate")
    if rolling.get("releaseEnabled") is not False:
        raise SystemExit("Expected a paused rolling candidate")

    release = puzzles.setdefault("release", {})
    release.update({
        "status": "approved-bound",
        "productionApproved": True,
        "approvedBy": "Pavel",
        "dailyGeneration4From": release_date.isoformat(),
    })
    puzzles["dailyGeneration4From"] = release_date.isoformat()
    puzzles["dailyRotationBaseDate"] = monday_on_or_before(release_date).isoformat()
    for window in (puzzles.get("archive") or {}).get("dailyWindows") or []:
        if int(window.get("generation") or 0) == 3:
            window["activeUntil"] = (release_date - timedelta(days=1)).isoformat()

    first_rolling = monday_after(release_date)
    release["rollingFirstRelease"] = first_rolling.isoformat()
    rolling.update({
        "releaseEnabled": True,
        "releasePauseReason": None,
        "firstRelease": first_rolling.isoformat(),
        "reservedThrough": (first_rolling + timedelta(weeks=12)).isoformat(),
    })
    by_id = {
        puzzle["id"]: puzzle
        for values in (rolling.get("puzzles") or {}).values()
        for puzzle in values or []
    }
    for week, batch in enumerate(rolling.get("batches") or []):
        available = first_rolling + timedelta(weeks=week)
        batch["id"] = f"{available.isocalendar().year}-W{available.isocalendar().week:02d}"
        batch["availableFrom"] = available.isoformat()
        for level in batch.get("levels") or []:
            puzzle = by_id.get(level.get("id"))
            if puzzle:
                puzzle["meta"]["availableFrom"] = available.isoformat()
                puzzle["meta"]["releaseBatch"] = batch["id"]

    args.puzzles_output.parent.mkdir(parents=True, exist_ok=True)
    args.rolling_output.parent.mkdir(parents=True, exist_ok=True)
    args.puzzles_output.write_text(json.dumps(puzzles, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    args.rolling_output.write_text(json.dumps(rolling, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "releaseDate": release_date.isoformat(),
        "dailyRotationBaseDate": puzzles["dailyRotationBaseDate"],
        "rollingFirstRelease": first_rolling.isoformat(),
        "approvedBy": "Pavel",
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
