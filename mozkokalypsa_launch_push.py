"""One-off, consent-aware announcement for the approved Mozkokalypsa release."""
from datetime import datetime
import json
import os

from fastapi import Header, HTTPException, Query, Request


EVENT_KEY = "content:mozkokalypsa-mk100-launch-20261002"
PAYLOAD = {
    "title": "Troufneš si na Mozkokalypsu?",
    "body": "1 008 různých slov. 100 nových desek. 100 písmen na desce. Troufneš si?",
    "url": "https://hrajproplet.cz/?open=free&announcement=mozkokalypsa&via=push-content",
    "tag": "proplet-mozkokalypsa-mk100-launch",
}


def install_launch_push(app, *, tz, push_ready, db_select_bounded,
                        reserve_delivery, db_update, webpush,
                        vapid_private, vapid_subject, logger, clock=None):
    clock = clock or (lambda: datetime.now(tz))
    scheduled_at = datetime(2026, 10, 2, 10, 0, tzinfo=tz)

    @app.get("/api/cron/mozkokalypsa-launch-push")
    def launch_push(request: Request, authorization: str | None = Header(default=None),
                    dry_run: bool = Query(default=False)):
        secret = os.environ.get("CRON_SECRET", "").strip()
        if not secret or authorization != f"Bearer {secret}":
            raise HTTPException(401, "Neplatné cron oprávnění")
        now = clock()
        base = {"eventKey": EVENT_KEY, "scheduledAt": scheduled_at.isoformat(), "sent": 0}
        if os.environ.get("VERCEL_ENV", "").lower() != "production":
            return {**base, "ok": True, "skipped": "not-production"}
        # The annual cron expression can never resend this one-off campaign next year.
        if now.date() != scheduled_at.date() or (now < scheduled_at and not dry_run):
            return {**base, "ok": True, "skipped": "outside-release-window"}
        if not push_ready():
            raise HTTPException(503, "Push není nakonfigurovaný")
        subscriptions = db_select_bounded("push_subscriptions", max_rows=5000)
        eligible = [sub for sub in subscriptions
                    if sub.get("daily_enabled") is True or sub.get("content_enabled") is True]
        if dry_run:
            return {**base, "ok": True, "dryRun": True, "eligible": len(eligible), "payload": PAYLOAD}
        counts = {"sent": 0, "failed": 0, "removed": 0, "duplicate": 0}
        for sub in eligible:
            # Unique (subscription_id, event_key) reservation prevents concurrent/retried sends.
            delivery_id = reserve_delivery(sub, EVENT_KEY, "content")
            if not delivery_id:
                counts["duplicate"] += 1
                continue
            try:
                webpush(
                    subscription_info={"endpoint": sub["endpoint"],
                                       "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]}},
                    data=json.dumps({**PAYLOAD, "deliveryId": delivery_id}, ensure_ascii=False),
                    vapid_private_key=vapid_private,
                    vapid_claims={"sub": vapid_subject}, ttl=86400, timeout=10,
                )
            except Exception as exc:
                status = getattr(getattr(exc, "response", None), "status_code", None)
                outcome = "removed" if status in (404, 410) else "failed"
                counts[outcome] += 1
                db_update("push_delivery_log", {"id": delivery_id}, {"status": outcome})
                if outcome == "removed":
                    db_update("push_subscriptions", {"id": sub["id"]},
                              {"daily_enabled": False, "content_enabled": False,
                               "updated_at": now.isoformat()})
                logger.warning("Mozkokalypsa launch push failed subscription=%s status=%s", sub["id"], status)
                continue
            counts["sent"] += 1
            try:
                db_update("push_delivery_log", {"id": delivery_id},
                          {"status": "sent", "sent_at": clock().isoformat()})
            except Exception:
                # Preserve the reservation if the provider accepted the push but bookkeeping failed.
                logger.warning("Mozkokalypsa push accepted; ledger update failed delivery=%s", delivery_id)
        return {**base, **counts, "ok": counts["failed"] == 0, "eligible": len(eligible)}
