"""Monthly supporter series. Personal awards are issued by the database."""
import json
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal, Optional

from fastapi import Header, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, StrictInt

# Vercel serves public/ from its CDN. Keep the verified paths in the Python bundle.
SOLUTION_FILE = Path(__file__).resolve().parents[1] / "data/pet_otisku_solutions.json"


class StampSeen(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["gift", "ask"]


class StampFinish(BaseModel):
    model_config = ConfigDict(extra="forbid")
    board: StrictInt = Field(ge=1, le=5)
    solution: Annotated[list[Annotated[list[StrictInt], Field(min_length=1, max_length=100)]],
                        Field(min_length=1, max_length=50)]


@lru_cache(maxsize=1)
def solutions():
    return json.loads(SOLUTION_FILE.read_text(encoding="utf8"))


@lru_cache(maxsize=12)
def edition_solutions(edition):
    if edition == "2026-11":
        return solutions()
    if edition == "2026-12":
        return json.loads((SOLUTION_FILE.parent / "gift_2026_12_solutions.json").read_text(encoding="utf8"))
    raise HTTPException(404, "Tato edice není dostupná.")


def install(app, *, auth_player, db_rpc, enforce_rate_limit):
    def call(player_id, action, board=None, edition="2026-11"):
        result = db_rpc("proplet_gift_edition_v1", {
            "p_month": edition + "-01",
            "p_player": player_id, "p_action": action, "p_board": board,
        })
        if not isinstance(result, dict):
            raise HTTPException(503, "Dárková série je dočasně nedostupná.")
        if result.get("code") == "unknown":
            raise HTTPException(404, "Tato edice není dostupná.")
        if result.get("code") == "ineligible":
            raise HTTPException(403, "Tato série patří podporovatelům Propletu.")
        if result.get("code") == "locked":
            raise HTTPException(409, "Nejprve dohrajte předchozí desku.")
        if result.get("ok") is not True:
            raise HTTPException(503, "Dárková série je dočasně nedostupná.")
        return result

    def player(request, response, authorization):
        response.headers["Cache-Control"] = "private, no-store"
        account = auth_player(authorization)
        enforce_rate_limit(request, "pet_otisku", limit=120, window_seconds=3600)
        return account["id"]

    @app.get("/api/pet-otisku")
    def state(request: Request, response: Response, authorization: Optional[str] = Header(default=None)):
        return call(player(request, response, authorization), "read")

    @app.post("/api/pet-otisku/seen")
    def seen(body: StampSeen, request: Request, response: Response, authorization: Optional[str] = Header(default=None)):
        return call(player(request, response, authorization), body.kind)

    @app.post("/api/pet-otisku/complete")
    def complete(body: StampFinish, request: Request, response: Response, authorization: Optional[str] = Header(default=None)):
        pid = player(request, response, authorization)
        if body.solution != solutions().get(f"otisk-2026-11-{body.board:02}"):
            raise HTTPException(422, "Řešení desky není úplné.")
        return call(pid, "complete", body.board)

    @app.get("/api/gift-editions/{edition}")
    def edition_state(edition: str, request: Request, response: Response,
                      authorization: Optional[str] = Header(default=None)):
        owner = player(request, response, authorization)
        edition_solutions(edition)
        return call(owner, "read", edition=edition)

    @app.post("/api/gift-editions/{edition}/seen")
    def edition_seen(edition: str, body: StampSeen, request: Request, response: Response,
                     authorization: Optional[str] = Header(default=None)):
        owner = player(request, response, authorization)
        edition_solutions(edition)
        return call(owner, body.kind, edition=edition)

    @app.post("/api/gift-editions/{edition}/complete")
    def edition_complete(edition: str, body: StampFinish, request: Request, response: Response,
                         authorization: Optional[str] = Header(default=None)):
        owner = player(request, response, authorization)
        answer = edition_solutions(edition).get(f"otisk-{edition}-{body.board:02}")
        if body.solution != answer:
            raise HTTPException(422, "Řešení desky není úplné.")
        return call(owner, "complete", body.board, edition)
