#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APPROVED = ROOT / "data" / "tajenka_v2_approved.json"
CLUES = ROOT / "data" / "tajenka_v2_clues.json"
PROD = ROOT / "data" / "tajenka_weekend_v2.json"
MANIFEST = ROOT / "data" / "tajenka_v2_freeze_manifest.json"


def geometry(board: dict) -> dict:
    return {
        "mask": board["mask"],
        "letters": board["letters"],
        "answers": [{"word": a["word"], "path": a["path"]} for a in board["answers"]],
    }


def digest(board: dict) -> str:
    raw = json.dumps(geometry(board), ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def neighbours(cell: int, cols: int, rows: int):
    r, c = divmod(cell, cols)
    if r: yield cell - cols
    if r + 1 < rows: yield cell + cols
    if c: yield cell - 1
    if c + 1 < cols: yield cell + 1


def norm(text: str) -> str:
    return str(text or "").upper()


def assert_phrase_coverage(puzzle: dict) -> None:
    text = puzzle["tajenka"]["displayText"]
    words = re.findall(r"[^\W\d_]+|\d+", text, flags=re.UNICODE)
    used = [False] * len(words)
    answers = puzzle["answers"]
    for answer in answers:
        for i, word in enumerate(words):
            if not used[i] and norm(word) == norm(answer["word"]):
                used[i] = True
                break
        else:
            raise AssertionError(f"{puzzle['id']}: anchor {answer['word']} missing from displayText")
    for companion in puzzle["tajenka"].get("companions", []):
        wanted = re.findall(r"[^\W\d_]+|\d+", companion["text"], flags=re.UNICODE)
        assert any(norm(a["word"]) == norm(companion["revealWith"]) for a in answers), (puzzle["id"], companion)
        found = False
        for start in range(len(words) - len(wanted) + 1):
            if any(used[start:start + len(wanted)]):
                continue
            if all(norm(words[start + j]) == norm(wanted[j]) for j in range(len(wanted))):
                for j in range(len(wanted)): used[start + j] = True
                found = True
                break
        assert found, f"{puzzle['id']}: companion not found: {companion['text']}"
    assert all(used), f"{puzzle['id']}: unrevealed phrase words: {[w for w,u in zip(words,used) if not u]}"


def main() -> None:
    approved = json.loads(APPROVED.read_text(encoding="utf-8"))
    clue_payload = json.loads(CLUES.read_text(encoding="utf-8"))
    prod = json.loads(PROD.read_text(encoding="utf-8"))
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    source_boards = approved["boards"]
    puzzles = prod["puzzles"]
    clues = clue_payload.get("clues") or {}
    assert clue_payload.get("version") == 1 and isinstance(clues, dict)
    assert approved.get("failures") == []
    assert len(source_boards) == len(puzzles) == len(manifest["boards"]) == 37
    assert prod["version"] == 2 and prod["weeks"] == 37 and prod["rewardXp"] == 200

    required_words = {answer["word"] for board in source_boards for answer in board["answers"]}
    assert set(clues) == required_words, f"clue coverage mismatch missing={sorted(required_words-set(clues))} extra={sorted(set(clues)-required_words)}"

    answer_count = 0
    for week, (source, puzzle, frozen) in enumerate(zip(source_boards, puzzles, manifest["boards"]), 1):
        assert puzzle["week"] == week
        assert puzzle["id"] == f"tajenka-v2-week-{week:02d}"
        assert puzzle["sourceId"] == source["id"] == frozen["sourceId"]
        expected = digest(source)
        assert digest(puzzle) == expected == puzzle["meta"]["geometrySha256"] == frozen["geometrySha256"], puzzle["id"]
        assert puzzle["mask"] == source["mask"]
        assert puzzle["letters"] == source["letters"]
        assert [(a["word"], a["path"]) for a in puzzle["answers"]] == [(a["word"], a["path"]) for a in source["answers"]]
        mask = set(puzzle["mask"])
        rows, cols = puzzle["rows"], puzzle["cols"]
        assert all(any(n in mask for n in neighbours(cell, cols, rows)) for cell in mask), f"{puzzle['id']}: isolated active cell"
        for answer in puzzle["answers"]:
            answer_count += 1
            assert len(answer["path"]) == len(answer["word"])
            assert answer["path"] == list(dict.fromkeys(answer["path"]))
            assert all(cell in mask for cell in answer["path"])
            assert all(b in set(neighbours(a, cols, rows)) for a, b in zip(answer["path"], answer["path"][1:]))
            assert "".join(puzzle["letters"][cell] for cell in answer["path"]) == answer["word"]
            clue = str(answer.get("clue") or "").strip()
            assert clue == str(clues[answer["word"]]).strip(), f"{puzzle['id']} {answer['word']}: clue mismatch"
            assert 3 <= len(clue) <= 90, f"{puzzle['id']} {answer['word']}: invalid clue length"
            assert not clue.startswith("Hledej slovo dlouhé"), f"{puzzle['id']} {answer['word']}: semantic clue fell back to length"
        assert puzzle["meta"].get("alternativeFullPaths") == 0
        assert puzzle["tajenka"]["phrase"] == puzzle["tajenka"]["displayText"] == source["displayText"]
        assert_phrase_coverage(puzzle)
        if puzzle.get("category") in {"fact", "czech", "quote"}:
            src = puzzle.get("source") or {}
            assert src.get("status") == "verified" and str(src.get("url", "")).startswith("https://"), puzzle["id"]
        if puzzle.get("category") == "quote":
            assert puzzle["source"].get("author") and puzzle["source"].get("work"), puzzle["id"]

    assert answer_count == 184, f"expected 184 playable anchors, got {answer_count}"
    config = (ROOT / "backend/config.py").read_text(encoding="utf-8")
    server = (ROOT / "server.py").read_text(encoding="utf-8")
    app = (ROOT / "public/app.js").read_text(encoding="utf-8")
    result_fix = (ROOT / "public/tajenka-release-fix.js").read_text(encoding="utf-8")
    assert 'tajenka_bank_path=data_root / "tajenka_weekend_v2.json"' in config
    assert 'Query(default=None, ge=1, le=37)' in server
    assert 'const TAJENKA_PREPARED_WEEKS=37;' in app
    assert 'Math.min(37,' in app
    assert 'function tajenkaPhraseTokens(' in app
    assert 'puzzle?.tajenka?.companions' in app
    assert "tajenka&&level===1" in app and "pick.a.clue" in app, "Tajenka level-1 hint must read semantic clue metadata"
    assert 'currentSourceMarkup' in result_fix and 'tajenka-result-source' in result_fix
    assert "Pět slov, jedna společná myšlenka." not in app
    print("Tajenka v2 production validation: 37/37 frozen boards + 184/184 semantic clues PASS")


if __name__ == "__main__":
    main()
