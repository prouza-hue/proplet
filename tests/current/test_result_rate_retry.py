"""Actual rate-guard HTTP boundary, with an isolated clock and quota RPC."""
import ast
from contextvars import ContextVar
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional
from unittest.mock import Mock
import math
import uuid
from fastapi import FastAPI, HTTPException, Request
from fastapi.testclient import TestClient

tree = ast.parse(Path("server.py").read_text(encoding="utf-8"))
guard = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "enforce_rate_limit")
class Clock(datetime):
    current = datetime(2026, 11, 3, 11, 13, 27, tzinfo=timezone.utc)
    @classmethod
    def now(cls, tz=None):
        return cls.current if tz else cls.current.replace(tzinfo=None)

events = []
rpc = Mock()
context = ContextVar("guard", default=None)
ns = dict(Optional=Optional, Request=Request, datetime=Clock, timezone=timezone,
          math=math, uuid=uuid, HTTPException=HTTPException, request_guard_context=context,
          _rate_actor_hash=lambda *_: "fixed-private-bucket", db_rpc=rpc,
          record_operational_event=lambda *args, **kwargs: events.append((args, kwargs)))
exec(compile(ast.Module(body=[guard], type_ignores=[]), "server.py", "exec"), ns)
player = "11111111-1111-4111-8111-111111111111"
attempt = "22222222-2222-4222-8222-222222222222"
app = FastAPI()
@app.post("/api/result")
def submit(request: Request, body: dict):
    request.state.request_id = "fixture-request"
    ns["enforce_rate_limit"](request, "result_submit", limit=120, window_seconds=3600,
                             discriminator=player, result_attempt_id=body.get("attempt_id"))
    return {"committed": True}
@app.post("/other")
def other(request: Request):
    ns["enforce_rate_limit"](request, "other", limit=120, window_seconds=3600)
    return {}
client = TestClient(app)

hits = 0
def quota(name, args):
    global hits
    hits += 1
    assert args["p_limit"] == 120 and args["p_window_seconds"] == 3600
    return {"allowed": hits <= 120, "reset_at": "2026-11-03T12:00:00Z"}
rpc.side_effect = quota
for _ in range(120):
    assert client.post("/api/result", json={"attempt_id": attempt}).status_code == 200
r = client.post("/api/result", json={"attempt_id": attempt, "private": "never-save"})
assert r.status_code == 429 and r.headers["retry-after"] == "2793"
assert len(events) == 1
metadata = events[0][1]["metadata"]
assert metadata["reporting_actor_key"] == "p:" + player
assert metadata["reported_attempt_id"] == attempt and metadata["attempt_link"] == "reported"
assert metadata["retry_after_seconds"] == 2793
assert "never-save" not in repr(events) and "Authorization" not in repr(events)
rpc.side_effect = None
for current, reset, expected in [
    ("2026-11-03T13:33:07Z", "2026-11-03T14:00:00Z", "1613"),
    ("2026-11-03T13:59:59.100Z", "2026-11-03T14:00:00Z", "1"),
    ("2026-11-03T14:00:00.100Z", "2026-11-03T14:00:00Z", "1"),
    ("2026-11-03T13:33:07Z", "bad", "3600"),
    ("2026-11-03T13:33:07Z", "2026-11-03T14:00:00", "3600"),
    ("2026-11-03T13:33:07Z", None, "3600"),
    ("2026-11-03T13:33:07Z", "2027-01-01T00:00:00Z", "3600"),
]:
    Clock.current = datetime.fromisoformat(current.replace("Z", "+00:00"))
    rpc.return_value = {"allowed": False, "reset_at": reset}
    r = client.post("/api/result", json={"attempt_id": "invalid-private-id"})
    assert r.headers["retry-after"] == expected
    assert "reported_attempt_id" not in events[-1][1]["metadata"]
rpc.return_value = {"allowed": False, "reset_at": "2026-11-03T14:00:00Z"}
assert client.post("/other").headers["retry-after"] == "3600"
assert events[-1][1]["metadata"] == {"rate_scope_actor": "fixed-private-bucket"}
rpc.return_value = {"allowed": True, "reset_at": "2026-11-03T15:00:00Z"}
assert client.post("/api/result", json={"attempt_id": attempt}).status_code == 200
# The production result handler supplies the actual declared attempt for this guard.
handler = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "result")
call = next(n for n in ast.walk(handler) if isinstance(n, ast.Call) and
            isinstance(n.func, ast.Name) and n.func.id == "enforce_rate_limit" and
            len(n.args) > 1 and isinstance(n.args[1], ast.Constant) and n.args[1].value == "result_submit")
assert any(k.arg == "result_attempt_id" and ast.unparse(k.value) == "payload.attempt_id"
           for k in call.keywords)
print("PASS fixed-bucket Retry-After, 120/121 boundary, safe reported linkage and unchanged other scopes")

