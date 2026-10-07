"""Explicit-output public projection and private-content static scan."""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.dated_daily import DatedDaily, assert_no_private_payload, public_runtime_projection


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--pack", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--scan-root", type=Path, required=True)
    parser.add_argument("--candidate", action="store_true", help="Local candidate QA only")
    args = parser.parse_args()
    if args.source.resolve() == args.output.resolve():
        raise ValueError("Výstup nesmí přepsat zdroj")
    pack = DatedDaily.load(args.pack, allow_candidate=args.candidate)
    source = json.loads(args.source.read_text(encoding="utf-8"))
    projected = public_runtime_projection(source, cutover=pack.cutover.isoformat(), active_until=pack.active_until.isoformat())
    encoded = json.dumps(projected, ensure_ascii=False, separators=(",", ":"))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(encoded, encoding="utf-8")
    print(json.dumps(assert_no_private_payload(args.scan_root, pack), sort_keys=True))


if __name__ == "__main__":
    main()
