"""One approved, consent-aware invitation to the private visual pilot."""
from datetime import datetime, timezone
import hmac
import json
import os
from urllib.parse import urlparse
from uuid import UUID

from fastapi import Header, HTTPException, Query, Request

CAMPAIGN_ID = "visual-refresh-20261027-v1"
EVENT_KEY = "content:" + CAMPAIGN_ID
START = datetime(2026, 10, 28, 10, tzinfo=timezone.utc)
END = datetime(2026, 10, 28, 11, tzinfo=timezone.utc)
PAYLOAD = {
    "title": "Pomůžeš doladit nový Proplet?",
    "body": "Zkouším nový vzhled Propletu. Zajímá mě upřímně, jak ti sedne a jestli se ti hraje lépe.",
    "url": "https://hrajproplet.cz/?playtest=" + CAMPAIGN_ID,
    "tag": "proplet-" + CAMPAIGN_ID,
}


def _participants(state):
    if not isinstance(state, dict) or state.get("active") is not True:
        return set()
    values = state.get("participant_ids")
    if not isinstance(values, list) or len(values) > 12:
        raise HTTPException(503, "Neplatná skupina hráčů pro pilot")
    try:
        return {str(UUID(value)) for value in values}
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(503, "Neplatná skupina hráčů pro pilot")


def _deliverable(sub, participants):
    if str(sub.get("player_id") or "") not in participants or sub.get("content_enabled") is not True:
        return False
    try:
        endpoint = urlparse(str(sub.get("endpoint") or ""))
        host = (endpoint.hostname or "").lower()
        return bool(endpoint.scheme == "https" and host
                    and host not in {"localhost", "127.0.0.1", "::1"}
                    and not host.endswith((".invalid", ".test", ".example"))
                    and sub.get("p256dh") and sub.get("auth"))
    except ValueError:
        return False


def install_visual_pilot_push(app, *, push_ready, db_select_bounded,
                              reserve_delivery, db_update, webpush, campaign_state,
                              vapid_private, vapid_subject, logger, clock=None):
    """campaign_state returns active + eligible tester UUIDs, never reviewers."""
    clock = clock or (lambda: datetime.now(timezone.utc))

    @app.get("/api/cron/visual-pilot-push")
    def visual_pilot_push(request: Request, authorization: str | None = Header(default=None),
                          dry_run: bool = Query(default=False)):
        secret = os.environ.get("CRON_SECRET", "").strip()
        if not secret or not hmac.compare_digest(authorization or "", "Bearer " + secret):
            raise HTTPException(401, "Neplatné cron oprávnění")
        counts = dict(sent=0, failed=0, removed=0, duplicate=0, skipped=0,
                      skippedWindow=0, ledgerPending=0, eligible=0)
        base = {"eventKey": EVENT_KEY, "scheduledAt": START.isoformat(),
                "windowEnd": END.isoformat(), "dryRun": dry_run}
        if os.environ.get("VERCEL_ENV", "").lower() != "production":
            return {**base, **counts, "ok": True, "reason": "not-production"}
        # Authenticated preflight is read-only and works before the scheduled hour.
        if not dry_run and not START <= clock() < END:
            return {**base, **counts, "ok": True, "reason": "outside-release-window"}
        participants = _participants(campaign_state())
        if not participants:
            return {**base, **counts, "ok": True, "reason": "campaign-inactive-or-empty"}
        if not push_ready():
            raise HTTPException(503, "Push není nakonfigurovaný")
        subscriptions = db_select_bounded(
            "push_subscriptions", max_rows=100,
            columns="id,player_id,content_enabled,endpoint,p256dh,auth",
            filters={"player_id": "in.(" + ",".join(sorted(participants)) + ")",
                     "content_enabled": "eq.true"})
        logs = db_select_bounded("push_delivery_log", columns="subscription_id",
                                 filters={"event_key": "eq." + EVENT_KEY}, max_rows=1000)
        previous = {row["subscription_id"] for row in logs}

        def record(table, binding, values):
            try:
                db_update(table, binding, values)
            except Exception:
                counts["ledgerPending"] += 1
                logger.warning("Visual pilot push bookkeeping failed; reservation retained")

        for sub in subscriptions:
            if not _deliverable(sub, participants):
                counts["skipped"] += 1
                continue
            counts["eligible"] += 1
            if sub["id"] in previous:
                counts["duplicate"] += 1
                continue
            if dry_run:
                continue
            if not START <= clock() < END:
                counts["skippedWindow"] += 1
                continue
            # Recheck campaign, membership and device consent immediately before reservation.
            fresh_participants = _participants(campaign_state())
            fresh = db_select_bounded("push_subscriptions", max_rows=1,
                filters={"id": "eq." + str(sub["id"]),
                         "player_id": "eq." + str(sub["player_id"])})
            if not fresh or not _deliverable(fresh[0], fresh_participants):
                counts["skipped"] += 1
                continue
            sub = fresh[0]
            # Unique subscription/event reservation is authoritative under concurrency.
            # Never recycle pending/failed reservations: provider acceptance can be ambiguous.
            delivery_id = reserve_delivery(sub, EVENT_KEY, "content")
            if not delivery_id:
                counts["duplicate"] += 1
                continue
            previous.add(sub["id"])
            now = clock()
            if not START <= now < END:
                counts["skippedWindow"] += 1
                continue
            try:
                webpush(subscription_info={"endpoint": sub["endpoint"],
                    "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]}},
                    data=json.dumps({**PAYLOAD, "deliveryId": delivery_id}, ensure_ascii=False),
                    vapid_private_key=vapid_private, vapid_claims={"sub": vapid_subject},
                    ttl=max(1, min(3600, int((END - now).total_seconds()))), timeout=10)
            except Exception as exc:
                status = getattr(getattr(exc, "response", None), "status_code", None)
                outcome = "removed" if status in (404, 410) else "failed"
                counts[outcome] += 1
                record("push_delivery_log", {"id": delivery_id}, {"status": outcome})
                if outcome == "removed":
                    record("push_subscriptions", {"id": sub["id"]},
                           {"daily_enabled": False, "content_enabled": False,
                            "updated_at": clock().isoformat()})
                logger.warning("Visual pilot push failed, provider status=%s", status)
                continue
            counts["sent"] += 1
            record("push_delivery_log", {"id": delivery_id},
                   {"status": "sent", "sent_at": clock().isoformat()})
        return {**base, **counts, "subscriptions": len(subscriptions),
                "ok": counts["failed"] == 0 and counts["ledgerPending"] == 0}
