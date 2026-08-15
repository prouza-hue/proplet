#!/usr/bin/env python3
"""Static checks for social metadata and raster assets."""

from __future__ import annotations

import json
import struct
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"


class HeadParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.meta: dict[str, str] = {}
        self.links: list[dict[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {key: value or "" for key, value in attrs}
        if tag == "meta":
            key = values.get("property") or values.get("name")
            if key:
                self.meta[key] = values.get("content", "")
        elif tag == "link":
            self.links.append(values)


def png_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()[:24]
    assert data[:8] == b"\x89PNG\r\n\x1a\n", path
    return struct.unpack(">II", data[16:24])


html = (PUBLIC / "index.html").read_text(encoding="utf-8")
parser = HeadParser()
parser.feed(html)
assert parser.meta["og:title"] == "Proplet – česká slovní hra"
assert parser.meta["og:image"].startswith("https://")
assert parser.meta["og:image"].endswith("/share-card.png")
assert parser.meta["twitter:card"] == "summary_large_image"
assert any(link.get("rel") == "apple-touch-icon" for link in parser.links)

manifest = json.loads((PUBLIC / "manifest.webmanifest").read_text(encoding="utf-8"))
assert {icon["sizes"] for icon in manifest["icons"]} >= {"any", "192x192", "512x512"}
assert png_size(PUBLIC / "share-card.png") == (1200, 630)
assert png_size(PUBLIC / "icon-512.png") == (512, 512)
assert png_size(PUBLIC / "icon-192.png") == (192, 192)
assert png_size(PUBLIC / "apple-touch-icon.png") == (180, 180)
assert png_size(PUBLIC / "favicon-32.png") == (32, 32)
print("share metadata and assets: OK")
