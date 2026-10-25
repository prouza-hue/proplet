"""Browser-bound Google PKCE transactions, valid across stateless workers.

The signed HttpOnly cookie binds intent, origin and (for linking) the exact
reauthenticated player session. Supabase atomically redeems the PKCE code once;
cookie deletion alone is NOT the replay defence. Never accept a client token as
an alternative to that exchange. Starting again replaces the browser transaction.
"""
import base64
import hashlib
import hmac
import json
import secrets
import time

from fastapi import HTTPException


TTL = 300
COOKIE = "__Host-proplet-google"
LOCAL_COOKIE = "proplet-google-local"


def b64(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode().rstrip("=")


def session_hash(authorization: str) -> str:
    return hashlib.sha256(authorization.encode()).hexdigest()


def signature(body: str, key: str) -> str:
    return hmac.new(key.encode(), b"proplet-google-v1:" + body.encode(), hashlib.sha256).hexdigest()


def issue(origin: str, key: str, *, player_id=None, authorization=""):
    if not key:
        raise HTTPException(503, "Google přihlášení ještě není nakonfigurované")
    transaction = {
        "state": secrets.token_urlsafe(32), "verifier": secrets.token_urlsafe(48),
        "origin": origin, "expires": int(time.time()) + TTL,
        "intent": "link" if player_id else "login", "player_id": player_id,
        "session": session_hash(authorization) if player_id else None,
    }
    body = b64(json.dumps(transaction, separators=(",", ":")).encode())
    return transaction, body + "." + signature(body, key)


def read(request, state: str, origin: str, key: str):
    try:
        cookie = request.cookies.get(cookie_name(origin), "")
        body, mac = cookie.split(".")
        if not key or not hmac.compare_digest(mac, signature(body, key)):
            raise ValueError("signature")
        transaction = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
        if (not hmac.compare_digest(transaction["state"], state)
                or transaction["origin"] != origin
                or transaction["expires"] <= time.time()
                or transaction["intent"] not in {"login", "link"}):
            raise ValueError("binding")
        return transaction
    except (ValueError, TypeError, KeyError):
        raise HTTPException(400, "Přihlášení vypršelo nebo nebylo zahájeno v tomto prohlížeči. Zkus to znovu.")


def cookie_name(origin: str) -> str:
    return COOKIE if origin.startswith("https://") else LOCAL_COOKIE


def set_cookie(response, origin: str, value: str):
    response.set_cookie(cookie_name(origin), value, max_age=TTL, httponly=True,
                        secure=origin.startswith("https://"), samesite="lax", path="/")
    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"


def clear_cookie(response, origin: str):
    response.delete_cookie(cookie_name(origin), path="/", httponly=True,
                           secure=origin.startswith("https://"), samesite="lax")
    response.headers["Cache-Control"] = "no-store"
