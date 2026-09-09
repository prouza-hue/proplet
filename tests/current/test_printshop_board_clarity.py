#!/usr/bin/env python3
"""Static acceptance checks for the Tiskařská dílna game-board states."""

from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[2]


def read(relative_path: str) -> str:
    return (ROOT / relative_path).read_text(encoding="utf-8")


def css_hex_variable(css: str, name: str) -> str:
    match = re.search(rf"{re.escape(name)}\s*:\s*(#[0-9a-fA-F]{{6}})\b", css)
    assert match, f"Missing six-digit CSS color token {name}"
    return match.group(1)


def rgb(hex_color: str) -> tuple[int, int, int]:
    raw = hex_color.removeprefix("#")
    return tuple(int(raw[offset : offset + 2], 16) for offset in (0, 2, 4))


def relative_luminance(hex_color: str) -> float:
    channels = []
    for value in rgb(hex_color):
        normalized = value / 255
        channels.append(
            normalized / 12.92
            if normalized <= 0.04045
            else ((normalized + 0.055) / 1.055) ** 2.4
        )
    red, green, blue = channels
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue


def contrast_ratio(first: str, second: str) -> float:
    lighter, darker = sorted(
        (relative_luminance(first), relative_luminance(second)), reverse=True
    )
    return (lighter + 0.05) / (darker + 0.05)


ribbon = read("public/ribbon-ui.css")
printshop = read("public/printshop-ui.css")
app = read("public/app.js")
puzzles = read("public/puzzles.json")

# Letters are a single paper ink across all decisive board states. Requiring named,
# direct hex tokens keeps this check deterministic instead of trying to evaluate
# color-mix() differently in every CSS engine.
letter = css_hex_variable(ribbon, "--r-board-letter")
state_tokens = {
    "available": css_hex_variable(ribbon, "--r-board-tile"),
    "active": css_hex_variable(ribbon, "--r-board-active"),
    "error": css_hex_variable(ribbon, "--r-board-error"),
    "hint": css_hex_variable(ribbon, "--r-board-hint"),
    "full hint": css_hex_variable(ribbon, "--r-board-hint-full"),
}
for state, surface in state_tokens.items():
    ratio = contrast_ratio(letter, surface)
    assert ratio >= 7.0, (
        f"Board letter contrast in {state} state is {ratio:.2f}:1; expected >= 7:1 "
        f"({letter} on {surface})"
    )

# Figure/ground separation is intrinsic to the fills, not dependent on the tile
# shadow. Light mode is intentionally very strong; dark mode still doubles the
# old preview's 1.22:1 tile/mat separation.
light_mat = css_hex_variable(ribbon, "--r-board-mat")
assert contrast_ratio(light_mat, state_tokens["available"]) >= 7.0
dark_block_match = re.search(r'html\.ribbon-ui\[data-theme="dark"\]\{([^}]*)\}', ribbon)
assert dark_block_match, "Missing dark board tokens"
dark_block = dark_block_match.group(1)
dark_letter = css_hex_variable(dark_block, "--r-board-letter")
dark_tile = css_hex_variable(dark_block, "--r-board-tile")
dark_mat = css_hex_variable(dark_block, "--r-board-mat")
assert contrast_ratio(dark_letter, dark_tile) >= 7.0
assert contrast_ratio(dark_mat, dark_tile) >= 2.0

# Every completion ink still keeps the paper letter at 7:1 or better. This also
# prevents a future palette edit from making one solved word unreadable.
palette_match = re.search(r"const COLORS=\[([^]]+)\]", app)
assert palette_match, "Missing found-word palette"
palette = re.findall(r"#[0-9a-fA-F]{6}", palette_match.group(1))
assert len(palette) == 12, f"Expected 12 completion inks, found {len(palette)}"
for ink in palette:
    ratio = contrast_ratio(letter, ink)
    assert ratio >= 7.0, f"Completion ink {ink} has only {ratio:.2f}:1 letter contrast"
    assert contrast_ratio(light_mat, ink) >= 4.5, (
        f"Found path ink {ink} has insufficient light-mat contrast"
    )

