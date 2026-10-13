"""Archive edition, server admission and authoritative account state contract."""
from contextlib import ExitStack
from copy import deepcopy
import json
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError
from backend import archive, results
from backend.config import load_settings
from backend.contracts import ResultCreate
import server

ROOT = Path(__file__).resolve().parents[2]
EDITION = archive.load_edition(str(ROOT))
REQUEST = SimpleNamespace(headers={"X-Proplet-Result-Receipt": "1"},
    state=SimpleNamespace(request_id="archive-test"), client=SimpleNamespace(host="127.0.0.1"),
    url=SimpleNamespace(path="/api/result"))
PLAYER = {"id": "00000000-0000-4000-8000-000000000071", "family_code": "SOLO_TEST"}
RECEIPT = {"commandId": "00000000-0000-4000-8000-000000000072", "firstCompletion": True,
           "awardedPoints": 15, "dailyGenerationUpgrade": False,
           "transferredSlot": False, "attemptStatus": "created_offline"}


def evidence(entry, index=0):
    return {"editionId": archive.EDITION, "solutionPolicyRevision": archive.REVISION,
            "found": deepcopy(entry["solutions"]["solutionSets"][index])}


def payload(entry, proof=True):
    return ResultCreate(puzzle_id=entry["puzzle"]["id"], challenge_key="free:" + entry["puzzle"]["id"],
        mode="free", difficulty=entry["difficulty"], elapsed_ms=62000, moves=len(entry["puzzle"]["answers"]),
        attempt_id="archive-runtime-fixture", completed_at="2026-10-13T12:00:00+00:00",
        archive_solution=evidence(entry) if proof else None)


def flags():
    stack = ExitStack()
    for name in ("ARCHIVE_ENABLED", "HISTORICAL_FREE_REWARDS_ENABLED", "ATOMIC_RESULT_V1_ENABLED"):
        stack.enter_context(patch.object(server, name, True))
    return stack


