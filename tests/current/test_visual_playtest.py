"""Authenticated pilot transport with fake RPC; never contacts a database."""
import unittest
from unittest.mock import Mock
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from backend import visual_playtest as pilot


class PilotTests(unittest.TestCase):
    def make(self, environment="production", capability=False, result=None):
        app = FastAPI()
        def auth(header):
            if header != "Bearer valid-session":
                raise HTTPException(401, "invalid")
            return {"id": "session-owned-id"}
        self.rpc = Mock(return_value=result if result is not None else {"eligible": False})
        self.rate = Mock()
        pilot.install(app, auth_player=auth, db_rpc=self.rpc, enforce_rate_limit=self.rate,
                      environment=environment, live_player_preview=capability)
        return TestClient(app, headers={"Authorization": "Bearer valid-session"})

    def test_auth_required_no_rpc(self):
        client = self.make()
        for method, kwargs in ((client.get, {}), (client.post, {"json": {"action": "accept"}})):
            self.assertEqual(method("/api/visual-playtest", headers={"Authorization": "Bearer other"}, **kwargs).status_code, 401)
        self.rpc.assert_not_called()

    def test_identity_and_campaign_server_owned(self):
        client = self.make()
        response = client.get("/api/visual-playtest?player_id=other&campaign=other")
        self.assertEqual(response.json(), {"eligible": False})
        self.assertEqual(response.headers["cache-control"], "no-store")
        self.assertEqual(self.rpc.call_args.args[1]["p_player"], "session-owned-id")
        self.assertEqual(self.rpc.call_args.args[1]["p_campaign"], pilot.CAMPAIGN_ID)
        self.assertEqual(self.rpc.call_args.args[1]["p_action"], "status")
        self.rpc.reset_mock()
        for extra in ({"player_id": "other"}, {"campaignId": "other"}, {"reviewer": True}):
            self.assertEqual(client.post("/api/visual-playtest", json={"action": "accept", **extra}).status_code, 422)
        self.rpc.assert_not_called()

    def test_preview_capability_is_explicit_boolean(self):
        for environment, flag, permitted in (("production", False, True), ("preview", False, False),
                ("preview", "true", False), ("preview", True, True), ("", True, False)):
            with self.subTest(environment=environment, flag=flag):
                client = self.make(environment, flag)
                self.assertEqual(client.get("/api/visual-playtest").status_code, 200)
                self.assertEqual(client.post("/api/visual-playtest", json={"action": "shown"}).status_code, 200 if permitted else 409)
                self.assertEqual(self.rpc.call_count, 2 if permitted else 0)

    def test_commands_validate_and_forward_without_fabricating_state(self):
        client = self.make(result={"eligible": True, "status": "invited", "shownCount": 2,
            "canShowInvite": False, "displayGranted": False, "role": "tester", "feedback": None,
            "player_id": "secret", "cohort": ["secret"], "previewUrl": "https://evil.invalid"})
        for action in ("shown", "accept", "snooze", "decline"):
            response = client.post("/api/visual-playtest", json={"action": action})
            self.assertEqual(response.status_code, 200)
            self.assertFalse(response.json()["displayGranted"])
            self.assertNotIn("player_id", response.json())
            self.assertNotIn("cohort", response.json())
            self.assertEqual(response.json()["previewUrl"], pilot.PREVIEW_URL)
            self.assertEqual(self.rpc.call_args.args[1]["p_action"], action)
        for rating in ("better", "similar", "worse", "unsure"):
            comment = "ž" * 2000
            self.assertEqual(client.post("/api/visual-playtest", json={"action": "feedback", "rating": rating, "comment": comment}).status_code, 200)
            self.assertEqual(self.rpc.call_args.args[1]["p_comment"], comment)
        self.rpc.reset_mock()
        for body in ({"action": "feedback"}, {"action": "feedback", "rating": "great"},
                     {"action": "feedback", "rating": "better", "comment": "x" * 2001},
                     {"action": "accept", "rating": "better"}, {"action": "oops"}):
            self.assertEqual(client.post("/api/visual-playtest", json=body).status_code, 422)
        self.rpc.assert_not_called()

    def test_saved_feedback_and_decline_and_failures(self):
        feedback = {"rating": "worse", "comment": "Saved", "submittedAt": "2026-10-28T00:00:00Z"}
        client = self.make(result={"eligible": True, "feedback": feedback})
        self.assertEqual(client.get("/api/visual-playtest").json()["feedback"], feedback)
        self.rpc.return_value = {"eligible": True, "error": "declined"}
        self.assertEqual(client.post("/api/visual-playtest", json={"action": "accept"}).status_code, 409)
        self.rpc.return_value = None
        self.assertEqual(client.get("/api/visual-playtest").status_code, 503)
        self.rpc.side_effect = HTTPException(503, "offline")
        self.assertEqual(client.post("/api/visual-playtest", json={"action": "accept"}).status_code, 503)

    def test_push_private_selection_and_cap(self):
        rows = [{"player_id": "pending", "status": "invited"},
                {"player_id": "accepted", "status": "accepted"},
                {"player_id": "declined", "status": "declined"},
                {"player_id": "feedback", "status": "invited", "feedback_at": "saved"},
                {"player_id": "later", "status": "invited", "snoozed_until": "9999-01-01T00:00:00Z"}]
        select = Mock(side_effect=[[{"active": True}], rows])
        self.assertEqual(pilot.campaign_state(select, environment="production"), {"active": True, "participant_ids": ["pending"]})
        self.assertEqual(select.call_args.kwargs["filters"]["reviewer"], "eq.false")
        self.assertEqual(select.call_args.kwargs["filters"]["active"], "eq.true")
        select = Mock(side_effect=[[{"active": True}], rows * 3])
        with self.assertRaises(HTTPException):
            pilot.campaign_state(select, environment="production")
        select = Mock()
        self.assertEqual(pilot.campaign_state(select, environment="preview", live_player_preview=True)["active"], False)
        select.assert_not_called()
        self.assertFalse(pilot.campaign_state(Mock(return_value=[{"active": False}]), environment="production")["active"])


if __name__ == "__main__":
    unittest.main()
