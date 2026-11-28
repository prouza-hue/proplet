"""The deployable Python function must validate the same boards as the static CDN."""
import json
import re
from pathlib import Path

from backend.pet_otisku import edition_solutions, solutions


def main():
    bank = Path(__file__).resolve().parents[2] / "public/app/content/pet-otisku.json"
    boards = json.loads(bank.read_text(encoding="utf8"))["boards"]
    assert [b["id"] for b in boards] == [f"otisk-2026-11-{n:02}" for n in range(1, 6)]
    assert solutions() == {b["id"]: [a["path"] for a in b["answers"]] for b in boards}
    december = json.loads((bank.parent / "2026-12.json").read_text(encoding="utf8"))["boards"]
    assert [b["id"] for b in december] == [f"otisk-2026-12-{n:02}" for n in range(1, 6)]
    assert edition_solutions("2026-12") == {b["id"]: [a["path"] for a in b["answers"]] for b in december}
    public = bank.parents[2]
    game = (public / "app/game/pet-otisku.js").read_text(encoding="utf8")
    shell = (public / "sw.js").read_text(encoding="utf8")
    bank_url = re.search(r"bank: '(/app/content/2026-12\.json\?v=[^']+)'", game)
    assert bank_url, "The revised December bank requires a cache revision."
    assert f"'{bank_url.group(1)}'" in shell, "The PWA must preload the same December bank as the game."
    print("PASS December CDN cache revision, offline shell and validation paths agree")
    print("PASS all five published boards match server validation paths")


if __name__ == "__main__":
    main()
