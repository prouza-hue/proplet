"""Small immutable models for the canonical content build manifest.

Puzzle bodies deliberately remain plain JSON dictionaries: their metadata is
versioned and extensible, while the build contract only needs stable file and
compatibility-rule models.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Optional


class ManifestFormatError(ValueError):
    """The manifest cannot be parsed into the supported schema."""


def _require_keys(
    value: Mapping[str, Any],
    *,
    required: set[str],
    optional: set[str] | None = None,
    location: str,
) -> None:
    if not isinstance(value, Mapping):
        raise ManifestFormatError(f"{location} must be an object")
    keys = set(value)
    missing = required - keys
    unknown = keys - required - (optional or set())
    if missing:
        raise ManifestFormatError(f"{location} missing fields: {sorted(missing)}")
    if unknown:
        raise ManifestFormatError(f"{location} has unknown fields: {sorted(unknown)}")


def _nonempty_string(value: Any, location: str) -> str:
    if not isinstance(value, str) or not value:
        raise ManifestFormatError(f"{location} must be a non-empty string")
    return value


def _integer(value: Any, location: str, *, minimum: int | None = None) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ManifestFormatError(f"{location} must be an integer")
    if minimum is not None and value < minimum:
        raise ManifestFormatError(f"{location} must be at least {minimum}")
    return value


def _boolean(value: Any, location: str) -> bool:
    if not isinstance(value, bool):
        raise ManifestFormatError(f"{location} must be a boolean")
    return value


@dataclass(frozen=True)
class ValidationIssue:
    code: str
    location: str
    message: str


@dataclass(frozen=True)
class FileRecord:
    path: str
    role: str
    sha256: str
    size_bytes: int
    git_blob: Optional[str] = None
    compression: Optional[str] = None
    uncompressed_sha256: Optional[str] = None
    uncompressed_size_bytes: Optional[int] = None

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any], location: str) -> "FileRecord":
        _require_keys(
            value,
            required={"path", "role", "sha256", "sizeBytes"},
            optional={
                "gitBlob",
                "compression",
                "uncompressedSha256",
                "uncompressedSizeBytes",
            },
            location=location,
        )
        compression_fields = {
            "compression",
            "uncompressedSha256",
            "uncompressedSizeBytes",
        }
        present_compression_fields = compression_fields.intersection(value)
        if present_compression_fields and present_compression_fields != compression_fields:
            raise ManifestFormatError(
                f"{location} compression fields must be declared together"
            )
        compression = None
        uncompressed_sha256 = None
        uncompressed_size_bytes = None
        if present_compression_fields:
            compression = _nonempty_string(value["compression"], f"{location}.compression")
            if compression != "gzip":
                raise ManifestFormatError(f"{location}.compression must be gzip")
            uncompressed_sha256 = _nonempty_string(
                value["uncompressedSha256"], f"{location}.uncompressedSha256"
            )
            uncompressed_size_bytes = _integer(
                value["uncompressedSizeBytes"],
                f"{location}.uncompressedSizeBytes",
                minimum=0,
            )
        git_blob = value.get("gitBlob")
        if git_blob is not None:
            git_blob = _nonempty_string(git_blob, f"{location}.gitBlob")
        return cls(
            path=_nonempty_string(value["path"], f"{location}.path"),
            role=_nonempty_string(value["role"], f"{location}.role"),
            sha256=_nonempty_string(value["sha256"], f"{location}.sha256"),
            size_bytes=_integer(value["sizeBytes"], f"{location}.sizeBytes", minimum=0),
            git_blob=git_blob,
            compression=compression,
            uncompressed_sha256=uncompressed_sha256,
            uncompressed_size_bytes=uncompressed_size_bytes,
        )


@dataclass(frozen=True)
class JsonSerialization:
    encoding: str
    ensure_ascii: bool
    separators: tuple[str, str]
    trailing_newline: bool

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any]) -> "JsonSerialization":
        _require_keys(
            value,
            required={"encoding", "ensureAscii", "separators", "trailingNewline"},
            location="canonicalBuild.serialization",
        )
        separators = value.get("separators")
        if not isinstance(separators, list) or len(separators) != 2:
            raise ManifestFormatError("canonicalBuild.serialization.separators must have two values")
        if not all(isinstance(separator, str) for separator in separators):
            raise ManifestFormatError(
                "canonicalBuild.serialization.separators values must be strings"
            )
        return cls(
            encoding=_nonempty_string(value["encoding"], "canonicalBuild.serialization.encoding"),
            ensure_ascii=_boolean(
                value["ensureAscii"], "canonicalBuild.serialization.ensureAscii"
            ),
            separators=(separators[0], separators[1]),
            trailing_newline=_boolean(
                value["trailingNewline"], "canonicalBuild.serialization.trailingNewline"
            ),
        )


@dataclass(frozen=True)
class CompatibilityAppend:
    source_collection: str
    source_id: str
    target_collection: str
    position: str
    item_sha256: str
    reason: str

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any]) -> "CompatibilityAppend":
        _require_keys(
            value,
            required={
                "sourceCollection",
                "sourceId",
                "targetCollection",
                "position",
                "itemSha256",
                "reason",
            },
            location="canonicalBuild.append",
        )
        return cls(
            source_collection=_nonempty_string(
                value["sourceCollection"], "canonicalBuild.append.sourceCollection"
            ),
            source_id=_nonempty_string(
                value["sourceId"], "canonicalBuild.append.sourceId"
            ),
            target_collection=_nonempty_string(
                value["targetCollection"], "canonicalBuild.append.targetCollection"
            ),
            position=_nonempty_string(
                value["position"], "canonicalBuild.append.position"
            ),
            item_sha256=_nonempty_string(
                value["itemSha256"], "canonicalBuild.append.itemSha256"
            ),
            reason=_nonempty_string(value["reason"], "canonicalBuild.append.reason"),
        )


@dataclass(frozen=True)
class CanonicalBuild:
    source: FileRecord
    compatibility_source: FileRecord
    output: FileRecord
    serialization: JsonSerialization
    append: CompatibilityAppend

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any]) -> "CanonicalBuild":
        _require_keys(
            value,
            required={
                "source",
                "compatibilitySource",
                "output",
                "serialization",
                "append",
            },
            location="canonicalBuild",
        )
        try:
            return cls(
                source=FileRecord.from_mapping(value["source"], "canonicalBuild.source"),
                compatibility_source=FileRecord.from_mapping(
                    value["compatibilitySource"], "canonicalBuild.compatibilitySource"
                ),
                output=FileRecord.from_mapping(value["output"], "canonicalBuild.output"),
                serialization=JsonSerialization.from_mapping(value["serialization"]),
                append=CompatibilityAppend.from_mapping(value["append"]),
            )
        except KeyError as exc:
            raise ManifestFormatError(f"canonicalBuild missing field: {exc}") from exc


@dataclass(frozen=True)
class IdentityBuild:
    source: FileRecord
    output: FileRecord

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any], index: int) -> "IdentityBuild":
        _require_keys(
            value,
            required={"source", "output"},
            location=f"identityBuilds[{index}]",
        )
        try:
            return cls(
                source=FileRecord.from_mapping(value["source"], f"identityBuilds[{index}].source"),
                output=FileRecord.from_mapping(value["output"], f"identityBuilds[{index}].output"),
            )
        except KeyError as exc:
            raise ManifestFormatError(f"identityBuilds[{index}] missing field: {exc}") from exc


@dataclass(frozen=True)
class GenerationManifest:
    schema_ref: str
    schema_version: int
    manifest_id: str
    manifest_version: int
    validator_version: str
    provenance: Mapping[str, Any]
    generation: Mapping[str, Any]
    canonical_build: CanonicalBuild
    identity_builds: tuple[IdentityBuild, ...]
    runtime_artifacts: tuple[FileRecord, ...]
    generation_inputs: tuple[FileRecord, ...]

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any]) -> "GenerationManifest":
        _require_keys(
            value,
            required={
                "$schema",
                "schemaVersion",
                "manifestId",
                "manifestVersion",
                "validatorVersion",
                "provenance",
                "generation",
                "canonicalBuild",
                "identityBuilds",
                "runtimeArtifacts",
                "generationInputs",
            },
            location="manifest",
        )
        for key in ("provenance", "generation"):
            if not isinstance(value[key], Mapping):
                raise ManifestFormatError(f"{key} must be an object")
        for key in ("identityBuilds", "runtimeArtifacts", "generationInputs"):
            if not isinstance(value[key], list):
                raise ManifestFormatError(f"{key} must be an array")
        try:
            return cls(
                schema_ref=_nonempty_string(value["$schema"], "$schema"),
                schema_version=_integer(value["schemaVersion"], "schemaVersion", minimum=1),
                manifest_id=_nonempty_string(value["manifestId"], "manifestId"),
                manifest_version=_integer(
                    value["manifestVersion"], "manifestVersion", minimum=1
                ),
                validator_version=_nonempty_string(
                    value["validatorVersion"], "validatorVersion"
                ),
                provenance=dict(value["provenance"]),
                generation=dict(value["generation"]),
                canonical_build=CanonicalBuild.from_mapping(value["canonicalBuild"]),
                identity_builds=tuple(
                    IdentityBuild.from_mapping(item, index)
                    for index, item in enumerate(value.get("identityBuilds") or [])
                ),
                runtime_artifacts=tuple(
                    FileRecord.from_mapping(item, f"runtimeArtifacts[{index}]")
                    for index, item in enumerate(value.get("runtimeArtifacts") or [])
                ),
                generation_inputs=tuple(
                    FileRecord.from_mapping(item, f"generationInputs[{index}]")
                    for index, item in enumerate(value.get("generationInputs") or [])
                ),
            )
        except (KeyError, TypeError, ValueError) as exc:
            if isinstance(exc, ManifestFormatError):
                raise
            raise ManifestFormatError(f"Invalid generation manifest: {exc}") from exc
