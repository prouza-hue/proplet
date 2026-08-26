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


def main() -> None:
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    assert data["version"] == 1
    assert data["id"] == "tajenka-test-001"
    assert data["kind"] == "weekend_bonus"
    assert data["meta"]["previewOnly"] is True

    rows, cols = data["rows"], data["cols"]
    assert len(data["letters"]) == rows * cols
    mask = set(data["mask"])
    assert len(mask) == len(data["mask"]) == data["meta"]["cells"]
    assert mask <= set(range(rows * cols))

    for answer in data["answers"]:
        path = answer["path"]
        assert len(path) == len(answer["word"])
        assert len(set(path)) == len(path)
        assert set(path) <= mask
        assert all(adjacent(path[i - 1], path[i], cols) for i in range(1, len(path)))
        assert "".join(data["letters"][index] for index in path) == answer["word"]

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

    assert "proplet-v4.01.25-tajenka-preview-shell" in sw
    assert "'/tajenka-test.json'" in sw

    # The gate must explicitly list production origins so ?tajenka=1 cannot expose it there.
    hosts = re.search(r"const TAJENKA_PRODUCTION_HOSTS=new Set\(\[(.*?)\]\)", app, re.S)
    assert hosts and "hrajproplet.cz" in hosts.group(1)
    print("PASS: Tajenka fixture, preview gate, isolated state, and telemetry contract")


if __name__ == "__main__":
    main()
