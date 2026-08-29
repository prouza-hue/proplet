import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
app = (ROOT / "public" / "app.js").read_text(encoding="utf-8")
html = (ROOT / "public" / "index.html").read_text(encoding="utf-8")
runtime = (ROOT / "public" / "runtime-meta.js").read_text(encoding="utf-8")
service_worker = (ROOT / "public" / "sw.js").read_text(encoding="utf-8")
quality = (ROOT / "public" / "quality-v334.js").read_text(encoding="utf-8")
server = (ROOT / "server.py").read_text(encoding="utf-8")
push = (ROOT / "push_diagnostics_v3329.py").read_text(encoding="utf-8")
migration = (ROOT / "SUPABASE_MIGRATION_V4_01_25.sql").read_text(encoding="utf-8")
analytics = (ROOT / "ANALYTICS_V4_CZ.md").read_text(encoding="utf-8")
vercel = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))

assert "4.01.35" in runtime
assert "canonicalUpdateProbeV40125:true" in runtime
assert "pushOpenTrackingV40125:true" in runtime
assert "d7ReturnMessagingV40125:true" in runtime

# A current client compares itself with the canonical release, while previews stay isolated.
assert "probeCanonicalRelease" in app
assert "https://hrajproplet.cz" in app
assert "local.environment==='preview'" in app
assert "Proplet běží na starší adrese" in app
assert "legacy_origin_update_shown" in app
assert "legacy_origin_update_opened" in app
assert "pwa_update_detected" in server
assert '"environment": VERCEL_ENV or "local"' in server

# Recovery clears replaceable shell files only. Player data, registrations and push survive.
assert "!key.startsWith('proplet-data-')" in app
assert ".unregister(" not in app
assert "Clear-Site-Data" not in server

# The rescue enhancement must not render Daily before the puzzle bank exists
# during a first-install service-worker handover.
assert "if(!puzzleDB)return;Promise.resolve(refreshRescueStatus()).catch(()=>{})" in quality
assert '/quality-v334.js?v=40132' in html
assert "'/quality-v334.js?v=40132'" in service_worker

# One cron owns Daily and Monday content; every notification returns to the canonical app.
assert vercel["crons"] == [{"path": "/api/cron/daily-push-v2", "schedule": "0 7 * * *"}]
assert 'f"{canonical_origin}/?open=daily&via=push-daily"' in push
assert 'f"{canonical_origin}/?open=free&new={batch.get(\'id\')}&via=push-weekly"' in push
assert "deliveryId" in push and "deliveryId" in service_worker
assert "https://hrajproplet.cz/api/push/open" in service_worker
assert '@app.post("/api/push/open")' in push

# Delivery-level opens are the source of truth for the D7 return funnel.
assert "opened_at timestamptz" in migration
assert "idx_push_delivery_log_opened_at" in migration
assert "push_delivery_log.opened_at" in analytics
assert "Ráno připomeneme jen nevyřešenou Denní výzvu" in html

print("PASS: v4.01.25 canonical update recovery and measurable D7 push return contract.")
