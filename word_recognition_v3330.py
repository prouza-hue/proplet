from __future__ import annotations

import json
import re
import unicodedata
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Callable, Optional

from fastapi import Header, HTTPException, Query, Request
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"

# Player-reported, editorially verified forms that are useful for recognition even when they are
# not desirable generation targets. Keep this overlay intentionally small and reviewable.
RECOGNITION_OVERLAY = {
    "bruska",
    "pnutí",
    "padnutí",
    "hrubka",
    "stáj",
    "starost",
}

# Frequency fallback is deliberately recognition-only. It exists to catch ordinary Czech words
# missing from our finite static sources without making the generation lexicon more permissive.
# A slightly higher threshold is used for words without Czech diacritics because cross-language
# noise is materially higher there.
WORDFREQ_ZIPF_THRESHOLD_DIACRITIC = 2.45
WORDFREQ_ZIPF_THRESHOLD_PLAIN = 2.85

WORD_DISCOVERY_REWARD_PREFIX = "word_discovery_v1:"
WORD_DISCOVERY_XP = 1
WORD_DISCOVERY_BOARD_XP_LIMIT = 5
WORD_DISCOVERY_DAILY_XP_LIMIT = 20
RECOGNITION_VERSION = 4

_CZECH_WORD = re.compile(r"^[a-záčďéěíňóřšťúůýž]+$", re.IGNORECASE)
_CZECH_DIACRITICS = frozenset("áčďéěíňóřšťúůýž")


class WordDiscoveryClaim(BaseModel):
    puzzle_id: str = Field(min_length=2, max_length=80)
    mode: str = Field(min_length=4, max_length=10)
    difficulty: str = Field(min_length=3, max_length=20)
    word: str = Field(min_length=4, max_length=24)
    path: list[int] = Field(default_factory=list)
    daily_date: Optional[str] = Field(default=None, max_length=10)


def _normalize(value: str) -> str:
    return unicodedata.normalize("NFC", str(value or "").strip()).casefold()


def _acceptable(value: str) -> bool:
    return 4 <= len(value) <= 24 and bool(_CZECH_WORD.fullmatch(value))


def _discovery_reward_key(puzzle_id: str, word: str) -> str:
    return f"{WORD_DISCOVERY_REWARD_PREFIX}{str(puzzle_id).strip()}:{_normalize(word)}"


def _discovery_rows(rows: list[dict]) -> list[dict]:
    return [
        row for row in rows
        if str(row.get("reward_key") or "").startswith(WORD_DISCOVERY_REWARD_PREFIX)
    ]


def _discovery_metadata(row: dict) -> tuple[str, str]:
    """Return puzzle id and canonical word for old and structured reward rows."""
    puzzle_id = str(row.get("puzzle_id") or "").strip()
    word = _normalize(row.get("reward_word") or "")
    if puzzle_id and word:
        return puzzle_id, word
    key = str(row.get("reward_key") or "")
    if not key.startswith(WORD_DISCOVERY_REWARD_PREFIX):
        return "", ""
    payload = key[len(WORD_DISCOVERY_REWARD_PREFIX):]
    parsed_puzzle, separator, parsed_word = payload.rpartition(":")
    return (parsed_puzzle.strip(), _normalize(parsed_word)) if separator else ("", "")


def _reward_day(row: dict, tz) -> Optional[str]:
    raw = str(row.get("granted_at") or "").strip()
    if not raw:
        return None
    try:
        stamp = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if tz:
            stamp = stamp.astimezone(tz)
        return stamp.date().isoformat()
    except (TypeError, ValueError):
        return raw[:10] or None


def _discovery_summary(rows: list[dict], *, puzzle_id: str = "", today: str = "", tz=None) -> dict:
    discovery = _discovery_rows(rows)
    total_xp = sum(max(0, int(row.get("points") or 0)) for row in discovery)
    words = {word for row in discovery for _puzzle, word in [_discovery_metadata(row)] if word}
    board_xp = sum(
        max(0, int(row.get("points") or 0))
        for row in discovery
        if puzzle_id and _discovery_metadata(row)[0] == puzzle_id
    )
    daily_xp = sum(
        max(0, int(row.get("points") or 0))
        for row in discovery
        if today and _reward_day(row, tz) == today
    )
    return {
        "totalDiscoveryXp": total_xp,
        "discoveredWords": len(words),
        "boardDiscoveryXp": board_xp,
        "dailyDiscoveryXp": daily_xp,
        "boardRemainingXp": max(0, WORD_DISCOVERY_BOARD_XP_LIMIT - board_xp),
        "dailyRemainingXp": max(0, WORD_DISCOVERY_DAILY_XP_LIMIT - daily_xp),
    }


