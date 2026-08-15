#!/usr/bin/env python3
"""Apply the small runtime/UI part of Proplet v3.24 deterministically.

The large puzzle bank is generated separately by generate_daily_v324.py. This
patcher deliberately uses strict anchors and refuses to guess if main changed.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SERVER = ROOT / "server.py"
APP = ROOT / "public" / "app.js"
INDEX = ROOT / "public" / "index.html"
STYLES = ROOT / "public" / "styles.css"
SW = ROOT / "public" / "sw.js"


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text:
        return
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected exactly one anchor, found {count}: {old[:80]!r}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def replace_all(path: Path, old: str, new: str, expected: int) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text and old not in text:
        return
    count = text.count(old)
    if count != expected:
        raise RuntimeError(f"{path}: expected {expected} matches, found {count}: {old[:80]!r}")
    path.write_text(text.replace(old, new), encoding="utf-8")


def patch_server() -> None:
    replace_once(SERVER, 'APP_VERSION = "3.23.1"', 'APP_VERSION = "3.24.0"')
    text = SERVER.read_text(encoding="utf-8")
    marker = "def previous_daily_bank(data: Optional[dict] = None) -> Optional[dict]:"
    if marker not in text:
        start = text.index("def daily_rotation_index(")
        end = text.index("\ndef is_daily_generation_upgrade", start)
        block = '''def daily_rotation_index(daily_date: str, bank_size: int, base_date: str = "2026-01-01") -> int:
    if bank_size <= 0:
        raise HTTPException(503, "Daily banka je prázdná")
    try:
        d = date.fromisoformat(daily_date)
        base = date.fromisoformat(base_date)
    except ValueError:
        raise HTTPException(400, "Neplatné datum")
    return (d - base).days % bank_size


def legacy_daily_banks(data: Optional[dict] = None) -> list[dict]:
    pdata = data or load_puzzles()
    return [bank for bank in pdata.get("legacyDaily", []) if bank.get("puzzles")]


def previous_daily_bank(data: Optional[dict] = None) -> Optional[dict]:
    pdata = data or load_puzzles()
    bank = pdata.get("previousDaily") or {}
    return bank if bank.get("puzzles") else None


def legacy_daily_bank_by_generation(generation: int, data: Optional[dict] = None) -> Optional[dict]:
    pdata = data or load_puzzles()
    return next((bank for bank in legacy_daily_banks(pdata) if int(bank.get("generation") or 0) == int(generation)), None)


def daily_bank_puzzle_id(bank: dict, daily_date: str, fallback_base: str = "2026-01-01") -> str:
    puzzles = bank.get("puzzles") or []
    base = str(bank.get("rotationBaseDate") or fallback_base)
    return puzzles[daily_rotation_index(daily_date, len(puzzles), base)]["id"]


def expected_daily_puzzle_id(daily_date: str) -> str:
    """Return the primary Daily board for a date without rewriting history."""
    data = load_puzzles()
    try:
        d = date.fromisoformat(daily_date)
    except ValueError:
        raise HTTPException(400, "Neplatné datum")

    switch3_raw = data.get("dailyGeneration3From")
    try:
        switch3 = date.fromisoformat(str(switch3_raw)) if switch3_raw else None
    except ValueError:
        switch3 = None
    if switch3 and d >= switch3:
        bank = data.get("daily", [])
        base = str(data.get("dailyRotationBaseDate") or switch3.isoformat())
        return bank[daily_rotation_index(daily_date, len(bank), base)]["id"]

    switch2_raw = data.get("dailyGeneration2From")
    try:
        switch2 = date.fromisoformat(str(switch2_raw)) if switch2_raw else None
    except ValueError:
        switch2 = None
    if switch2 and d >= switch2:
        previous = previous_daily_bank(data)
        if previous and int(previous.get("generation") or 0) == 2:
            return daily_bank_puzzle_id(previous, daily_date)
        legacy2 = legacy_daily_bank_by_generation(2, data)
        if legacy2:
            return daily_bank_puzzle_id(legacy2, daily_date)
        if int(data.get("dailyGeneration") or 1) == 2:
            bank = data.get("daily", [])
            return bank[daily_rotation_index(daily_date, len(bank))]["id"]

    legacy1 = legacy_daily_bank_by_generation(1, data)
    if legacy1:
        return daily_bank_puzzle_id(legacy1, daily_date)

    # Defensive fallback for old/local data snapshots without generation metadata.
    bank = data.get("daily", [])
    base = str(data.get("dailyRotationBaseDate") or "2026-01-01")
    return bank[daily_rotation_index(daily_date, len(bank), base)]["id"]


def valid_daily_puzzle_ids(daily_date: str) -> set[str]:
    """Accept the primary board plus archived generations for cached/offline clients."""
    data = load_puzzles()
    ids = {expected_daily_puzzle_id(daily_date)}

    active = data.get("daily", [])
    if active:
        base = str(data.get("dailyRotationBaseDate") or data.get("dailyGeneration3From") or "2026-01-01")
        ids.add(active[daily_rotation_index(daily_date, len(active), base)]["id"])

    previous = previous_daily_bank(data)
    if previous:
        ids.add(daily_bank_puzzle_id(previous, daily_date))

    for legacy_bank in legacy_daily_banks(data):
        ids.add(daily_bank_puzzle_id(legacy_bank, daily_date))
    return ids


def daily_puzzle_matches_date(puzzle_id: str, daily_date: str) -> bool:
    return puzzle_id in valid_daily_puzzle_ids(daily_date)
'''
        text = text[:start] + block + text[end:]
        SERVER.write_text(text, encoding="utf-8")

    old_resolved = '''    if mode == "daily":
        for p in data.get("daily", []):
            if p.get("id") == puzzle_id and p.get("difficulty") == difficulty:
                return p
        for bank in legacy_daily_banks(data):
            for p in bank.get("puzzles", []):
                if p.get("id") == puzzle_id and p.get("difficulty") == difficulty:
                    return p
        return None
'''
    new_resolved = '''    if mode == "daily":
        for p in data.get("daily", []):
            if p.get("id") == puzzle_id and p.get("difficulty") == difficulty:
                return p
        previous = previous_daily_bank(data)
        if previous:
            for p in previous.get("puzzles", []):
                if p.get("id") == puzzle_id and p.get("difficulty") == difficulty:
                    return p
        for bank in legacy_daily_banks(data):
            for p in bank.get("puzzles", []):
                if p.get("id") == puzzle_id and p.get("difficulty") == difficulty:
                    return p
        return None
'''
    replace_once(SERVER, old_resolved, new_resolved)

    old_info = '''    for p in data.get("daily", []):
        if p.get("id") == puzzle_id:
            return {"puzzle": p, "difficulty": p.get("difficulty"), "mode": "daily", "level": None, "legacy": False, "generation": int(data.get("dailyGeneration") or 1)}
    for bank in reversed(legacy_daily_banks(data)):
        for p in bank["puzzles"]:
            if p.get("id") == puzzle_id:
                return {"puzzle": p, "difficulty": p.get("difficulty"), "mode": "daily", "level": None, "legacy": True, "generation": int(bank.get("generation") or 1)}
'''
    new_info = '''    for p in data.get("daily", []):
        if p.get("id") == puzzle_id:
            return {"puzzle": p, "difficulty": p.get("difficulty"), "mode": "daily", "level": None, "legacy": False, "generation": int(data.get("dailyGeneration") or 1)}
    previous = previous_daily_bank(data)
    if previous:
        for p in previous.get("puzzles", []):
            if p.get("id") == puzzle_id:
                return {"puzzle": p, "difficulty": p.get("difficulty"), "mode": "daily", "level": None, "legacy": True, "generation": int(previous.get("generation") or 2)}
    for bank in reversed(legacy_daily_banks(data)):
        for p in bank["puzzles"]:
            if p.get("id") == puzzle_id:
                return {"puzzle": p, "difficulty": p.get("difficulty"), "mode": "daily", "level": None, "legacy": True, "generation": int(bank.get("generation") or 1)}
'''
    replace_once(SERVER, old_info, new_info)

    replace_once(
        SERVER,
        '        "dailyGeneration2From": pdata.get("dailyGeneration2From"),\n',
        '        "dailyGeneration2From": pdata.get("dailyGeneration2From"),\n        "dailyGeneration3From": pdata.get("dailyGeneration3From"),\n        "dailyRotationBaseDate": pdata.get("dailyRotationBaseDate"),\n        "dailyCadence": pdata.get("dailyCadence"),\n'
    )
    replace_once(
        SERVER,
        '        "dailyRotationSize": p["dailyRotationSize"],\n',
        '        "dailyRotationSize": p["dailyRotationSize"],\n        "dailyGeneration": p.get("dailyGeneration"),\n        "dailyGeneration3From": p.get("dailyGeneration3From"),\n        "dailyCadence": p.get("dailyCadence"),\n'
    )


def patch_app() -> None:
    replace_once(APP, "const APP_VERSION='3.22.1';", "const APP_VERSION='3.24.0';")
    old = '''function dayNumber(iso){const [y,m,d]=iso.split('-').map(Number);return Math.floor((Date.UTC(y,m-1,d)-Date.UTC(2026,0,1))/86400000)}
function dailyPuzzleFor(iso){const n=puzzleDB.daily.length;const i=((dayNumber(iso)%n)+n)%n;return puzzleDB.daily[i]}
'''
    new = '''function dayOffsetISO(iso,base){const [y,m,d]=iso.split('-').map(Number),[by,bm,bd]=base.split('-').map(Number);return Math.floor((Date.UTC(y,m-1,d)-Date.UTC(by,bm-1,bd))/86400000)}
function dailyBankFor(iso){const switchDate=puzzleDB.dailyGeneration3From||null,previous=puzzleDB.previousDaily;if(switchDate&&iso<switchDate&&previous?.puzzles?.length)return {bank:previous.puzzles,base:previous.rotationBaseDate||'2026-01-01'};return {bank:puzzleDB.daily||[],base:puzzleDB.dailyRotationBaseDate||switchDate||'2026-01-01'}}
function dailyPuzzleFor(iso){const source=dailyBankFor(iso),n=source.bank.length;if(!n)throw new Error('Daily banka je prázdná');const i=((dayOffsetISO(iso,source.base)%n)+n)%n;return source.bank[i]}
function mondayWeekdayIndex(iso){const [y,m,d]=iso.split('-').map(Number),day=new Date(Date.UTC(y,m-1,d,12)).getUTCDay();return (day+6)%7}
function renderDailyWeekRhythm(iso){const root=$('#dailyWeekRhythm');if(!root)return;const cadence=puzzleDB.dailyCadence||{},pattern=cadence.pattern||['easy','easy','medium','medium','medium','hard','hard'],labels=cadence.labels||['Po','Út','St','Čt','Pá','So','Ne'],activeFrom=cadence.activeFrom||puzzleDB.dailyGeneration3From||null,active=!activeFrom||iso>=activeFrom,today=active?mondayWeekdayIndex(iso):-1;root.classList.toggle('pending',!active);root.innerHTML=`<div class="daily-week-rhythm-head"><strong>${active?'Týdenní rytmus':'Od pondělí 17. 8.'}</strong><span>2 snadné · 3 střední · 2 těžké</span></div><div class="daily-week-days">${pattern.map((diff,i)=>`<span class="daily-week-day ${diff} ${i===today?'active':''}" title="${labels[i]} · ${DIFF[diff]?.label||diff}"><b>${labels[i]}</b><i>${DIFF[diff]?.icon||'•'}</i></span>`).join('')}</div>`}
'''
    replace_once(APP, old, new)
    replace_once(
        APP,
        " $('#dailyDate').textContent=formatDateCZ(date);$('#dailyMeta').textContent=`${DIFF[p.difficulty].label} · ${countCz(p.meta.cells,'políčko','políčka','políček')} · ${countCz(p.answers.length,'slovo','slova','slov')}`;\n",
        " $('#dailyDate').textContent=formatDateCZ(date);$('#dailyMeta').textContent=`${DIFF[p.difficulty].label} · ${countCz(p.meta.cells,'políčko','políčka','políček')} · ${countCz(p.answers.length,'slovo','slova','slov')}`;renderDailyWeekRhythm(date);\n"
    )

    f_old = 'class="win-word" style="background:color-mix(in srgb,${COLORS[f.colorIndex%COLORS.length]} 55%,white)"'
    f_new = 'class="win-word" style="--word-color:${COLORS[f.colorIndex%COLORS.length]};background:color-mix(in srgb,${COLORS[f.colorIndex%COLORS.length]} 55%,white)"'
    replace_all(APP, f_old, f_new, 3)
    i_old = 'class="win-word" style="background:color-mix(in srgb,${COLORS[i%COLORS.length]} 55%,white)"'
    i_new = 'class="win-word" style="--word-color:${COLORS[i%COLORS.length]};background:color-mix(in srgb,${COLORS[i%COLORS.length]} 55%,white)"'
    replace_all(APP, i_old, i_new, 1)


def patch_index() -> None:
    replace_once(
        INDEX,
        '            <p id="dailyMeta" class="hero-muted"></p>\n',
        '            <p id="dailyMeta" class="hero-muted"></p>\n            <div id="dailyWeekRhythm" class="daily-week-rhythm" aria-label="Týdenní rytmus obtížnosti"></div>\n'
    )
    replace_once(INDEX, 'Proplet v3.23.1', 'Proplet v3.24.0')


def patch_styles() -> None:
    text = STYLES.read_text(encoding="utf-8")
    if "v3.24 — Monday Daily cadence" in text:
        return
    block = r'''

/* ==============================
   v3.24 — Monday Daily cadence + dark result chips
   ============================== */
.daily-week-rhythm{position:relative;z-index:2;margin:-7px 0 13px;padding:9px 10px;border:1px solid rgba(255,255,255,.14);border-radius:14px;background:rgba(255,255,255,.08);backdrop-filter:blur(8px)}
.daily-week-rhythm-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:7px;color:rgba(255,255,255,.92)}.daily-week-rhythm-head strong{font-size:10.5px;text-transform:uppercase;letter-spacing:.06em}.daily-week-rhythm-head span{font-size:10px;color:rgba(255,255,255,.68);font-weight:750}.daily-week-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}.daily-week-day{min-width:0;min-height:31px;display:flex;align-items:center;justify-content:center;gap:3px;border:1px solid rgba(255,255,255,.11);border-radius:10px;background:rgba(255,255,255,.07);color:rgba(255,255,255,.7)}.daily-week-day b{font-size:9px}.daily-week-day i{font-style:normal;font-size:12px;opacity:.78}.daily-week-day.active{background:#fff;color:#5548bd;border-color:#fff;box-shadow:0 4px 12px rgba(28,20,78,.18);transform:translateY(-1px)}.daily-week-day.active i{opacity:1}.daily-week-rhythm.pending .daily-week-day{opacity:.58}.daily-week-rhythm.pending .daily-week-rhythm-head strong{color:#ffe7a4}
@media(max-width:390px){.daily-week-rhythm{padding:8px;margin-bottom:11px}.daily-week-rhythm-head span{font-size:9px}.daily-week-day{gap:1px}.daily-week-day b{font-size:8.5px}.daily-week-day i{font-size:11px}}

/* Result words use the same colour token as solved cells/found chips in night mode. */
html[data-theme="dark"] .win-word{background:color-mix(in srgb,var(--word-color,#72d9b7) 70%,#211f2c)!important;color:#0c0b10;text-shadow:0 1px 0 rgba(255,255,255,.10);border:1px solid color-mix(in srgb,var(--word-color,#72d9b7) 72%,#383240)}
'''
    STYLES.write_text(text + block, encoding="utf-8")


def patch_sw() -> None:
    replace_once(SW, "const CACHE='proplet-v3.23.1-launch-readiness-single-team';", "const CACHE='proplet-v3.24.0-daily-weekly-cadence';")


def main() -> None:
    patch_server()
    patch_app()
    patch_index()
    patch_styles()
    patch_sw()
    print("Applied Proplet v3.24 runtime/UI patch.")


if __name__ == "__main__":
    main()
