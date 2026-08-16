from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'server.py'
text = path.read_text(encoding='utf-8')
old = '''    existing = db_select("push_subscriptions", endpoint=payload.endpoint)
    daily_enabled = True if payload.daily_enabled is None else bool(payload.daily_enabled)
    content_enabled = False if payload.content_enabled is None else bool(payload.content_enabled)
    row = {
'''
new = '''    existing = db_select("push_subscriptions", endpoint=payload.endpoint)
    legacy_client = payload.daily_enabled is None and payload.content_enabled is None
    if legacy_client and existing:
        # A cached pre-v3.30 client only knows the old Daily switch. Do not let that old
        # client silently erase a Content opt-in that was set by a newer version.
        daily_enabled = bool(existing[0].get("daily_enabled", True))
        content_enabled = bool(existing[0].get("content_enabled", False))
    else:
        daily_enabled = True if payload.daily_enabled is None else bool(payload.daily_enabled)
        content_enabled = False if payload.content_enabled is None else bool(payload.content_enabled)
    row = {
'''
if text.count(old) != 1:
    raise SystemExit(f'legacy push block count={text.count(old)}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('legacy push preference preservation applied')
