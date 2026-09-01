#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException

ROOT = Path(__file__).resolve().parents[2]
FIXTURE = json.loads((ROOT / "tests/current/s15-product-events-baseline.json").read_text(encoding="utf-8"))
APP = (ROOT / "public/app.js").read_text(encoding="utf-8")
CONTRACTS = (ROOT / "backend/contracts.py").read_text(encoding="utf-8")

old_transport = (
    "function trackProductEvent(eventType){if(CONTENT_PREVIEW_DATE||GEN4_CANDIDATE_PREVIEW)return;"
    "api('/api/product-event',{method:'POST',body:JSON.stringify({event_type:eventType})}).catch(()=>{})}"
)
assert old_transport in APP
assert FIXTURE["endpoint"] == "/api/product-event"
assert FIXTURE["method"] == "POST"
assert FIXTURE["request_fields"] == ["event_type"]
assert FIXTURE["pii_policy"]["custom_properties_sent"] is False
assert "class ProductEventCreate(BaseModel):\n    event_type: str = Field(min_length=2, max_length=40)" in CONTRACTS

# Baseline quirk: callers may pass a second argument, but product analytics sends event_type only.
assert "trackProductEvent('starter_hint_used',{level})" in APP

# Event timing / duplicate guards that must remain behavior-identical.
assert "if(screen!==prev&&screen!=='game')trackProductEvent(`screen_${screen}_viewed`);" in APP
assert "if(sessionStorage.getItem(ANALYTICS_SESSION_KEY)==='1')return;" in APP
assert "if(show&&!button.dataset.impression)" in APP
assert "trackProductEvent('win_account_cta_shown')" in APP

# Critical gameplay telemetry stays outside product analytics.
for endpoint in FIXTURE["out_of_scope_telemetry"][:5]:
    assert endpoint in APP

import server

events = FIXTURE["events"]
assert len(events) == 132
assert len(events) == len(set(events))
inserted = []

with (
    patch.object(server, "enforce_rate_limit", lambda *a, **k: None),
    patch.object(server, "telemetry_actor", return_value={"player_id": None, "anonymous_id": "anon-hash"}),
    patch.object(server, "client_app_version", return_value="4.01.40"),
    patch.object(server, "db_insert", side_effect=lambda table, row: inserted.append((table, row)) or row),
):
    for name in events:
        out = server.product_event(server.ProductEventCreate(event_type=name), object(), x_proplet_anon_id="anon")
        assert out == {"ok": True}
    try:
        server.product_event(server.ProductEventCreate(event_type="s15_unknown_event"), object(), x_proplet_anon_id="anon")
    except HTTPException as exc:
        assert exc.status_code == 400
        assert exc.detail == "Neplatný product event"
    else:
        raise AssertionError("Unknown product event must be rejected")

assert len(inserted) == len(events)
for (table, row), expected in zip(inserted, events):
    assert table == "product_events"
    assert set(row) == set(FIXTURE["server_row_fields"])
    assert row["event_type"] == expected
    assert row["player_id"] is None
    assert row["anonymous_id"] == "anon-hash"
    assert row["app_version"] == "4.01.40"

print("PASS Sprint 15 analytics characterization: 132 events, transport, dedup and PII baseline")
