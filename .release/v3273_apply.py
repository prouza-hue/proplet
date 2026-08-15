from pathlib import Path
import re

# Swap the actual artwork while keeping semantic filenames stable.
medium = Path('public/difficulty/medium.svg')
hard = Path('public/difficulty/hard.svg')
medium_src = medium.read_text(encoding='utf-8')
hard_src = hard.read_text(encoding='utf-8')
if '<title id="title">Střední</title>' not in medium_src or 'flameOuter' not in medium_src:
    raise SystemExit('medium.svg is not the expected flame source')
if '<title id="title">Těžká</title>' not in hard_src or 'mountainA' not in hard_src:
    raise SystemExit('hard.svg is not the expected mountain source')
medium.write_text(hard_src.replace('<title id="title">Těžká</title>', '<title id="title">Střední</title>', 1), encoding='utf-8')
hard.write_text(medium_src.replace('<title id="title">Střední</title>', '<title id="title">Těžká</title>', 1), encoding='utf-8')

# Version bumps.
replacements = {
    'server.py': [('APP_VERSION = "3.27.2"', 'APP_VERSION = "3.27.3"')],
    'public/app.js': [("const APP_VERSION='3.27.2';", "const APP_VERSION='3.27.3';")],
    'public/sw.js': [("const CACHE='proplet-v3.27.2-hardcore-crimson';", "const CACHE='proplet-v3.27.3-medium-hard-swap';")],
}
for filename, pairs in replacements.items():
    p = Path(filename)
    text = p.read_text(encoding='utf-8')
    for old, new in pairs:
        count = text.count(old)
        if count != 1:
            raise SystemExit(f'{filename}: expected exactly one match, got {count}: {old}')
        text = text.replace(old, new)
    p.write_text(text, encoding='utf-8')

# Retoken every difficulty-aware CSS block, including historical active fallbacks,
# so no orange Medium or blue Hard remains in another layout/dark-mode path.
PALETTES = {
    'medium': {
        False: ('#4e83d5', '#e5efff'),
        True: ('#87b5ff', '#25364f'),
    },
    'hard': {
        False: ('#f08a32', '#fff0dc'),
        True: ('#ffad5b', '#443025'),
    },
}
block_re = re.compile(r'(?P<selector>[^{}]+)\{(?P<body>[^{}]*)\}')

def retokenize_css(path: Path):
    text = path.read_text(encoding='utf-8')
    touched = {'medium': 0, 'hard': 0}
    def repl(m):
        selector = m.group('selector')
        body = m.group('body')
        out = body
        for diff in ('medium', 'hard'):
            if f'data-diff="{diff}"' not in selector:
                continue
            is_dark = 'data-theme="dark"' in selector
            primary, soft = PALETTES[diff][is_dark]
            before = out
            out = re.sub(r'--diff:\s*#[0-9a-fA-F]{3,8}', f'--diff:{primary}', out)
            out = re.sub(r'--diff-soft:\s*#[0-9a-fA-F]{3,8}', f'--diff-soft:{soft}', out)
            out = re.sub(r'--q:\s*#[0-9a-fA-F]{3,8}', f'--q:{primary}', out)
            out = re.sub(r'--qs:\s*#[0-9a-fA-F]{3,8}', f'--qs:{soft}', out)
            if out != before:
                touched[diff] += 1
        return selector + '{' + out + '}'
    new = block_re.sub(repl, text)
    path.write_text(new, encoding='utf-8')
    return touched

counts = {'medium': 0, 'hard': 0}
for css_name in ('public/styles.css', 'public/home-layout.css'):
    c = retokenize_css(Path(css_name))
    counts['medium'] += c['medium']
    counts['hard'] += c['hard']
if counts['medium'] < 4 or counts['hard'] < 4:
    raise SystemExit(f'Unexpectedly few difficulty CSS blocks retokenized: {counts}')

print('v3.27.3 patch applied', counts)
