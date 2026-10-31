"""Server-owned, once-per-account automatic release announcement receipt."""
from typing import Optional

from fastapi import Header, HTTPException, Request, Response

CAMPAIGN_ID = "november-2026-release-v1"


def install(app, *, auth_player, db_rpc, enforce_rate_limit, enabled):
    def execute(authorization, claim):
        player = auth_player(authorization)
        base = {"campaignId": CAMPAIGN_ID, "enabled": False, "eligible": False,
                "canShowAutomatically": False, **({"displayGranted": False} if claim else {})}
        if not enabled():
            return base
        value = db_rpc("proplet_release_news_v1", {"p_player": player["id"], "p_claim": claim})
        fields = ("enabled", "eligible", "canShowAutomatically", "displayGranted")
        if not isinstance(value, dict) or any(type(value.get(key)) is not bool for key in fields):
            raise HTTPException(503, "Oznámení je momentálně nedostupné")
        if ((value["eligible"] and not value["enabled"])
                or (value["canShowAutomatically"] and not value["eligible"])
                or (value["displayGranted"] and (not claim or not value["eligible"] or value["canShowAutomatically"]))):
            raise HTTPException(503, "Oznámení je momentálně nedostupné")
        # Do not expose identity, timestamps, internal rows or arbitrary RPC fields.
        return {**base, **{key: value[key] for key in fields if claim or key != "displayGranted"}}

    @app.get("/api/release-news")
    def status(request: Request, response: Response, authorization: Optional[str] = Header(default=None)):
        response.headers["Cache-Control"] = "no-store"
        enforce_rate_limit(request, "release_news_read", limit=120, window_seconds=3600)
        return execute(authorization, False)

    @app.post("/api/release-news/claim")
    def claim(request: Request, response: Response, authorization: Optional[str] = Header(default=None)):
        response.headers["Cache-Control"] = "no-store"
        enforce_rate_limit(request, "release_news_claim", limit=60, window_seconds=3600)
        return execute(authorization, True)
