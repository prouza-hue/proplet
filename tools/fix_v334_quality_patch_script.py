#!/usr/bin/env python3
"""Repair the temporary v3.34 server patch before execution.

The server has five result persistence shapes that need calm_mode: four update branches
and the initial insert. The first patcher assumed identical indentation, so normalize that
logic and make the later insert patch idempotent. This helper is removed after success.
"""
from pathlib import Path

path = Path("tools/apply_v334_quality_server_patch.py")
text = path.read_text(encoding="utf-8")
q = "'''"

original_result_block = (
    "text = text.replace(\n"
    + q + "                \\\"clean_solve\\\": effective_clean, \\\"completed_at\\\": official_completed_at,\n            })" + q + ",\n"
    + q + "                \\\"clean_solve\\\": effective_clean, \\\"calm_mode\\\": bool(payload.calm_mode), \\\"completed_at\\\": official_completed_at,\n            })" + q + ",\n"
    + ")\n"
    + "if text.count('\\\"clean_solve\\\": effective_clean, \\\"calm_mode\\\": bool(payload.calm_mode), \\\"completed_at\\\": official_completed_at,') < 4:\n"
    + "    raise SystemExit(\\\"result replacement branches: expected at least four calm_mode updates\\\")\n"
)

replacement_result_block = '''inline_old = '\"clean_solve\": effective_clean, \"completed_at\": official_completed_at,'
inline_new = '\"clean_solve\": effective_clean, \"calm_mode\": bool(payload.calm_mode), \"completed_at\": official_completed_at,'
inline_count = text.count(inline_old)
if inline_count != 2:
    raise SystemExit(f\"result inline replacement branches: expected 2, got {inline_count}\")
text = text.replace(inline_old, inline_new)

wrapped16_old = '\"clean_solve\": effective_clean,\\n                \"completed_at\": official_completed_at,'
wrapped16_new = '\"clean_solve\": effective_clean,\\n                \"calm_mode\": bool(payload.calm_mode), \"completed_at\": official_completed_at,'
wrapped16_count = text.count(wrapped16_old)
if wrapped16_count != 2:
    raise SystemExit(f\"result wrapped16 branches: expected 2, got {wrapped16_count}\")
text = text.replace(wrapped16_old, wrapped16_new)

wrapped20_old = '\"clean_solve\": effective_clean,\\n                    \"completed_at\": official_completed_at,'
wrapped20_new = '\"clean_solve\": effective_clean,\\n                    \"calm_mode\": bool(payload.calm_mode), \"completed_at\": official_completed_at,'
wrapped20_count = text.count(wrapped20_old)
if wrapped20_count != 1:
    raise SystemExit(f\"result wrapped20 branch: expected 1, got {wrapped20_count}\")
text = text.replace(wrapped20_old, wrapped20_new)

if text.count('\"calm_mode\": bool(payload.calm_mode), \"completed_at\": official_completed_at,') < 5:
    raise SystemExit(\"result persistence: calm_mode was not added to all five official-result writes\")
'''

if original_result_block not in text:
    raise SystemExit("Could not find the original result replacement block")
text = text.replace(original_result_block, replacement_result_block, 1)

insert_old_body = '''                \"clean_solve\": effective_clean,
                \"completed_at\": official_completed_at,
            })
            first = True
'''
insert_new_body = '''                \"clean_solve\": effective_clean,
                \"calm_mode\": bool(payload.calm_mode),
                \"completed_at\": official_completed_at,
            })
            first = True
'''
insert_once_block = (
    "once(\n" + q + insert_old_body + q + ",\n" + q + insert_new_body + q
    + ",\n\"result insert calm persistence\",\n)\n"
)
insert_idempotent_block = (
    "result_insert_old = " + q + insert_old_body + q + "\n"
    + "result_insert_new = " + q + insert_new_body + q + "\n"
    + "if result_insert_old in text:\n"
    + "    text = text.replace(result_insert_old, result_insert_new, 1)\n"
    + "elif result_insert_new not in text:\n"
    + "    raise SystemExit(\"result insert calm persistence: neither old nor already-patched shape found\")\n"
)
if insert_once_block not in text:
    raise SystemExit("Could not find result insert one-shot block")
text = text.replace(insert_once_block, insert_idempotent_block, 1)

path.write_text(text, encoding="utf-8")
print("Repaired result persistence logic in v3.34 server patch")
