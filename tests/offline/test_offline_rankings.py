#!/usr/bin/env python3
"""Offline Free time cannot enter post-win/global/team adapters or fallback."""
import sys
import unittest
from contextlib import ExitStack
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
import server
from backend.rankings import ranking_runs
from fastapi import HTTPException

class OfflineRankings(unittest.TestCase):
 def setUp(self):
  self.viewer={"id":"offline","name":"Offline","family_code":"TEAM","public_rankings":True}
  self.players=[self.viewer,{"id":"online","name":"Online","family_code":"TEAM","public_rankings":True}]
  self.rows=[dict(id="off",player_id="offline",puzzle_id="board",challenge_key="free:board",mode="free",difficulty="easy",elapsed_ms=1000,moves=12,calm_mode=False,timing_verified=False,completed_at="2026-10-15T10:00:00Z"),dict(id="on",player_id="online",puzzle_id="board",challenge_key="free:board",mode="free",difficulty="easy",elapsed_ms=20000,moves=12,calm_mode=False,timing_verified=True,completed_at="2026-10-15T10:00:00Z")]
  self.request=SimpleNamespace(headers={},state=SimpleNamespace(request_id="offline-ranking"),client=SimpleNamespace(host="127.0.0.1"),url=SimpleNamespace(path="/api/free-global-leaderboard"))

 def test_global_postwin_and_team_exclude_offline(self):
  def select(table,**kwargs):
   return self.players if table=="players" else self.rows if table=="puzzle_runs" else []
  with ExitStack() as stack:
   for item in (patch.object(server,"enforce_rate_limit",lambda *a,**k:None),patch.object(server,"auth_player",lambda _token:self.viewer),patch.object(server,"db_select",select),patch.object(server,"puzzle_info",lambda _id:{"difficulty":"easy","level":1}),patch.object(server,"free_puzzle_info",lambda _id:{"difficulty":"easy","level":1,"generation":4}),patch.object(server.ranking_queries,"ranking_runs",lambda *a,**k:(self.rows,"test")),patch.object(server.ranking_queries,"entity_context",lambda *a,**k:(self.players,[]))):
    stack.enter_context(item)
   world=server.free_global_leaderboard(self.request,"board","Bearer synthetic",None)
   team=server.puzzle_leaderboard(self.request,"board","TEAM","Bearer synthetic")
  self.assertEqual(world["total"],1)
  self.assertIsNone(world["myRank"])
  self.assertEqual([row["id"] for row in team["rows"]],["online"])
  self.assertTrue(all(row["elapsedMs"]!=1000 for row in world["rows"]))

 def test_rpc_fallback_also_excludes_offline(self):
  def unavailable(*args):
   raise HTTPException(503,"missing routine")
  rows,mode=ranking_runs(unavailable,lambda *a,**k:self.rows,mode="free",puzzle_id="board")
  self.assertEqual(mode,"bounded-compatibility-v1")
  self.assertEqual([row["player_id"] for row in rows],["online"])

if __name__=="__main__":
 unittest.main()
