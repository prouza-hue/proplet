from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
server = (ROOT / "server.py").read_text(encoding="utf-8")
backend_db = (ROOT / "backend" / "db.py").read_text(encoding="utf-8")
app = (ROOT / "public" / "app.js").read_text(encoding="utf-8")
runtime = (ROOT / "public" / "runtime-meta.js").read_text(encoding="utf-8")
sw = (ROOT / "public" / "sw.js").read_text(encoding="utf-8")
push = (ROOT / "push_diagnostics_v3329.py").read_text(encoding="utf-8")
migration = (ROOT / "SUPABASE_MIGRATION_V4_01_26.sql").read_text(encoding="utf-8")

assert 'APP_VERSION = "4.02.0"' in (ROOT / "proplet_version.py").read_text(encoding="utf-8")
assert "proplet-v4.02.0-game-session-shell" in sw
assert "proplet_http_5xx" in server and "response.status_code >= 500" in server
assert 'response.headers["X-Proplet-Version"] = APP_VERSION' in server
assert "proplet_upsert_push_subscription" in backend_db
assert "on conflict (endpoint) do update" in migration
assert "grant execute on function public.proplet_upsert_push_subscription" in migration
assert "'X-Proplet-Version':APP_VERSION" in app
assert 'return "legacy-unknown"' in server
assert "runtimeUpdateRequired&&screen!=='game'" in app
assert "proplet-auto-update-${targetVersion}" in app
assert "recoverRuntimeUpdate({automatic:true,targetVersion:canonicalVersion})" in app
assert "setInterval(checkForUpdate,5*60*1000)" in app
assert "proplet_push_return_cohort" in migration and "proplet_push_return_cohort" in push
assert "push-return" in push and '"push-return":"push_return_opened"' in app
assert "retentionTargeted" in push
assert 'category not in {"daily", "return"}' in push and 'group["returnTargeted"] += 1' in push
assert "atomicPushRegistrationV40126:true" in runtime

print("PASS: v4.01.26 atomic push, direct 5xx visibility, measured clients and targeted return push.")
