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

# Letters are a single paper ink across all decisive board states. Requiring named,
# direct hex tokens keeps this check deterministic instead of trying to evaluate
# color-mix() differently in every CSS engine.
letter = css_hex_variable(ribbon, "--r-board-letter")
state_tokens = {
    "available": css_hex_variable(ribbon, "--r-board-tile"),
    "active": css_hex_variable(ribbon, "--r-board-active"),
    "error": css_hex_variable(ribbon, "--r-board-error"),
}
for state, surface in state_tokens.items():
    ratio = contrast_ratio(letter, surface)
    assert ratio >= 7.0, (
        f"Board letter contrast in {state} state is {ratio:.2f}:1; expected >= 7:1 "
        f"({letter} on {surface})"
    )

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

print("PASS Tiskařská dílna board clarity contract")
