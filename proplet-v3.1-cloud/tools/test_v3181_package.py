#!/usr/bin/env python3
"""Fail a release build when required runtime/admin files are missing."""

from pathlib import Path
import sys

ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]

required = (
    "server.py",
    "requirements.txt",
    "vercel.json",
    "public/index.html",
    "public/app.js",
    "public/styles.css",
    "public/sw.js",
    "public/admin.html",
    "public/admin.css",
    "public/admin.js",
)
missing = [name for name in required if not (ROOT / name).is_file()]
assert not missing, f"Release is missing required files: {', '.join(missing)}"

server = (ROOT / "server.py").read_text(encoding="utf-8")
app = (ROOT / "public" / "app.js").read_text(encoding="utf-8")
index = (ROOT / "public" / "index.html").read_text(encoding="utf-8")
admin = (ROOT / "public" / "admin.html").read_text(encoding="utf-8")
assert 'version="3.18.1-cloud"' in server
assert '"version": "3.18.1"' in server
assert "const APP_VERSION='3.18.1'" in app
assert "Proplet v3.18.1" in index
assert 'href="/admin.css"' in admin and 'src="/admin.js"' in admin

print(f"v3.18.1 release completeness: OK ({ROOT})")
