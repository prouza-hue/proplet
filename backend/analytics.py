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

EMBEDDED_EVENT_NAMES = (
    "account_authenticated",
    "account_created",
    "account_logged_in",
    "account_nudge_1_authenticated",
    "account_nudge_1_create",
    "account_nudge_1_dismissed",
    "account_nudge_1_login",
    "account_nudge_1_shown",
    "account_nudge_2_authenticated",
    "account_nudge_2_create",
    "account_nudge_2_dismissed",
    "account_nudge_2_login",
    "account_nudge_2_shown",
    "account_nudge_3_authenticated",
    "account_nudge_3_create",
    "account_nudge_3_dismissed",
    "account_nudge_3_login",
    "account_nudge_3_shown",
    "account_nudge_create",
    "account_nudge_dismissed",
    "account_nudge_login",
    "account_nudge_shown",
    "app_open",
    "app_session_started",
    "calm_preference_disabled",
    "calm_preference_enabled",
    "calm_run_enabled",
    "content_drop_cta_clicked",
    "difficulty_nudge_accepted",
    "difficulty_nudge_accepted_easy_medium",
    "difficulty_nudge_accepted_hard_hardcore",
    "difficulty_nudge_accepted_medium_hard",
    "difficulty_nudge_declined",
    "difficulty_nudge_declined_easy_medium",
    "difficulty_nudge_declined_hard_hardcore",
    "difficulty_nudge_declined_medium_hard",
    "difficulty_nudge_followup_1",
    "difficulty_nudge_followup_1_hard",
    "difficulty_nudge_followup_1_hardcore",
    "difficulty_nudge_followup_1_medium",
    "difficulty_nudge_followup_2",
    "difficulty_nudge_followup_2_hard",
    "difficulty_nudge_followup_2_hardcore",
    "difficulty_nudge_followup_2_medium",
    "difficulty_nudge_followup_3",
    "difficulty_nudge_followup_3_hard",
    "difficulty_nudge_followup_3_hardcore",
    "difficulty_nudge_followup_3_medium",
    "difficulty_nudge_shown",
    "difficulty_nudge_shown_easy_medium",
    "difficulty_nudge_shown_hard_hardcore",
    "difficulty_nudge_shown_medium_hard",
    "first_win_return_nudge_accepted",
    "first_win_return_nudge_dismissed",
    "first_win_return_nudge_shown",
    "helper_default_applied",
    "helper_onboarding_started",
    "legacy_origin_update_opened",
    "legacy_origin_update_shown",
    "onboarding_completed",
    "onboarding_login_authenticated",
    "onboarding_login_clicked",
    "onboarding_principle_completed",
    "onboarding_principle_shown",
    "onboarding_returning_state_detected",
    "onboarding_skipped_known_player",
    "onboarding_skipped_returning_state",
    "onboarding_started",
    "onboarding_support_selected",
    "onboarding_support_selected_beginner",
    "onboarding_support_selected_none",
    "onboarding_support_selected_older",
    "onboarding_support_selected_younger",
    "onboarding_tutorial_completed",
    "progress_guard_desktop_shown",
    "progress_guard_dismissed",
    "progress_guard_google_selected",
    "progress_guard_mobile_shown",
    "progress_guard_other_account_selected",
    "push_content_disabled",
    "push_content_enabled",
    "push_content_opened",
    "push_daily_disabled",
    "push_daily_enabled",
    "push_daily_opened",
    "push_notifications_auto_repaired",
    "push_notifications_disabled",
    "push_notifications_enabled",
    "push_nudge_accepted",
    "push_nudge_dismissed",
    "push_nudge_shown",
    "push_permission_denied",
    "push_return_opened",
    "push_tajenka_opened",
    "push_weekly_opened",
    "pwa_install_ios_hint_ack",
    "pwa_install_native_accepted",
    "pwa_install_native_dismissed",
    "pwa_install_nudge_dismissed",
    "pwa_install_nudge_shown",
    "pwa_install_profile_closed",
    "pwa_install_profile_opened",
    "pwa_installed",
    "pwa_update_applied",
    "pwa_update_detected",
    "screen_daily_viewed",
    "screen_free_viewed",
    "screen_leaderboard_viewed",
    "screen_profile_viewed",
    "starter_completed",
    "starter_easy_warmup_completed",
    "starter_easy_warmup_selected",
    "starter_hard_choice_shown",
    "starter_hard_direct_selected",
    "starter_hint_offer_shown",
    "starter_hint_used",
    "starter_reset",
    "starter_started",
    "starter_word_1_completed",
    "starter_word_2_completed",
    "starter_word_3_completed",
    "tajenka_abandoned",
    "tajenka_completed",
    "tajenka_started",
    "tajenka_viewed",
    "tajenka_word_found",
    "valid_nonsolution_detected",
    "valid_nonsolution_failsafe_shown",
    "win_account_cta_authenticated",
    "win_account_cta_create",
    "win_account_cta_shown",
    "word_discovery_claim_rejected",
)


class UnknownProductEvent(ValueError):
    """Raised when a caller tries to record an event outside the registry."""


@lru_cache(maxsize=1)
def load_registry() -> dict[str, Any]:
    try:
        data = json.loads(Path(REGISTRY_PATH).read_text(encoding="utf-8"))
    except FileNotFoundError:
        # Vercel's Python serverless bundle does not include public/ static assets.
        # Keep runtime behavior available from an embedded mirror; current tests
        # require this mirror to stay byte-semantically equal to the canonical JSON.
        data = {"request_fields": ["event_type"], "events": list(EMBEDDED_EVENT_NAMES)}
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
