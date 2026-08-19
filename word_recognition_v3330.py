from __future__ import annotations

import json
import re
import unicodedata
from functools import lru_cache
from pathlib import Path
from typing import Optional

from fastapi import HTTPException, Query, Request

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

_CZECH_WORD = re.compile(r"^[a-záčďéěíňóřšťúůýž]+$", re.IGNORECASE)


def _normalize(value: str) -> str:
    return unicodedata.normalize("NFC", str(value or "").strip()).casefold()


def _acceptable(value: str) -> bool:
    return 4 <= len(value) <= 24 and bool(_CZECH_WORD.fullmatch(value))


@lru_cache(maxsize=1)
def _recognition_index() -> dict[str, str]:
    """Broad recognition-only lexicon.

    Generation remains governed by Lexicon V2. Recognition intentionally uses a wider union:
    - existing permissive gameplay word list (good offline/colloquial coverage),
    - approved Lexicon V2 targets,
    - lowercase Czech Wikidata lemmas (CC0 evidence),
    - a tiny editorial overlay for verified player reports.

    A word being present here means only "we can acknowledge this as a word", never "use it as
    a generated Proplet answer".
    """
    out: dict[str, str] = {}

    words_path = DATA / "words.txt"
    if words_path.exists():
        for raw in words_path.read_text(encoding="utf-8").splitlines():
            word = _normalize(raw)
            if _acceptable(word):
                out.setdefault(word, "gameplay")

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


def install_word_recognition(app, *, enforce_rate_limit=None, **_kwargs):
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
        source: Optional[str] = _recognition_index().get(normalized)
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
        return {
            "ok": True,
            "version": 2,
            "entries": len(index),
            "reportedRegressionWords": {
                word.upper(): word in index
                for word in ("bruska", "pnutí", "padnutí", "hrubka")
            },
        }
