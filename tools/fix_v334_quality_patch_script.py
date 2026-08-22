#!/usr/bin/env python3
"""Repair the one-shot v3.34 server patch before it is executed.

The initial patch expected four result-update branches to share one formatting shape.
The current server has two inline and two wrapped variants, so patch both explicitly.
This helper is temporary and is removed by the one-shot workflow together with the patch scripts.
"""
from pathlib import Path

path = Path("tools/apply_v334_quality_server_patch.py")
text = path.read_text(encoding="utf-8")

old = '''text = text.replace(
''' + "'''" + '''                \"clean_solve\": effective_clean, \"completed_at\": official_completed_at,
            })''' + "'''" + ''',
''' + "'''" + '''                \"clean_solve\": effective_clean, \"calm_mode\": bool(payload.calm_mode), \"completed_at\": official_completed_at,
            })''' + "'''" + ''',
)
if text.count('\"clean_solve\": effective_clean, \"calm_mode\": bool(payload.calm_mode), \"completed_at\": official_completed_at,') < 4:
    raise SystemExit(\"result replacement branches: expected at least four calm_mode updates\")
'''

new = '''inline_old = ''' + "'''" + '''                \"clean_solve\": effective_clean, \"completed_at\": official_completed_at,
            })''' + "'''" + '''
inline_new = ''' + "'''" + '''                \"clean_solve\": effective_clean, \"calm_mode\": bool(payload.calm_mode), \"completed_at\": official_completed_at,
            })''' + "'''" + '''
inline_count = text.count(inline_old)
if inline_count != 2:
    raise SystemExit(f\"result inline replacement branches: expected 2, got {inline_count}\")
text = text.replace(inline_old, inline_new)

wrapped_old = ''' + "'''" + '''                \"max_hint_level\": payload.max_hint_level, \"clean_solve\": effective_clean,
                \"completed_at\": official_completed_at,
            })''' + "'''" + '''
wrapped_new = ''' + "'''" + '''                \"max_hint_level\": payload.max_hint_level, \"clean_solve\": effective_clean,
                \"calm_mode\": bool(payload.calm_mode), \"completed_at\": official_completed_at,
            })''' + "'''" + '''
wrapped_count = text.count(wrapped_old)
if wrapped_count != 2:
    raise SystemExit(f\"result wrapped replacement branches: expected 2, got {wrapped_count}\")
text = text.replace(wrapped_old, wrapped_new)
'''

if old not in text:
    raise SystemExit("Could not find the original result replacement block")
text = text.replace(old, new, 1)
path.write_text(text, encoding="utf-8")
print("Repaired result replacement logic in v3.34 server patch")
