#!/usr/bin/env python3
"""Regression contract for resilient server-only Supabase RPC authentication."""

from pathlib import Path
import sys
from unittest.mock import Mock, patch

import httpx


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import server


runtime = (ROOT / "public" / "runtime-meta.js").read_text(encoding="utf-8")
version = (ROOT / "proplet_version.py").read_text(encoding="utf-8")
service_worker = (ROOT / "public" / "sw.js").read_text(encoding="utf-8")

assert 'APP_VERSION = "4.01.26"' in version
assert "version:'4.01.26'" in runtime
assert "supabaseRpcAuthRetryV40124:true" in runtime
assert "proplet-v4.01.26-shell" in service_worker


with patch.object(server, "SUPABASE_SECRET_KEY", "sb_secret_opaque"):
    opaque_headers = server._supabase_headers()
assert opaque_headers["apikey"] == "sb_secret_opaque"
assert "Authorization" not in opaque_headers

legacy_key = "eyJheader.payload.signature"
with patch.object(server, "SUPABASE_SECRET_KEY", legacy_key):
    legacy_headers = server._supabase_headers()
assert legacy_headers["apikey"] == legacy_key
assert legacy_headers["Authorization"] == f"Bearer {legacy_key}"


first = httpx.Response(401, request=httpx.Request("POST", "https://example.supabase.co/rest/v1/rpc/proplet_rate_limit"))
second = httpx.Response(
    200,
    json=[{"allowed": True, "remaining": 99, "reset_at": "2026-08-26T20:00:00Z"}],
    request=httpx.Request("POST", "https://example.supabase.co/rest/v1/rpc/proplet_rate_limit"),
)
retry_client = Mock()
retry_client.__enter__ = Mock(return_value=retry_client)
retry_client.__exit__ = Mock(return_value=False)
retry_client.post.return_value = second

with (
    patch.object(server, "SUPABASE_URL", "https://example.supabase.co"),
    patch.object(server, "SUPABASE_SECRET_KEY", "sb_secret_opaque"),
    patch.object(server.DB_HTTP_CLIENT, "post", return_value=first) as pooled_post,
    patch.object(server.httpx, "Client", return_value=retry_client) as fresh_client,
):
    result = server.db_rpc("proplet_rate_limit", {"p_scope": "test"})

assert result[0]["allowed"] is True
pooled_post.assert_called_once()
fresh_client.assert_called_once_with(timeout=12.0)
assert retry_client.post.call_args.kwargs["headers"]["Connection"] == "close"

print("PASS: current release retries one transient Supabase RPC 401 without weakening rate limits.")
