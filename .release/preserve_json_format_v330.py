from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'tools' / 'generate_rolling_content.py'
text = path.read_text(encoding='utf-8')
old = 'json.dumps(data, ensure_ascii=False, separators=(",", ":"))'
new = 'json.dumps(data, ensure_ascii=False, indent=2)'
if text.count(old) != 1:
    raise SystemExit(f'data json writer count={text.count(old)}')
text = text.replace(old, new, 1)
old = 'json.dumps(baseline, ensure_ascii=False, separators=(",", ":"))'
new = 'json.dumps(baseline, ensure_ascii=False, indent=2)'
if text.count(old) != 1:
    raise SystemExit(f'public json writer count={text.count(old)}')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
print('rolling generator keeps existing readable JSON format')
