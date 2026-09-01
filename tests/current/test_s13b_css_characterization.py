#!/usr/bin/env python3
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[2]
read=lambda p:(ROOT/p).read_text(encoding="utf-8")
theme=read("public/theme-init.js"); index=read("public/index.html")
baseline_files=[
"public/home-layout.css","public/today-brand.css","public/onboarding-fit.css","public/onboarding-model-v3328.css",
"public/profile-layout-v3330.css","public/settings-ia-v40122.css","public/settings-polish-v40122.css","public/account-auth.css"
]
new_files=["public/app-play.css","public/app-profile-settings.css","public/app-onboarding.css"]
baseline=all((ROOT/p).is_file() for p in baseline_files)
consolidated=all((ROOT/p).is_file() for p in new_files)
assert baseline ^ consolidated, "S13B must be fully baseline or fully consolidated"
for hook in ('id="screen-daily"','id="screen-free"','id="screen-leaderboard"','id="screen-profile"','id="onboardingModal"','id="profileModal"','id="levelDetailModal"'):
    assert hook in index, hook
# 13A and mixed-risk files are frozen out of this slice.
assert len(re.findall(r"!important",read("public/game.css")))==92
assert "#winModal .win-main-actions + .win-secondary-actions{margin-top:7px}" in read("public/results.css")
assert "#tutorialBoard .tutorial-cell[data-tidx=\"0\"]" in read("public/gesture-guard-v3325.css")
assert "body.game-tablet-portrait.game-tablet-landscape .game-main" in read("public/quality-hotfix-v334.css")
assert "html.quality-v334 #screen-free" in read("public/quality-v334.css")
if baseline:
    order=["/home-layout.css?v=10","/today-brand.css?v=4","/onboarding-fit.css?v=1","/onboarding-model-v3328.css?v=3",
           "/push-retention-v3329.css?v=1","/desktop-layout-v3330.css?v=3","/profile-layout-v3330.css?v=2",
           "/onboarding-return-v3332.css?v=1","/settings-ia-v40122.css?v=2","/settings-polish-v40122.css?v=2"]
    pos=[theme.index(x) for x in order]; assert pos==sorted(pos)
    expected={"public/home-layout.css":2,"public/today-brand.css":2,"public/onboarding-fit.css":0,
      "public/onboarding-model-v3328.css":0,"public/onboarding-return-v3332.css":0,"public/profile-layout-v3330.css":0,
      "public/settings-ia-v40122.css":27,"public/settings-polish-v40122.css":58,"public/push-retention-v3329.css":0,
      "public/account-auth.css":8,"public/desktop-layout-v3330.css":0}
    for p,n in expected.items(): assert len(re.findall(r"!important",read(p)))==n,(p,n)
    assert "#screen-daily.home-layout-active .daily-hero" in read("public/home-layout.css")
    assert "#screen-profile .achievement-card" in read("public/profile-layout-v3330.css")
    assert "#screen-profile.settings-open.active" in read("public/settings-ia-v40122.css")
else:
    for old in ["home-layout.css","today-brand.css","onboarding-fit.css","onboarding-model-v3328.css",
                "profile-layout-v3330.css","settings-ia-v40122.css","settings-polish-v40122.css","account-auth.css"]:
        assert old not in theme, old
    for new in ["/app-play.css","/app-profile-settings.css","/app-onboarding.css"]: assert new in theme
    assert "#screen-daily.home-layout-active .daily-hero" in read("public/app-play.css")
    assert "#screen-free .difficulty-grid" in read("public/desktop-layout-v3330.css")
    assert "#screen-profile .achievement-card" in read("public/app-profile-settings.css")
    assert "#screen-profile.settings-open.active" in read("public/app-profile-settings.css")
    assert ".onboard-principle" in read("public/app-onboarding.css")
    assert ".google-auth-btn" in read("public/app-profile-settings.css")
    assert (ROOT/"public/onboarding-return-v3332.css").is_file()
    assert (ROOT/"public/push-retention-v3329.css").is_file()
    assert (ROOT/"public/desktop-layout-v3330.css").is_file()
print("PASS Sprint 13B CSS characterization")
