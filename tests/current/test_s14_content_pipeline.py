"""Executable Sprint 14 contracts for manifest, builder, validator, and safe IO."""
from __future__ import annotations

from copy import deepcopy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from unittest import mock


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from proplet_content.io import atomic_write_bytes, load_manifest
from proplet_content.models import GenerationManifest
from proplet_content.models import ManifestFormatError
from proplet_content.validator import build_public_runtime_bytes, validate_manifest


MANIFEST_PATH = ROOT / "content/generation-manifest.json"
MANIFEST_PAYLOAD = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
SCHEMA_PAYLOAD = json.loads(
    (ROOT / "content/generation-manifest.schema.json").read_text(encoding="utf-8")
)
MANIFEST = load_manifest(MANIFEST_PATH)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


issues = validate_manifest(ROOT, MANIFEST)
assert not issues, issues
built = build_public_runtime_bytes(ROOT, MANIFEST)
assert built == (ROOT / "public/puzzles.json").read_bytes()
assert hashlib.sha256(built).hexdigest() == MANIFEST.canonical_build.output.sha256
assert SCHEMA_PAYLOAD["properties"]["manifestId"]["const"] == MANIFEST.manifest_id
assert (
    SCHEMA_PAYLOAD["properties"]["validatorVersion"]["const"]
    == MANIFEST.validator_version
)
assert set(SCHEMA_PAYLOAD["$defs"]["file"]["dependentRequired"]) == {
    "compression",
    "uncompressedSha256",
    "uncompressedSizeBytes",
}

# The builder has a read-only mode and requires an explicit action.
environment = dict(os.environ, PYTHONDONTWRITEBYTECODE="1")
check = subprocess.run(
    [sys.executable, "tools/build_runtime_content.py", "--check"],
    cwd=ROOT,
    env=environment,
    capture_output=True,
    text=True,
    check=False,
)
assert check.returncode == 0, check.stderr
assert MANIFEST.canonical_build.output.sha256 in check.stdout
no_builder_action = subprocess.run(
    [sys.executable, "tools/build_runtime_content.py"],
    cwd=ROOT,
    env=environment,
    capture_output=True,
    text=True,
    check=False,
)
assert no_builder_action.returncode == 2

with tempfile.TemporaryDirectory(prefix="proplet-s14-") as temporary_directory:
    temporary_root = Path(temporary_directory)
    output = temporary_root / "puzzles.json"
    build = subprocess.run(
        [sys.executable, "tools/build_runtime_content.py", "--output", str(output)],
        cwd=ROOT,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )
    assert build.returncode == 0, build.stderr
    assert output.read_bytes() == built

    # Failed replace preserves the previous target and removes the temporary file.
    protected = temporary_root / "protected.bin"
    protected.write_bytes(b"released-content")
    with mock.patch("proplet_content.io.os.replace", side_effect=OSError("simulated")):
        try:
            atomic_write_bytes(protected, b"replacement")
        except OSError as exc:
            assert str(exc) == "simulated"
        else:
            raise AssertionError("simulated os.replace failure did not propagate")
    assert protected.read_bytes() == b"released-content"
    assert list(temporary_root.glob(".protected.bin.*.tmp")) == []

    # Explicit output is a verified copy operation, not a repair path.  Any
    # drift in the declared released output contract must stop before writing.
    drift_manifest_payload = deepcopy(MANIFEST_PAYLOAD)
    drift_manifest_payload["canonicalBuild"]["output"]["sha256"] = "0" * 64
    drift_manifest = temporary_root / "drift-manifest.json"
    drift_manifest.write_text(
        json.dumps(drift_manifest_payload, ensure_ascii=False), encoding="utf-8"
    )
    rejected_output = temporary_root / "must-not-exist.json"
    rejected = subprocess.run(
        [
            sys.executable,
            "tools/build_runtime_content.py",
            "--manifest",
            str(drift_manifest),
            "--output",
            str(rejected_output),
        ],
        cwd=ROOT,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )
    assert rejected.returncode == 1
    assert "hash-mismatch" in rejected.stderr
    assert not rejected_output.exists()

# Invalid hashes and unsafe paths are reported by the pure validator, never repaired.
bad_hash_payload = deepcopy(MANIFEST_PAYLOAD)
bad_hash_payload["runtimeArtifacts"][0]["sha256"] = "0" * 64
bad_hash = GenerationManifest.from_mapping(bad_hash_payload)
assert "hash-mismatch" in {issue.code for issue in validate_manifest(ROOT, bad_hash)}

unsafe_payload = deepcopy(MANIFEST_PAYLOAD)
unsafe_payload["generationInputs"][0]["path"] = "../outside.txt"
unsafe = GenerationManifest.from_mapping(unsafe_payload)
assert "unsafe-path" in {issue.code for issue in validate_manifest(ROOT, unsafe)}

duplicate_role_payload = deepcopy(MANIFEST_PAYLOAD)
duplicate_role_payload["generationInputs"][1]["role"] = duplicate_role_payload[
    "generationInputs"
][0]["role"]
duplicate_role = GenerationManifest.from_mapping(duplicate_role_payload)
assert "duplicate-role" in {issue.code for issue in validate_manifest(ROOT, duplicate_role)}

