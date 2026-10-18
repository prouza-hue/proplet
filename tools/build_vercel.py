"""Run the Vercel build stages in order, stopping at the first failure."""
from pathlib import Path
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


def main():
    for stage in STAGES:
        subprocess.run([sys.executable, *stage], cwd=ROOT, check=True)


if __name__ == "__main__":
    main()
