from pathlib import Path

MEDIUM = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-labelledby="title">
  <title id="title">Střední</title>
  <defs>
    <linearGradient id="flameOuter" x1="18" y1="57" x2="43" y2="7" gradientUnits="userSpaceOnUse">
      <stop stop-color="#ff7a1a"/>
      <stop offset="0.58" stop-color="#ff9d18"/>
      <stop offset="1" stop-color="#ffbf2f"/>
    </linearGradient>
    <linearGradient id="flameInner" x1="27" y1="52" x2="35" y2="27" gradientUnits="userSpaceOnUse">
      <stop stop-color="#fff4bd"/>
      <stop offset="1" stop-color="#ffd65c"/>
    </linearGradient>
  </defs>
  <path d="M31.8 5.8c4.3 7.2 4.8 13.2 1.6 18.2 5.2-2.3 8.2-6.4 9-12.3 7 7.5 9.7 15.5 7.7 23.3 4.2-2 6.4-5.1 7.1-9.2 4.4 8.6 4.2 17-.6 23.8-5.1 7.3-13.7 10.3-23.9 9.3-12.2-1.2-20.7-8.5-21.8-18.7-.8-7.4 2.5-13.4 9.9-20.3-.4 5.8 1.3 10.2 5.1 13.1 1.2-6.1.3-11.7-2.6-16.8 4.4 2 7.2 5.2 8.5 9.7 2-6 2-12.7 0-20.1Z" fill="url(#flameOuter)" stroke="#29284a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M31.4 24.5c3.4 5.2 3.2 9.3-.5 13 3.9-.9 6.6-3.2 8.1-7 4.6 5.1 6 10.2 3.9 15.1-2.1 5-6.2 7.8-11.8 7.8-6.8 0-11.4-4.1-11.4-10 0-4.9 2.9-8.8 8.1-13.5-.1 3.5.8 6.2 2.8 8.1 1.5-4.4 1.8-8.9.8-13.5Z" fill="#ff5f17" stroke="#d84d15" stroke-width="1.9" stroke-linejoin="round"/>
  <path d="M31.3 34.4c4.2 3.9 5.4 7.6 3.6 11-1.2 2.3-3.2 3.7-5.9 3.7-3.9 0-6.6-2.5-6.6-6 0-3.1 2-5.6 5.5-8.7 0 2.3.7 4 2 5.1.8-1.6 1.3-3.3 1.4-5.1Z" fill="url(#flameInner)"/>
</svg>
'''

HARDCORE = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-labelledby="title">
  <title id="title">Mozkožrout</title>
  <defs>
    <linearGradient id="monster" x1="17" y1="55" x2="45" y2="11" gradientUnits="userSpaceOnUse">
      <stop stop-color="#6b0d18"/>
      <stop offset="0.58" stop-color="#941522"/>
      <stop offset="1" stop-color="#c52a36"/>
    </linearGradient>
    <linearGradient id="horn" x1="11" y1="10" x2="19" y2="27" gradientUnits="userSpaceOnUse">
      <stop stop-color="#e14b52"/>
      <stop offset="1" stop-color="#7a101b"/>
    </linearGradient>
  </defs>
  <path d="M15.8 20.2 11.1 8.2l11.4 7.5c2.8-1.5 6.1-2.3 9.7-2.3 3.5 0 6.8.8 9.6 2.3l11.1-7.5-4.5 12c3.4 4 5.3 9.2 5.3 15 0 13.1-9.4 22.6-21.7 22.6S10.5 48.5 10.5 35.3c0-5.8 1.9-11.1 5.3-15.1Z" fill="url(#monster)" stroke="#29284a" stroke-width="4" stroke-linejoin="round"/>
  <path d="m12.6 11 9.1 6.2-5.5 6.1c-1.7-4-2.9-8.1-3.6-12.3Zm38.8 0-9 6.2 5.4 6.1c1.7-4 2.9-8.1 3.6-12.3Z" fill="url(#horn)" opacity=".95"/>
  <path d="M21.2 25.4c3.1-4.1 7-6 11.6-5.8 4 .2 7.3 1.8 9.8 4.9" fill="none" stroke="#29284a" stroke-width="3.5" stroke-linecap="round"/>
  <ellipse cx="32.4" cy="31.8" rx="10.2" ry="8.8" fill="#fffefd" stroke="#29284a" stroke-width="3"/>
  <circle cx="34.8" cy="31" r="4.3" fill="#29284a"/>
  <circle cx="36.1" cy="29.5" r="1.15" fill="#fffefd" opacity=".8"/>
  <path d="M21.5 42.5c3 5.2 7 7.7 12 7.7 4.7 0 8.4-2.2 11.1-6.5-3.3.7-7.2 1-11.8 1-4.2 0-8-.7-11.3-2.2Z" fill="#fffefd" stroke="#29284a" stroke-width="3" stroke-linejoin="round"/>
  <path d="m26.8 44.7 2.4 4.3 2.5-4.1m4.9-.1 2.3 3.8 2.2-4.3" fill="none" stroke="#29284a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M20.5 19.2c3.8-2.1 7.9-3.1 12.3-3 3.7.1 7.1.9 10.1 2.5" fill="none" stroke="#e44b51" stroke-width="2" stroke-linecap="round" opacity=".65"/>
</svg>
'''


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one occurrence of {old!r}, found {count}')
    p.write_text(text.replace(old, new), encoding='utf-8')

Path('public/difficulty/medium.svg').write_text(MEDIUM, encoding='utf-8')
Path('public/difficulty/hardcore.svg').write_text(HARDCORE, encoding='utf-8')
replace_once('public/app.js', "const APP_VERSION='3.27.0';", "const APP_VERSION='3.27.1';")
replace_once('server.py', 'APP_VERSION = "3.27.0"', 'APP_VERSION = "3.27.1"')
replace_once('public/sw.js', "const CACHE='proplet-v3.27.0-difficulty-icons';", "const CACHE='proplet-v3.27.1-icon-refine';")
