"""Run the Vercel build stages in order, stopping at the first failure."""
from pathlib import Path
import os
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
STAGES = (
    ("tools/build_runtime_content.py", "--check"),
    ("tools/generate_puzzles_bootstrap.py",),
    ("tools/check_dated_daily_release.py",),
    ("tools/build_archive_experience.py",),
    ("tools/build_weekly_rewards_review.py",),
    ("tools/build_refinements_review.py",),
)

# The first four pilot boards and their solutions stay playable on the review
# branch. The live application obtains the published board from /api/spojky.
SPOJKY_REVIEW_FILES = (
    "index.html", "pilot.js", "boards.js", "preview-play.js", "preview-play-boards.js",
    "board-preview.js", "tajenka-preview.js", "tajenka-samples.js",
    "vydani.html", "vydani.js", "vydani.css", "vysledek.html", "vysledek.js", "vysledek.css",
)


def prepare_spojky_output(public_dir, environment):
    if environment == "production":
        for filename in SPOJKY_REVIEW_FILES:
            # Vercel enumerates static paths before the build and opens them afterward.
            # Keep each path packagable while removing the entire editorial payload.
            target = public_dir / "design/spojky" / filename
            content = ('<!doctype html><html lang="cs"><meta charset="utf-8"><title>Spojky</title>'
                       '<a href="/?open=spojky">Hrát aktuální Spojky</a></html>') if target.suffix == ".html" else ""
            target.write_text(content, encoding="utf-8")


def main():
    for stage in STAGES:
        subprocess.run([sys.executable, *stage], cwd=ROOT, check=True)
    prepare_spojky_output(ROOT / "public", os.environ.get("VERCEL_ENV"))


if __name__ == "__main__":
    main()
