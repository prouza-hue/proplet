"""Review identity/API fixtures must never be included in a production build."""
from pathlib import Path
import os
import shutil
import subprocess
import sys
import tempfile
ROOT=Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory() as directory:
    target=Path(directory)
    for name in ['tools/build_weekly_rewards_review.py','tools/weekly-rewards-review.js','public/index.html']:
        path=target/name;path.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,path)
    script=target/'tools/build_weekly_rewards_review.py'
    subprocess.run([sys.executable,str(script)],env={**os.environ,'VERCEL_ENV':'preview'},check=True)
    page=target/'public/design/team-rewards/index.html';fixture=page.with_name('review.js')
    assert 'data-archive-preview' in page.read_text()
    assert '/app/archive/preview-isolation.js' in page.read_text()
    assert 'team-victories/personal' in fixture.read_text()
    subprocess.run([sys.executable,str(script)],env={**os.environ,'VERCEL_ENV':'production'},check=True)
    assert 'data-archive-preview' not in page.read_text()
    assert 'review.js' not in page.read_text()
    assert 'Sazeči' not in fixture.read_text() and 'fetch' not in fixture.read_text()
    assert (target/'public/index.html').read_bytes()==(ROOT/'public/index.html').read_bytes()
print('PASS native reward review: preview fixtures isolated; production placeholders inert; source shell unchanged')
