"""Static, release-safety, and game-design contracts for the Tajenka bank."""

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "data" / "tajenka_weekend_v1.json"
APP = ROOT / "public" / "app.js"
STYLES = ROOT / "public" / "styles.css"
GAME_LAYOUT = ROOT / "public" / "game.css"
SERVER = ROOT / "server.py"
BACKEND_CONFIG = ROOT / "backend" / "config.py"
BACKEND_CONTENT = ROOT / "backend" / "content.py"
PUSH = ROOT / "push_diagnostics_v3329.py"
RUNTIME = ROOT / "public" / "runtime-meta.js"
SW = ROOT / "public" / "sw.js"
RELEASE_NOTES = ROOT / "public" / "release-notes-v3331.js"
HINTS = ROOT / "public" / "app" / "game" / "hints.js"
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


def matching_paths(text: str, letters: list[str], mask: set[int], rows: int, cols: int) -> set[tuple[int, ...]]:
    result: set[tuple[int, ...]] = set()
    for start in mask:
        if letters[start] != text[0]:
            continue
        path = [start]
        used = {start}

        def visit(position: int) -> None:
            if position == len(text):
                result.add(tuple(path))
                return
            for cell in mask:
                if cell in used or letters[cell] != text[position] or not adjacent(path[-1], cell, cols):
                    continue
                path.append(cell)
                used.add(cell)
                visit(position + 1)
                used.remove(cell)
                path.pop()

        visit(1)
    return result


