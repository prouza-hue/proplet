"""Opt-in QA deployment build only; never invoked by the production build."""
from pathlib import Path
import shutil

root = Path(__file__).resolve().parents[2]
source = root / 'tools' / 'weekly-victory-qa'
target = root / 'public' / 'qa'
target.mkdir(parents=True, exist_ok=True)
for path in source.iterdir():
    if path.suffix in {'.html', '.js', '.css'}:
        shutil.copy2(path, target / path.name)
print('Isolated weekly victory QA mounted at /qa/review.html')
