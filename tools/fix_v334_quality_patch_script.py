#!/usr/bin/env python3
"""Repair the temporary v3.34 server patch before execution.

The first draft assumed all four result-update branches had identical indentation.
They do not. Replace both inline and wrapped forms independent of indentation, then
let the normal one-shot quality checks verify the final server source.
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

new = '''inline_old = '\"clean_solve\": effective_clean, \"completed_at\": official_completed_at,'
inline_new = '\"clean_solve\": effective_clean, \"calm_mode\": bool(payload.calm_mode), \"completed_at\": official_completed_at,'
inline_count = text.count(inline_old)
if inline_count != 2:
    raise SystemExit(f\"result inline replacement branches: expected 2, got {inline_count}\")
text = text.replace(inline_old, inline_new)

wrapped_counts = []
for indent in (16, 20):
    wrapped_old = '\"clean_solve\": effective_clean,\\n' + (' ' * indent) + '\"completed_at\": official_completed_at,'
    wrapped_new = '\"clean_solve\": effective_clean,\\n' + (' ' * indent) + '\"calm_mode\": bool(payload.calm_mode), \"completed_at\": official_completed_at,'
    count = text.count(wrapped_old)
    wrapped_counts.append(count)
    if count != 1:
        raise SystemExit(f\"result wrapped replacement branch indent={indent}: expected 1, got {count}\")
    text = text.replace(wrapped_old, wrapped_new, 1)

if text.count('\"calm_mode\": bool(payload.calm_mode), \"completed_at\": official_completed_at,') < 4:
    raise SystemExit(\"result replacement branches: calm_mode was not added to all four official-result replacements\")
'''

if old not in text:
    raise SystemExit("Could not find the original result replacement block")
text = text.replace(old, new, 1)
path.write_text(text, encoding="utf-8")
print("Repaired result replacement logic in v3.34 server patch")
