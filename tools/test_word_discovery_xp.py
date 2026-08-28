#!/usr/bin/env python3
"""Regression checks for valid non-solution +1 XP semantics."""
from word_recognition_v3330 import (
    WORD_DISCOVERY_XP,
    _discovery_reward_key,
    _valid_discovery_trace,
)

PUZZLE = {
    "rows": 3,
    "cols": 3,
    "mask": list(range(9)),
    "letters": ["S", "T", "Á", "J", "A", "U", "T", "O", "X"],
    "answers": [
        {"word": "AUTO", "path": [4, 5, 6, 7]},
    ],
}

assert WORD_DISCOVERY_XP == 1
assert _valid_discovery_trace(PUZZLE, "STÁJ", [0, 1, 2, 3])
assert not _valid_discovery_trace(PUZZLE, "AUTO", [4, 5, 6, 7]), "target words never earn discovery XP"
assert not _valid_discovery_trace(PUZZLE, "STÁJ", [0, 4, 2, 3]), "diagonal jumps are invalid"
assert not _valid_discovery_trace(PUZZLE, "STÁJ", [0, 1, 0, 3]), "cells cannot repeat"
assert _discovery_reward_key("g4-e-001", "STÁJ") == _discovery_reward_key("g4-e-001", "stáj")
assert _discovery_reward_key("g4-e-001", "STÁJ") != _discovery_reward_key("g4-e-002", "STÁJ")
print("word-discovery-xp regression: PASS")
