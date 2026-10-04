"""Stable first-board assignments, with a time-bounded operational catch-up phase."""
from uuid import UUID
from fastapi import Header, HTTPException, Request
from pydantic import BaseModel
from backend import measurement

class AssignmentRequest(BaseModel):
    first_steps_run_id: UUID

def identity_bucket(identity: str) -> int:
    # Match JavaScript FNV-1a over UTF-16 code units, including non-ASCII guest IDs.
    value = 2166136261
    units = ("first-board-v1:" + identity).encode("utf-16-le")
    for i in range(0, len(units), 2):
        value = ((value ^ int.from_bytes(units[i:i+2], "little")) * 16777619) & 0xffffffff
    return value % 100

def install(app, *, telemetry_actor, db_rpc, enforce_rate_limit, environment, app_version):
    @app.post("/api/first-board/assignment")
    def assign(payload: AssignmentRequest, request: Request,
               authorization: str | None = Header(default=None),
               anonymous_id: str | None = Header(default=None, alias="X-Proplet-Anon-ID")):
        enforce_rate_limit(request, "first_board_assignment", limit=40, window_seconds=3600)
        actor = telemetry_actor(authorization, anonymous_id)
        if actor.get("player_id"):
            raise HTTPException(409, "První deska se přiřazuje pouze novému anonymnímu hráči")
        provenance = measurement.context.get() or {}
        if provenance.get("onboarding_version") != "board-v3-short":
            raise HTTPException(400, "Chybí verze tréninku")
        details = provenance.get("_event_context", {})
        if details.get("first_steps_run_id") != str(payload.first_steps_run_id):
            raise HTTPException(400, "Nesouhlasí průchod první hrou")
        result = db_rpc("proplet_first_board_assign", {
            "p_environment": environment or "local",
            "p_is_test": bool(provenance.get("is_test")),
            "p_anonymous_id": actor["anonymous_id"],
            "p_flow": str(payload.first_steps_run_id),
            "p_identity_bucket": identity_bucket((anonymous_id or "").strip()),
            "p_client_release": provenance.get("client_release", "legacy"),
            "p_release": provenance.get("release", "legacy"),
            "p_app_version": app_version,
        })
        if not isinstance(result, dict) or result.get("key") != "first-board-v1":
            raise HTTPException(503, "První hru se nepodařilo přiřadit. Zkus to znovu.")
        return result

