"""Static contract checks for the preview-only Tajenka experiment."""

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "public" / "tajenka-test.json"
APP = ROOT / "public" / "app.js"
SERVER = ROOT / "server.py"
SW = ROOT / "public" / "sw.js"


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


def main() -> None:
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    assert data["version"] == 1
    assert data["id"] == "tajenka-test-003"
    assert data["kind"] == "weekend_bonus"
    assert data["meta"]["previewOnly"] is True

    rows, cols = data["rows"], data["cols"]
    assert (rows, cols) == (6, 6)
    assert len(data["letters"]) == rows * cols
    mask = set(data["mask"])
    assert len(mask) == len(data["mask"]) == data["meta"]["cells"]
    assert mask <= set(range(rows * cols))

    answer_owner = {}
    measured_turns = []
    for answer_index, answer in enumerate(data["answers"]):
        path = answer["path"]
        assert len(path) == len(answer["word"])
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

    # This is a game-design contract, not just a data-integrity test: the 6x6
    # silhouette has visible bites, four deliberate decoys create plausible
    # false branches, and none of the words can regress into a straight row.
    decoys = mask - set(answer_owner)
    assert len(set(range(rows * cols)) - mask) == 4
    assert len(decoys) == data["meta"]["decoyCells"] == 4
    assert len(answer_owner) == data["meta"]["phraseCells"] == 28
    assert sum(measured_turns) >= 18
    cross_word_edges = sum(
        1
        for cell in answer_owner
        for neighbour in answer_owner
        if cell < neighbour and adjacent(cell, neighbour, cols)
        and answer_owner[cell] != answer_owner[neighbour]
    )
    assert cross_word_edges >= 15

    order = data["tajenka"]["answerOrder"]
    assert sorted(order) == list(range(len(data["answers"])))
    assert " ".join(data["answers"][index]["word"] for index in order) == data["tajenka"]["phrase"]

    app = APP.read_text(encoding="utf-8")
    server = SERVER.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    for marker in (
        "const TAJENKA_PREVIEW=",
        "const TAJENKA_PREVIEW_ORIGIN=",
        "!TAJENKA_PRODUCTION_HOSTS.has(location.hostname)",
        "fetch('/tajenka-test.json'",
        "challengeKey(mode,puzzle,date){return mode==='daily'",
        "mode==='tajenka'?`tajenka:${puzzle.id}`",
        "if(mode==='tajenka')return 0",
        "if(mode==='tajenka')return savedTajenkaProgress(puzzle)",
        "if(g.mode==='tajenka')return saveTajenkaGameProgress(g)",
        "trackProductEvent('tajenka_completed')",
    ):
        assert marker in app, marker

    for event in (
        "tajenka_viewed",
        "tajenka_started",
        "tajenka_word_found",
        "tajenka_completed",
        "tajenka_abandoned",
    ):
        assert f'"{event}"' in server, event

    assert "proplet-v4.01.28-tajenka-preview-v4-shell" in sw
    assert "'/tajenka-test.json'" in sw

    # The gate must explicitly list production origins so ?tajenka=1 cannot expose it there.
    hosts = re.search(r"const TAJENKA_PRODUCTION_HOSTS=new Set\(\[(.*?)\]\)", app, re.S)
    assert hosts and "hrajproplet.cz" in hosts.group(1)
    print("PASS: Tajenka fixture, preview gate, isolated state, and telemetry contract")


if __name__ == "__main__":
    main()
