from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
server = (ROOT / "server.py").read_text(encoding="utf-8")
app = (ROOT / "public" / "app.js").read_text(encoding="utf-8")
sharing_js = (ROOT / "public" / "competitive-sharing-v3331.js").read_text(encoding="utf-8")
sharing_server = (ROOT / "competitive_sharing_v3331.py").read_text(encoding="utf-8")
push = (ROOT / "push_diagnostics_v3329.py").read_text(encoding="utf-8")
migration = (ROOT / "SUPABASE_MIGRATION_V4_01_14.sql").read_text(encoding="utf-8")
vercel = (ROOT / "vercel.json").read_text(encoding="utf-8")
analytics = (ROOT / "ANALYTICS_V4_CZ.md").read_text(encoding="utf-8")

assert "alter column player_id drop not null" in migration
assert "push_subscriptions_actor_check" in migration
assert "push_delivery_log_actor_check" in migration
assert "idx_push_subscriptions_anonymous_id" in migration

assert 'x_proplet_anon_id: Optional[str] = Header(default=None, alias="X-Proplet-Anon-ID")' in server
assert 'actor = telemetry_actor(authorization, x_proplet_anon_id)' in server
assert '"pushSubscriptions": 0' in server
assert '"push_daily_opened", "push_weekly_opened", "push_content_opened"' in server
assert '"anonymous_id": sub.get("anonymous_id")' in server

for event in (
    "daily_share_clicked", "daily_share_created", "shared_daily_opened",
    "shared_daily_started", "shared_daily_completed", "level_share_clicked",
    "level_share_created", "shared_level_opened", "shared_level_started",
    "shared_level_completed",
):
    assert f'"{event}"' in sharing_server
    assert event in sharing_js

assert "u.searchParams.set('via','share-daily')" in sharing_js
assert "daily_share_native_completed" in sharing_js
assert "daily_share_clipboard_completed" in sharing_js
assert "level_share_native_completed" in sharing_js
assert "level_share_clipboard_completed" in sharing_js
assert "if(playDaily)playDaily.onclick=startDaily" in sharing_js

assert "trackInboundCampaign()" in app
assert '"push-weekly":"push_weekly_opened"' in app
assert "['daily','free'].includes(g?.mode)" in app
assert "if(!p?.token||g?.mode!=='daily'" not in app

assert '"path": "/api/cron/daily-push-v2"' in vercel
assert "push-weekly" in push
assert 'event_key = f"content:{batch.get(\'id\')}"' in push
assert '"anonymous_id": sub.get("anonymous_id")' in push
assert "PWA, push a share funnel od v4.01.14" in analytics

print("PASS: v4.01.14 complete share/PWA/push funnel and anonymous retention opt-in contracts.")
