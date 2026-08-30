#!/usr/bin/env python3
"""Validate the repository's static Supabase migration lineage manifest.

This module deliberately performs filesystem-only checks.  It never imports a
Supabase client and never connects to, changes, or executes a database.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ALLOWED_TYPES = {"setup", "migration", "hotfix", "verify", "seed", "archive"}
SQL_PATTERN = "SUPABASE_*.sql"


@dataclass(frozen=True)
class ManifestError:
    code: str
    message: str


def _error(errors: list[ManifestError], code: str, message: str) -> None:
    errors.append(ManifestError(code, message))


def _safe_path(root: Path, relative: Any) -> Path | None:
    if not isinstance(relative, str) or not relative:
        return None
    candidate = (root / relative).resolve()
    try:
        candidate.relative_to(root.resolve())
    except ValueError:
        return None
    return candidate


def _entry_orders(entries: list[Any]) -> dict[str, int]:
    """Collect unambiguous IDs and orders for lineage checks."""
    orders: dict[str, int] = {}
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        ident, order = entry.get("id"), entry.get("order")
        if isinstance(ident, str) and isinstance(order, int) and not isinstance(order, bool):
            orders.setdefault(ident, order)
    return orders


def validate_read_only_sql(sql: str) -> list[ManifestError]:
    """Reject every statement whose first keyword is not ``SELECT``.

    This is intentionally a conservative lexical guard for the checked-in
    verification definitions. It is not a SQL parser and never executes SQL.
    """
    without_comments = re.sub(r"/\*.*?\*/", "", sql, flags=re.DOTALL)
    without_comments = re.sub(r"--[^\n]*", "", without_comments)
    errors: list[ManifestError] = []
    for index, statement in enumerate(without_comments.split(";"), start=1):
        compact = statement.strip()
        if not compact:
            continue
        match = re.match(r"([A-Za-z]+)", compact)
        keyword = match.group(1).lower() if match else "<none>"
        if keyword != "select":
            errors.append(ManifestError("non_read_only_statement", f"statement {index} starts with {keyword!r}"))
    return errors


def validate_manifest(manifest: dict[str, Any], root: Path) -> list[ManifestError]:
    """Return deterministic validation errors for *manifest* and its SQL root."""

    errors: list[ManifestError] = []
    if not isinstance(manifest, dict):
        return [ManifestError("invalid_manifest", "manifest must be an object")]
    if manifest.get("schema_version") != 1:
        _error(errors, "invalid_schema_version", "schema_version must be 1")

    entries = manifest.get("files")
    if not isinstance(entries, list):
        return errors + [ManifestError("invalid_files", "files must be a list")]

    seen_ids: dict[str, int] = {}
    seen_orders: dict[Any, int] = {}
    seen_paths: dict[str, int] = {}
    listed_paths: set[str] = set()
    previous_order: int | None = None
    ids = {
        entry.get("id")
        for entry in entries
        if isinstance(entry, dict) and isinstance(entry.get("id"), str)
    }
    entry_orders = _entry_orders(entries)

    for index, entry in enumerate(entries):
        if not isinstance(entry, dict):
            _error(errors, "invalid_entry", f"files[{index}] must be an object")
            continue
        ident = entry.get("id")
        order = entry.get("order")
        relative = entry.get("path")
        if not isinstance(ident, str) or not ident:
            _error(errors, "invalid_id", f"files[{index}].id must be a non-empty string")
        elif ident in seen_ids:
            _error(errors, "duplicate_id", f"id {ident!r} repeats files[{seen_ids[ident]}]")
        else:
            seen_ids[ident] = index
        if isinstance(order, (int, str, float)) and not isinstance(order, bool) and order in seen_orders:
            _error(errors, "duplicate_order", f"order {order!r} repeats files[{seen_orders[order]}]")
        elif isinstance(order, (int, str, float)) and not isinstance(order, bool):
            seen_orders[order] = index
        if not isinstance(relative, str) or not relative:
            _error(errors, "invalid_path", f"files[{index}].path must be a non-empty string")
        elif relative in seen_paths:
            _error(errors, "duplicate_path", f"path {relative!r} repeats files[{seen_paths[relative]}]")
        else:
            seen_paths[relative] = index
            listed_paths.add(relative)

        if not isinstance(order, int) or isinstance(order, bool):
            _error(errors, "invalid_order", f"files[{index}].order must be an integer")
        elif previous_order is not None and order <= previous_order:
            _error(errors, "ambiguous_order", f"order {order} at files[{index}] is not after {previous_order}")
        else:
            previous_order = order

        if not isinstance(entry.get("type"), str) or entry.get("type") not in ALLOWED_TYPES:
            _error(errors, "invalid_type", f"files[{index}].type is not supported")

        path = _safe_path(root, relative)
        if path is None or not path.is_file():
            _error(errors, "missing_file", f"files[{index}].path does not identify a file: {relative!r}")
        else:
            expected = entry.get("sha256")
            actual = hashlib.sha256(path.read_bytes()).hexdigest()
            if not isinstance(expected, str) or expected.lower() != actual:
                _error(errors, "checksum_mismatch", f"checksum differs for {relative}")

        supersedes = entry.get("supersedes", [])
        if not isinstance(supersedes, list):
            _error(errors, "invalid_supersedes", f"files[{index}].supersedes must be a list")
        else:
            for predecessor in supersedes:
                if not isinstance(predecessor, str) or predecessor not in ids:
                    _error(errors, "unknown_supersedes", f"{ident!r} supersedes unknown id {predecessor!r}")
                elif predecessor not in entry_orders or not isinstance(order, int) or isinstance(order, bool) or entry_orders[predecessor] >= order:
                    _error(errors, "invalid_supersedes_order", f"{ident!r} must supersede an earlier entry: {predecessor!r}")
        replaced = entry.get("replaced_rpc_definitions", [])
        if not isinstance(replaced, list) or any(not isinstance(item, str) for item in replaced):
            _error(errors, "invalid_rpc_definitions", f"files[{index}].replaced_rpc_definitions must be string list")

    # Inventory is intentionally limited to the versioned SQL convention at
    # repository root.  Verification definitions under supabase/ are not
    # executable migration files and therefore are not part of this inventory.
    actual_paths = {path.name for path in root.glob(SQL_PATTERN) if path.is_file()}
    for relative in sorted(actual_paths - listed_paths):
        _error(errors, "unlisted_file", f"repository SQL file is absent from manifest: {relative}")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--manifest", type=Path, default=None)
    args = parser.parse_args()
    root = args.root.resolve()
    manifest_path = (args.manifest or root / "supabase/migrations/manifest.json").resolve()
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"FAIL: cannot read manifest: {exc}")
        return 2
    errors = validate_manifest(manifest, root)
    verification_path = root / "supabase/schema-verification.sql"
    if not verification_path.is_file():
        errors.append(ManifestError("missing_verification", "supabase/schema-verification.sql is missing"))
    else:
        errors.extend(validate_read_only_sql(verification_path.read_text(encoding="utf-8")))
    if errors:
        for item in errors:
            print(f"FAIL [{item.code}]: {item.message}")
        return 1
    print(f"PASS: migration manifest validated ({len(manifest['files'])} SQL entries; filesystem only)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
