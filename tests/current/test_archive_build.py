"""Distribution boundary: a production build must not ship the review adapter."""
from pathlib import Path
import json
import os
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory(prefix="proplet-archive-build-") as directory:
    target = Path(directory)
    paths = ["tools/build_archive_experience.py", "backend/archive.py", "backend/__init__.py",
             "public/index.html", "public/sw.js", "public/app/archive/preview-isolation.js",
             "content/archives/free-gen3-v1/manifest.json",
             "content/archives/free-gen3-v1/approved-solutions.json",
             "content/archives/free-gen3-v1/editorial-decisions.json",
             "data/archive/v3.33.5/puzzles.json.gz"]
    for name in paths:
        destination = target / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / name, destination)
    result = subprocess.run([sys.executable, str(target / "tools/build_archive_experience.py")],
                            env={**os.environ, "VERCEL_ENV": "production"},
                            capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr
    html = (target / "public/index.html").read_text()
    assert "data-archive-preview" not in html and "preview-isolation" not in html
    assert "preview-isolation" not in (target / "public/sw.js").read_text()
    # Packaging may reopen every original input path after buildCommand.
    adapter = target / "public/app/archive/preview-isolation.js"
    assert adapter.read_text().strip() == "// Preview adapter disabled in production."
    assert "/app/archive/experience.js" in html and "/app/engagement/announcements.js" in html
    bank = json.loads((target / "public/app/archive/boards.json").read_text())
    assert len(bank["boards"]) == 800 and bank["completeCovers"] == 879
assert "data-archive-preview" in (ROOT / "public/index.html").read_text(), "test modified source tree"
print("PASS production distribution: validated bank, real runtime, no synthetic identity or API adapter")
