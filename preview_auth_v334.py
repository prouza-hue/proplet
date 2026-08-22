from __future__ import annotations

import inspect
import os
from typing import get_type_hints

from fastapi import HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse, Response
from pydantic import ValidationError


_PREVIEW_BRANCH = "agent/v3340-medium-calibration-v3"
_PREVIEW_AUTH_PATHS = frozenset({
    "/api/login",
    "/api/player",
    "/api/auth/google/complete",
    "/api/logout",
    "/api/account/email/start",
    "/api/account/email/verify",
    "/api/auth/recovery/start",
    "/api/auth/recovery/check",
    "/api/auth/recovery/reset",
    "/api/account-bonus/claim",
    "/api/account-bonus-event",
})


def install_preview_auth_v334(app) -> None:
    """Keep Gen4 gameplay read-only while allowing canonical account QA.

    The preview's global safety middleware intentionally blocks normal mutations.
    This later-installed, preview-only middleware is outermost and handles only the
    explicit account/auth allowlist with the already-registered canonical endpoint
    functions. Browser traffic stays ordinary POST; no custom HTTP method is used.
    """
    if os.environ.get("VERCEL_ENV", "").strip().lower() != "preview":
        return
    if os.environ.get("VERCEL_GIT_COMMIT_REF", "").strip() != _PREVIEW_BRANCH:
        return

    def post_route(path: str):
        return next(
            (
                route
                for route in app.routes
                if getattr(route, "path", None) == path
                and "POST" in (getattr(route, "methods", set()) or set())
            ),
            None,
        )

    async def invoke(path: str, request: Request):
        route = post_route(path)
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
            try:
                body = await request.json()
            except Exception as exc:
                raise HTTPException(400, "Chybí přihlašovací data") from exc
            model = hints.get("payload")
            if model is None:
                raise HTTPException(503, "Preview auth model není dostupný")
            try:
                kwargs["payload"] = model.model_validate(body)
            except ValidationError as exc:
                return JSONResponse(status_code=422, content={"detail": jsonable_encoder(exc.errors())})

        if "request" in signature.parameters:
            kwargs["request"] = request
        if "authorization" in signature.parameters:
            kwargs["authorization"] = request.headers.get("authorization")
        if "x_proplet_anon_id" in signature.parameters:
            kwargs["x_proplet_anon_id"] = request.headers.get("x-proplet-anon-id")

        try:
            result = endpoint(**kwargs)
            if inspect.isawaitable(result):
                result = await result
        except HTTPException as exc:
            return JSONResponse(
                status_code=exc.status_code,
                content={"detail": exc.detail},
                headers=exc.headers or {},
            )
        if isinstance(result, Response):
            return result
        return JSONResponse(content=jsonable_encoder(result))

    @app.middleware("http")
    async def gen4_preview_auth_middleware(request: Request, call_next):
        if request.method == "POST" and request.url.path in _PREVIEW_AUTH_PATHS:
            return await invoke(request.url.path, request)
        return await call_next(request)
