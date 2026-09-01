"""Read-only validation and pure source-to-public content assembly."""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Iterable

from .io import read_record_bytes, render_json, resolve_repo_path, sha256_bytes
from .models import FileRecord, GenerationManifest, ManifestFormatError, ValidationIssue


SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
GIT_SHA1_RE = re.compile(r"^[0-9a-f]{40}$")
PROVENANCE_COMMIT_KEYS = (
    "baselineCommit",
    "baselineRuntimeMergeCommit",
    "archiveCandidateEvidenceCommit",
    "generation4BinderCommit",
    "generation4ReleaseCutoverCommit",
    "publicDailyCompatibilityCommit",
    "mozkomorRuntimeCommit",
    "compatibilitySourceCommit",
    "compatibilitySourcePublicBlob",
)


def canonical_item_bytes(payload: object, manifest: GenerationManifest) -> bytes:
    rendered = render_json(payload, manifest)
    return rendered[:-1] if manifest.canonical_build.serialization.trailing_newline else rendered


def _record_issues(root: Path, record: FileRecord, location: str) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    if not SHA256_RE.fullmatch(record.sha256):
        issues.append(ValidationIssue("invalid-sha256", location, record.sha256))
    if record.size_bytes < 0:
        issues.append(ValidationIssue("invalid-size", location, str(record.size_bytes)))
    try:
        path = resolve_repo_path(root, record.path)
    except ManifestFormatError as exc:
        return [ValidationIssue("unsafe-path", location, str(exc))]
    if not path.is_file():
        return [ValidationIssue("missing-file", location, record.path)]
    raw = path.read_bytes()
    if len(raw) != record.size_bytes:
        issues.append(
            ValidationIssue(
                "size-mismatch", location, f"expected {record.size_bytes}, got {len(raw)}"
            )
        )
    actual_hash = sha256_bytes(raw)
    if actual_hash != record.sha256:
        issues.append(
            ValidationIssue(
                "hash-mismatch", location, f"expected {record.sha256}, got {actual_hash}"
            )
        )
    if record.git_blob:
        actual_blob = hashlib.sha1(
            f"blob {len(raw)}\0".encode("ascii") + raw
        ).hexdigest()
        if not GIT_SHA1_RE.fullmatch(record.git_blob) or actual_blob != record.git_blob:
            issues.append(
                ValidationIssue(
                    "git-blob-mismatch",
                    location,
                    f"expected {record.git_blob}, got {actual_blob}",
                )
            )
    if record.compression:
        try:
            unpacked = read_record_bytes(root, record, decompress=True)
        except Exception as exc:  # malformed compressed input becomes a validation issue
            issues.append(ValidationIssue("decompression-failed", location, str(exc)))
        else:
            if record.uncompressed_size_bytes is None or not record.uncompressed_sha256:
                issues.append(
                    ValidationIssue(
                        "missing-uncompressed-contract", location, record.path
                    )
                )
            else:
                if len(unpacked) != record.uncompressed_size_bytes:
                    issues.append(
                        ValidationIssue(
                            "uncompressed-size-mismatch",
                            location,
                            f"expected {record.uncompressed_size_bytes}, got {len(unpacked)}",
                        )
                    )
                unpacked_hash = sha256_bytes(unpacked)
                if unpacked_hash != record.uncompressed_sha256:
                    issues.append(
                        ValidationIssue(
                            "uncompressed-hash-mismatch",
                            location,
                            f"expected {record.uncompressed_sha256}, got {unpacked_hash}",
                        )
                    )
    return issues


def build_public_runtime_bytes(root: Path, manifest: GenerationManifest) -> bytes:
    build = manifest.canonical_build
    source = json.loads(read_record_bytes(root, build.source))
    compatibility_archive = json.loads(
        read_record_bytes(root, build.compatibility_source, decompress=True)
    )
    rule = build.append
    source_items = source.get(rule.target_collection)
    compatibility_items = compatibility_archive.get(rule.source_collection)
    if not isinstance(source_items, list) or not isinstance(compatibility_items, list):
        raise ManifestFormatError("Compatibility collections must both be JSON lists")
    matches = [item for item in compatibility_items if item.get("id") == rule.source_id]
    if len(matches) != 1:
        raise ManifestFormatError(
            f"Expected one {rule.source_id} in {rule.source_collection}, found {len(matches)}"
        )
    if any(item.get("id") == rule.source_id for item in source_items):
        raise ManifestFormatError(f"Compatibility ID already exists in source: {rule.source_id}")
    if rule.position != "end":
        raise ManifestFormatError(f"Unsupported append position: {rule.position}")
    compatibility = matches[0]
    actual_item_hash = sha256_bytes(canonical_item_bytes(compatibility, manifest))
    if actual_item_hash != rule.item_sha256:
        raise ManifestFormatError(
            f"Compatibility item hash mismatch: expected {rule.item_sha256}, got {actual_item_hash}"
        )
    rebuilt = dict(source)
    rebuilt[rule.target_collection] = list(source_items) + [compatibility]
    output = render_json(rebuilt, manifest)
    actual_hash = sha256_bytes(output)
    if len(output) != build.output.size_bytes or actual_hash != build.output.sha256:
        raise ManifestFormatError(
            "Built runtime output for "
            f"append {rule.source_id} does not match contract: "
            f"expected {build.output.size_bytes} bytes/{build.output.sha256}, "
            f"got {len(output)} bytes/{actual_hash}"
        )
    return output


