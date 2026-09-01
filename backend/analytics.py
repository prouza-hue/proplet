"""Product analytics service and canonical event registry boundary.

Sprint 15 keeps the public HTTP contract unchanged. This module owns the
allowed product-event registry and the row shape written to product_events;
request authentication, rate limiting and HTTP error mapping remain in
server.py.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Callable, Mapping

from backend.config import ROOT

REGISTRY_PATH = ROOT / "public" / "analytics-event-registry.json"


class UnknownProductEvent(ValueError):
    """Raised when a caller tries to record an event outside the registry."""


@lru_cache(maxsize=1)
def load_registry() -> dict[str, Any]:
    data = json.loads(Path(REGISTRY_PATH).read_text(encoding="utf-8"))
    events = data.get("events")
    if not isinstance(events, list) or not events:
        raise RuntimeError("Analytics event registry is empty or invalid")
    if len(events) != len(set(events)) or not all(isinstance(name, str) and name for name in events):
        raise RuntimeError("Analytics event registry contains invalid or duplicate names")
    if data.get("request_fields") != ["event_type"]:
        raise RuntimeError("Analytics event registry changed the product-event request contract")
    return data


@lru_cache(maxsize=1)
def allowed_event_names() -> frozenset[str]:
    return frozenset(load_registry()["events"])


def record_product_event(
    event_type: str,
    *,
    actor: Mapping[str, Any],
    app_version: str,
    insert_fn: Callable[[str, dict[str, Any]], Any],
    event_id: str,
    created_at: str,
) -> dict[str, Any]:
    if event_type not in allowed_event_names():
        raise UnknownProductEvent(event_type)
    row = {
        "id": event_id,
        "player_id": actor.get("player_id"),
        "anonymous_id": actor.get("anonymous_id"),
        "event_type": event_type,
        "app_version": app_version,
        "created_at": created_at,
    }
    insert_fn("product_events", row)
    return row
