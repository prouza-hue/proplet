"""Static and game-design contracts for the preview-only Tajenka bank."""

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "public" / "tajenka-test.json"
APP = ROOT / "public" / "app.js"
STYLES = ROOT / "public" / "styles.css"
SERVER = ROOT / "server.py"
PUSH = ROOT / "push_diagnostics_v3329.py"
RUNTIME = ROOT / "public" / "runtime-meta.js"
SW = ROOT / "public" / "sw.js"
REWARD_XP = 200


def adjacent(a: int, b: int, cols: int) -> bool:
    return (abs(a - b) == 1 and a // cols == b // cols) or abs(a - b) == cols


def direction(a: int, b: int, cols: int) -> tuple[int, int]:
    return (b // cols - a // cols, b % cols - a % cols)


def turn_count(path: list[int], cols: int) -> int:
    directions = [direction(a, b, cols) for a, b in zip(path, path[1:])]
    return sum(current != previous for previous, current in zip(directions, directions[1:]))


def longest_straight_run(path: list[int], cols: int) -> int:
    directions = [direction(a, b, cols) for a, b in zip(path, path[1:])]
    longest = current = 1
    for previous, next_direction in zip(directions, directions[1:]):
        current = current + 1 if next_direction == previous else 1
        longest = max(longest, current)
    return longest


def validate_puzzle(data: dict, expected_week: int) -> None:
    assert data["version"] == 1
    assert data["id"] == f"tajenka-week-{expected_week:02d}"
    assert data["week"] == expected_week
    assert data["kind"] == "weekend_bonus"
    assert data["difficulty"] == "medium"
    assert data["meta"]["previewOnly"] is True
    assert data["meta"]["rewardXp"] == REWARD_XP

    rows, cols = data["rows"], data["cols"]
    assert (rows, cols) == (6, 6)
    assert len(data["letters"]) == rows * cols
    mask = set(data["mask"])
    assert len(mask) == len(data["mask"]) == data["meta"]["cells"]
    assert mask <= set(range(rows * cols))
    assert 2 <= rows * cols - len(mask) <= 4

    answer_owner = {}
    measured_turns = []
    for answer_index, answer in enumerate(data["answers"]):
        path = answer["path"]
        assert len(path) == len(answer["word"])
        assert len(answer["word"]) >= 4
        assert isinstance(answer.get("clue"), str) and len(answer["clue"]) >= 12
        assert len(set(path)) == len(path)
        assert set(path) <= mask
        assert all(adjacent(path[i - 1], path[i], cols) for i in range(1, len(path)))
        assert "".join(data["letters"][index] for index in path) == answer["word"]
        turns = turn_count(path, cols)
        measured_turns.append(turns)
        assert turns == answer["turns"]
        assert turns >= 2
        assert longest_straight_run(path, cols) <= 2
        for cell in path:
            assert cell not in answer_owner
            answer_owner[cell] = answer_index

    decoys = mask - set(answer_owner)
    assert len(decoys) == data["meta"]["decoyCells"] >= 3
    assert len(answer_owner) == data["meta"]["phraseCells"]
    assert sum(measured_turns) >= 14
    cross_word_edges = sum(
        1
        for cell in answer_owner
        for neighbour in answer_owner
        if cell < neighbour and adjacent(cell, neighbour, cols)
        and answer_owner[cell] != answer_owner[neighbour]
    )
    assert cross_word_edges == data["meta"]["crossWordEdges"] >= 4

    order = data["tajenka"]["answerOrder"]
    assert sorted(order) == list(range(len(data["answers"])))
    assert " ".join(data["answers"][index]["word"] for index in order) == data["tajenka"]["phrase"]


def main() -> None:
    bank = json.loads(FIXTURE.read_text(encoding="utf-8"))
    assert bank["version"] == 1
    assert bank["kind"] == "weekend_bonus_bank"
    assert bank["weeks"] == len(bank["puzzles"]) == 10
    assert bank["rewardXp"] == REWARD_XP
    assert len({puzzle["id"] for puzzle in bank["puzzles"]}) == 10
    assert len({puzzle["tajenka"]["phrase"] for puzzle in bank["puzzles"]}) == 10
    for week, puzzle in enumerate(bank["puzzles"], 1):
        validate_puzzle(puzzle, week)

    app = APP.read_text(encoding="utf-8")
    styles = STYLES.read_text(encoding="utf-8")
    server = SERVER.read_text(encoding="utf-8")
    push = PUSH.read_text(encoding="utf-8")
    runtime = RUNTIME.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    for marker in (
        "const TAJENKA_PREVIEW=",
        "const TAJENKA_AVAILABLE=",
        "const requestedTajenkaWeek=",
        "!TAJENKA_PRODUCTION_HOSTS.has(location.hostname)",
        "bank.kind!=='weekend_bonus_bank'",
        "puzzles.length!==10",
        "mode==='tajenka'?`tajenka:${puzzle.id}`",
        "TAJENKA_REWARD_XP=200",
        "state.completions[g.puzzle.id]=completion",
        "if(TAJENKA_RELEASE_ENABLED&&!old)",
        "Jiná pravidla",
        "Některá písmena na desce zůstanou nevyužitá.",
        "Významová stopa",
        "Každý víkend nová",
        "push_tajenka_opened",
    ):
        assert marker in app, marker

    for event in (
        "tajenka_viewed",
        "tajenka_started",
        "tajenka_word_found",
        "tajenka_completed",
        "tajenka_abandoned",
        "push_tajenka_opened",
    ):
        assert f'"{event}"' in server, event

    assert "TAJENKA_REWARD_XP = 200" in server
    assert 'payload.mode not in ("daily", "free", "starter", "tajenka")' in server
    assert 'payload.challenge_key != f"tajenka:{payload.puzzle_id}"' in server
    assert '"title": "✨ Víkendová Tajenka je tady"' in push
    assert '"body": "Pět slov, jedna myšlenka a 200 XP. Odhalíš ji?"' in push
    assert '"url": f"{canonical_origin}/?open=tajenka&via=push-tajenka"' in push
    assert "tajenkaReleaseEnabled:false" in runtime
    assert "tajenkaRewardXp:200" in runtime
    assert "proplet-v4.01.28-tajenka-preview-v6-shell" in sw
    assert "'/tajenka-test.json'" in sw

    assert re.search(r"\.tajenka-rule-note\{[^}]*font-size:14px", styles)
    assert re.search(r"@media\(max-width:600px\)\{\.tajenka-rule-note,[^}]*font-size:15px", styles)
    assert ".tajenka-entry-copy p{margin:0;color:#6d6478;font-size:14px" in styles

    hosts = re.search(r"const TAJENKA_PRODUCTION_HOSTS=new Set\(\[(.*?)\]\)", app, re.S)
    assert hosts and "hrajproplet.cz" in hosts.group(1)
    print("PASS: 10 winding Tajenka boards, readable rules, 200 XP contract, dormant Saturday push")


if __name__ == "__main__":
    main()