def validate_puzzle(data: dict, expected_week: int) -> None:
    assert data["version"] == 1
    assert data["id"] == f"tajenka-v2-week-{expected_week:02d}"
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
    assert len(mask) == 32
    assert rows * cols - len(mask) == 4

    answer_owner = {}
    measured_turns = []
    for answer_index, answer in enumerate(data["answers"]):
        path = answer["path"]
        assert len(path) == len(answer["word"])
        assert 5 <= len(answer["word"]) <= 7
        assert isinstance(answer.get("clue"), str) and len(answer["clue"]) >= 12
        assert len(set(path)) == len(path)
        assert set(path) <= mask
        assert all(adjacent(path[i - 1], path[i], cols) for i in range(1, len(path)))
        assert "".join(data["letters"][index] for index in path) == answer["word"]
        turns = turn_count(path, cols)
        measured_turns.append(turns)
        assert turns == answer["turns"]
        assert turns >= 3
        assert longest_straight_run(path, cols) == 1
        assert matching_paths(answer["word"], data["letters"], mask, rows, cols) == {tuple(path)}
        for cell in path:
            assert cell not in answer_owner
            answer_owner[cell] = answer_index

    decoys = mask - set(answer_owner)
    assert len(decoys) == data["meta"]["decoyCells"] in (4, 5)
    assert len(answer_owner) == data["meta"]["phraseCells"]
    assert len(answer_owner) in (27, 28)
    assert sum(measured_turns) >= 17
    cross_word_edges = sum(
        1
        for cell in answer_owner
        for neighbour in answer_owner
        if cell < neighbour and adjacent(cell, neighbour, cols)
        and answer_owner[cell] != answer_owner[neighbour]
    )
    cross_word_pairs = {
        tuple(sorted((answer_owner[cell], answer_owner[neighbour])))
        for cell in answer_owner
        for neighbour in answer_owner
        if cell < neighbour and adjacent(cell, neighbour, cols)
        and answer_owner[cell] != answer_owner[neighbour]
    }
    non_sequential_edges = sum(
        1
        for cell in answer_owner
        for neighbour in answer_owner
        if cell < neighbour and adjacent(cell, neighbour, cols)
        and abs(answer_owner[cell] - answer_owner[neighbour]) > 1
    )
    sequential_boundaries = sum(
        int(adjacent(data["answers"][index]["path"][-1], data["answers"][index + 1]["path"][0], cols))
        for index in range(len(data["answers"]) - 1)
    )
    assert cross_word_edges == data["meta"]["crossWordEdges"] >= 13
    assert len(cross_word_pairs) == data["meta"]["crossWordPairs"] >= 7
    assert non_sequential_edges == data["meta"]["nonSequentialEdges"] >= 8
    assert sequential_boundaries == data["meta"]["sequentialBoundaries"] <= 1
    assert data["meta"]["minWordContacts"] >= 2
    assert data["meta"]["falsePrefixes2"] >= 6
    assert data["meta"]["falsePrefixes3"] >= 2
    assert data["meta"]["falsePrefixStartCells"] >= 4
    assert data["meta"]["falsePrefixFamilies"] >= 3
    assert data["meta"]["meaningfulDecoys"] == len(decoys)
    assert data["meta"]["alternativeFullPaths"] == 0
    assert data["meta"]["holeQuadrants"] >= 3
    assert data["meta"]["decoyQuadrants"] >= 3
    assert data["meta"]["decoyAdjacencyEdges"] <= 1
    assert data["meta"]["minRowFill"] >= 4
    assert data["meta"]["minColFill"] >= 4
    assert data["meta"]["candidatePool"] >= 1
    assert data["meta"]["pathStyle"] == "independent_interleaved_with_intentional_decoys"

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
    all_words = [answer["word"] for puzzle in bank["puzzles"] for answer in puzzle["answers"]]
    assert len(all_words) == len(set(all_words)) == 50
    for week, puzzle in enumerate(bank["puzzles"], 1):
        validate_puzzle(puzzle, week)

    app = APP.read_text(encoding="utf-8")
    styles = STYLES.read_text(encoding="utf-8")
    game_layout = GAME_LAYOUT.read_text(encoding="utf-8")
    server = SERVER.read_text(encoding="utf-8")
    backend_config = BACKEND_CONFIG.read_text(encoding="utf-8")
    backend_content = BACKEND_CONTENT.read_text(encoding="utf-8")
    push = PUSH.read_text(encoding="utf-8")
    runtime = RUNTIME.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    release_notes = RELEASE_NOTES.read_text(encoding="utf-8")
    hints = HINTS.read_text(encoding="utf-8") if HINTS.exists() else app
    for marker in (
        "const TAJENKA_PREVIEW=",
        "let TAJENKA_AVAILABLE=",
        "const requestedTajenkaWeek=",
        "!TAJENKA_PRODUCTION_HOSTS.has(location.hostname)",
        "const TAJENKA_FIRST_SATURDAY=",
        "function refreshTajenkaAvailability(",
        "`/api/tajenka?week=${activeTajenkaWeek}`",
        "const puzzle=await response.json()",
        "mode==='tajenka'?`tajenka:${puzzle.id}`",
        "TAJENKA_REWARD_XP=200",
        "function tajenkaStateKey(",
        "function migrateTajenkaStorage(",
        "function adoptGuestTajenkaData(",
        "function mergeRemoteTajenkaProgress(",
        "mergeRemoteTajenkaProgress(rows,scope)",
        "state.completions[g.puzzle.id]=completion",
        "if(TAJENKA_RELEASE_ENABLED&&!old)",
        "tajenka-rule-inline",
        "některá písmena mohou zůstat volná.",
        "Další přijde zase v sobotu.",
        "showTajenkaRecap",
        "tajenka_recap_opened",
        "tajenka-entry-open",
        "push_tajenka_opened",
    ):
        assert marker in app, marker
    assert "Významová stopa" in hints

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
    assert 'payload.challenge_key != domain_content.challenge_key("tajenka", payload.puzzle_id)' in server
    assert 'return f"tajenka:{puzzle_id}"' in backend_content
    assert 'tajenka_bank_path=data_root / "tajenka_weekend_v1.json"' in backend_config
    assert '@app.get("/api/tajenka")' in server
    assert 'headers={"Cache-Control": "private, no-store"}' in server
    assert "week if 1 <= week <= prepared else None" in server
    assert '"title": "✨ Víkendová Tajenka je tady"' in push
    assert '"body": "Pět slov, jedna myšlenka a 200 XP. Odhalíš ji?"' in push
    assert '"url": f"{canonical_origin}/?open=tajenka&via=push-tajenka"' in push
    assert "tajenkaReleaseEnabled:true" in runtime
    assert "tajenkaFirstSaturday:'2026-08-29'" in runtime
    assert "tajenkaRewardXp:200" in runtime
    assert "proplet-v4.01.40-game-session-shell" in sw
    assert "tajenka-test.json" not in sw
    assert not (ROOT / "public" / "tajenka-test.json").exists()
    for marker in (
        "const RELEASE_ID='4.01.32'",
        "const RELEASE_DATE='2026-08-29'",
        "Novinky v Propletu",
        "<strong>Tajenka</strong><span>nová každou sobotu</span>",
        "<strong>Mozkomor</strong><span>100 nových úrovní</span>",
        "<strong>+1 XP</strong><span>za platná slova navíc</span>",
        ">Jdu hrát</button>",
    ):
        assert marker in release_notes, marker

    assert ".tajenka-rule-note{" not in styles
    assert ".tajenka-rule-inline{" in styles
    assert ".tajenka-preview-card.completed{" in styles
    assert ".tajenka-entry-open{" in styles
    assert ".tajenka-entry-answer{" not in styles
    assert ".tajenka-mode .game-board-column>.game-info .found-row" in styles
    assert ".tajenka-mode .game-board-column>.game-info .game-progress{display:none}" in styles
    assert ".tajenka-mode .game-board-column>.board-stage{grid-row:4;padding:4px" in styles
    assert "body.game-tablet-landscape .game-screen.tajenka-mode .game-board-column{grid-template-rows:auto minmax(0,1fr) auto!important" in game_layout
    assert "body.game-tablet-landscape .game-screen.tajenka-mode .game-board-column>.board-stage{grid-row:2!important" in game_layout
    assert "body.game-tablet-landscape .game-screen.tajenka-mode .game-board-column>.tajenka-phrase{grid-row:3!important" in game_layout
    assert ".tajenka-entry-copy p{display:inline;margin:0;color:#6d6478;font-size:12px" in styles
    assert "tajenkaWin.classList.add('hidden');tajenkaWin.innerHTML=''" in app
    assert "localStorage.getItem(tajenkaStateKey(scope))" in app
    assert "localStorage.setItem(tajenkaStateKey(scope),JSON.stringify(state))" in app
    assert "localStorage.getItem(TAJENKA_STATE_KEY)||'{}'" not in app
    assert "PropletTajenkaStorage" in app
    assert "if(!accountProfileMatches(p))return null" in app
    assert "tajenkaStorage()?.remove(deletedId)" in app
    assert "root.classList.toggle('completed',completed)" in app
    assert "showRule=g.found.length===0" in app
    assert "tajenkaRecapOpen=true" in app
    assert "if(tajenkaRecapOpen){tajenkaRecapOpen=false" in app
    entry = app[app.index("function renderTajenkaEntry()"):app.index("async function loadTajenkaFixture()")]
    assert "Zahrát znovu" not in entry
    assert "Každý víkend nová" not in entry
    assert "tajenkaPuzzle.tajenka.phrase" not in entry
    assert "Tajenka odhalena" in entry
    assert "Další přijde zase v sobotu." in entry

    hosts = re.search(r"const TAJENKA_PRODUCTION_HOSTS=new Set\(\[(.*?)\]\)", app, re.S)
    assert hosts and "hrajproplet.cz" in hosts.group(1)
    print("PASS: compact clickable Tajenka recap card, responsive game UI, isolated Daily result, 200 XP and Saturday push")


if __name__ == "__main__":
    main()
