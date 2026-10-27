"""Private, opt-in visual pilot; no gameplay or reward side effects."""
from typing import Literal, Optional
from datetime import datetime, timezone

from fastapi import Header, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, model_validator

CAMPAIGN_ID = "visual-refresh-20261027-v1"
PREVIEW_URL = "https://proplet-git-codex-today-one-screen-pavel-prouzas-projects.vercel.app/?playtest=" + CAMPAIGN_ID


class Command(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    action: Literal["shown", "accept", "snooze", "decline", "feedback"]
    rating: Optional[Literal["better", "similar", "worse", "unsure"]] = None
    comment: Optional[str] = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def feedback_fields(self):
        if self.action == "feedback" and self.rating is None:
            raise ValueError("Vyber hodnocení")
        if self.action != "feedback" and (self.rating is not None or self.comment is not None):
            raise ValueError("Hodnocení patří pouze ke zpětné vazbě")
        return self


def allowed(environment, live_player_preview=False):
    return environment == "production" or (environment == "preview" and live_player_preview is True)


def campaign_state(db_select_bounded, *, environment, live_player_preview=False):
    """Private server callback for the one-off push; never an HTTP response."""
    if not allowed(environment, live_player_preview) or environment != "production":
        return {"active": False, "participant_ids": []}
    campaign = db_select_bounded("visual_playtest_campaigns", columns="campaign_id,active",
                                 filters={"campaign_id": "eq." + CAMPAIGN_ID}, max_rows=1)
    if not campaign or campaign[0].get("active") is not True:
        return {"active": False, "participant_ids": []}
    rows = db_select_bounded("visual_playtest_participants", columns="player_id,status,feedback_at,snoozed_until",
                            filters={"campaign_id": "eq." + CAMPAIGN_ID, "active": "eq.true",
                                     "reviewer": "eq.false"}, max_rows=13)
    if len(rows) > 12:
        raise HTTPException(503, "Neplatná skupina hráčů pro pilot")
    now = datetime.now(timezone.utc)
    def invite_pending(row):
        if row.get("status") != "invited" or row.get("feedback_at"):
            return False
        if row.get("snoozed_until"):
            try:
                if datetime.fromisoformat(row["snoozed_until"].replace("Z", "+00:00")) > now:
                    return False
            except (ValueError, TypeError):
                return False
        return True
    return {"active": True, "participant_ids": [row["player_id"] for row in rows if invite_pending(row)]}


def install(app, *, auth_player, db_rpc, enforce_rate_limit, environment, live_player_preview=False):
    def execute(authorization, action="status", rating=None, comment=None):
        # Capability is supplied by canonical server configuration, never headers/query/body.
        player = auth_player(authorization)
        if not allowed(environment, live_player_preview):
            if action == "status":
                return {"eligible": False}
            raise HTTPException(409, "Pilot v tomto prostředí není dostupný")
        value = db_rpc("proplet_visual_playtest_v1", {
            "p_campaign": CAMPAIGN_ID, "p_player": player["id"],
            "p_action": action, "p_rating": rating, "p_comment": comment,
        })
        if not isinstance(value, dict) or type(value.get("eligible")) is not bool:
            raise HTTPException(503, "Pilot je momentálně nedostupný")
        if not value["eligible"]:
            return {"eligible": False}
        if value.get("error"):
            raise HTTPException(409, "Tuto odpověď už nelze uložit")
        # Explicit projection prevents internal cohort/identity fields escaping.
        return {"eligible": True, "campaignId": CAMPAIGN_ID, "previewUrl": PREVIEW_URL,
                **{key: value.get(key) for key in ("role", "status", "shownCount", "canShowInvite",
                                                  "snoozedUntil", "feedback", "displayGranted")}}

    @app.get("/api/visual-playtest")
    def status(request: Request, response: Response, authorization: Optional[str] = Header(default=None)):
        response.headers["Cache-Control"] = "no-store"
        enforce_rate_limit(request, "visual_playtest_read", limit=120, window_seconds=3600)
        return execute(authorization)

    @app.post("/api/visual-playtest")
    def command(payload: Command, request: Request, response: Response,
                authorization: Optional[str] = Header(default=None)):
        response.headers["Cache-Control"] = "no-store"
        enforce_rate_limit(request, "visual_playtest_write", limit=60, window_seconds=3600)
        return execute(authorization, payload.action, payload.rating, payload.comment)
