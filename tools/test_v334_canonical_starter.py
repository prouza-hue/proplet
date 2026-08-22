#!/usr/bin/env python3
from pathlib import Path
import json

root=Path(__file__).resolve().parents[1]
base=json.loads((root/"data/puzzles.json").read_text(encoding="utf-8"))["starter"]
gen4=json.loads((root/"data/puzzles_gen4_candidate_v334.json").read_text(encoding="utf-8"))["starter"]
assert base==gen4, "Gen4 must preserve canonical starter exactly"
assert base["id"]=="starter-v1"
assert (base["rows"],base["cols"])==(5,5)
assert [a["word"] for a in base["answers"]]==["MRAK","JABLKO","ČOKOLÁDA","AUTOBUS"]
paths=[i for a in base["answers"] for i in a["path"]]
assert len(paths)==25 and len(set(paths))==25
print("Canonical starter preserved: starter-v1 5x5")
