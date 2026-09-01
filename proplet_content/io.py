"""Explicit, caller-directed IO for content tooling."""
from __future__ import annotations

import gzip
import hashlib
import json
import os
from pathlib import Path
import tempfile
from typing import Any

from .models import FileRecord, GenerationManifest, ManifestFormatError


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def resolve_repo_path(root: Path, relative_path: str) -> Path:
    root = root.resolve()
    candidate = (root / relative_path).resolve()
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise ManifestFormatError(f"Path escapes repository root: {relative_path}") from exc
    return candidate


def read_record_bytes(root: Path, record: FileRecord, *, decompress: bool = False) -> bytes:
    raw = resolve_repo_path(root, record.path).read_bytes()
    if not decompress:
        return raw
    if record.compression == "gzip":
        return gzip.decompress(raw)
    if record.compression:
        raise ManifestFormatError(f"Unsupported compression for {record.path}: {record.compression}")
    return raw


def load_manifest(path: Path) -> GenerationManifest:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ManifestFormatError(f"Cannot read manifest {path}: {exc}") from exc
    if not isinstance(payload, dict):
        raise ManifestFormatError("Generation manifest root must be an object")
    return GenerationManifest.from_mapping(payload)


def render_json(payload: Any, manifest: GenerationManifest) -> bytes:
    serialization = manifest.canonical_build.serialization
    text = json.dumps(
        payload,
        ensure_ascii=serialization.ensure_ascii,
        separators=serialization.separators,
    )
    if serialization.trailing_newline:
        text += "\n"
    return text.encode(serialization.encoding)


def atomic_write_bytes(path: Path, payload: bytes) -> None:
    """Atomically replace one explicit path; never chooses a production path."""
    target = path.resolve()
    parent = target.parent
    if not parent.is_dir():
        raise FileNotFoundError(f"Output directory does not exist: {parent}")
    mode = target.stat().st_mode & 0o777 if target.exists() else 0o644
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{target.name}.", suffix=".tmp", dir=parent
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            descriptor = -1
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, mode)
        os.replace(temporary, target)
    finally:
        if descriptor >= 0:
            os.close(descriptor)
        temporary.unlink(missing_ok=True)


def atomic_write_text(path: Path, payload: str, *, encoding: str = "utf-8") -> None:
    atomic_write_bytes(path, payload.encode(encoding))