def validate_manifest(
    root: Path, manifest: GenerationManifest, *, verify_outputs: bool = True
) -> list[ValidationIssue]:
    root = root.resolve()
    issues: list[ValidationIssue] = []
    if manifest.schema_ref != "./generation-manifest.schema.json":
        issues.append(ValidationIssue("schema-ref", "$schema", manifest.schema_ref))
    elif not (root / "content/generation-manifest.schema.json").is_file():
        issues.append(
            ValidationIssue(
                "schema-missing", "$schema", "content/generation-manifest.schema.json"
            )
        )
    if manifest.schema_version != 1:
        issues.append(ValidationIssue("schema-version", "schemaVersion", str(manifest.schema_version)))
    if manifest.manifest_version < 1:
        issues.append(
            ValidationIssue("manifest-version", "manifestVersion", str(manifest.manifest_version))
        )
    if manifest.manifest_id != "proplet-runtime-content":
        issues.append(ValidationIssue("manifest-id", "manifestId", manifest.manifest_id))
    if manifest.validator_version != "proplet-content-s14-v1":
        issues.append(
            ValidationIssue(
                "validator-version", "validatorVersion", manifest.validator_version
            )
        )
    for key in PROVENANCE_COMMIT_KEYS:
        value = str(manifest.provenance.get(key) or "")
        if not GIT_SHA1_RE.fullmatch(value):
            issues.append(ValidationIssue("provenance-sha", f"provenance.{key}", value))
    serialization = manifest.canonical_build.serialization
    if (
        serialization.encoding != "utf-8"
        or serialization.ensure_ascii
        or serialization.separators != (",", ":")
        or not serialization.trailing_newline
    ):
        issues.append(
            ValidationIssue(
                "serialization-contract",
                "canonicalBuild.serialization",
                "expected compact UTF-8 JSON with ensureAscii=false and trailing LF",
            )
        )

    records: list[tuple[str, FileRecord]] = [
        ("canonicalBuild.source", manifest.canonical_build.source),
        ("canonicalBuild.compatibilitySource", manifest.canonical_build.compatibility_source),
    ]
    if verify_outputs:
        records.append(("canonicalBuild.output", manifest.canonical_build.output))
    else:
        try:
            resolve_repo_path(root, manifest.canonical_build.output.path)
        except ManifestFormatError as exc:
            issues.append(ValidationIssue("unsafe-path", "canonicalBuild.output", str(exc)))
    for index, identity in enumerate(manifest.identity_builds):
        records.extend(
            [
                (f"identityBuilds[{index}].source", identity.source),
                (f"identityBuilds[{index}].output", identity.output),
            ]
        )
    records.extend(
        (f"runtimeArtifacts[{index}]", record)
        for index, record in enumerate(manifest.runtime_artifacts)
    )
    records.extend(
        (f"generationInputs[{index}]", record)
        for index, record in enumerate(manifest.generation_inputs)
    )
    role_locations: dict[str, str] = {}
    for location, record in records:
        previous = role_locations.get(record.role)
        if previous and previous != location:
            issues.append(
                ValidationIssue(
                    "duplicate-role", location, f"{record.role} already declared at {previous}"
                )
            )
        role_locations[record.role] = location
        issues.extend(_record_issues(root, record, location))

    for index, identity in enumerate(manifest.identity_builds):
        try:
            source = read_record_bytes(root, identity.source)
            output = read_record_bytes(root, identity.output)
        except (OSError, ManifestFormatError):
            continue
        if source != output:
            issues.append(
                ValidationIssue(
                    "identity-build-mismatch", f"identityBuilds[{index}]", "source/output differ"
                )
            )

    if not issues:
        try:
            built = build_public_runtime_bytes(root, manifest)
            actual = (
                read_record_bytes(root, manifest.canonical_build.output)
                if verify_outputs
                else None
            )
            if actual is not None and built != actual:
                issues.append(
                    ValidationIssue(
                        "runtime-byte-mismatch",
                        "canonicalBuild.output",
                        "built bytes differ from committed output",
                    )
                )
        except (OSError, json.JSONDecodeError, ManifestFormatError) as exc:
            issues.append(ValidationIssue("build-failed", "canonicalBuild", str(exc)))

    source = None
    try:
        source_path = resolve_repo_path(root, manifest.canonical_build.source.path)
        source = json.loads(source_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, ManifestFormatError) as exc:
        issues.append(ValidationIssue("source-json", "generation", str(exc)))
    if source is not None:
        active_puzzles = []
        starter = source.get("starter")
        if isinstance(starter, dict):
            active_puzzles.append(starter)
        active_puzzles.extend(source.get("rescue") or [])
        active_puzzles.extend(source.get("daily") or [])
        for bank in (source.get("free") or {}).values():
            active_puzzles.extend(bank or [])
        active_ids = [puzzle.get("id") for puzzle in active_puzzles]
        duplicates = sorted(
            puzzle_id
            for puzzle_id in set(active_ids)
            if puzzle_id is not None and active_ids.count(puzzle_id) > 1
        )
        if duplicates:
            issues.append(
                ValidationIssue(
                    "duplicate-puzzle-id",
                    manifest.canonical_build.source.path,
                    ", ".join(duplicates[:20]),
                )
            )

        for key in (
            "contentGeneration",
            "freeGeneration",
            "dailyGeneration",
            "generationKey",
            "dailyGeneration4From",
        ):
            expected = manifest.generation.get(key)
            if source.get(key) != expected:
                issues.append(
                    ValidationIssue(
                        "generation-metadata", f"generation.{key}", f"expected {expected!r}, got {source.get(key)!r}"
                    )
                )

        rolling_record = next(
            (
                record
                for record in manifest.runtime_artifacts
                if record.role == "server-rolling-content"
            ),
            None,
        )
        if rolling_record is not None:
            try:
                rolling = json.loads(read_record_bytes(root, rolling_record))
                expected_release = manifest.generation.get("rollingFirstRelease")
                if rolling.get("firstRelease") != expected_release:
                    issues.append(
                        ValidationIssue(
                            "generation-metadata",
                            "generation.rollingFirstRelease",
                            f"expected {expected_release!r}, got {rolling.get('firstRelease')!r}",
                        )
                    )
                if rolling.get("contentGeneration") != manifest.generation.get(
                    "contentGeneration"
                ):
                    issues.append(
                        ValidationIssue(
                            "generation-metadata",
                            "generation.contentGeneration",
                            "Rolling content generation differs from canonical source",
                        )
                    )
            except (OSError, json.JSONDecodeError, ManifestFormatError) as exc:
                issues.append(ValidationIssue("rolling-source", rolling_record.path, str(exc)))

        mozkomor_record = next(
            (
                record
                for record in manifest.generation_inputs
                if record.role == "mozkomor-release-source"
            ),
            None,
        )
        if mozkomor_record is not None:
            try:
                mozkomor = json.loads(read_record_bytes(root, mozkomor_record))
                runtime_puzzles = (source.get("free") or {}).get("mozkomor") or []
                if mozkomor.get("puzzles") != runtime_puzzles:
                    issues.append(
                        ValidationIssue(
                            "mozkomor-embed",
                            mozkomor_record.path,
                            "source puzzles differ from canonical runtime",
                        )
                    )
                unlock = mozkomor.get("unlock") or {}
                runtime_unlock = source.get("mozkomorUnlock") or {}
                if (
                    unlock.get("difficulty") != runtime_unlock.get("requiresDifficulty")
                    or int(unlock.get("baseLevels") or 0)
                    != int(runtime_unlock.get("requiresCurrentBaseLevels") or 0)
                    or len(runtime_puzzles) != int(runtime_unlock.get("levels") or 0)
                    or len(runtime_puzzles) != int(manifest.generation.get("mozkomorLevels") or 0)
                ):
                    issues.append(
                        ValidationIssue(
                            "mozkomor-unlock",
                            mozkomor_record.path,
                            "source/runtime unlock metadata differ",
                        )
                    )
            except (OSError, json.JSONDecodeError, ManifestFormatError) as exc:
                issues.append(
                    ValidationIssue("mozkomor-source", mozkomor_record.path, str(exc))
                )
    return issues


def format_issues(issues: Iterable[ValidationIssue]) -> str:
    return "\n".join(f"{issue.code} [{issue.location}]: {issue.message}" for issue in issues)
