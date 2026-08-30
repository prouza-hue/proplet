#!/usr/bin/env python3
"""Explicit maintenance command for legacy Gen4 reward rows.

The command is read-only unless both ``--apply`` and the confirmation token are
provided.  It never calls a profile/read endpoint.
"""

import argparse
import json
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import server  # noqa: E402


CONFIRMATION = "APPLY_GEN4_REWARD_REPAIR"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--player-id", required=True, help="Player UUID to inspect or repair")
    parser.add_argument("--apply", action="store_true", help="Apply the planned compare-and-set updates")
    parser.add_argument("--confirm", default="", help=f"Required with --apply: {CONFIRMATION}")
    args = parser.parse_args()
    if args.apply and args.confirm != CONFIRMATION:
        parser.error(f"--apply requires --confirm {CONFIRMATION}")
    return args


def main() -> int:
    args = parse_args()
    report = server.repair_gen4_free_rewards(args.player_id, dry_run=not args.apply)
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    return 2 if report["conflicts"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
