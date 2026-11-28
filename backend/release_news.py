"""Server-owned, once-per-account automatic release announcement receipt."""
from typing import Optional

from fastapi import Header, HTTPException, Request, Response

from backend.config import settings

CAMPAIGN_ID = "november-2026-release-v1"
DAILY_TAJENKA_CAMPAIGN = "daily-tajenka-2026-12"
SPOJKY_CAMPAIGN = "weekly-spojky-daily-tajenka-2026-11"


def daily_tajenka_news_enabled():
    return settings.vercel_env == "production" and settings.tajenka_release_enabled


def install(app, *, auth_player, db_rpc, enforce_rate_limit, enabled,
            tajenka_enabled=daily_tajenka_news_enabled):
    def execute(authorization, claim, campaign=CAMPAIGN_ID):
        player = auth_player(authorization)
        base = {"campaignId": campaign, "enabled": False, "eligible": False,
                "canShowAutomatically": False, **({"displayGranted": False} if claim else {})}
        shared_launch = campaign == SPOJKY_CAMPAIGN
        if shared_launch:
            base["sawDailyTajenka"] = False
        game_news = campaign in (DAILY_TAJENKA_CAMPAIGN, SPOJKY_CAMPAIGN)
        if not (tajenka_enabled() if game_news else enabled()):
            return base
        params = {"p_player": player["id"], "p_claim": claim}
        if game_news:
            value = db_rpc("proplet_campaign_news_v1", {**params, "p_campaign": campaign})
        else:
            value = db_rpc("proplet_release_news_v1", params)
        fields = ("enabled", "eligible", "canShowAutomatically", "displayGranted")
        if not isinstance(value, dict) or any(type(value.get(key)) is not bool for key in fields):
            raise HTTPException(503, "Oznámení je momentálně nedostupné")
        if ((value["eligible"] and not value["enabled"])
                or (value["canShowAutomatically"] and not value["eligible"])
                or (value["displayGranted"] and (not claim or not value["eligible"] or value["canShowAutomatically"]))):
            raise HTTPException(503, "Oznámení je momentálně nedostupné")
        if shared_launch and value["enabled"]:
            if type(value.get("sawDailyTajenka")) is not bool:
                raise HTTPException(503, "Oznámení je momentálně nedostupné")
            base["sawDailyTajenka"] = value["sawDailyTajenka"]
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

    @app.get("/api/release-news/daily-tajenka")
    def tajenka_status(request: Request, response: Response, authorization: Optional[str] = Header(default=None)):
        response.headers["Cache-Control"] = "no-store"
        enforce_rate_limit(request, "release_news_read", limit=120, window_seconds=3600)
        return execute(authorization, False, DAILY_TAJENKA_CAMPAIGN)

    @app.post("/api/release-news/daily-tajenka/claim")
    def tajenka_claim(request: Request, response: Response, authorization: Optional[str] = Header(default=None)):
        response.headers["Cache-Control"] = "no-store"
        enforce_rate_limit(request, "release_news_claim", limit=60, window_seconds=3600)
        return execute(authorization, True, DAILY_TAJENKA_CAMPAIGN)

    @app.get("/api/release-news/weekly-spojky")
    def spojky_status(request: Request, response: Response, authorization: Optional[str] = Header(default=None)):
        response.headers["Cache-Control"] = "no-store"
        enforce_rate_limit(request, "release_news_read", limit=120, window_seconds=3600)
        return execute(authorization, False, SPOJKY_CAMPAIGN)

    @app.post("/api/release-news/weekly-spojky/claim")
    def spojky_claim(request: Request, response: Response, authorization: Optional[str] = Header(default=None)):
        response.headers["Cache-Control"] = "no-store"
        enforce_rate_limit(request, "release_news_claim", limit=60, window_seconds=3600)
        return execute(authorization, True, SPOJKY_CAMPAIGN)
