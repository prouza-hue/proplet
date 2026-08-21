#!/usr/bin/env python3
"""Render idempotent catalog seed and unambiguous historical lineage backfill SQL."""
from __future__ import annotations

import argparse
import json
from pathlib import Path


def sql(value: object) -> str:
    if value is None:
        return "null"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("catalog", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    catalog = json.loads(args.catalog.read_text(encoding="utf-8"))

    lines = [
        "-- Generated from the non-playable v3.34 content catalog.",
        "-- Contains hashes and lineage metadata only; no letters, answers or paths.",
        "begin;",
        "",
    ]
    content_rows = []
    context_rows = []
    tombstone_rows = []
    for record in catalog.get("content") or []:
        generations = {int(ctx["generation"]) for ctx in record.get("contexts") or [] if ctx.get("generation") is not None}
        status = "active" if 4 in generations else "cold-archive"
        metadata = json.dumps({
            "catalogVersion": catalog.get("version"),
            "generations": sorted(generations),
        }, ensure_ascii=False, separators=(",", ":"))
        content_rows.append("(" + ",".join([
            sql(record.get("contentKey")), sql(record.get("sha256")),
            sql(record.get("rows")), sql(record.get("cols")),
            sql(record.get("activeCells")), sql(record.get("targetCount")),
            sql(status), sql(metadata) + "::jsonb",
        ]) + ")")
        for ctx in record.get("contexts") or []:
            context_rows.append("(" + ",".join([
                sql(record.get("contentKey")), sql(ctx.get("puzzleId")), sql(ctx.get("generation")),
                sql(ctx.get("bank")), sql(ctx.get("difficulty")), sql(ctx.get("slot")),
                "null", "null", "null", sql(ctx.get("sourcePath")), sql("exact"),
            ]) + ")")

    for ctx in catalog.get("tombstones") or []:
        tombstone_rows.append("(" + ",".join([
            sql(ctx.get("puzzleId")), sql(ctx.get("generation")), sql(ctx.get("bank")),
            sql(ctx.get("difficulty")), sql(ctx.get("slot")), sql(ctx.get("sourcePath")),
            sql(ctx.get("reason") or "metadata-only-source"),
        ]) + ")")

    for offset in range(0, len(content_rows), 250):
        lines += [
            "insert into public.content_catalog",
            "  (content_key, content_hash, rows, cols, active_cells, target_count, archive_status, metadata)",
            "values",
            "  " + ",\n  ".join(content_rows[offset:offset + 250]),
            "on conflict (content_key) do update set",
            "  archive_status = excluded.archive_status, metadata = excluded.metadata;",
            "",
        ]
    for offset in range(0, len(context_rows), 250):
        lines += [
            "insert into public.content_catalog_contexts",
            "  (content_key, puzzle_id, content_generation, content_bank, difficulty, content_level,",
            "   daily_date, published_from, published_to, source_path, lineage_confidence)",
            "values",
            "  " + ",\n  ".join(context_rows[offset:offset + 250]),
            "on conflict do nothing;",
            "",
        ]
    for offset in range(0, len(tombstone_rows), 250):
        lines += [
            "insert into public.content_archive_tombstones",
            "  (puzzle_id, content_generation, content_bank, difficulty, content_level, source_path, reason)",
            "values",
            "  " + ",\n  ".join(tombstone_rows[offset:offset + 250]),
            "on conflict do nothing;",
            "",
        ]

    lines += [
        "-- A puzzle_id reused for different board hashes is deliberately left ambiguous.",
        "with exact as (",
        "  select puzzle_id, min(content_key) as content_key, min(content_generation) as content_generation,",
        "         min(content_bank) as content_bank, min(content_level) as content_level",
        "  from public.content_catalog_contexts",
        "  where puzzle_id is not null",
        "  group by puzzle_id",
        "  having count(distinct content_key) = 1",
        ")",
        "update public.results r set",
        "  content_key = e.content_key, content_generation = e.content_generation,",
        "  content_bank = coalesce(r.mode, e.content_bank), content_level = e.content_level,",
        "  content_lineage_confidence = 'exact'",
        "from exact e where r.puzzle_id = e.puzzle_id and r.content_key is null;",
        "",
        "with exact as (",
        "  select puzzle_id, min(content_key) as content_key, min(content_generation) as content_generation,",
        "         min(content_bank) as content_bank, min(content_level) as content_level",
        "  from public.content_catalog_contexts where puzzle_id is not null",
        "  group by puzzle_id having count(distinct content_key) = 1",
        ")",
        "update public.puzzle_runs r set",
        "  content_key = e.content_key, content_generation = e.content_generation,",
        "  content_bank = coalesce(r.mode, e.content_bank), content_level = e.content_level,",
        "  content_lineage_confidence = 'exact'",
        "from exact e where r.puzzle_id = e.puzzle_id and r.content_key is null;",
        "",
        "with exact as (",
        "  select puzzle_id, min(content_key) as content_key, min(content_generation) as content_generation,",
        "         min(content_bank) as content_bank, min(content_level) as content_level",
        "  from public.content_catalog_contexts where puzzle_id is not null",
        "  group by puzzle_id having count(distinct content_key) = 1",
        ")",
        "update public.puzzle_attempts r set",
        "  content_key = e.content_key, content_generation = e.content_generation,",
        "  content_bank = coalesce(r.mode, e.content_bank), content_level = e.content_level,",
        "  content_lineage_confidence = 'exact'",
        "from exact e where r.puzzle_id = e.puzzle_id and r.content_key is null;",
        "",
        "with inferred as (",
        "  select puzzle_id, min(content_generation) as content_generation,",
        "         min(content_bank) as content_bank, min(content_level) as content_level",
        "  from public.content_archive_tombstones where puzzle_id is not null",
        "  group by puzzle_id having count(*) = 1",
        ")",
        "update public.results r set",
        "  content_generation = e.content_generation, content_bank = coalesce(r.mode, e.content_bank),",
        "  content_level = e.content_level, content_lineage_confidence = 'inferred'",
        "from inferred e where r.puzzle_id = e.puzzle_id and r.content_key is null;",
        "",
        "with inferred as (",
        "  select puzzle_id, min(content_generation) as content_generation,",
        "         min(content_bank) as content_bank, min(content_level) as content_level",
        "  from public.content_archive_tombstones where puzzle_id is not null",
        "  group by puzzle_id having count(*) = 1",
        ")",
        "update public.puzzle_runs r set",
        "  content_generation = e.content_generation, content_bank = coalesce(r.mode, e.content_bank),",
        "  content_level = e.content_level, content_lineage_confidence = 'inferred'",
        "from inferred e where r.puzzle_id = e.puzzle_id and r.content_key is null;",
        "",
        "with inferred as (",
        "  select puzzle_id, min(content_generation) as content_generation,",
        "         min(content_bank) as content_bank, min(content_level) as content_level",
        "  from public.content_archive_tombstones where puzzle_id is not null",
        "  group by puzzle_id having count(*) = 1",
        ")",
        "update public.puzzle_attempts r set",
        "  content_generation = e.content_generation, content_bank = coalesce(r.mode, e.content_bank),",
        "  content_level = e.content_level, content_lineage_confidence = 'inferred'",
        "from inferred e where r.puzzle_id = e.puzzle_id and r.content_key is null;",
        "",
        "commit;",
        "",
    ]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps({
        "contentRows": len(content_rows),
        "contextRows": len(context_rows),
        "tombstoneRows": len(tombstone_rows),
        "output": str(args.output),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
