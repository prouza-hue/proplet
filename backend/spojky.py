"""Publish one edition of Spojky by its authored Prague calendar dates."""

import json
from dataclasses import dataclass
from datetime import date, timedelta
from functools import lru_cache
from pathlib import Path


BANK = Path(__file__).resolve().parents[1] / "data" / "spojky_weeks.json"


@dataclass(frozen=True)
class Edition:
    week: int
    start: date
    end: date
    board: dict


@lru_cache(maxsize=1)
def load_editions(path: Path = BANK) -> tuple[Edition, ...]:
    source = json.loads(path.read_text(encoding="utf-8"))
    launch = date.fromisoformat(source["launchDate"])
    editions = []
    ids = set()
    for number, board in enumerate(source["boards"], start=1):
        monday = date.fromisoformat(board["start"])
        if monday.weekday() != 0 or (editions and monday <= editions[-1].end):
            raise ValueError("Týdny Spojek musejí začínat v různá pondělí v časovém pořadí.")
        if not board["id"] or board["id"] in ids:
            raise ValueError("Každé vydání Spojek potřebuje jedinečné ID.")
        if number == 1 and not 0 <= (monday - launch).days < 7:
            raise ValueError("Datum spuštění musí připadnout na první pondělí nebo na šest dní před ním.")
        # The launch weekend belongs to the first full week. Keep the board's original ID and Monday.
        start = launch if number == 1 else monday
        editions.append(Edition(number, start, monday + timedelta(days=6), board))
        ids.add(board["id"])
    if not editions:
        raise ValueError("V bance Spojek chybí první týden.")
    return tuple(editions)


def edition_for(day: date) -> dict:
    editions = load_editions()
    current = next((e for e in editions if e.start <= day <= e.end), None)
    upcoming = next((e.start for e in editions if e.start > day), None)
    return {
        "available": current is not None,
        "date": day.isoformat(),
        "week": current.week if current else None,
        "start": current.start.isoformat() if current else None,
        "end": current.end.isoformat() if current else None,
        "nextStart": upcoming.isoformat() if upcoming else None,
        "board": current.board if current else None,
    }


def editorial_calendar() -> dict:
    return {"editions": [{"week": e.week, "start": e.start.isoformat(), "end": e.end.isoformat()}
                         for e in load_editions()]}