class ArchiveRuntime(unittest.TestCase):
    def test_asgi_routes_require_auth_only_for_private_state(self):
        entry = EDITION["boards"][0]
        def authenticate(authorization):
            if authorization != "Bearer fixture":
                raise HTTPException(401, "Přihlas se")
            return PLAYER
        with flags(), patch.object(server, "enforce_rate_limit"), patch.object(server, "auth_player", side_effect=authenticate), \
                patch.object(server, "db_rpc", return_value={"claims": {}, "completedPuzzleIds": []}):
            with TestClient(server.app) as client:
                catalogue = client.get("/api/archive")
                self.assertEqual(catalogue.status_code, 200)
                self.assertEqual(len(catalogue.json()["boards"]), 800)
                self.assertNotIn("puzzle", catalogue.json()["boards"][0])
                board = client.get("/api/archive/puzzle", params={"puzzle_id": entry["puzzle"]["id"]})
                self.assertEqual(board.status_code, 200)
                self.assertEqual(board.json()["puzzle"], entry["puzzle"])
                self.assertEqual(client.get("/api/archive/claims").status_code, 401)
                state = client.get("/api/archive/claims", headers={"Authorization": "Bearer fixture"})
                self.assertEqual(state.json(), {"editionId": archive.EDITION, "claims": {}, "completedPuzzleIds": []})
                self.assertIn("no-store", state.headers["cache-control"])
                self.assertEqual(client.get("/api/archive/puzzle?puzzle_id=not-in-edition").status_code, 404)
                with patch.object(server, "ARCHIVE_ENABLED", False):
                    self.assertEqual(client.get("/api/archive").status_code, 404)

    def test_all_879_approved_covers_and_all_rejected_editorial_covers(self):
        self.assertEqual(len(EDITION["byId"]), 800)
        count = 0
        for entry in EDITION["boards"]:
            for cover in entry["solutions"]["solutionSets"]:
                proof = evidence(entry)
                # Player discovery order differs from editorial order.
                proof["found"] = list(reversed(cover))
                archive.validate_completion(entry, proof)
                count += 1
        self.assertEqual(count, 879)
        decisions = json.loads((ROOT / "content/archives/free-gen3-v1/editorial-decisions.json").read_text())
        rejected = [row for row in decisions["decisions"] if row["projectPreparationDecision"] == "reject"]
        self.assertEqual(len(rejected), 21)
        for row in rejected:
            entry = EDITION["byId"][row["puzzleId"]]
            proof = evidence(entry)
            proof["found"] = row["completeSolution"]
            with self.assertRaises(ValueError):
                archive.validate_completion(entry, proof)

    def test_no_partial_forged_path_or_wrong_policy(self):
        entry = EDITION["boards"][0]
        original = evidence(entry)
        variants = []
        proof = deepcopy(original); proof["found"].pop(); variants.append(proof)
        proof = deepcopy(original); proof["found"][0]["path"].reverse(); variants.append(proof)
        proof = deepcopy(original); proof["found"][0]["word"] = "FORGED"; variants.append(proof)
        proof = deepcopy(original); proof["found"][1] = proof["found"][0]; variants.append(proof)
        proof = deepcopy(original); proof["solutionPolicyRevision"] = "old-policy"; variants.append(proof)
        proof = deepcopy(original); proof["editionId"] = "future-edition"; variants.append(proof)
        for proof in variants:
            with self.assertRaises(ValueError):
                archive.validate_completion(entry, proof)
        proof = deepcopy(original); proof["found"][0]["path"][0] = True
        with self.assertRaises(ValidationError):
            payload(entry).model_validate({**payload(entry).model_dump(), "archive_solution": proof})

    def test_gate_defaults_closed_and_requires_all_three_switches(self):
        with patch.dict("os.environ", {}, clear=True):
            self.assertFalse(load_settings().archive_enabled)
        with flags():
            self.assertTrue(server.archive_release_enabled())
            for name in ("ARCHIVE_ENABLED", "HISTORICAL_FREE_REWARDS_ENABLED", "ATOMIC_RESULT_V1_ENABLED"):
                with patch.object(server, name, False):
                    self.assertFalse(server.archive_release_enabled())
                    with self.assertRaises(HTTPException) as error:
                        server.archive_catalogue(REQUEST)
                    self.assertEqual(error.exception.status_code, 404)

    def test_validation_before_any_result_mutation(self):
        entry = EDITION["boards"][0]
        calls = []
        with flags(), ExitStack() as stack:
            stack.enter_context(patch.object(server, "enforce_rate_limit"))
            stack.enter_context(patch.object(server, "auth_player", return_value=PLAYER))
            stack.enter_context(patch.object(server, "db_select", return_value=[]))
            stack.enter_context(patch.object(server, "rankings_v2_schema_ready", return_value=False))
            stack.enter_context(patch.object(server, "db_atomic_result_rpc", side_effect=lambda name, body: calls.append((name, body)) or RECEIPT))
            self.assertEqual(server.result(payload(entry), REQUEST, "Bearer fixture")["awardedPoints"], 15)
            self.assertEqual(len(calls), 1)
            command = calls[0][1]["p_command"]
            self.assertEqual(command["legacyRewardSlot"], {"difficulty": "easy", "level": 1})
            self.assertEqual(command["points"], 15)
            for invalid in (payload(entry, False), payload(entry).model_copy(update={"mode": "daily"})):
                with self.assertRaises(HTTPException):
                    server.result(invalid, REQUEST, "Bearer fixture")
            self.assertEqual(len(calls), 1)

    def test_receipt_replay_survives_gate_closure_and_proof_is_bound_to_identity(self):
        entry = EDITION["boards"][0]
        submitted = payload(entry)
        identity = results.result_identity(PLAYER["id"], submitted)
        old = payload(entry, False)
        self.assertNotIn("archive_solution", results.canonical_request(old))
        changed = submitted.model_copy(deep=True)
        changed.archive_solution.found[0].word = "FORGED"
        self.assertNotEqual(identity.request_digest, results.result_identity(PLAYER["id"], changed).request_digest)
        saved = {"request_digest": identity.request_digest, "receipt": RECEIPT}
        with flags(), patch.object(server, "ARCHIVE_ENABLED", False), patch.object(server, "HISTORICAL_FREE_REWARDS_ENABLED", False), \
                patch.object(server, "auth_player", return_value=PLAYER), patch.object(server, "enforce_rate_limit"), \
                patch.object(server, "db_select", return_value=[saved]), patch.object(server, "db_atomic_result_rpc") as rpc:
            self.assertEqual(server.result(submitted, REQUEST, "Bearer fixture")["awardedPoints"], 15)
            rpc.assert_not_called()
            with self.assertRaises(HTTPException) as error:
                server.result(changed, REQUEST, "Bearer fixture")
            self.assertEqual(error.exception.status_code, 409)

    def test_claims_auth_authority_empty_and_read_failure(self):
        state = {"claims": {"legacy-free:easy:1": {"sourcePuzzleId": "g2-e-001", "points": 0}},
                 "completedPuzzleIds": ["g3-e-003"]}
        with flags(), patch.object(server, "auth_player", return_value=PLAYER), patch.object(server, "enforce_rate_limit"), \
                patch.object(server, "db_rpc", return_value=state) as rpc:
            response = server.archive_claims(REQUEST, "Bearer fixture")
            actual = json.loads(response.body)
            self.assertEqual(actual["claims"], state["claims"])
            self.assertEqual(actual["completedPuzzleIds"], ["g3-e-003"])
            self.assertEqual(response.headers["Cache-Control"], "private, no-store")
            self.assertEqual(rpc.call_args.args[1]["p_player_id"], PLAYER["id"])
            self.assertEqual(len(rpc.call_args.args[1]["p_puzzle_ids"]), 800)
            rpc.return_value = {"claims": {}, "completedPuzzleIds": []}
            self.assertEqual(json.loads(server.archive_claims(REQUEST, "Bearer fixture").body)["claims"], {})
            rpc.side_effect = HTTPException(404, "RPC missing")
            with self.assertRaises(HTTPException) as error:
                server.archive_claims(REQUEST, "Bearer fixture")
            self.assertEqual(error.exception.status_code, 503)


if __name__ == "__main__":
    unittest.main()
