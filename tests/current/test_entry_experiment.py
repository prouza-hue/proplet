"""HTTP boundary: no client-selected branch, production QA excluded, retry after close."""
from unittest.mock import Mock, patch
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient
from backend import entry_experiment as entry, measurement


def check_http_contract():
    app = FastAPI()
    rpc = Mock(return_value={"variant": None})
    actor = Mock(return_value={"anonymous_id": "a" * 64})
    entry.install(app, telemetry_actor=actor, db_rpc=rpc, enforce_rate_limit=Mock(),
                  environment="production", app_version="qa")

    @app.middleware("http")
    async def provenance(request, call_next):
        token = measurement.context.set(measurement.request_context(request, "production"))
        try:
            return await call_next(request)
        finally:
            measurement.context.reset(token)

    client = TestClient(app)
    url = "/api/entry-experiment/assignment"
    body = {"first_steps_run_id": str(uuid4()), "variant": "B", "p_enroll": True}
    with patch.dict("os.environ", {"PROPLET_ENTRY_EXPERIMENT_ENABLED": "1"}):
        assert all(entry.enabled(env) for env in ("local", "preview", "production"))
        assert not entry.enabled("unknown")
        assert client.post(url, json=body).json() == {"variant": None}
        rpc_name, args = rpc.call_args.args
        assert rpc_name == "proplet_entry_assign_v1"
        assert args["p_enroll"] is True and args["p_is_test"] is False
        assert args["p_anonymous_id"] == "a" * 64 and "variant" not in args
        rpc.reset_mock()
        assert client.post(url, json=body, headers={"X-Proplet-Test": "1"}).json() == {"variant": None}
        rpc.assert_not_called()

    with patch.dict("os.environ", {"PROPLET_ENTRY_EXPERIMENT_ENABLED": "0"}):
        rpc.return_value = {"variant": "B", "key": "new-player-entry-v1", "firstStepsRunId": body["first_steps_run_id"]}
        assert client.post(url, json=body).json()["variant"] == "B"
        assert rpc.call_args.args[1]["p_enroll"] is False


if __name__ == "__main__":
    check_http_contract()
    print("PASS entry assignment HTTP gates and closed-window retries")
