from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

server = (ROOT / "server.py").read_text(encoding="utf-8")
app = (ROOT / "public" / "app.js").read_text(encoding="utf-8")
quality = (ROOT / "public" / "quality-v334.js").read_text(encoding="utf-8")
index = (ROOT / "public" / "index.html").read_text(encoding="utf-8")
analytics = (ROOT / "public" / "analytics-init.js").read_text(encoding="utf-8")
privacy = (ROOT / "public" / "privacy.html").read_text(encoding="utf-8")
sw = (ROOT / "public" / "sw.js").read_text(encoding="utf-8")
runtime = (ROOT / "public" / "runtime-meta.js").read_text(encoding="utf-8")
version = (ROOT / "proplet_version.py").read_text(encoding="utf-8")

assert 'APP_VERSION = "4.01.7"' in version
assert "version:'4.01.7'" in runtime
assert "analyticsCoverageV4016:true" in runtime
assert "proplet-v4.01.7-shell" in sw

for path in ("/_vercel/insights/script.js", "/_vercel/speed-insights/script.js"):
    assert path in index
assert "url.search=''" in analytics and "url.hash=''" in analytics
assert "u.pathname.startsWith('/_vercel/')" in sw

for event in (
    "app_session_started", "account_created", "account_logged_in",
    "progress_guard_desktop_shown", "difficulty_nudge_shown",
    "onboarding_principle_completed", "valid_nonsolution_detected",
    "push_nudge_accepted", "calm_run_enabled",
):
    assert f'"{event}"' in server

assert "trackAppSession()" in app
assert "screen_${screen}_viewed" in app
assert "push_nudge_shown" in app and "push_permission_denied" in app
assert "calm_preference_enabled" in quality and "calm_run_enabled" in quality
assert "Vercel Web Analytics a Speed Insights" in privacy
assert "identifikátor návštěvníka se automaticky mění po 24 hodinách" in privacy

print("PASS: v4.01.7 first-party analytics, complete event coverage and privacy contract")
