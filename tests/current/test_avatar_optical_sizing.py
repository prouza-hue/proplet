#!/usr/bin/env python3
"""Guard perceived avatar size, not only the identical outer DOM circles."""

from __future__ import annotations

import ast
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[2]
JS = (ROOT / "public/organic-ui-v4023.js").read_text(encoding="utf-8")
CSS = (ROOT / "public/organic-ui-v4023.css").read_text(encoding="utf-8")

match = re.search(r"const AVATAR_FOCUS_FRAMES=(\[.*?\]);", JS)
assert match, "missing optical frame calibration"
frames = ast.literal_eval(match.group(1))
assert len(frames) == 30
assert all(len(frame) == 3 for frame in frames)

# Bounds are the 1st–99th percentile of the dark silhouette inside each
# medallion in the authoritative 512px SVG.  The reference animals deliberately
# mix compact and broad shapes; their median is therefore a useful visual target.
silhouette_long_edges = {
    2: 235,   # 03-jezek.svg
    3: 300,   # 04-medved.svg
    6: 360,   # 07-jezevec.svg
    8: 349,   # 09-myval.svg
    9: 374,   # 10-kocka.svg
    13: 383,  # 14-kralik.svg
}
reference = sorted(silhouette_long_edges[index] * frames[index][0] for index in (3, 6, 8, 9, 13))
reference_median = reference[len(reference) // 2]
hedgehog_footprint = silhouette_long_edges[2] * frames[2][0]
assert 0.96 <= hedgehog_footprint / reference_median <= 1.05, (
    hedgehog_footprint,
    reference_median,
)

# The hedgehog silhouette is centred around (260, 238), not the canvas centre.
# Scaling must therefore be paired with a downward focal correction.
hedgehog_scale, hedgehog_x, hedgehog_y = frames[2]
assert 1.48 <= hedgehog_scale <= 1.56
assert -2.0 <= hedgehog_x <= -0.5
assert 4.5 <= hedgehog_y <= 6.5

for needle in (
    "--avatar-focus-x",
    "--avatar-focus-y",
    "dataset.avatarFocusX",
    "dataset.avatarFocusY",
    "translate(var(--avatar-focus-x,0),var(--avatar-focus-y,0)) scale(var(--avatar-focus-scale,1))",
):
    assert needle in JS + CSS, needle

print("PASS avatar optical sizing")
