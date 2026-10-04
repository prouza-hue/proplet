"""Approved one-off refresh announcement, strictly 4 October 2026 morning."""
from datetime import datetime
import hmac
import json
import os

from fastapi import Header, HTTPException, Query, Request

EVENT_KEY = "content:refresh300-gen6-20261004"
PAYLOAD = {
    "title": "300 nových Propletů je tady!",
    "body": "Po stovce nových úrovní ve Snadné, Střední a Těžké. Pojď si rozplést hlavu.",
    "url": "https://hrajproplet.cz/?open=free&via=push-content",
    "tag": "proplet-refresh300-gen6",
}


def install_refresh300_push(app, *, tz, push_ready, db_select_bounded,
                            reserve_delivery, db_update, webpush, load_puzzles,
                            vapid_private, vapid_subject, logger, clock=None):
    clock = clock or (lambda: datetime.now(tz))
    start = datetime(2026, 10, 4, 10, 0, tzinfo=tz)
    end = datetime(2026, 10, 4, 12, 0, tzinfo=tz)

    @app.get("/api/cron/refresh300-launch-push")
    def refresh300_push(request: Request, authorization: str | None = Header(default=None),
                        dry_run: bool = Query(default=False)):
        secret = os.environ.get("CRON_SECRET", "").strip()
        if not secret or not hmac.compare_digest(authorization or "", f"Bearer {secret}"):
            raise HTTPException(401, "Neplatné cron oprávnění")
        counts = dict(sent=0, failed=0, removed=0, skipped=0, duplicate=0,
                      skippedToday=0, skippedOptOut=0, skippedWindow=0, ledgerPending=0)
        base = {"eventKey": EVENT_KEY, "windowEnd": end.isoformat()}
        if os.environ.get("VERCEL_ENV", "").lower() != "production":
            return {**base, **counts, "ok": True, "reason": "not-production"}
        now = clock()
        if not start <= now < end:
            return {**base, **counts, "ok": True, "reason": "outside-release-window"}
        if not push_ready():
            raise HTTPException(503, "Push není nakonfigurovaný")
        free = load_puzzles().get("free", {})
        content_counts = {d: sum(str(p.get("id", "")).startswith("g6-refresh-")
                                 for p in free.get(d, [])) for d in ("easy", "medium", "hard")}
        if any(n != 100 for n in content_counts.values()):
            raise HTTPException(503, "Schválených 300 desek není dostupných")
        subscriptions = db_select_bounded("push_subscriptions", max_rows=5000)
        midnight = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        # Any prior attempt today is excluded conservatively, including pending/failed.
        # Never retry a campaign reservation, whatever its final status.
        logs = db_select_bounded("push_delivery_log", columns="subscription_id,event_key,status",
                                 filters={"or": f"(created_at.gte.{midnight},event_key.eq.{EVENT_KEY})"},
                                 max_rows=20000)
        prior_campaign = {r["subscription_id"] for r in logs if r["event_key"] == EVENT_KEY}
        prior_today = {r["subscription_id"] for r in logs if r["event_key"] != EVENT_KEY}
        eligible = 0
        for sub in subscriptions:
            if not (sub.get("daily_enabled") is True or sub.get("content_enabled") is True):
                counts["skippedOptOut"] += 1
                continue
            eligible += 1
            if sub["id"] in prior_campaign:
                counts["duplicate"] += 1
                counts["skipped"] += 1
                continue
            if sub["id"] in prior_today:
                counts["skippedToday"] += 1
                counts["skipped"] += 1
                continue
            if dry_run:
                continue
            if not start <= clock() < end:
                counts["skippedWindow"] += 1
                counts["skipped"] += 1
                continue
            # Recheck consent and today's ledger immediately before reserving.
            fresh = db_select_bounded("push_subscriptions", filters={"id": f"eq.{sub['id']}"}, max_rows=1)
            if not fresh or not (fresh[0].get("daily_enabled") is True or fresh[0].get("content_enabled") is True):
                counts["skipped"] += 1
                continue
            sub = fresh[0]
            latest = db_select_bounded("push_delivery_log", columns="event_key",
                                      filters={"subscription_id": f"eq.{sub['id']}",
                                               "or": f"(created_at.gte.{midnight},event_key.eq.{EVENT_KEY})"}, max_rows=1000)
            if latest:
                counts["duplicate" if any(r["event_key"] == EVENT_KEY for r in latest) else "skippedToday"] += 1
                counts["skipped"] += 1
                continue
            delivery_id = reserve_delivery(sub, EVENT_KEY, "content")
            if not delivery_id:
                counts["duplicate"] += 1
                counts["skipped"] += 1
                continue
            try:
                webpush(subscription_info={"endpoint": sub["endpoint"],
                                            "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]}},
                        data=json.dumps({**PAYLOAD, "deliveryId": delivery_id}, ensure_ascii=False),
                        vapid_private_key=vapid_private, vapid_claims={"sub": vapid_subject},
                        ttl=max(1, int((end - clock()).total_seconds())), timeout=10)
            except Exception as exc:
                status = getattr(getattr(exc, "response", None), "status_code", None)
                outcome = "removed" if status in (404, 410) else "failed"
                counts[outcome] += 1
                db_update("push_delivery_log", {"id": delivery_id}, {"status": outcome})
                if outcome == "removed":
                    db_update("push_subscriptions", {"id": sub["id"]},
                              {"daily_enabled": False, "content_enabled": False, "updated_at": clock().isoformat()})
                logger.warning("Refresh300 push failed subscription=%s status=%s", sub["id"], status)
                continue
            counts["sent"] += 1
            try:
                db_update("push_delivery_log", {"id": delivery_id}, {"status": "sent", "sent_at": clock().isoformat()})
            except Exception:
                counts["ledgerPending"] += 1
                logger.warning("Refresh300 accepted; ledger pending delivery=%s", delivery_id)
        result = {**base, **counts, "eligible": eligible, "subscriptions": len(subscriptions),
                  "ok": counts["failed"] == 0 and counts["ledgerPending"] == 0,
                  "dryRun": dry_run, "contentCounts": content_counts}
        logger.info("Refresh300 push summary %s", json.dumps(result))
        return result
