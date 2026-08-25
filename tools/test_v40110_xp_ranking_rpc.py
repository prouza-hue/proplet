#!/usr/bin/env python3
"""Focused contract for the v4.01.10 database-aggregated XP leaderboard."""

from datetime import datetime
from pathlib import Path
import sys
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import server


sql = (ROOT / "SUPABASE_MIGRATION_V4_01_10.sql").read_text(encoding="utf-8")
runtime = (ROOT / "public" / "runtime-meta.js").read_text(encoding="utf-8")
version = (ROOT / "proplet_version.py").read_text(encoding="utf-8")

assert "proplet_rankings_xp_aggregate" in sql
assert "security invoker" in sql.lower()
assert "security definer" not in sql.lower()
assert "revoke all on function public.proplet_rankings_xp_aggregate" in sql.lower()
assert "grant execute on function public.proplet_rankings_xp_aggregate(timestamptz) to service_role" in sql.lower()
assert "r.calm_mode = false" in sql
assert "public.account_rewards" in sql
assert "public.streak_rescues" in sql
assert "team_code_at_completion" in sql
assert 'APP_VERSION = "4.01.13"' in version
assert "version:'4.01.13'" in runtime
assert "xpRankingAggregateV40110:true" in runtime

rpc_rows = [
    {"row_kind": "player", "entity_id": "p1", "period_xp": 125, "lifetime_xp": 625, "badge_count": 2},
    {"row_kind": "team", "entity_id": "TEAM", "period_xp": 100, "lifetime_xp": 0, "badge_count": 0},
]
period_start = datetime.fromisoformat("2026-08-24T00:00:00+02:00")
with patch.object(server, "db_rpc", return_value=rpc_rows) as rpc:
    period, lifetime, badges, teams = server._ranking_xp_aggregates(period_start)

rpc.assert_called_once_with(
    "proplet_rankings_xp_aggregate",
    {"p_period_start": "2026-08-24T00:00:00+02:00"},
)
assert period == {"p1": 125}
assert lifetime == {"p1": 625}
assert badges == {"p1": 2}
assert teams == {"TEAM": 100}

print("Proplet v4.01.10 XP ranking database aggregation contract: OK")
