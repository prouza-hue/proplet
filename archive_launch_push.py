"""Approved shared Extra + Archive campaign, strictly 14 October 2026 morning."""
from datetime import datetime
import hmac
import json
import os

from fastapi import Header, HTTPException, Query, Request

EVENT_KEY = "content:extra-archive-launch-v1"
PAYLOAD = {
    "title": "Extra výzvy a Archiv jsou tady",
    "body": "Třikrát týdně těžší výzva navíc. A 800 původních desek v Archivu. Co rozpleteš jako první?",
    "url": "https://hrajproplet.cz/?open=daily&via=push-content",
    "tag": "proplet-extra-archive-launch-v1",
}


def install_archive_launch_push(app, *, tz, push_ready, db_select_bounded,
                            reserve_delivery, db_update, webpush, release_ready, audience_eligible,
                            vapid_private, vapid_subject, logger, clock=None):
    clock = clock or (lambda: datetime.now(tz))
    start = datetime(2026, 10, 14, 8, 0, tzinfo=tz)
    end = datetime(2026, 10, 14, 9, 0, tzinfo=tz)

    @app.get("/api/cron/archive-launch-push")
    def archive_launch_push(request: Request, authorization: str | None = Header(default=None),
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
        if not release_ready():
            raise HTTPException(503, "Archiv nebo Extra nejsou připravené")
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
            if sub.get("content_enabled") is not True or not audience_eligible(sub):
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
            if not fresh or fresh[0].get("content_enabled") is not True or not audience_eligible(fresh[0]):
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
                logger.warning("Archive+Extra push failed subscription=%s status=%s", sub["id"], status)
                continue
            counts["sent"] += 1
            try:
                db_update("push_delivery_log", {"id": delivery_id}, {"status": "sent", "sent_at": clock().isoformat()})
            except Exception:
                counts["ledgerPending"] += 1
                logger.warning("Archive+Extra accepted; ledger pending delivery=%s", delivery_id)
        result = {**base, **counts, "eligible": eligible, "subscriptions": len(subscriptions),
                  "ok": counts["failed"] == 0 and counts["ledgerPending"] == 0,
                  "dryRun": dry_run}
        logger.info("Archive+Extra push summary %s", json.dumps(result))
        return result
