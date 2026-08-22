#!/usr/bin/env python3
"""Repair the temporary v3.34 server patch before execution.

The original one-shot patch assumed identical formatting across result persistence branches.
This helper rewrites only that fragile section using stable anchors, then makes the insert
step idempotent. It is deleted after the successful quality commit.
"""
from pathlib import Path

path = Path("tools/apply_v334_quality_server_patch.py")
text = path.read_text(encoding="utf-8")

section_comment = "# Existing-result updates only adopt calm_mode when they replace the chronologically official"
section_pos = text.index(section_comment)
fragile_start = text.index("text = text.replace(\n", section_pos)
insert_start_marker = "once(\n'''                \"clean_solve\": effective_clean,\n                \"completed_at\": official_completed_at,"
fragile_end = text.index(insert_start_marker, fragile_start)

replacement = '''inline_old = '\"clean_solve\": effective_clean, \"completed_at\": official_completed_at,'
inline_new = '\"clean_solve\": effective_clean, \"calm_mode\": bool(payload.calm_mode), \"completed_at\": official_completed_at,'
inline_count = text.count(inline_old)
if inline_count != 2:
    raise SystemExit(f\"result inline persistence: expected 2, got {inline_count}\")
text = text.replace(inline_old, inline_new)

wrapped16_old = '\"clean_solve\": effective_clean,\\n                \"completed_at\": official_completed_at,'
wrapped16_new = '\"clean_solve\": effective_clean,\\n                \"calm_mode\": bool(payload.calm_mode), \"completed_at\": official_completed_at,'
wrapped16_count = text.count(wrapped16_old)
if wrapped16_count != 2:
    raise SystemExit(f\"result wrapped16 persistence: expected 2, got {wrapped16_count}\")
text = text.replace(wrapped16_old, wrapped16_new)

wrapped20_old = '\"clean_solve\": effective_clean,\\n                    \"completed_at\": official_completed_at,'
wrapped20_new = '\"clean_solve\": effective_clean,\\n                    \"calm_mode\": bool(payload.calm_mode), \"completed_at\": official_completed_at,'
wrapped20_count = text.count(wrapped20_old)
if wrapped20_count != 1:
    raise SystemExit(f\"result wrapped20 persistence: expected 1, got {wrapped20_count}\")
text = text.replace(wrapped20_old, wrapped20_new)

if text.count('\"calm_mode\": bool(payload.calm_mode), \"completed_at\": official_completed_at,') < 5:
    raise SystemExit(\"result persistence: calm_mode missing from one or more official-result writes\")

'''
text = text[:fragile_start] + replacement + text[fragile_end:]

insert_start = text.index(insert_start_marker, fragile_start)
insert_end_marker = '"result insert calm persistence",\n)\n'
insert_end = text.index(insert_end_marker, insert_start) + len(insert_end_marker)
insert_block = text[insert_start:insert_end]

old_body = '''                "clean_solve": effective_clean,
                "completed_at": official_completed_at,
            })
            first = True
'''
new_body = '''                "clean_solve": effective_clean,
                "calm_mode": bool(payload.calm_mode),
                "completed_at": official_completed_at,
            })
            first = True
'''
idempotent = (
    "result_insert_old = '''" + old_body + "'''\n"
    + "result_insert_new = '''" + new_body + "'''\n"
    + "if result_insert_old in text:\n"
    + "    text = text.replace(result_insert_old, result_insert_new, 1)\n"
    + "elif result_insert_new not in text:\n"
    + "    raise SystemExit(\"result insert calm persistence: neither old nor patched shape found\")\n"
)
text = text[:insert_start] + idempotent + text[insert_end:]

path.write_text(text, encoding="utf-8")
print("Repaired result persistence logic in v3.34 server patch")
