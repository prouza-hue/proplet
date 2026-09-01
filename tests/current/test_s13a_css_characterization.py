#!/usr/bin/env python3
"""Sprint 13A characterization: freeze CSS ownership/cascade invariants before consolidation."""

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
read = lambda p: (ROOT / p).read_text(encoding="utf-8")

theme = read("public/theme-init.js")
index = read("public/index.html")
styles = read("public/styles.css")
gesture = read("public/gesture-guard-v3325.css")

baseline_files = [
    "public/game-layout-v3323.css",
    "public/win-actions-v3324.css",
    "public/desktop-layout-v3330.css",
    "public/result-layout-v3330.css",
]
consolidated_files = ["public/game.css", "public/results.css"]

baseline = all((ROOT / p).is_file() for p in baseline_files)
consolidated = all((ROOT / p).is_file() for p in consolidated_files)
assert baseline ^ consolidated, "13A must be either baseline or fully consolidated, never a half-applied ownership state"

# Bootstrap order is behavioral: theme-init runs before the static base CSS links are parsed.
theme_boot='/theme-init.js?v=40140-s12b3' if baseline else '/theme-init.js?v=40140-s13a2'
assert index.index(theme_boot) < index.index('/styles.css?v=40140-s12a2r2')
assert '/quality-v334.css?v=4' in index

# Gesture ownership is intentionally not refactored in 13A because this file also owns onboarding.
for needle in (
    "html,body{overscroll-behavior-x:none}",
    ".board-wrap,.board,.board .cell",
    "#tutorialBoard .tutorial-cell[data-tidx=\"0\"]",
):
    assert needle in gesture

# DOM hooks used by the screenshot/visual contract must remain stable.
for hook in (
    'id="screen-game"',
    'id="boardStage"',
    'id="boardWrap"',
    'id="board"',
    'id="currentWord"',
    'id="gameMessage"',
    'id="hintBtn"',
    'id="winModal"',
    'id="winTitle"',
    'id="winXp"',
    'id="winClean"',
    'id="levelLeaderboardBox"',
    'class="win-secondary-actions"',
):
    assert hook in index, hook

# Base stylesheet debt is frozen, not silently "cleaned up" during the screen-owner move.
assert len(re.findall(r"!important", styles)) == 93

if baseline:
    game = read("public/game-layout-v3323.css")
    win_actions = read("public/win-actions-v3324.css")
    desktop = read("public/desktop-layout-v3330.css")
    results = read("public/result-layout-v3330.css")

    order = [
        "/game-layout-v3323.css?v=1",
        "/win-actions-v3324.css?v=1",
        "/copy-density-v3327.css?v=1",
        "/desktop-layout-v3330.css?v=3",
        "/result-layout-v3330.css?v=2",
    ]
    positions = [theme.index(x) for x in order]
    assert positions == sorted(positions), positions

    assert len(re.findall(r"!important", game)) == 92
    assert len(re.findall(r"!important", win_actions)) == 0
    assert len(re.findall(r"!important", desktop)) == 0
    assert len(re.findall(r"!important", results)) == 0

    for needle in (
        "body.game-tablet-landscape .game-main",
        ".phone-landscape-guard",
        "body.game-tablet-landscape .game-screen.tajenka-mode .game-board-column",
    ):
        assert needle in game
    for needle in (
        "body.game-desktop-wide .game-main",
        "body.game-free-mode .game-title #gameDifficulty",
        "#screen-daily.home-layout-active .daily-hero",
        "#screen-profile .profile-grid",
    ):
        assert needle in desktop
    for needle in (
        ".win-secondary-actions .win-utility-btn",
        "html[data-theme=\"dark\"] .win-secondary-actions .win-utility-btn",
    ):
        assert needle in win_actions
    for needle in (
        "@media (min-width:700px) and (min-height:540px)",
        "#winModal .win-card",
        "#winModal.comparison-loaded .win-summary",
        "html[data-theme=\"dark\"] #winModal .win-summary",
    ):
        assert needle in results
else:
    game = read("public/game.css")
    results = read("public/results.css")
    desktop = read("public/desktop-layout-v3330.css")

    for old in (
        "/game-layout-v3323.css?v=1",
        "/win-actions-v3324.css?v=1",
        "/result-layout-v3330.css?v=2",
    ):
        assert old not in theme, old
    for new in ("/game.css", "/results.css"):
        assert new in theme, new
    assert theme.index("/copy-density-v3327.css?v=1") < theme.index("/desktop-layout-v3330.css?v=3")
    assert theme.index("/desktop-layout-v3330.css?v=3") < theme.index("/game.css") < theme.index("/results.css")

    for needle in (
        "body.game-tablet-landscape .game-main",
        ".phone-landscape-guard",
        "body.game-tablet-landscape .game-screen.tajenka-mode .game-board-column",
        "body.game-desktop-wide .game-main",
        "body.game-free-mode .game-title #gameDifficulty",
    ):
        assert needle in game, needle
    assert len(re.findall(r"!important", game)) == 92

    # 13B app-screen desktop rules stay in their existing owner.
    for needle in (
        "#screen-daily.home-layout-active .daily-hero",
        "#screen-profile .profile-grid",
        "#screen-leaderboard .leader-row",
    ):
        assert needle in desktop, needle
    assert "body.game-desktop-wide .game-main" not in desktop

    for needle in (
        ".win-secondary-actions .win-utility-btn",
        "@media (min-width:700px) and (min-height:540px)",
        "#winModal .win-card",
        "#winModal.comparison-loaded .win-summary",
        "html[data-theme=\"dark\"] #winModal .win-summary",
    ):
        assert needle in results, needle

print("PASS Sprint 13A CSS characterization")
