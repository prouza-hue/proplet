"""Broad dictionary admission must leave board proofs and atomic reward keys intact."""
from datetime import datetime
from pathlib import Path
from unittest.mock import patch
from zoneinfo import ZoneInfo
from types import SimpleNamespace
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
import unicodedata
import zipfile

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

import word_recognition_v3330 as words
from bonus_recognition import recognizes
from tools.gen5 import validation

ROOT = Path(__file__).resolve().parents[2]
REPORTED = ("OBRNA", "STROFA", "AORTA", "KANCL", "KATION")
FORMS = ("obrny", "obrnou", "strofy", "strofou", "aorty", "aortou",
         "kationu", "kationy", "kationech", "kočkami", "kancelářemi")

binary = (ROOT / "data/recognition/bonus-cs-v1.dawg").read_bytes()
manifest = json.loads((ROOT / "data/recognition/manifest.json").read_text())
assert binary == (ROOT / "public/recognition/bonus-cs-v1.dawg").read_bytes()
assert manifest == json.loads((ROOT / "public/recognition/manifest.json").read_text())
assert hashlib.sha256(binary).hexdigest() == manifest["sha256"]
assert len(binary) == manifest["bytes"] and manifest["words"] > 1_000_000
with zipfile.ZipFile(ROOT / "public/recognition/bonus-cs-v1-source.zip") as archive:
    for source in (*sorted((ROOT / "content/recognition/hunspell-cs").iterdir()),
                   ROOT / "content/recognition/README.md", ROOT / "tools/build_bonus_recognition.py"):
        if source.is_file():
            assert archive.read(str(source.relative_to(ROOT))) == source.read_bytes(), source

# A serverless function must work with the data directory alone. The CDN's public
# directory is intentionally absent from this isolated import.
with tempfile.TemporaryDirectory() as temporary:
    directory = Path(temporary)
    shutil.copy(ROOT / "bonus_recognition.py", directory)
    shutil.copytree(ROOT / "data/recognition", directory / "data/recognition")
    outcome = subprocess.run([sys.executable, "-I", "-c",
                              "import sys;sys.path.insert(0,'.');from bonus_recognition import recognizes;assert recognizes('aorta')"],
                             cwd=directory, capture_output=True, text=True, timeout=30)
    assert outcome.returncode == 0, outcome.stderr

# The expanded offline dataset is evidence in its own right; these words must not need
# wordfreq, a remote API or a hand-written list of the five reported words.
for word in (*REPORTED[:3], REPORTED[4], *FORMS):
    assert recognizes(word), word
    assert recognizes(unicodedata.normalize("NFD", word.upper())), word
with patch.object(words, "_wordfreq_source", return_value=None):
    for word in (*REPORTED, *FORMS, "setr", "bígl", "labrador", "jilm"):
        assert words._recognize_source(word), word
    for word in ("qxzq", "aortaa", "kočkamii", "aor-ta", "1234", "negr"):
        assert words._recognize_source(word) is None, word

rows: dict[str, list[dict]] = {"alice": [], "bob": []}
rpc_calls: list[tuple[str, dict]] = []
tz = ZoneInfo("Europe/Prague")
boards = {
    f"reported-{word.lower()}": {
        "rows": 1, "cols": len(word), "mask": list(range(len(word))),
        "letters": list(word), "answers": [],
    }
    for word in REPORTED
}


def auth(token):
    if token not in ("Bearer alice", "Bearer bob"):
        raise HTTPException(401, "test authentication required")
    return {"id": token.split()[1]}


def rpc(name, params):
    rpc_calls.append((name, params))
    assert name == "proplet_claim_word_discovery"
    player = params["p_player_id"]
    key = words._discovery_reward_key(params["p_puzzle_id"], params["p_word"])
    assert not any(row["reward_key"] == key for row in rows[player])
    rows[player].append({"reward_key": key, "points": 1,
                         "granted_at": datetime.now(tz).isoformat()})
    return [{"newly_granted": True, "awarded_points": 1,
             "reason": "granted", "reward_key": key}]


app = FastAPI()
words.install_word_recognition(
    app, db_select=lambda _table, **kw: rows[kw["player_id"]], db_rpc=rpc,
    auth_player=auth, tz=tz,
    puzzle_exists=lambda puzzle, mode, difficulty: puzzle in boards and mode == "free" and difficulty == "easy",
    resolved_puzzle=lambda puzzle, *_: boards[puzzle],
)
client = TestClient(app)
for word in REPORTED:
    puzzle_id = f"reported-{word.lower()}"
    payload = {"puzzle_id": puzzle_id, "mode": "free", "difficulty": "easy",
               "word": word, "path": list(range(len(word)))}
    headers = {"Authorization": "Bearer alice"}
    assert client.get("/api/word-recognition", params={"word": word}).json()["recognized"]
    before = len(rpc_calls)
    assert client.post("/api/word-discovery/claim", json=payload).status_code == 401
    for bad in ({**payload, "path": list(reversed(payload["path"]))},
                {**payload, "path": [0] * len(word)},
                {**payload, "puzzle_id": "unreleased"},
                {**payload, "mode": "playtest"}):
        assert client.post("/api/word-discovery/claim", headers=headers, json=bad).status_code in (400, 422)
    assert len(rpc_calls) == before
    reply = client.post("/api/word-discovery/claim", headers=headers, json=payload)
    assert reply.status_code == 200, reply.text
    assert reply.json()["newlyGranted"] and reply.json()["awardedPoints"] == 1
    duplicate = client.post("/api/word-discovery/claim", headers=headers,
                            json={**payload, "word": unicodedata.normalize("NFD", word.lower())}).json()
    assert duplicate["newlyGranted"] is False and duplicate["awardedPoints"] == 0
    assert len(rpc_calls) == before + 1

# A word which is part of the board solution still cannot become a bonus word.
board = boards["reported-obrna"]
board["answers"] = [{"word": "OBRNA", "path": list(range(5))}]
target = {"puzzle_id": "reported-obrna", "mode": "free", "difficulty": "easy",
          "word": "OBRNA", "path": list(range(5))}
assert client.post("/api/word-discovery/claim", headers={"Authorization": "Bearer bob"}, json=target).status_code == 400
assert rows["bob"] == []
assert len(rows["alice"]) == len(REPORTED)

# A live bonus overlay may grow without changing a historical uniqueness receipt.
# Explicit frozen overlays (including an empty one) never read the live module.
with tempfile.TemporaryDirectory() as temporary:
    directory = Path(temporary)
    (directory / "data").mkdir()
    (directory / "data/words.txt").write_text("bruska\n", encoding="utf-8")
    (directory / "data/lexicon_v2_wikidata_raw.json").write_text(
        json.dumps({"entries": [{"lemma": "strofa"}]}), encoding="utf-8")
    overlay_path = directory / "word_recognition_v3330.py"
    overlay_path.write_text("RECOGNITION_OVERLAY = {'aorta', 'kancl'}\n", encoding="utf-8")
    catalog = SimpleNamespace(entries={"obrna": {}})
    with patch.object(validation, "ROOT", directory):
        frozen = validation.validation_words(catalog, overlay_words=["AORTA"])
        assert frozen == ["aorta", "bruska", "obrna", "strofa"]
        assert "kancl" in validation.validation_words(catalog)
        overlay_path.write_text("not valid Python!", encoding="utf-8")
        assert validation.validation_words(catalog, overlay_words=["aorta"]) == frozen
        assert validation.validation_words(catalog, overlay_words=[]) == ["bruska", "obrna", "strofa"]
print("PASS broad forms + all five reported words; auth, trace, published board, target and reward-key protection")
