#!/usr/bin/env python3
"""Build the exact, offline Czech bonus-recognition automaton (stdlib only).

This recognition dictionary is deliberately separate from the curated board-
generation lexicon. Its vendored source and this generated derivative are GPL-2.0.
See content/recognition/README.md for provenance, policy and binary format.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import struct
import unicodedata
import io
import zipfile
from dataclasses import dataclass

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "content/recognition/hunspell-cs"
ALPHABET = "aábcčdďeéěfghiíjklmnňoó pqrřsštťuúůvwxyýzž".replace(" ", "")
VALID = re.compile(r"[" + ALPHABET + r"]{4,24}\Z")
MAGIC = b"PRLX0001"


@dataclass(frozen=True)
class Rule:
    kind: str
    flag: str
    strip: str
    add: str
    continuation: str
    condition: re.Pattern
    cross: bool

    def apply(self, word):
        if not self.condition.search(word):
            return None
        if self.kind == "PFX":
            if not word.startswith(self.strip):
                return None
            return self.add + word[len(self.strip):]
        if not word.endswith(self.strip):
            return None
        return word[:len(word) - len(self.strip)] + self.add if self.strip else word + self.add


def read_affixes(path):
    rules = {"PFX": {}, "SFX": {}}
    declared = {}
    forbidden = None
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        parts = line.split("#", 1)[0].split()
        if not parts:
            continue
        kind = parts[0]
        if kind == "FORBIDDENWORD":
            forbidden = parts[1]
        if kind not in rules:
            if kind not in {"SET", "TRY", "KEY", "MAP", "REP", "FORBIDDENWORD", "NOSUGGEST"}:
                raise ValueError(f"Unsupported Hunspell directive at {number}: {kind}")
            continue
        if len(parts) == 4 and parts[2] in {"Y", "N"}:
            flag, cross, count = parts[1:]
            if flag in rules[kind]:
                raise ValueError(f"Duplicate affix class at {number}")
            rules[kind][flag] = []
            declared[kind, flag] = bool(cross == "Y"), int(count)
            continue
        if len(parts) != 5:
            raise ValueError(f"Unexpected affix rule at {number}: {line}")
        _, flag, strip, addition, condition = parts
        add, _, continuation = addition.partition("/")
        anchor = "^(?:" + condition + ")" if kind == "PFX" else "(?:" + condition + ")$"
        rule = Rule(kind, flag, "" if strip == "0" else strip,
                    "" if add == "0" else add, continuation,
                    re.compile(anchor), declared[kind, flag][0])
        rules[kind][flag].append(rule)
    for key, (_, count) in declared.items():
        if len(rules[key[0]][key[1]]) != count:
            raise ValueError(f"Incomplete affix class {key}")
    return rules, forbidden


def expand(stem, flags, rules):
    """Hunspell's one-prefix/two-suffix grammar, with explicit continuations.

    This pinned affix file has no COMPLEXPREFIXES, NEEDAFFIX, compound rules or
    non-character flags. Prefix availability may come from a suffix continuation.
    A second suffix requires an explicit continuation on the first suffix.
    """
    yield stem
    suffix_forms = [(stem, flags, True)]
    for flag in flags:
        for first in rules["SFX"].get(flag, ()):
            form = first.apply(stem)
            if form is None:
                continue
            yield form
            suffix_forms.append((form, flags + first.continuation, first.cross))
            for continuation in first.continuation:
                for second in rules["SFX"].get(continuation, ()):
                    final = second.apply(form)
                    if final is not None:
                        yield final
                        suffix_forms.append((final, flags + first.continuation,
                                             first.cross and second.cross))
    for form, available, cross in suffix_forms:
        if not cross:
            continue
        for flag in set(available):
            for prefix in rules["PFX"].get(flag, ()):
                if not prefix.cross and form != stem:
                    continue
                prefixed = prefix.apply(form)
                if prefixed is not None:
                    yield prefixed


def collect_forms(source):
    rules, forbidden_flag = read_affixes(source / "cs_CZ.aff")
    lines = (source / "cs_CZ.dic").read_text(encoding="utf-8").splitlines()
    if int(lines[0]) != len(lines) - 1:
        raise ValueError("Dictionary entry count does not match its header")
    words, forbidden = set(), set()
    included_roots = 0
    for line in lines[1:]:
        token = line.split()[0]
        stem, _, flags = token.partition("/")
        # Do not lowercase proper names into acceptable common words.
        if stem != stem.lower() or not stem.islower() or not all(c in ALPHABET for c in stem):
            continue
        if stem != unicodedata.normalize("NFC", stem):
            raise ValueError("Unexpected decomposed source spelling")
        destination = forbidden if forbidden_flag and forbidden_flag in flags else words
        included_roots += destination is words
        destination.update(form for form in expand(stem, flags, rules) if VALID.fullmatch(form))
    words.difference_update(forbidden)
    return words, {"sourceEntries": len(lines) - 1, "includedLowercaseRoots": included_roots,
                   "forbiddenForms": len(forbidden)}


class Node:
    __slots__ = ("accept", "edges")
    def __init__(self):
        self.accept = False
        self.edges = {}


def encode_dawg(words):
    """Incrementally minimize sorted trie suffixes; never use probabilistic hits."""
    registry, nodes, unchecked = {}, [], []
    root, previous = Node(), ""

    def minimize(common):
        while len(unchecked) > common:
            parent, letter, child = unchecked.pop()
            key = child.accept, tuple(child.edges.items())
            node_id = registry.get(key)
            if node_id is None:
                node_id = len(nodes)
                registry[key] = node_id
                nodes.append(key)
            parent.edges[letter] = node_id

    for word in sorted(words):
        common = 0
        for left, right in zip(word, previous):
            if left != right:
                break
            common += 1
        minimize(common)
        node = unchecked[-1][2] if unchecked else root
        for letter in word[common:]:
            child = Node()
            node.edges[letter] = child
            unchecked.append((node, letter, child))
            node = child
        node.accept = True
        previous = word
    minimize(0)
    root_id = len(nodes)
    nodes.append((root.accept, tuple(root.edges.items())))
    edges = sum(len(row[1]) for row in nodes)
    if len(ALPHABET) > 64 or len(nodes) >= (1 << 26) or edges >= (1 << 31):
        raise ValueError("Automaton exceeds binary format bounds")
    output = bytearray(MAGIC)
    output.extend(struct.pack("<5I", len(nodes), edges, root_id, len(words), len(ALPHABET)))
    output.extend(ALPHABET.encode("utf-16-le"))
    offset = 0
    for accept, children in nodes:
        output.extend(struct.pack("<I", offset | (0x80000000 if accept else 0)))
        offset += len(children)
    output.extend(struct.pack("<I", offset))
    letters = {letter: index for index, letter in enumerate(ALPHABET)}
    for _, children in nodes:
        for letter, target in sorted(children, key=lambda edge: letters[edge[0]]):
            output.extend(struct.pack("<I", (target << 6) | letters[letter]))
    return bytes(output), {"nodes": len(nodes), "edges": edges, "words": len(words)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Fail if committed artifacts differ")
    args = parser.parse_args()
    provenance = json.loads((SOURCE / "source.json").read_text())
    for name, digest in provenance["sha256"].items():
        if hashlib.sha256((SOURCE / name).read_bytes()).hexdigest() != digest:
            raise ValueError(f"Source checksum mismatch: {name}")
    words, counts = collect_forms(SOURCE)
    binary, shape = encode_dawg(words)
    manifest = {"version": "bonus-cs-v1", "format": "PRLX0001", "license": "GPL-2.0",
                "sourceCommit": provenance["commit"], "minimumLength": 4, "maximumLength": 24,
                "alphabet": ALPHABET, **counts, **shape, "bytes": len(binary),
                "sha256": hashlib.sha256(binary).hexdigest()}
    content = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode()
    for directory in (ROOT / "data/recognition", ROOT / "public/recognition"):
        for name, payload in (("bonus-cs-v1.dawg", binary), ("manifest.json", content)):
            path = directory / name
            if args.check:
                if not path.exists() or path.read_bytes() != payload:
                    raise ValueError(f"Generated artifact is stale: {path}")
            else:
                directory.mkdir(parents=True, exist_ok=True)
                path.write_bytes(payload)
    # GPL corresponding source is available from the same public download site,
    # including the exact transformation, rather than a private-repository link.
    source_archive = io.BytesIO()
    with zipfile.ZipFile(source_archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        paths = [*sorted(SOURCE.iterdir()), ROOT / "content/recognition/README.md", Path(__file__).resolve()]
        for path in paths:
            if not path.is_file():
                continue
            info = zipfile.ZipInfo(str(path.relative_to(ROOT)), date_time=(2026, 10, 18, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, path.read_bytes(), compresslevel=9)
    archive_path = ROOT / "public/recognition/bonus-cs-v1-source.zip"
    if args.check:
        if not archive_path.exists() or archive_path.read_bytes() != source_archive.getvalue():
            raise ValueError("Generated corresponding-source archive is stale")
    else:
        archive_path.write_bytes(source_archive.getvalue())
    print(json.dumps(manifest, ensure_ascii=False))


if __name__ == "__main__":
    main()
