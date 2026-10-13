"""Real product ingestion accepts referrals with bounded provenance, no PII."""
from datetime import datetime, timezone
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
import uuid

from fastapi import HTTPException
from backend import analytics, measurement
import server

ROOT = Path(__file__).resolve().parents[2]
events = analytics.REFERRAL_EVENT_NAMES
registry = json.loads((ROOT / "public/analytics-event-registry.json").read_text())
assert len(events) == 8 and len(set(events)) == 8
assert set(events).issubset(registry["events"])
assert registry["request_fields"] == ["event_type"]
assert registry["pii_policy"]["new_pii_allowed"] is False
analytics.load_registry.cache_clear()
analytics.allowed_event_names.cache_clear()
with patch.object(analytics, "REGISTRY_PATH", ROOT / "missing-referral-registry.json"):
    assert set(events).issubset(analytics.allowed_event_names())
analytics.load_registry.cache_clear()
analytics.allowed_event_names.cache_clear()

headers = {
    "x-proplet-referral-source": "win",
    "x-proplet-referral-copy-method": "share_fallback",
    "x-proplet-referral-code": "never-store-this-invitation-code",
    "x-proplet-referral-url": "https://example.invalid/private?invite=secret",
    "x-proplet-referral-name": "Private nickname",
    "x-proplet-auth-at-event": "anonymous",
    "x-proplet-puzzle": "unrelated-current-board",
    "x-proplet-run": "unrelated-current-run",
    "x-proplet-hints": "2",
    "x-proplet-elapsed-ms": "5000",
}
captured = measurement.request_context(SimpleNamespace(headers=headers), "production")
inserted = []


def insert(method, table, body, prefer):
    assert method == "POST" and table == "product_events"
    rows = body if isinstance(body, list) else [body]
    inserted.extend(rows)
    return rows


token = measurement.context.set(captured)
try:
    with patch.object(server, "enforce_rate_limit"), patch.object(
        server, "telemetry_actor", return_value={"anonymous_id": "existing-anon"}
    ), patch.object(server, "client_app_version", return_value="4.07.3"), patch.object(
        server, "db_request", side_effect=insert
    ):
        # One request per accepted name goes through the real single-event endpoint.
        for event in events:
            request = SimpleNamespace(headers={**headers, "x-proplet-event-id": str(uuid.uuid4())})
            out = server.product_event(server.ProductEventCreate(event_type=event), request)
            assert out == {"ok": True}
        first_rows = list(inserted)
        inserted.clear()
        # Batch item IDs, capture times, and shared finite headers survive unchanged.
        items = [
            {"id": str(uuid.uuid4()), "event_type": event, "created_at": datetime.now(timezone.utc).isoformat()}
            for event in events
        ]
        out = server.product_events(server.ProductEventBatch(events=items), SimpleNamespace(headers=headers))
        assert out == {"ok": True, "accepted": 8}
        assert [row["id"] for row in inserted] == [item["id"] for item in items]
        assert [row["event_type"] for row in inserted] == list(events)
        for row in first_rows + inserted:
            expected = {"referral_entry_source": "win", "auth_at_event": "anonymous"}
            if row["event_type"] in {"referral_copy_succeeded", "referral_copy_failed"}:
                expected["referral_copy_method"] = "share_fallback"
            assert row["context"] == expected, row["context"]
            assert row["anonymous_id"] == "existing-anon" and row.get("player_id") is None
            assert row["environment"] == "production"
            assert "never-store-this-invitation-code" not in json.dumps(row)
            assert "example.invalid" not in json.dumps(row)
        # An unregistered name remains rejected without any insert.
        count = len(inserted)
        try:
            server.product_event(server.ProductEventCreate(event_type="referral_delivered"), SimpleNamespace(headers={}))
        except HTTPException as error:
            assert error.status_code == 400
        else:
            raise AssertionError("A native outcome must never imply delivered")
        assert len(inserted) == count
finally:
    measurement.context.reset(token)

for bad in ("person@example.invalid", "https://example.invalid/private", "win" * 1000, "unknown"):
    value = measurement.request_context(SimpleNamespace(headers={
        "x-proplet-referral-source": bad, "x-proplet-referral-copy-method": bad
    }), "production")
    assert not any(key.startswith("referral_") for key in value["_event_context"])
token = measurement.context.set(captured)
try:
    ordinary = measurement.enrich("product_events", {"event_type": "app_open"})
    assert not any(key.startswith("referral_") for key in ordinary["context"])
finally:
    measurement.context.reset(token)

print("PASS referral analytics: single/batch ingestion, serverless mirror, immutable event IDs, finite headers, no referral PII/game leakage")
