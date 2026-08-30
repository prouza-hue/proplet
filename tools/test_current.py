#!/usr/bin/env python3
"""Run Proplet's small, explicit current runtime regression gate.

The repository intentionally contains historical release checks alongside the
current suite.  Only tests named by ``tests/current/manifest.json`` run here;
the manifest is the reviewable source of truth for that boundary.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
from typing import Any


DEFAULT_MANIFEST = Path(__file__).resolve().parents[1] / "tests/current/manifest.json"


def _files_for_globs(root: Path, patterns: list[str]) -> list[Path]:
    files: set[Path] = set()
    for pattern in patterns:
        files.update(path for path in root.glob(pattern) if path.is_file())
    return sorted(files)


def _relative(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def _run(command: list[str], root: Path, label: str, env: dict[str, str]) -> bool:
    started = time.monotonic()
    result = subprocess.run(command, cwd=root, env=env, text=True, capture_output=True)
    elapsed = time.monotonic() - started
    if result.returncode == 0:
        print(f"PASS {label} ({elapsed:.2f}s)")
        return True
    print(f"FAIL {label} (exit {result.returncode}, {elapsed:.2f}s)")
    output = (result.stdout + result.stderr).strip()
    if output:
        print(output)
    return False


def _validate_manifest(manifest: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if manifest.get("schema_version") != 1:
        errors.append("manifest schema_version must be 1")
    current = manifest.get("current")
    if not isinstance(current, dict) or not isinstance(current.get("tests"), list):
        return errors + ["manifest current.tests must be a list"]
    for index, test in enumerate(current["tests"]):
        if not isinstance(test, dict) or not isinstance(test.get("path"), str):
            errors.append(f"current.tests[{index}] must contain a path")
        elif test.get("runner") not in {"python", "node"}:
            errors.append(f"current.tests[{index}] runner must be python or node")
    return errors


def _syntax_checks(root: Path, manifest: dict[str, Any], env: dict[str, str]) -> tuple[int, int]:
    syntax = manifest.get("syntax", {})
    python_files = _files_for_globs(root, syntax.get("python_globs", []))
    node_files = _files_for_globs(root, syntax.get("javascript_globs", []))
    passed = failed = 0
    for path in python_files:
        command = [sys.executable, "-c", "import ast, pathlib, sys; ast.parse(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))", str(path)]
        if _run(command, root, f"python syntax {_relative(path, root)}", env):
            passed += 1
        else:
            failed += 1
    for path in node_files:
        if _run(["node", "--check", str(path)], root, f"node syntax {_relative(path, root)}", env):
            passed += 1
        else:
            failed += 1
    print(f"Syntax: {passed} PASS / {failed} FAIL")
    return passed, failed


def _asset_checks(root: Path, manifest: dict[str, Any]) -> tuple[int, int]:
    assets = manifest.get("assets", {})
    required = assets.get("required", [])
    passed = failed = 0
    for relative in required:
        if not isinstance(relative, str) or not relative or Path(relative).is_absolute():
            print(f"FAIL asset manifest entry: {relative!r}")
            failed += 1
            continue
        path = root / relative
        if path.is_file():
            print(f"PASS asset {relative}")
            passed += 1
        else:
            print(f"FAIL asset missing {relative}")
            failed += 1
    # Check local, extension-bearing URLs in the small set of production
    # bootstrap files as well. API routes and Vercel's virtual endpoints are
    # intentionally not filesystem assets.
    references = assets.get("reference_files", [])
    for relative in references:
        if not isinstance(relative, str) or not (root / relative).is_file():
            print(f"FAIL asset reference file missing {relative}")
            failed += 1
    reference_paths = sorted({
        match
        for relative in references
        if isinstance(relative, str)
        for path in [root / relative]
        if path.is_file()
        for match in re.findall(r"[\"'](/[^\"'#?\s]+)", path.read_text(encoding="utf-8"))
        if not match.startswith(("/api/", "/_vercel/"))
        and match != "/"
        and Path(match).suffix.lower() in {".css", ".html", ".ico", ".js", ".json", ".png", ".svg", ".txt", ".webmanifest"}
    })
    reference_passed = reference_failed = 0
    for reference in reference_paths:
        path = root / "public" / reference.lstrip("/")
        if path.is_file():
            print(f"PASS asset reference {reference}")
            reference_passed += 1
        else:
            print(f"FAIL asset reference missing {reference}")
            reference_failed += 1
    passed += reference_passed
    failed += reference_failed
    print(f"Assets: {passed} PASS / {failed} FAIL ({len(reference_paths)} local references checked)")
    return passed, failed


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    args = parser.parse_args(argv)
    manifest_path = args.manifest.resolve()
    root = manifest_path.parents[2]
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"FAIL manifest {manifest_path}: {exc}")
        return 2
    if not isinstance(manifest, dict):
        print("FAIL manifest must contain a JSON object")
        return 2
    errors = _validate_manifest(manifest)
    if errors:
        for error in errors:
            print(f"FAIL manifest: {error}")
        return 2

    env = os.environ.copy()
    env["PYTHONPATH"] = os.pathsep.join(filter(None, [str(root), env.get("PYTHONPATH", "")]))
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    # Current tests use mocked HTTP transport.  Do not let an unrelated SOCKS
    # proxy setting change whether importing the application succeeds.
    env["NO_PROXY"] = "*"
    env["no_proxy"] = "*"

    failures = 0
    tests = manifest["current"]["tests"]
    for test in tests:
        relative = test["path"]
        path = root / relative
        if not path.is_file():
            print(f"FAIL current test missing {relative}")
            failures += 1
            continue
        runner = test["runner"]
        command = [sys.executable, str(path)] if runner == "python" else ["node", str(path)]
        if not _run(command, root, f"current {relative}", env):
            failures += 1
    print(f"Current tests: {len(tests) - failures} PASS / {failures} FAIL")
    _, asset_failures = _asset_checks(root, manifest)
    failures += asset_failures
    _, syntax_failures = _syntax_checks(root, manifest, env)
    failures += syntax_failures
    print(f"CURRENT GATE: {'PASS' if failures == 0 else 'FAIL'}")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
