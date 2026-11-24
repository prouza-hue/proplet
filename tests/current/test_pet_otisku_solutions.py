"""The deployable Python function must validate the same boards as the static CDN."""
import json
from pathlib import Path

from backend.pet_otisku import solutions


def main():
    bank = Path(__file__).resolve().parents[2] / "public/app/content/pet-otisku.json"
    boards = json.loads(bank.read_text(encoding="utf8"))["boards"]
    assert [b["id"] for b in boards] == [f"otisk-2026-11-{n:02}" for n in range(1, 6)]
    assert solutions() == {b["id"]: [a["path"] for a in b["answers"]] for b in boards}
    print("PASS all five published boards match server validation paths")


if __name__ == "__main__":
    main()
