"""Server gate for the preregistered new-player entry experiment."""
import os
from datetime import datetime, timezone

from fastapi import Header, HTTPException, Request
from backend import measurement
from backend.first_board import AssignmentRequest

START = datetime(2026, 11, 15, 23, tzinfo=timezone.utc)
END = datetime(2026, 11, 29, 23, tzinfo=timezone.utc)


def enabled(environment):
    if os.getenv("PROPLET_ENTRY_EXPERIMENT_ENABLED") != "1":
        return False
    return environment in ("local", "preview") or (
        environment == "production" and START <= datetime.now(timezone.utc) < END
    )


def install(app, *, telemetry_actor, db_rpc, enforce_rate_limit, environment, app_version):
    namespace = environment or "local"

    @app.post("/api/entry-experiment/assignment")
    def entry_assignment(payload: AssignmentRequest, request: Request,
                         authorization: str | None = Header(default=None),
                         anonymous_id: str | None = Header(default=None, alias="X-Proplet-Anon-ID")):
        provenance = measurement.context.get() or {}
        is_test = bool(provenance.get("is_test"))
        if (namespace == "production") == is_test:
            return {"variant": None}
        enforce_rate_limit(request, "entry_assignment", limit=40, window_seconds=3600)
        actor = telemetry_actor(authorization, anonymous_id)
        assignment = db_rpc("proplet_entry_assign_v1", {
            "p_environment": namespace, "p_is_test": is_test, "p_enroll": enabled(namespace),
            "p_anonymous_id": actor.get("anonymous_id"), "p_player": actor.get("player_id"),
            "p_flow": str(payload.first_steps_run_id),
            "p_client_release": provenance.get("client_release", "legacy"),
            "p_release": provenance.get("release", "legacy"), "p_app_version": app_version,
        })
        if not isinstance(assignment, dict) or "variant" not in assignment:
            raise HTTPException(503, "Vstup do hry se nepodařilo ověřit.")
        return assignment
