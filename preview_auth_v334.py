from __future__ import annotations

import inspect
import os
from typing import get_type_hints

from fastapi import HTTPException, Request
from pydantic import ValidationError


_PREVIEW_BRANCH = "agent/v3340-medium-calibration-v3"
_ACTIONS = {
    "login": "/api/login",
    "player": "/api/player",
    "google-complete": "/api/auth/google/complete",
}


def install_preview_auth_v334(app) -> None:
    """Allow narrowly scoped auth QA on the Gen4 preview.

    The ordinary preview middleware intentionally blocks POST/PUT/PATCH/DELETE.
    This preview-only PROPFIND endpoint invokes the existing auth handlers directly,
    preserving their validation/rate limits while leaving every gameplay mutation blocked.
    """
    if os.environ.get("VERCEL_ENV", "").strip().lower() != "preview":
        return
    if os.environ.get("VERCEL_GIT_COMMIT_REF", "").strip() != _PREVIEW_BRANCH:
        return

    async def invoke_existing(path: str, body: dict, request: Request):
        route = next(
            (
                route
                for route in app.routes
                if getattr(route, "path", None) == path
                and "POST" in (getattr(route, "methods", set()) or set())
            ),
            None,
        )
        if route is None:
            raise HTTPException(503, "Preview auth route není dostupná")

        endpoint = route.endpoint
        signature = inspect.signature(endpoint)
        try:
            hints = get_type_hints(endpoint, globalns=getattr(endpoint, "__globals__", {}))
        except Exception:
            hints = {}
        kwargs = {}

        if "payload" in signature.parameters:
            model = hints.get("payload")
            if model is None:
                raise HTTPException(503, "Preview auth model není dostupný")
            try:
                kwargs["payload"] = model.model_validate(body)
            except ValidationError as exc:
                raise HTTPException(422, "Neplatné přihlašovací údaje") from exc
        if "request" in signature.parameters:
            kwargs["request"] = request
        if "authorization" in signature.parameters:
            kwargs["authorization"] = request.headers.get("authorization")

        result = endpoint(**kwargs)
        if inspect.isawaitable(result):
            result = await result
        return result

    @app.api_route("/api/preview-auth/{action}", methods=["PROPFIND"])
    async def preview_auth(action: str, request: Request):
        path = _ACTIONS.get(action)
        if not path:
            raise HTTPException(404, "Neznámá preview auth operace")
        try:
            body = await request.json()
        except Exception as exc:
            raise HTTPException(400, "Chybí přihlašovací data") from exc
        if not isinstance(body, dict):
            raise HTTPException(400, "Neplatná přihlašovací data")
        return await invoke_existing(path, body, request)