def _valid_discovery_trace(puzzle: dict, word: str, path: list[int]) -> bool:
    """Server-side proof that the claimed word was genuinely traceable on this board.

    A discovery is deliberately *not* a solution word. Paths are orthogonal, unique-cell,
    active-mask paths exactly like the client gesture model.
    """
    normalized = _normalize(word)
    if not _acceptable(normalized) or not isinstance(path, list) or len(path) != len(normalized):
        return False
    if len(path) < 4 or len(set(path)) != len(path):
        return False
    if any(isinstance(index, bool) or not isinstance(index, int) for index in path):
        return False

    try:
        rows = int(puzzle.get("rows") or 0)
        cols = int(puzzle.get("cols") or 0)
        mask = {int(index) for index in (puzzle.get("mask") or [])}
        letters = list(puzzle.get("letters") or [])
    except (TypeError, ValueError):
        return False
    if rows <= 0 or cols <= 0 or not mask or not letters:
        return False
    if any(index < 0 or index >= len(letters) or index not in mask for index in path):
        return False

    target_words = {
        _normalize(answer.get("word"))
        for answer in (puzzle.get("answers") or [])
        if answer.get("word")
    }
    if normalized in target_words:
        return False

    traced = _normalize("".join(str(letters[index] or "") for index in path))
    if traced != normalized:
        return False

    for left, right in zip(path, path[1:]):
        lr, lc = divmod(left, cols)
        rr, rc = divmod(right, cols)
        if abs(lr - rr) + abs(lc - rc) != 1:
            return False
    return True


@lru_cache(maxsize=1)
def _recognition_index() -> dict[str, str]:
    """Broad static recognition-only lexicon.

    Generation remains governed by Lexicon V2. Recognition intentionally uses a wider union:
    - existing permissive gameplay word list (good offline/colloquial coverage),
    - the browser's offline recognition seed,
    - approved Lexicon V2 targets,
    - lowercase Czech Wikidata lemmas (CC0 evidence),
    - a tiny editorial overlay for verified player reports.

    A word being present here means only "we can acknowledge this as a word", never "use it as
    a generated Proplet answer".
    """
    out: dict[str, str] = {}

    static_sources = (
        (DATA / "words.txt", "gameplay"),
        (ROOT / "public" / "valid-words-v3328.txt", "offline_seed"),
    )
    for words_path, source in static_sources:
        if not words_path.exists():
            continue
        for raw in words_path.read_text(encoding="utf-8").splitlines():
            word = _normalize(raw)
            if _acceptable(word):
                out.setdefault(word, source)

    lexicon_path = DATA / "lexicon_v2.json"
    if lexicon_path.exists():
        try:
            payload = json.loads(lexicon_path.read_text(encoding="utf-8"))
            for row in payload.get("entries", []):
                word = _normalize(row.get("word"))
                if _acceptable(word):
                    out[word] = "lexicon_v2"
        except (OSError, ValueError, TypeError):
            pass

    wikidata_path = DATA / "lexicon_v2_wikidata_raw.json"
    if wikidata_path.exists():
        try:
            payload = json.loads(wikidata_path.read_text(encoding="utf-8"))
            for row in payload.get("entries", []):
                raw = str(row.get("lemma") or "").strip()
                # Proper names and mixed-case forms are too risky for automatic acknowledgement.
                if not raw or raw != raw.lower():
                    continue
                word = _normalize(raw)
                if _acceptable(word):
                    out.setdefault(word, "wikidata_lemma")
        except (OSError, ValueError, TypeError):
            pass

    for raw in RECOGNITION_OVERLAY:
        word = _normalize(raw)
        if _acceptable(word):
            out[word] = "editorial_overlay"

    return out


@lru_cache(maxsize=1)
def _wordfreq_zipf() -> Optional[Callable[[str, str], float]]:
    """Lazy-load wordfreq so ordinary app requests do not pay its import cost."""
    try:
        from wordfreq import zipf_frequency

        return zipf_frequency
    except Exception:
        return None


