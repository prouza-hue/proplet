"""Private December Tajenka review on the dedicated preview branch and QA database."""
from functools import lru_cache
import hashlib
import hmac
import json
import os
from pathlib import Path
import re

import httpx
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse


BRANCH = "review/tajenka-denne-redakce-2026"
QA_RPC = "https://eanzztstmwlamwfdskbf.supabase.co/rest/v1/rpc/proplet_tajenka_editorial_202612_v1"
EDITIONS = {f"tajenka-v2-week-{n}": n for n in range(26, 67)}
PRIVATE = {"Cache-Control": "private, no-store", "CDN-Cache-Control": "no-store",
           "Vercel-CDN-Cache-Control": "no-store", "Vary": "Authorization",
           "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow"}
MAX_REQUEST = 40 * 1024


def enabled():
    return os.getenv("VERCEL_ENV") == "preview" and os.getenv("VERCEL_GIT_COMMIT_REF") == BRANCH


def fail(code, message):
    raise HTTPException(code, message, headers=PRIVATE)


def authorize(request):
    if not enabled():
        fail(404, "Stránka není dostupná.")
    header = request.headers.get("authorization", "")
    if not header.startswith("Bearer "):
        fail(401, "K otevření je potřeba soukromý odkaz.")
    key = header[7:]
    expected = os.getenv("PROPLET_TAJENKA_EDITORIAL_TOKEN_SHA256", "")
    if not re.fullmatch(r"[0-9a-fA-F]{64}", expected):
        fail(503, "Soukromá redakce není připravená.")
    if not re.fullmatch(r"[A-Za-z0-9_-]{32,128}", key) or not hmac.compare_digest(
        hashlib.sha256(key.encode("ascii")).digest(), bytes.fromhex(expected)
    ):
        fail(401, "Soukromý odkaz není platný.")
    return key


@lru_cache(maxsize=1)
def review_set(path: Path):
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        words = {row["id"]: {answer["word"] for answer in row["answers"]} for row in data["editions"]}
        if words.keys() != EDITIONS.keys() or len(data["editions"]) != len(EDITIONS):
            raise ValueError("wrong edition set")
    except (OSError, KeyError, TypeError, ValueError):
        fail(503, "Sada pro redakci se zatím nedá načíst.")
    return data, words


def valid_number(value):
    return type(value) is int and 0 <= value <= 9_007_199_254_740_991


def valid_text(value, limit):
    if not isinstance(value, str) or len(value) > limit:
        return False
    return not any(ord(c) < 32 and c not in "\n\r\t" or 0xD800 <= ord(c) <= 0xDFFF for c in value)


def validate_fields(fields, words):
    if not isinstance(fields, dict) or fields.keys() - {"phrase", "comment", "status", "clues", "clueComments"}:
        fail(422, "Neplatná pole redakční poznámky.")
    if "status" in fields and fields["status"] not in ("approved", "revise", "pending"):
        fail(422, "Neplatný stav revize.")
    for name, limit in (("phrase", 240), ("comment", 4000)):
        if name in fields and not valid_text(fields[name], limit):
            fail(422, "Text je příliš dlouhý nebo obsahuje neplatné znaky.")
    for name, limit in (("clues", 320), ("clueComments", 2000)):
        if name in fields:
            entries = fields[name]
            if not isinstance(entries, dict) or entries.keys() - words or not all(valid_text(value, limit) for value in entries.values()):
                fail(422, "Neplatné slovo nebo text u nápovědy.")


async def read_json(request, names):
    parts = bytearray()
    async for chunk in request.stream():
        if len(parts) + len(chunk) > MAX_REQUEST:
            fail(413, "Poznámka je příliš velká.")
        parts.extend(chunk)
    try:
        value = json.loads(parts.decode("utf-8"))
    except (ValueError, UnicodeDecodeError, RecursionError):
        fail(422, "Neplatný obsah žádosti.")
    if not isinstance(value, dict) or value.keys() != names:
        fail(422, "Neplatný obsah žádosti.")
    return value


async def request_storage(payload):
    public_key = os.getenv("PROPLET_TAJENKA_EDITORIAL_PUBLISHABLE_KEY", "")
    if not public_key.startswith("sb_publishable_"):
        fail(503, "Úložiště redakce zatím není dostupné.")
    try:
        async with httpx.AsyncClient(timeout=12.0, follow_redirects=False) as client:
            reply = await client.post(QA_RPC, headers={"apikey": public_key}, json=payload)
        reply.raise_for_status()
        value = reply.json()
        if not isinstance(value, dict) or not valid_number(value.get("revision")) or "submission" not in value:
            raise ValueError("invalid editorial response")
    except (httpx.HTTPError, ValueError):
        fail(503, "Změnu se zatím nepodařilo ověřit v úložišti. Zkus to znovu.")
    return value


def result(value):
    conflict = value.pop("conflict", False)
    return JSONResponse(value, status_code=409 if conflict else 200, headers=PRIVATE)


def install(app, *, root):
    if not enabled():
        return
    data_file = root / "data" / "tajenka_editorial_review_set.json"

    @app.get("/api/editorial/tajenka")
    async def editorial_reviews(request: Request):
        key = authorize(request)
        return result(await request_storage({"p_key": key, "p_action": "read"}))

    @app.get("/api/editorial/tajenka/set")
    def editorial_originals(request: Request):
        authorize(request)
        return JSONResponse(review_set(data_file)[0], headers=PRIVATE)

    @app.post("/api/editorial/tajenka/submit")
    async def editorial_submit(request: Request):
        key = authorize(request)
        body = await read_json(request, {"revision"})
        if not valid_number(body["revision"]):
            fail(422, "Neplatná revize sady.")
        return result(await request_storage({"p_key": key, "p_action": "submit", "p_version": body["revision"]}))

    @app.put("/api/editorial/tajenka/{edition_id}")
    async def editorial_save(edition_id: str, request: Request):
        key = authorize(request)
        if edition_id not in EDITIONS:
            fail(404, "Tato deska do redakční sady nepatří.")
        body = await read_json(request, {"version", "fields"})
        if not valid_number(body["version"]):
            fail(422, "Neplatná verze redakční poznámky.")
        validate_fields(body["fields"], review_set(data_file)[1][edition_id])
        return result(await request_storage({"p_key": key, "p_action": "write", "p_edition": EDITIONS[edition_id],
                                            "p_version": body["version"], "p_fields": body["fields"]}))