unknown_field_payload = deepcopy(MANIFEST_PAYLOAD)
unknown_field_payload["canonicalBuild"]["source"]["implicitOutput"] = True
try:
    GenerationManifest.from_mapping(unknown_field_payload)
except ManifestFormatError as exc:
    assert "unknown fields" in str(exc)
else:
    raise AssertionError("unknown manifest field was accepted")

for malformed_payload, expected_message in (
    (
        {**deepcopy(MANIFEST_PAYLOAD), "schemaVersion": True},
        "schemaVersion must be an integer",
    ),
    (
        deepcopy(MANIFEST_PAYLOAD),
        "canonicalBuild.source.sizeBytes must be an integer",
    ),
    (
        deepcopy(MANIFEST_PAYLOAD),
        "canonicalBuild.serialization.ensureAscii must be a boolean",
    ),
    (
        deepcopy(MANIFEST_PAYLOAD),
        "canonicalBuild.source.role must be a non-empty string",
    ),
    (
        deepcopy(MANIFEST_PAYLOAD),
        "canonicalBuild.source compression fields must be declared together",
    ),
):
    if "source.sizeBytes" in expected_message:
        malformed_payload["canonicalBuild"]["source"]["sizeBytes"] = False
    elif "ensureAscii" in expected_message:
        malformed_payload["canonicalBuild"]["serialization"]["ensureAscii"] = "false"
    elif "source.role" in expected_message:
        malformed_payload["canonicalBuild"]["source"]["role"] = ""
    elif "compression fields" in expected_message:
        malformed_payload["canonicalBuild"]["source"]["compression"] = "gzip"
    try:
        GenerationManifest.from_mapping(malformed_payload)
    except ManifestFormatError as exc:
        assert expected_message in str(exc), (expected_message, str(exc))
    else:
        raise AssertionError(f"malformed manifest accepted: {expected_message}")

wrong_append_payload = deepcopy(MANIFEST_PAYLOAD)
wrong_append_payload["canonicalBuild"]["append"]["sourceId"] = "missing-daily"
wrong_append = GenerationManifest.from_mapping(wrong_append_payload)
assert "build-failed" in {issue.code for issue in validate_manifest(ROOT, wrong_append)}

wrong_size_payload = deepcopy(MANIFEST_PAYLOAD)
wrong_size_payload["canonicalBuild"]["output"]["sizeBytes"] += 1
wrong_size = GenerationManifest.from_mapping(wrong_size_payload)
try:
    build_public_runtime_bytes(ROOT, wrong_size)
except ManifestFormatError as exc:
    mismatch = str(exc)
    assert "g3-d-007" in mismatch
    assert "expected" in mismatch and "got" in mismatch
else:
    raise AssertionError("declared output mismatch was accepted")

# The historical CLI may be imported by older tools, but invocation without
# --output must fail in argparse before any release or auxiliary file changes.
protected_paths = [
    ROOT / "data/puzzles.json",
    ROOT / "public/puzzles.json",
    ROOT / "data/words.txt",
    ROOT / "data/legacy_daily_gen1.json",
]
before = {path: sha256(path) for path in protected_paths if path.exists()}
no_output = subprocess.run(
    [sys.executable, "tools/generate_puzzles.py"],
    cwd=ROOT,
    env=environment,
    capture_output=True,
    text=True,
    check=False,
)
assert no_output.returncode == 2
assert "--output" in no_output.stderr
after = {path: sha256(path) for path in protected_paths if path.exists()}
assert after == before

generator_path = ROOT / "tools/generate_puzzles.py"
spec = importlib.util.spec_from_file_location("proplet_s14_generator_contract", generator_path)
assert spec and spec.loader
generator = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = generator
spec.loader.exec_module(generator)
for public_helper in (
    "clean_word",
    "load_answer_tiers",
    "load_answer_metadata",
    "build_answer_pools",
    "load_frequency_words",
    "solve_count",
    "progression_variant_index",
    "free_vocab_key",
    "create_puzzle",
    "write_outputs",
):
    assert callable(getattr(generator, public_helper, None)), public_helper

# Auxiliary outputs are attempted before the primary bank.  A failure may
# leave an earlier explicit auxiliary updated, but never advances the canonical
# output that depends on the complete set.
write_order = []


def fail_second_write(path, payload):
    write_order.append(path.name)
    if len(write_order) == 2:
        raise OSError("auxiliary failure")


with mock.patch.object(generator, "atomic_write_text", side_effect=fail_second_write):
    try:
        generator.write_outputs(
            output=Path("canonical.json"),
            puzzle_payload="puzzles",
            words_output=Path("words.txt"),
            words_payload="words",
            legacy_daily_output=Path("legacy.json"),
            legacy_daily_payload="legacy",
        )
    except OSError as exc:
        assert str(exc) == "auxiliary failure"
    else:
        raise AssertionError("auxiliary write failure did not propagate")
assert write_order == ["words.txt", "legacy.json"]

print("Sprint 14 canonical content pipeline: PASS")
