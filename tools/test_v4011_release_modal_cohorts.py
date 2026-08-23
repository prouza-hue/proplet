#!/usr/bin/env python3
"""Keep the Gen4 launch message universal and the XP repair message cohort-only."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
app = (root / "public" / "app.js").read_text(encoding="utf-8")
quality = (root / "public" / "quality-v334.js").read_text(encoding="utf-8")
runtime = (root / "public" / "runtime-meta.js").read_text(encoding="utf-8")

assert "const GEN4_MODAL_KEY='proplet-gen4-release-modal-v1'" in quality
assert "const GEN4_XP_MODAL_KEY='proplet-gen4-xp-reward-modal-v1'" in quality
assert "function shouldShowReleaseModal()" in quality
assert "function xpRepairAffected()" in quality
assert "getState()?.gen4XpRepairNotice===true" in quality
assert "Number(stats.gen4RewardRepairXp||0)-Number(stats.gen4ReturnBonusAwardedNow||0)" in quality
assert "else if(shouldShowXpModal())" in quality
assert "activeReleaseModal==='xp'?xpModalKey():GEN4_MODAL_KEY" in quality
assert "Nové úrovně jsou tady!" in quality
assert "Tvoje nové desky už dávají XP!" in quality
assert "missingBoardXp=true" in app
assert "state.gen4XpRepairNotice=true" in app
assert "proplet:gen4-xp-repair" in app and "proplet:gen4-xp-repair" in quality
assert "proplet:profile-refreshed" in app and "proplet:profile-refreshed" in quality
assert "releaseModalCohortsV4011:true" in runtime

print("Proplet v4.01.5 release modal cohorts: OK")
