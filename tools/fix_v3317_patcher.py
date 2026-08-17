from pathlib import Path

p = Path('tools/patch_v3317_rankings_preview.py')
text = p.read_text(encoding='utf-8')
old = "regex_replace_once('public/app.js', r'async function renderLeaderboard\\(\\)\\{.*?\\n\\}\\nfunction renderLeaderData\\(data\\)\\{.*?\\n\\}\\n\\nasync function renderGlobalLeague\\(\\)\\{', new_render)"
new = """app_path = ROOT / 'public/app.js'\napp_text = app_path.read_text(encoding='utf-8')\nrender_start = app_text.index('async function renderLeaderboard(){')\nglobal_marker = 'async function renderGlobalLeague(){'\nrender_end = app_text.index(global_marker, render_start) + len(global_marker)\napp_path.write_text(app_text[:render_start] + new_render + app_text[render_end:], encoding='utf-8')"""
if text.count(old) != 1:
    raise SystemExit(f'patch anchor occurrence mismatch: {text.count(old)}')
p.write_text(text.replace(old, new, 1), encoding='utf-8')
print('v3.31.7 patcher anchor fixed')