# The shipped puzzle bank exercises every Czech uppercase glyph called out in
# the visual brief. The board deliberately uses the platform UI stack rather
# than decorative display type.
for glyph in "ÁÉĚÍŇŘŠŤÚŮÝŽ":
    assert glyph in puzzles, f"Puzzle bank does not exercise Czech glyph {glyph}"
assert 'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important' in ribbon

# The tested tokens must own the actual surfaces, not merely exist as unused values.
for needle in (
    "background:var(--r-board-tile)!important",
    "background:var(--r-board-active)!important",
    "background:var(--r-board-error)!important",
    "color:var(--r-board-letter)!important",
):
    assert needle in ribbon, f"Board state does not consume clarity token: {needle}"

# An active route is redundantly encoded by sequence badges and explicit endpoints,
# so it remains understandable in grayscale and on a poor display.
for needle in (
    "dataset.routeOrder",
    "route-start",
    "route-end",
):
    assert needle in app, f"Missing active-route semantic hook: {needle}"
assert re.search(
    r"\.cell\.active::after\s*\{[^}]*content\s*:\s*attr\(data-route-order\)",
    ribbon,
    re.DOTALL,
), "Active route order must be visible through data-route-order badges"
assert ".route-start" in ribbon and ".route-end" in ribbon, (
    "Route start and end need separate visual treatments"
)
assert "clearHints:clearHintTrace" in app, (
    "Starting a drag must clear an older hint so the two states cannot collide"
)

# Level-two and level-three hints number the first three cells, and the number is
# actually rendered within the cell rather than relying on the accompanying copy.
assert "c.dataset.hintOrder=String(n+1)" in app
assert "path.slice(0,Math.min(3,path.length))" in app
assert re.search(
    r"\.hint-route::after\s*\{[^}]*content\s*:\s*attr\(data-hint-order\)",
    ribbon,
    re.DOTALL,
), "Hint order 1–3 must be rendered on the board"

# Phone actions may keep compact icons, but Hint and Calm must have visible labels.
for selector, label in (("#hintBtn::after", "Nápověda"), ("#calmRunBtn::after", "Klid")):
    pattern = rf"{re.escape(selector)}\s*\{{[^}}]*content\s*:\s*['\"]{label}['\"]"
    assert re.search(pattern, printshop, re.DOTALL), (
        f"Mobile control {selector} is missing visible label {label!r}"
    )

# Completion may deliberately settle before opening results, but it must never
# block the completed board for more than one second. Cover all completion paths.
settle_delays = [
    int(normal_delay)
    for _, normal_delay in re.findall(
        r"await\s+sleep\([^;]{0,240}?\?\s*(\d+)\s*:\s*(\d+)\s*\)", app
    )
]
assert len(settle_delays) >= 3, "Expected settle delays for starter, tajenka, and normal completion"
assert max(settle_delays) <= 1000, (
    f"Completion settle delay exceeds 1000 ms: {settle_delays}"
)

# In light mode the SVG lives almost entirely in narrow tile gutters, so each
# path stroke needs its own dark ink. Dark mode swaps to bright path tokens.
for token in ("--r-board-path-active", "--r-board-path-error"):
    light_path = css_hex_variable(ribbon, token)
    dark_path = css_hex_variable(dark_block, token)
    assert contrast_ratio(light_mat, light_path) >= 4.5
    assert contrast_ratio(dark_mat, dark_path) >= 4.5
assert "html.ribbon-ui[data-theme=\"dark\"] #pathLayer .path-found" in ribbon

# Reduced-motion owns every state animation with selectors at least as specific
# as the normal state rules, including the whole-board lock.
reduce_match = re.search(r"@media\(prefers-reduced-motion:reduce\)\{([^@]+)\}", ribbon)
assert reduce_match, "Missing reduced-motion board treatment"
reduce_css = reduce_match.group(1)
for state in ("wrong-flash", "just-found", "board-stage.board-complete"):
    assert state in reduce_css, f"Reduced motion does not cover {state}"

print("PASS Tiskařská dílna board clarity contract")
