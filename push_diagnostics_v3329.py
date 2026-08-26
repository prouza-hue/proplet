from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime
from typing import Optional
from urllib.parse import urlparse

from fastapi import Header, HTTPException, Query, Request
from pydantic import BaseModel, Field

try:
    from pywebpush import webpush
except Exception:
    webpush = None


class PushTestRequest(BaseModel):
    endpoint: str = Field(min_length=20, max_length=2048)


def install_push_diagnostics(
    app,
    *,
    tz,
    db_select,
    db_insert,
    db_update,
    db_delete,
    auth_player,
    enforce_rate_limit,
    db_rpc=None,
    save_quality_snapshot_if_monday=None,
    current_prague_date=None,
    released_batches=None,
    logger=None,
    **_kwargs,
):
    """v3.32.9: observable Daily push delivery + per-device self test.

    Uses the existing push_delivery_log table. No schema migration is required.
    """
    log = logger or logging.getLogger("proplet")
    vapid_public = os.environ.get("VAPID_PUBLIC_KEY", "").strip()
    vapid_private = os.environ.get("VAPID_PRIVATE_KEY", "").strip()
    vapid_subject = os.environ.get("VAPID_SUBJECT", "https://hrajproplet.cz").strip()
    cron_secret = os.environ.get("CRON_SECRET", "").strip()
    vercel_env = os.environ.get("VERCEL_ENV", "").strip().lower()
    canonical_origin = str(_kwargs.get("canonical_origin") or "https://hrajproplet.cz").rstrip("/")

    def now():
        return datetime.now(tz)

    def today_iso():
        if callable(current_prague_date):
            return current_prague_date().isoformat()
        return now().date().isoformat()

    def push_ready():
        return bool(webpush and vapid_public and vapid_private)

    def is_admin(player: dict) -> bool:
        try:
            rows = db_select("admin_accounts", player_id=player["id"])
            return any(row.get("active") is not False for row in rows)
        except HTTPException:
            return False

    def reserve_delivery(sub: dict, event_key: str, category: str):
        existing = db_select("push_delivery_log", subscription_id=sub["id"], event_key=event_key)
        if existing:
            row = existing[0]
            status = str(row.get("status") or "pending")
            if status == "sent":
                return row["id"], "duplicate"
            if status == "removed":
                return row["id"], "removed"
            db_update("push_delivery_log", {"id": row["id"]}, {"status": "pending", "sent_at": None})
            return row["id"], "retry"
        delivery_id = str(uuid.uuid4())
        db_insert("push_delivery_log", {
            "id": delivery_id,
            "subscription_id": sub["id"],
            "player_id": sub["player_id"],
            "anonymous_id": sub.get("anonymous_id"),
            "event_key": event_key,
            "category": category,
            "status": "pending",
            "created_at": now().isoformat(),
        })
        return delivery_id, "new"

    def mark_delivery(delivery_id: str, status: str):
        body = {"status": status}
        if status == "sent":
            body["sent_at"] = now().isoformat()
        db_update("push_delivery_log", {"id": delivery_id}, body)

    def disable_dead_subscription(sub: dict):
        try:
            db_update("push_subscriptions", {"id": sub["id"]}, {
                "daily_enabled": False,
                "content_enabled": False,
                "updated_at": now().isoformat(),
            })
        except HTTPException:
            pass

    def send_one(sub: dict, payload: dict, *, event_key: str, category: str, ttl: int):
        delivery_id, reservation = reserve_delivery(sub, event_key, category)
        if reservation == "duplicate":
            return "duplicate"
        if reservation == "removed":
            return "removed"
        info = {
            "endpoint": sub.get("endpoint"),
            "keys": {"p256dh": sub.get("p256dh"), "auth": sub.get("auth")},
        }
        delivery_payload = {**payload, "deliveryId": delivery_id}
        try:
            webpush(
                subscription_info=info,
                data=json.dumps(delivery_payload, ensure_ascii=False),
                vapid_private_key=vapid_private,
                vapid_claims={"sub": vapid_subject},
                ttl=ttl,
            )
        except Exception as exc:
            status_code = getattr(getattr(exc, "response", None), "status_code", None)
            if status_code in (404, 410):
                mark_delivery(delivery_id, "removed")
                disable_dead_subscription(sub)
                return "removed"
            mark_delivery(delivery_id, "failed")
            log.warning("Push v3.32.9 failed category=%s subscription=%s status=%s error=%s", category, sub.get("id"), status_code, exc)
            return "failed"
        mark_delivery(delivery_id, "sent")
        return "sent"

    @app.post("/api/push/open")
    def push_open(
        request: Request,
        delivery_id: str = Query(min_length=36, max_length=36, pattern=r"^[0-9a-fA-F-]{36}$"),
    ):
        enforce_rate_limit(request, "push_open", limit=120, window_seconds=3600)
        rows = db_select("push_delivery_log", id=delivery_id)
        if not rows:
            # A stale or forged click must not reveal whether any player/subscription exists.
            return {"ok": True, "tracked": False}
        row = rows[0]
        if not row.get("opened_at"):
            db_update("push_delivery_log", {"id": delivery_id}, {"opened_at": now().isoformat()})
        return {"ok": True, "tracked": True}

    def run_housekeeping():
        snapshot = None
        housekeeping = None
        if callable(save_quality_snapshot_if_monday):
            try:
                snapshot = save_quality_snapshot_if_monday()
            except Exception as exc:
                log.warning("Push diagnostics snapshot hook failed: %s", exc)
        if callable(db_rpc):
            try:
                housekeeping = db_rpc("proplet_launch_housekeeping")
            except HTTPException:
                housekeeping = None
        return snapshot, housekeeping

    @app.get("/api/cron/daily-push-v2")
    def cron_daily_push_v2(request: Request, authorization: Optional[str] = Header(default=None)):
        if not cron_secret or authorization != f"Bearer {cron_secret}":
            raise HTTPException(401, "Neplatné cron oprávnění")
        snapshot, housekeeping = run_housekeeping()
        if vercel_env == "preview":
            return {"ok": True, "preview": True, "sent": 0, "message": "Preview Daily push neposílá", "qualitySnapshot": snapshot, "housekeeping": housekeeping}
        if not push_ready():
            return {"ok": False, "sent": 0, "message": "VAPID není nakonfigurovaný", "qualitySnapshot": snapshot, "housekeeping": housekeeping}

        today = today_iso()
        today_date = now().date()
        batch = None
        if callable(released_batches):
            try:
                released, _ = released_batches(today_date)
                latest = released[-1] if released else None
                if latest and str(latest.get("availableFrom") or "") == today:
                    batch = latest
            except Exception as exc:
                log.warning("Unified weekly push lookup failed: %s", exc)

        completed = {f"p:{row.get('player_id')}" for row in db_select("results", mode="daily", daily_date=today) if row.get("player_id")}
        try:
            for row in db_select("puzzle_attempts", mode="daily", challenge_key=f"daily:{today}"):
                if not row.get("completed_at"):
                    continue
                if row.get("player_id"):
                    completed.add(f"p:{row['player_id']}")
                elif row.get("anonymous_id"):
                    completed.add(f"a:{row['anonymous_id']}")
        except HTTPException:
            pass
        subscriptions = db_select("push_subscriptions")
        if batch:
            payload = {
                "title": "✨ Pondělní balíček je venku",
                "body": "Pět nových desek právě přistálo. Vrať se do Propletu a vyber si, čím začneš.",
                "url": f"{canonical_origin}/?open=free&new={batch.get('id')}&via=push-weekly",
                "tag": f"proplet-content-{batch.get('id')}",
            }
            event_key = f"content:{batch.get('id')}"
            category = "content"
        else:
            payload = {
                "title": "☀️ Dnešní Proplet čeká",
                "body": "Stejná deska pro všechny. Zahraješ ji dnes čistě?",
                "url": f"{canonical_origin}/?open=daily&via=push-daily",
                "tag": f"proplet-daily-{today}",
            }
            event_key = f"daily:{today}"
            category = "daily"
        opted_in = already_completed = eligible = 0
        counts = {"sent": 0, "failed": 0, "removed": 0, "duplicate": 0}
        for sub in subscriptions:
            enabled = bool(sub.get("daily_enabled", True) or (batch and sub.get("content_enabled", False)))
            if not enabled:
                continue
            opted_in += 1
            actor_key = f"p:{sub['player_id']}" if sub.get("player_id") else f"a:{sub.get('anonymous_id')}"
            if not batch and actor_key in completed:
                already_completed += 1
                continue
            eligible += 1
            outcome = send_one(sub, payload, event_key=event_key, category=category, ttl=86400 if batch else 43200)
            counts[outcome] = counts.get(outcome, 0) + 1
        return {
            "ok": counts["failed"] == 0,
            "date": today,
            "eventKey": event_key,
            "category": category,
            "batch": batch.get("id") if batch else None,
            "subscriptions": len(subscriptions),
            "optedIn": opted_in,
            "alreadyCompleted": already_completed,
            "eligible": eligible,
            **counts,
            "qualitySnapshot": snapshot,
            "housekeeping": housekeeping,
            "audited": True,
        }

    @app.post("/api/push/test")
    def push_test(payload: PushTestRequest, request: Request, authorization: Optional[str] = Header(default=None)):
        enforce_rate_limit(request, "push_self_test", limit=8, window_seconds=3600)
        player = auth_player(authorization)
        if not push_ready():
            raise HTTPException(503, "Push notifikace nejsou nakonfigurované")
        rows = db_select("push_subscriptions", endpoint=payload.endpoint)
        sub = next((row for row in rows if row.get("player_id") == player["id"]), None)
        if not sub:
            raise HTTPException(404, "Toto zařízení nemá aktivní push subscription")
        test_id = uuid.uuid4().hex[:12]
        outcome = send_one(
            sub,
            {
                "title": "🔔 Test Propletu",
                "body": "Funguje to. Takhle dorazí připomínka na Denní výzvu.",
                "url": f"{canonical_origin}/?open=daily&via=push-test",
                "tag": f"proplet-test-{test_id}",
            },
            event_key=f"test:{player['id']}:{test_id}",
            category="test",
            ttl=300,
        )
        if outcome == "removed":
            return {"ok": False, "status": "removed", "message": "Push subscription už u poskytovatele neplatí. Vypni a znovu zapni upozornění."}
        if outcome == "failed":
            raise HTTPException(503, "Testovací upozornění se nepodařilo odeslat")
        return {"ok": True, "status": outcome, "message": "Testovací upozornění bylo přijato push službou."}

    def device_label(ua: str) -> str:
        ua = str(ua or "")
        if "iPhone" in ua:
            os_name = "iPhone"
        elif "iPad" in ua:
            os_name = "iPad"
        elif "Android" in ua:
            os_name = "Android"
        elif "Windows" in ua:
            os_name = "Windows"
        elif "Macintosh" in ua:
            os_name = "macOS"
        else:
            os_name = "jiné zařízení"
        if "CriOS" in ua:
            browser = "Chrome iOS"
        elif "FxiOS" in ua:
            browser = "Firefox iOS"
        elif "EdgiOS" in ua:
            browser = "Edge iOS"
        elif "Chrome/" in ua:
            browser = "Chrome"
        elif "Safari/" in ua:
            browser = "Safari"
        else:
            browser = "browser"
        return f"{os_name} · {browser}"

    @app.get("/api/admin/push-diagnostics")
    def admin_push_diagnostics(request: Request, authorization: Optional[str] = Header(default=None)):
        enforce_rate_limit(request, "admin_push_diagnostics", limit=120, window_seconds=3600)
        player = auth_player(authorization)
        if not is_admin(player):
            raise HTTPException(403, "Administrátorský přístup je potřeba")
        subscriptions = db_select("push_subscriptions")
        logs = db_select("push_delivery_log")
        players = {str(row.get("id")): row for row in db_select("players")}

        daily_groups = {}
        for row in logs:
            if row.get("category") != "daily":
                continue
            key = str(row.get("event_key") or "")
            group = daily_groups.setdefault(key, {"eventKey": key, "eligible": 0, "sent": 0, "opened": 0, "failed": 0, "removed": 0, "pending": 0, "firstAt": row.get("created_at"), "lastAt": row.get("created_at")})
            group["eligible"] += 1
            status = str(row.get("status") or "pending")
            group[status] = group.get(status, 0) + 1
            if row.get("opened_at"):
                group["opened"] += 1
            stamp = str(row.get("created_at") or "")
            if stamp and (not group.get("firstAt") or stamp < group["firstAt"]): group["firstAt"] = stamp
            if stamp and (not group.get("lastAt") or stamp > group["lastAt"]): group["lastAt"] = stamp
        recent_daily = sorted(daily_groups.values(), key=lambda row: row.get("eventKey") or "", reverse=True)[:14]

        subscription_rows = []
        for sub in subscriptions:
            owner = players.get(str(sub.get("player_id"))) or {}
            try:
                host = urlparse(str(sub.get("endpoint") or "")).hostname or ""
            except Exception:
                host = ""
            subscription_rows.append({
                "playerName": owner.get("name") or ("Anonymní hráč" if sub.get("anonymous_id") else "Hráč"),
                "device": device_label(sub.get("user_agent") or ""),
                "dailyEnabled": sub.get("daily_enabled", True) is not False,
                "contentEnabled": sub.get("content_enabled", False) is True,
                "pushHost": host,
                "createdAt": sub.get("created_at"),
                "updatedAt": sub.get("updated_at"),
            })
        subscription_rows.sort(key=lambda row: str(row.get("updatedAt") or row.get("createdAt") or ""), reverse=True)

        tests = [row for row in logs if row.get("category") == "test"]
        tests.sort(key=lambda row: str(row.get("created_at") or ""), reverse=True)
        return {
            "auditingSinceVersion": "3.32.9",
            "cronPath": "/api/cron/daily-push-v2",
            "dailyScheduleUtc": "0 7 * * *",
            "latestDaily": recent_daily[0] if recent_daily else None,
            "recentDaily": recent_daily,
            "subscriptions": {
                "total": len(subscriptions),
                "dailyEnabled": sum(1 for sub in subscriptions if sub.get("daily_enabled", True) is not False),
                "contentEnabled": sum(1 for sub in subscriptions if sub.get("content_enabled", False) is True),
                "rows": subscription_rows,
            },
            "tests": {
                "total": len(tests),
                "recent": [{"status": row.get("status"), "createdAt": row.get("created_at"), "sentAt": row.get("sent_at")} for row in tests[:10]],
            },
            "historicalNote": "Daily push před v3.32.9 neměl per-device delivery ledger.",
        }
