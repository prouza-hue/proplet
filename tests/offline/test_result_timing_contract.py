#!/usr/bin/env python3
"""Offline trust is immutable request evidence, without changing legacy retries."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from backend.contracts import ResultCreate
from backend import results
from fastapi import HTTPException


class OfflineTrustContract(unittest.TestCase):
    def setUp(self):
        self.legacy = dict(puzzle_id="g4-e-001", challenge_key="free:g4-e-001", mode="free", difficulty="easy", elapsed_ms=42000, moves=12, attempt_id="offline-attempt-0001", completed_at="2026-10-15T10:00:00Z")

    def command(self, payload):
        return results.build_command(results.result_identity("player", payload), payload, completed_at=payload.completed_at, points=15, content_generation=4, free_level=1, legacy_reward_slot=None, team_code_at_completion=None)

    def test_legacy_and_explicit_false_keep_old_identity_and_command(self):
        legacy = ResultCreate(**self.legacy)
        explicit_false = ResultCreate(**self.legacy, timing_unverified=False)
        self.assertEqual(results.canonical_request(self.legacy), results.canonical_request(legacy))
        self.assertEqual(results.result_identity("player", legacy), results.result_identity("player", explicit_false))
        self.assertNotIn("timing_unverified", results.canonical_request(legacy))
        self.assertNotIn("timingUnverified", self.command(legacy))

    def test_offline_has_same_attempt_key_and_different_immutable_digest(self):
        online = ResultCreate(**self.legacy)
        offline = ResultCreate(**self.legacy, timing_unverified=True)
        first, second = [results.result_identity("player", row) for row in (online, offline)]
        self.assertEqual(first.idempotency_key, second.idempotency_key)
        self.assertNotEqual(first.request_digest, second.request_digest)
        self.assertEqual(results.canonical_request(offline)["timing_unverified"], True)
        command = self.command(offline)
        self.assertIs(command["timingUnverified"], True)
        self.assertEqual(command["points"], 15)
        self.assertFalse(command["calmMode"], "offline play does not pretend the player selected calm mode")
        self.assertEqual(command["commandDigest"], results.canonical_digest({key:value for key,value in command.items() if key != "commandDigest"}))

    def test_recorded_hints_preserve_offline_trust(self):
        offline = ResultCreate(**self.legacy, timing_unverified=True, clean_solve=True)
        merged = results.preserve_recorded_attempt_flags(offline, {"hints_used":2, "max_hint_level":1})
        self.assertTrue(merged.timing_unverified)
        self.assertEqual(merged.hints_used, 2)
        self.assertFalse(merged.clean_solve)

    def test_new_rpc_gates_offline_regular_and_special_before_sql_migration(self):
        receipt = {"firstCompletion":True,"awardedPoints":15,"dailyGenerationUpgrade":False,"transferredSlot":False}
        for special in (False,True):
            for offline in (False,True):
                payload=ResultCreate(**self.legacy,timing_unverified=offline)
                command=self.command(payload)
                if special:
                    command["mode"]="daily_special"
                calls=[]
                def rpc(name,body):
                    calls.append((name,body))
                    return receipt
                self.assertEqual(results.submit_atomic(command,rpc),receipt)
                expected=(results.OFFLINE_SPECIAL_RPC_NAME if special else results.OFFLINE_RPC_NAME) if offline else (results.SPECIAL_RPC_NAME if special else results.RPC_NAME)
                self.assertEqual(calls[0][0],expected)
                if offline:
                    self.assertEqual(calls[0][1],{"p_command":command})
                    calls.clear()
                    def old_database(name,body):
                        calls.append(name)
                        raise results.map_atomic_rpc_error(404,{"code":"PGRST202","message":"Could not find the function"})
                    with self.assertRaises(HTTPException) as failure:
                        results.submit_atomic(command,old_database)
                    self.assertEqual(failure.exception.status_code,503)
                    self.assertEqual(calls,[expected],"missing safe RPC never falls back to the older timing-blind writer")
                else:
                    self.assertEqual(calls[0][1]["p_player_id"],"player")


if __name__ == "__main__":
    unittest.main()
