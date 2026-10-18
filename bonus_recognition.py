"""Exact offline Czech bonus-word membership, separate from board generation.

Data provenance and GPL source availability: content/recognition/README.md.
Loading or validation errors intentionally propagate; callers must not cache them
as a negative language judgment.
"""
from functools import lru_cache
import hashlib
import json
from pathlib import Path
import struct
import unicodedata

DATA = Path(__file__).resolve().parent / "data" / "recognition"


@lru_cache(maxsize=1)
def _metadata():
    return json.loads((DATA / "manifest.json").read_text(encoding="utf-8"))


def metadata():
    return dict(_metadata())


class BonusLexicon:
    def __init__(self, payload):
        if len(payload) < 28 or payload[:8] != b"PRLX0001":
            raise ValueError("Invalid bonus lexicon header")
        nodes, edges, root, words, alphabet_length = struct.unpack_from("<5I", payload, 8)
        if not nodes or root >= nodes or not 1 <= alphabet_length <= 64:
            raise ValueError("Invalid bonus lexicon dimensions")
        self.alphabet = payload[28:28 + alphabet_length * 2].decode("utf-16-le")
        if len(set(self.alphabet)) != alphabet_length:
            raise ValueError("Invalid bonus lexicon alphabet")
        self.letters = {letter: index for index, letter in enumerate(self.alphabet)}
        self.node_offset = 28 + alphabet_length * 2
        self.edge_offset = self.node_offset + (nodes + 1) * 4
        if len(payload) != self.edge_offset + edges * 4:
            raise ValueError("Invalid bonus lexicon byte length")
        self.payload, self.root, self.word_count = payload, root, words
        previous = 0
        for index in range(nodes + 1):
            offset = self.uint(self.node_offset + index * 4) & 0x7fffffff
            if not previous <= offset <= edges:
                raise ValueError("Invalid bonus lexicon node offsets")
            previous = offset
        if previous != edges:
            raise ValueError("Invalid bonus lexicon final offset")
        for index in range(edges):
            edge = self.uint(self.edge_offset + index * 4)
            if edge >> 6 >= nodes or edge & 63 >= alphabet_length:
                raise ValueError("Invalid bonus lexicon edge")

    def uint(self, offset):
        return struct.unpack_from("<I", self.payload, offset)[0]

    def has(self, word):
        if not isinstance(word, str):
            return False
        word = unicodedata.normalize("NFC", word).lower()
        if not 4 <= len(word) <= 24:
            return False
        node = self.root
        for letter in word:
            label = self.letters.get(letter)
            if label is None:
                return False
            low = self.uint(self.node_offset + node * 4) & 0x7fffffff
            high = (self.uint(self.node_offset + (node + 1) * 4) & 0x7fffffff) - 1
            while low <= high:
                middle = (low + high) // 2
                edge = self.uint(self.edge_offset + middle * 4)
                candidate = edge & 63
                if candidate < label:
                    low = middle + 1
                elif candidate > label:
                    high = middle - 1
                else:
                    node = edge >> 6
                    break
            else:
                return False
        return bool(self.uint(self.node_offset + node * 4) & 0x80000000)


@lru_cache(maxsize=1)
def load():
    manifest = _metadata()
    payload = (DATA / "bonus-cs-v1.dawg").read_bytes()
    if hashlib.sha256(payload).hexdigest() != manifest["sha256"]:
        raise ValueError("Bonus lexicon checksum mismatch")
    dictionary = BonusLexicon(payload)
    if len(payload) != manifest["bytes"] or dictionary.word_count != manifest["words"]:
        raise ValueError("Bonus lexicon manifest mismatch")
    return dictionary


def recognizes(word):
    return load().has(word)
