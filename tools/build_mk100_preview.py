"""Isolated candidate-only static preview. Never deploy this branch as production."""
import os
from pathlib import Path
if os.environ.get('VERCEL_ENV') == 'production':
    raise SystemExit('Candidate-only preview: production build forbidden')
p=Path('dist-mk100'); p.mkdir(exist_ok=True)
(p/'index.html').write_text('<!doctype html><html lang="cs"><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>Mozkokalypsa · soukromá dílna</title><h1>Mozkokalypsa</h1><p>Soukromá kandidátní série se připravuje. Tento náhled nemá účty, databázi ani odměny.</p></html>',encoding='utf-8')
