from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1]
out=root/'support-dist'
for name in ['patron-preview.js','patron-preview.css']:
    shutil.copy2(root/'public'/name,out/name)
html=(out/'index.html').read_text(encoding='utf8')
html=html.replace('</head>','<link rel="stylesheet" href="/patron-preview.css"></head>')
html=html.replace('</body>','<script src="/patron-preview.js"></script></body>')
(out/'patron.html').write_text(html,encoding='utf8')
print('Patron preview built from isolated production-based support artifact.')
