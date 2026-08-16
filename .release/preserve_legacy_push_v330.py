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
text = text.replace(old, new, 1)

# Keep the reservation if the push was accepted but only the bookkeeping update failed.
# Otherwise an overlapping/retried cron could send the same notification twice.
old_delivery = '''        try:
            webpush(subscription_info=info, data=payload, vapid_private_key=VAPID_PRIVATE_KEY, vapid_claims={"sub": VAPID_SUBJECT}, ttl=86400)
            db_update("push_delivery_log", {"id": delivery_id}, {"status": "sent", "sent_at": datetime.now(TZ).isoformat()})
            sent += 1
        except Exception as exc:
            status = getattr(getattr(exc, "response", None), "status_code", None)
            try:
                db_delete("push_delivery_log", id=delivery_id)  # allow an explicit retry after transient failure
            except Exception:
                pass
            if status in (404, 410):
                try:
                    db_delete("push_subscriptions", id=sub["id"]); removed += 1
                except Exception:
                    pass
            else:
                failed += 1
                logger.warning("Content push failed for subscription %s: %s", sub.get("id"), exc)
'''
new_delivery = '''        try:
            webpush(subscription_info=info, data=payload, vapid_private_key=VAPID_PRIVATE_KEY, vapid_claims={"sub": VAPID_SUBJECT}, ttl=86400)
        except Exception as exc:
            status = getattr(getattr(exc, "response", None), "status_code", None)
            try:
                db_delete("push_delivery_log", id=delivery_id)  # send did not succeed; a later cron may retry
            except Exception:
                pass
            if status in (404, 410):
                try:
                    db_delete("push_subscriptions", id=sub["id"]); removed += 1
                except Exception:
                    pass
            else:
                failed += 1
                logger.warning("Content push failed for subscription %s: %s", sub.get("id"), exc)
            continue
        sent += 1
        try:
            db_update("push_delivery_log", {"id": delivery_id}, {"status": "sent", "sent_at": datetime.now(TZ).isoformat()})
        except Exception as exc:
            # Keep the unique pending reservation. It is safer to miss bookkeeping than to
            # duplicate a notification that the push provider already accepted.
            logger.warning("Content push sent but delivery ledger update failed for %s: %s", sub.get("id"), exc)
'''
if text.count(old_delivery) != 1:
    raise SystemExit(f'content delivery block count={text.count(old_delivery)}')
text = text.replace(old_delivery, new_delivery, 1)

path.write_text(text, encoding='utf-8')
print('legacy push preference preservation and delivery dedupe hardening applied')
