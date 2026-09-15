"""Preview write guards must follow the routed path even with a malformed Host."""
from pathlib import Path
import sys
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from fastapi.testclient import TestClient
import server

client = TestClient(server.app)
with patch.object(server, "VERCEL_ENV", "preview"), patch.object(server, "db_insert") as insert:
    for host in ("localhost", "example.invalid/abc?bar=", "example.invalid/api/config?"):
        response = client.post("/api/result", headers={"host": host}, json={})
        assert response.status_code == 409, (host, response.status_code)
        response = client.post("/api/attempt/start", headers={"host": host}, json={})
        assert response.status_code == 200 and response.json()["ignored"] is True
    insert.assert_not_called()
print("PASS: preview guards use the routing path, including hostile Host headers")