def _wordfreq_source(word: str) -> Optional[str]:
    lookup = _wordfreq_zipf()
    if lookup is None:
        return None
    try:
        score = float(lookup(word, "cs"))
    except Exception:
        return None
    threshold = (
        WORDFREQ_ZIPF_THRESHOLD_DIACRITIC
        if any(ch in _CZECH_DIACRITICS for ch in word)
        else WORDFREQ_ZIPF_THRESHOLD_PLAIN
    )
    return "wordfreq_cs" if score >= threshold else None


def _recognize_source(word: str) -> Optional[str]:
    source = _recognition_index().get(word)
    if source is not None:
        return source
    return _wordfreq_source(word)


def install_word_recognition(
    app,
    *,
    enforce_rate_limit=None,
    db_select=None,
    db_insert=None,
    db_rpc=None,
    auth_player=None,
    tz=None,
    resolved_puzzle=None,
    puzzle_exists=None,
    daily_puzzle_matches_date=None,
    vercel_env: str = "",
    **_kwargs,
):
    def require_discovery_dependencies() -> None:
        if not all(callable(fn) for fn in (db_select, auth_player, resolved_puzzle, puzzle_exists)):
            raise HTTPException(503, "Odměny za objevená slova ještě nejsou připravené")

    def reward_state(player_id: str) -> tuple[list[dict], set[str]]:
        rows = _discovery_rows(db_select("account_rewards", player_id=player_id))
        keys = {str(row.get("reward_key") or "") for row in rows if row.get("reward_key")}
        return rows, keys

    def response_state(player_id: str, *, puzzle_id: str = "", extra_row: Optional[dict] = None) -> dict:
        rows, keys = reward_state(player_id)
        if extra_row:
            rows = [*rows, extra_row]
            keys.add(str(extra_row.get("reward_key") or ""))
        now = datetime.now(tz) if tz else datetime.now().astimezone()
        return {
            "rewardKeys": sorted(keys),
            "xpPerWord": WORD_DISCOVERY_XP,
            "boardXpLimit": WORD_DISCOVERY_BOARD_XP_LIMIT,
            "dailyXpLimit": WORD_DISCOVERY_DAILY_XP_LIMIT,
            **_discovery_summary(rows, puzzle_id=puzzle_id, today=now.date().isoformat(), tz=tz),
        }

    @app.get("/api/word-recognition")
    def word_recognition(
        request: Request,
        word: str = Query(min_length=4, max_length=24),
    ):
        if callable(enforce_rate_limit):
            enforce_rate_limit(request, "word_recognition", limit=900, window_seconds=3600)
        normalized = _normalize(word)
        if not _acceptable(normalized):
            return {"recognized": False, "word": normalized.upper(), "source": None}
        source = _recognize_source(normalized)
        return {
            "recognized": source is not None,
            "word": normalized.upper(),
            "source": source,
            "recognitionOnly": True,
        }

    @app.get("/api/word-recognition/status")
    def word_recognition_status(request: Request):
        if callable(enforce_rate_limit):
            enforce_rate_limit(request, "word_recognition_status", limit=120, window_seconds=3600)
        index = _recognition_index()
        regression_words = (
            "bruska",
            "pnutí",
            "padnutí",
            "hrubka",
            "tlupa",
            "pult",
        )
        return {
            "ok": True,
            "version": RECOGNITION_VERSION,
            "staticEntries": len(index),
            "discoveryXp": True,
            "frequencyFallback": {
                "enabled": _wordfreq_zipf() is not None,
                "language": "cs",
                "zipfThresholdDiacritic": WORDFREQ_ZIPF_THRESHOLD_DIACRITIC,
                "zipfThresholdPlain": WORDFREQ_ZIPF_THRESHOLD_PLAIN,
            },
            "reportedRegressionWords": {
                word.upper(): _recognize_source(word) is not None for word in regression_words
            },
        }

    @app.get("/api/word-discovery/status")
    def word_discovery_status(
        request: Request,
        authorization: Optional[str] = Header(default=None),
    ):
        require_discovery_dependencies()
        if callable(enforce_rate_limit):
            enforce_rate_limit(request, "word_discovery_status", limit=180, window_seconds=3600)
        player = auth_player(authorization)
        return {"ok": True, **response_state(player["id"])}

    @app.post("/api/word-discovery/claim")
    def word_discovery_claim(
        payload: WordDiscoveryClaim,
        request: Request,
        authorization: Optional[str] = Header(default=None),
    ):
        require_discovery_dependencies()
        if callable(enforce_rate_limit):
            enforce_rate_limit(request, "word_discovery_claim", limit=600, window_seconds=3600)

        player = auth_player(authorization)
        normalized = _normalize(payload.word)
        source = _recognize_source(normalized) if _acceptable(normalized) else None
        if source is None:
            raise HTTPException(400, "Slovo není v recognition lexikonu")
        if payload.mode not in ("daily", "free"):
            raise HTTPException(400, "Odměna platí jen v běžné hře")

        if not puzzle_exists(payload.puzzle_id, payload.mode, payload.difficulty):
            raise HTTPException(400, "Neznámá nebo nevydaná úloha")
        if payload.mode == "daily":
            if not payload.daily_date or not callable(daily_puzzle_matches_date):
                raise HTTPException(400, "Daily odměna nemá platné datum")
            if not daily_puzzle_matches_date(payload.puzzle_id, payload.daily_date):
                raise HTTPException(400, "Tato úloha nepatří k uvedenému dni")

        puzzle = resolved_puzzle(payload.puzzle_id, payload.mode, payload.difficulty)
        if not puzzle or not _valid_discovery_trace(puzzle, normalized, payload.path):
            raise HTTPException(400, "Slovo neodpovídá platné vedlejší cestě této desky")

        reward_key = _discovery_reward_key(payload.puzzle_id, normalized)
        _rows, existing_keys = reward_state(player["id"])
        if reward_key in existing_keys:
            return {
                "ok": True,
                "recognized": True,
                "source": source,
                "newlyGranted": False,
                "awardedPoints": 0,
                "rewardKey": reward_key,
                "limitReason": "duplicate",
                **response_state(player["id"], puzzle_id=payload.puzzle_id),
            }

        now = datetime.now(tz) if tz else datetime.now().astimezone()
        usage = _discovery_summary(
            _rows,
            puzzle_id=payload.puzzle_id,
            today=now.date().isoformat(),
            tz=tz,
        )
        limit_reason = None
        if usage["boardDiscoveryXp"] >= WORD_DISCOVERY_BOARD_XP_LIMIT:
            limit_reason = "board_limit"
        elif usage["dailyDiscoveryXp"] >= WORD_DISCOVERY_DAILY_XP_LIMIT:
            limit_reason = "daily_limit"
        if limit_reason:
            return {
                "ok": True,
                "recognized": True,
                "source": source,
                "newlyGranted": False,
                "awardedPoints": 0,
                "rewardKey": reward_key,
                "limitReason": limit_reason,
                **response_state(player["id"], puzzle_id=payload.puzzle_id),
            }

        # Preview deployments share the production database. QA may exercise the complete UX,
        # but never writes reward rows. The dedicated Mozkomor calibration client disables XP
        # altogether, so this simulation is only for normal preview regression testing.
        if str(vercel_env or "").strip().lower() == "preview":
            simulated_row = {
                "reward_key": reward_key,
                "points": WORD_DISCOVERY_XP,
                "granted_at": now.isoformat(),
                "puzzle_id": payload.puzzle_id,
                "reward_word": normalized,
            }
            return {
                "ok": True,
                "recognized": True,
                "source": source,
                "newlyGranted": True,
                "awardedPoints": WORD_DISCOVERY_XP,
                "rewardKey": reward_key,
                "simulated": True,
                "limitReason": None,
                **response_state(player["id"], puzzle_id=payload.puzzle_id, extra_row=simulated_row),
            }

        if not callable(db_rpc):
            raise HTTPException(503, "Odměnu teď nelze bezpečně potvrdit")
        result = db_rpc(
            "proplet_claim_word_discovery",
            {
                "p_player_id": player["id"],
                "p_puzzle_id": payload.puzzle_id,
                "p_word": normalized,
            },
        )
        canonical = result[0] if isinstance(result, list) and result else (result or {})
        reason = str(canonical.get("reason") or "") or None
        return {
            "ok": True,
            "recognized": True,
            "source": source,
            "newlyGranted": bool(canonical.get("newly_granted")),
            "awardedPoints": int(canonical.get("awarded_points") or 0),
            "rewardKey": str(canonical.get("reward_key") or reward_key),
            "limitReason": reason,
            **response_state(player["id"], puzzle_id=payload.puzzle_id),
        }
