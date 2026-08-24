from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
app = (ROOT / "public" / "app.js").read_text(encoding="utf-8")
html = (ROOT / "public" / "index.html").read_text(encoding="utf-8")
runtime = (ROOT / "public" / "runtime-meta.js").read_text(encoding="utf-8")
server = (ROOT / "server.py").read_text(encoding="utf-8")
sw = (ROOT / "public" / "sw.js").read_text(encoding="utf-8")
version = (ROOT / "proplet_version.py").read_text(encoding="utf-8")
vercel = (ROOT / "vercel.json").read_text(encoding="utf-8")

assert 'APP_VERSION = "4.01.12"' in version
assert "version:'4.01.12'" in runtime
assert "proplet-v4.01.12-shell" in sw
assert "unifiedPushV4017:true" in runtime
assert "pushAutoRepairV4017:true" in runtime
assert "weeklyContentBannerV4017:true" in runtime
assert "/push-origin-v3325.js?v=2" in runtime

# One player-facing preference controls both delivery schedules.
assert html.count('id="pushToggleBtn"') == 1
assert 'id="contentPushToggleBtn"' not in html
assert "Jedno nastavení pro Denní výzvu i novou pondělní várku" in html
assert "daily_enabled:true,content_enabled:true" in app
assert "daily_enabled = content_enabled = enabled" in server
assert '@app.get("/api/push/account-state")' in server

# A lost or server-orphaned browser subscription is repaired without another CTA.
assert "push_notifications_auto_repaired" in app
assert "if(!pref.subscribed" in app
assert "if(prior.enabled)" in app
assert "disabledByUser" in app

# The first Monday drop has a visible play CTA, not just a background cron.
assert "nových Propletů je tady" in app
assert "PONDĚLNÍ NOVINKY" in app
assert "content_drop_cta_clicked" in app
assert '@app.get("/api/cron/content-push")' in server
assert '"path": "/api/cron/daily-push"' in vercel
assert "daily-push-v2" not in vercel
assert "![1,2].includes(Number(delta?.version||0))" in app
assert "content_preview" in app

print("Proplet v4.01.7 unified push, auto-repair and weekly content CTA: OK")
