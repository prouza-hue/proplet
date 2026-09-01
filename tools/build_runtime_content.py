#!/usr/bin/env python3
"""Build or verify public runtime content from the declared canonical source.

The command never writes unless the caller supplies ``--output``.  ``--check``
is read-only and compares the in-memory build with the committed public output.
"""
from __future__ import annotations

import argparse
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from proplet_content.io import atomic_write_bytes, load_manifest, read_record_bytes, sha256_bytes
from proplet_content.models import ManifestFormatError
from proplet_content.validator import build_public_runtime_bytes, format_issues, validate_manifest


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--manifest",
        type=Path,
        default=ROOT / "content" / "generation-manifest.json",
    )
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--check", action="store_true", help="Verify the committed output without writing.")
    action.add_argument("--output", type=Path, help="Write the verified build to this explicit path atomically.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        manifest = load_manifest(args.manifest)
    except (OSError, ManifestFormatError) as exc:
        print(f"Manifest rejected: {exc}", file=sys.stderr)
        return 1
    # Sprint 14 only copies bytes that have already been proven identical to the
    # checked-in released output.  A write must therefore fail closed on output
    # drift just like --check; it is not a repair or release-creation command.
    issues = validate_manifest(ROOT, manifest, verify_outputs=True)
    if issues:
        print(format_issues(issues), file=sys.stderr)
        return 1
    try:
        built = build_public_runtime_bytes(ROOT, manifest)
        committed = read_record_bytes(ROOT, manifest.canonical_build.output)
    except (OSError, ValueError) as exc:
        print(f"Content build rejected: {exc}", file=sys.stderr)
        return 1
    if built != committed:
        print("Built runtime bytes differ from the committed output", file=sys.stderr)
        return 1
    if not args.check:
        try:
            atomic_write_bytes(args.output, built)
        except OSError as exc:
            print(f"Content output failed: {exc}", file=sys.stderr)
            return 1
    print(f"{sha256_bytes(built)}  {len(built)} bytes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
