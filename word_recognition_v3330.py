from __future__ import annotations

import json
import re
import unicodedata
from functools import lru_cache
from pathlib import Path
from typing import Callable, Optional

from fastapi import Query, Request

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

_CZECH_WORD = re.compile(r"^[a-záčďéěíňóřšťúůýž]+$", re.IGNORECASE)
_CZECH_DIACRITICS = frozenset("áčďéěíňóřšťúůýž")


def _normalize(value: str) -> str:
    return unicodedata.normalize("NFC", str(value or "").strip()).casefold()


def _acceptable(value: str) -> bool:
    return 4 <= len(value) <= 24 and bool(_CZECH_WORD.fullmatch(value))


@lru_cache(maxsize=1)
def _recognition_index() -> dict[str, str]:
    """Broad static recognition-only lexicon.

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
            "version": 3,
            "staticEntries": len(index),
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
