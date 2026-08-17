#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_one(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    n = text.count(old)
    if n != 1:
        raise RuntimeError(f"{path}: expected one match, got {n}: {old[:100]!r}")
    path.write_text(text.replace(old, new), encoding="utf-8")


def finalize_specs() -> None:
    path = ROOT / "tools" / "generate_puzzles.py"
    text = path.read_text(encoding="utf-8")
    start = text.index("SPECS = {")
    end = text.index("\n\ndef progression_variant_index", start)
    specs = '''SPECS = {
    "rescue": [
        dict(rows=6, cols=6, cells=(20, 24), words=(4, 5), min_len=4, max_len=6, dict_size=5000, cand=(4, 28),
             style="dense", min_curvy=0, min_spiral=0),
    ],
    "easy": [
        dict(rows=6, cols=6, cells=(28, 32), words=(6, 7), min_len=4, max_len=7, dict_size=6500, cand=(5, 40),
             style="dense", min_curvy=0, min_spiral=0),
    ],
    # Medium has its own identity: paths stay readable, while search area and the
    # number of words grow every 50 levels. This raises difficulty without making
    # Medium feel like a smaller Hard board.
    "medium": [
        dict(rows=8, cols=8, cells=(46, 52), words=(8, 9), min_len=4, max_len=8, dict_size=8750, cand=(8, 180),
             style="dense", min_curvy=0, min_spiral=0),
        dict(rows=8, cols=9, cells=(52, 58), words=(8, 10), min_len=4, max_len=9, dict_size=9000, cand=(10, 240),
             style="dense", min_curvy=0, min_spiral=0),
        dict(rows=9, cols=9, cells=(58, 64), words=(9, 10), min_len=4, max_len=9, dict_size=9250, cand=(10, 300),
             style="dense", min_curvy=0, min_spiral=0),
        dict(rows=9, cols=9, cells=(62, 68), words=(10, 11), min_len=4, max_len=9, dict_size=9500, cand=(12, 380),
             style="dense", min_curvy=0, min_spiral=0),
    ],
    # Hard starts at roughly the same board scale as late Medium, then changes the
    # nature of the challenge: winding geometry appears gradually and the vocabulary
    # begins with a gentler B/C bridge before moving to the normal Hard mix.
    "hard": [
        dict(rows=9, cols=9, cells=(64, 70), words=(10, 11), min_len=4, max_len=9, dict_size=9500, cand=(12, 480),
             style="winding", turn_bias=.18, curl_bias=.08, min_curvy=3, min_spiral=1, max_short_words=2),
        dict(rows=9, cols=9, cells=(66, 72), words=(10, 12), min_len=4, max_len=9, dict_size=9750, cand=(12, 580),
             style="winding", turn_bias=.24, curl_bias=.13, min_curvy=4, min_spiral=1, max_short_words=2),
        dict(rows=9, cols=9, cells=(68, 74), words=(11, 12), min_len=4, max_len=9, dict_size=10000, cand=(14, 700),
             style="winding", turn_bias=.30, curl_bias=.18, min_curvy=4, min_spiral=1, max_short_words=2),
        dict(rows=10, cols=10, cells=(72, 80), words=(11, 13), min_len=4, max_len=9, dict_size=10250, cand=(14, 850),
             style="winding", turn_bias=.34, curl_bias=.22, min_curvy=5, min_spiral=2, max_short_words=2),
    ],
    "hardcore": [
        dict(rows=10, cols=10, cells=(78, 88), words=(12, 15), min_len=4, max_len=10, dict_size=10500, cand=(18, 700),
             style="winding", turn_bias=.38, curl_bias=.25, min_curvy=6, min_spiral=2, max_short_words=2),
    ],
}
'''
    path.write_text(text[:start] + specs + text[end:], encoding="utf-8")


def finalize_gen3_writer() -> None:
    path = ROOT / "tools" / "generate_free_generation3.py"
    text = path.read_text(encoding="utf-8")
    text = text.replace(
        '''    for bank in data.get("legacyDaily", []):\n        for p in bank.get("puzzles", []):\n            used_signatures.add((p["rows"], p["cols"], tuple(p["letters"])))\n''',
        '''    for bank in data.get("legacyDaily", []):\n        for p in bank.get("puzzles", []):\n            if p.get("rows") and p.get("cols") and p.get("letters"):\n                used_signatures.add((p["rows"], p["cols"], tuple(p["letters"])))\n''',
    )
    old = '''    encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))\n    DATA.write_text(encoded, encoding="utf-8")\n    PUBLIC.write_text(encoded, encoding="utf-8")\n'''
    new = '''    encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))\n    DATA.write_text(encoded, encoding="utf-8")\n\n    # New players download only active content. Historical Free boards remain server-side\n    # for old results and the rare in-progress migration. A compact id -> level index is\n    # enough for local stable-slot bookkeeping without leaking generation concepts into UI.\n    legacy_index = {}\n    for difficulty in DIFFICULTIES:\n        for puzzle in legacy[difficulty]:\n            meta = puzzle.get("meta") or {}\n            legacy_index[puzzle["id"]] = {\n                "difficulty": difficulty,\n                "level": int(meta.get("level") or 0),\n                "generation": int(meta.get("contentGeneration") or 1),\n            }\n    public_payload = json.loads(json.dumps(payload))\n    public_payload["legacyFreeIndex"] = legacy_index\n    public_payload["legacyFree"] = {difficulty: [] for difficulty in DIFFICULTIES}\n    public_payload["publicLegacyMode"] = "compact-index"\n    PUBLIC.write_text(json.dumps(public_payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")\n'''
    if old not in text:
        raise RuntimeError("Gen3 writer output block not found")
    path.write_text(text.replace(old, new), encoding="utf-8")


def finalize_audit() -> None:
    path = ROOT / "tools" / "audit_free_generation3.py"
    text = path.read_text(encoding="utf-8")
    text = text.replace(
        "    assert data == public\n",
        '''    assert data.get("free") == public.get("free")\n    assert public.get("publicLegacyMode") == "compact-index"\n    assert all(not bank for bank in (public.get("legacyFree") or {}).values())\n''',
    )
    text = text.replace(
        '''    legacy_ids = {p["id"] for bank in (data.get("legacyFree") or {}).values() for p in bank}\n    assert not active_ids & legacy_ids\n''',
        '''    legacy_ids = {p["id"] for bank in (data.get("legacyFree") or {}).values() for p in bank}\n    assert not active_ids & legacy_ids\n    public_legacy_index = public.get("legacyFreeIndex") or {}\n    assert legacy_ids == set(public_legacy_index), (len(legacy_ids), len(public_legacy_index))\n    assert DATA.stat().st_size > PUBLIC.stat().st_size\n''',
    )
    text = text.replace(
        '''        "rollingRechecked": rolling_checked, "rejectedTargetWordsAbsent": sorted(REJECTED),\n        "bands": summaries,\n''',
        '''        "rollingRechecked": rolling_checked, "rejectedTargetWordsAbsent": sorted(REJECTED),\n        "serverPuzzleBytes": DATA.stat().st_size, "publicPuzzleBytes": PUBLIC.stat().st_size,\n        "publicLegacyIndexEntries": len(public.get("legacyFreeIndex") or {}),\n        "bands": summaries,\n''',
    )
    path.write_text(text, encoding="utf-8")


def finalize_app() -> None:
    path = ROOT / "public" / "app.js"
    text = path.read_text(encoding="utf-8")
    start = text.index("function freePuzzleSlot(puzzleId,diffHint=null){")
    end = text.index("\nfunction localFreeSlotState", start)
    new_slot = '''function freePuzzleSlot(puzzleId,diffHint=null){
 if(!puzzleId||!puzzleDB)return null;const diffs=diffHint&&DIFF[diffHint]?[diffHint]:Object.keys(DIFF);
 for(const diff of diffs){const active=puzzleDB.free?.[diff]||[];for(let i=0;i<active.length;i++){const p=active[i];if(p.id===puzzleId)return {difficulty:diff,level:Number(p.meta?.level)||i+1,generation:Number(p.meta?.contentGeneration)||Number(puzzleDB.freeGeneration)||1,legacy:false,puzzle:p}}}
 const indexed=puzzleDB.legacyFreeIndex?.[puzzleId];if(indexed&&(!diffHint||indexed.difficulty===diffHint))return {difficulty:indexed.difficulty,level:Number(indexed.level)||0,generation:Number(indexed.generation)||1,legacy:true,puzzle:null};
 for(const diff of diffs){const legacy=puzzleDB.legacyFree?.[diff]||[];for(let i=legacy.length-1;i>=0;i--){const p=legacy[i];if(p.id===puzzleId)return {difficulty:diff,level:Number(p.meta?.level)||i+1,generation:Number(p.meta?.contentGeneration)||1,legacy:true,puzzle:p}}}
 return null;
}'''
    text = text[:start] + new_slot + text[end:]

    start = text.index("function resumableFreePuzzle(diff,list){")
    end = text.index("\n\nfunction currentLocalStats", start)
    new_resume = '''function resumableFreePuzzle(diff,list){
 const s=getState(),rows=Object.values(s.inProgress||{}).filter(r=>r?.mode==='free'&&r.difficulty===diff&&!s.completed?.[`free:${r.puzzleId}`]).sort((a,b)=>(b.savedAt||0)-(a.savedAt||0));if(!rows.length)return null;
 const row=rows[0],active=list.find(p=>p.id===row.puzzleId);if(active)return active;const info=freePuzzleSlot(row.puzzleId,diff);return info?{id:row.puzzleId,difficulty:diff,meta:{level:info.level},__archiveResume:true}:null;
}
async function archivedFreePuzzle(puzzleId){const payload=await api(`/api/free-archive?puzzle_id=${encodeURIComponent(puzzleId)}`);return payload?.puzzle||null}'''
    text = text[:start] + new_resume + text[end:]

    old_start = '''function startFree(diff){\n const list=sortedFreeBank(diff),slots=localFreeSlotState(diff),resume=resumableFreePuzzle(diff,list),unrewarded=list.filter(p=>!slots.effective.has(Number(p.meta?.level))),unplayed=list.filter(p=>!slots.actual.has(Number(p.meta?.level)));\n const p=resume||(unrewarded[0]||unplayed[0]||list[0]);if(p)startGame(p,'free',null);\n}'''
    new_start = '''async function startFree(diff){\n const list=sortedFreeBank(diff),slots=localFreeSlotState(diff),resume=resumableFreePuzzle(diff,list),unrewarded=list.filter(p=>!slots.effective.has(Number(p.meta?.level))),unplayed=list.filter(p=>!slots.actual.has(Number(p.meta?.level)));\n let p=resume||(unrewarded[0]||unplayed[0]||list[0]);if(p?.__archiveResume){try{p=await archivedFreePuzzle(p.id)}catch{showToast('Rozehranou úroveň se teď nepodařilo načíst. Otevřu další v pořadí.');p=unrewarded[0]||unplayed[0]||list[0]}}if(p)startGame(p,'free',null);\n}'''
    if old_start not in text:
        raise RuntimeError("startFree block not found")
    path.write_text(text.replace(old_start, new_start), encoding="utf-8")


def finalize_server() -> None:
    path = ROOT / "server.py"
    text = path.read_text(encoding="utf-8")
    # Public, read-only compatibility endpoint for a single historical Free board.
    marker = '''@app.get("/api/played-levels")\ndef played_levels(\n'''
    endpoint = '''@app.get("/api/free-archive")\ndef free_archive(\n    request: Request,\n    puzzle_id: str = Query(min_length=2, max_length=80),\n):\n    """Return one historical Free board only when an existing client needs to resume it."""\n    enforce_rate_limit(request, "free_archive_read", limit=60, window_seconds=3600)\n    info = free_puzzle_info(puzzle_id)\n    if not info or info.get("legacy") is not True:\n        raise HTTPException(404, "Archivovaná úroveň nebyla nalezena")\n    return {"puzzle": info["puzzle"], "difficulty": info["difficulty"], "level": info["level"]}\n\n\n@app.get("/api/played-levels")\ndef played_levels(\n'''
    if marker not in text:
        raise RuntimeError("played-levels endpoint marker not found")
    text = text.replace(marker, endpoint, 1)

    # Cross-difficulty health: unlike Difficulty Index, this deliberately compares the ladder itself.
    marker = '''    rows.sort(key=lambda r: (0 if r["flag"] in {"too_hard","too_easy","watch"} else 1, -(abs(r["difficultyIndex"] or 0)), -(r["starts"] or 0)))\n    priorities = [r for r in rows if r["flag"] in {"too_hard", "too_easy", "watch"]]\n    helper_summary = {}\n'''
    ladder = '''    rows.sort(key=lambda r: (0 if r["flag"] in {"too_hard","too_easy","watch"} else 1, -(abs(r["difficultyIndex"] or 0)), -(r["starts"] or 0)))\n    priorities = [r for r in rows if r["flag"] in {"too_hard", "too_easy", "watch"]]\n\n    band_ranges = ((1, 50), (51, 100), (101, 150), (151, 200))\n    active_free = pdata.get("free") or {}\n    active_level: dict[str, tuple[str, int, dict]] = {}\n    for difficulty, bank in active_free.items():\n        for index, puzzle in enumerate(bank, start=1):\n            level = int((puzzle.get("meta") or {}).get("level") or index)\n            active_level[str(puzzle.get("id"))] = (difficulty, level, puzzle)\n\n    def ladder_average(values):\n        values = [float(value) for value in values if value is not None]\n        return round(sum(values) / len(values), 3) if values else None\n\n    def ladder_band(difficulty: str, start_level: int, end_level: int) -> dict:\n        puzzles = [\n            puzzle for _, level, puzzle in active_level.values()\n            if puzzle.get("difficulty") == difficulty and start_level <= level <= end_level\n        ]\n        puzzle_ids = {str(puzzle.get("id")) for puzzle in puzzles}\n        attempts_band = [a for a in first_attempts if str(a.get("puzzle_id")) in puzzle_ids and a.get("mode") == "free"]\n        completed_band = [a for a in attempts_band if a.get("completed_at")]\n        times = [int(a.get("elapsed_ms")) for a in completed_band if a.get("elapsed_ms") is not None]\n        hints_band = [int(a.get("hints_used") or 0) for a in completed_band]\n        wrong_band = [int(a.get("wrong_attempts") or 0) for a in completed_band]\n        clean_band = [1 if a.get("clean_solve") is True else 0 for a in completed_band]\n        turns = [int(answer.get("turns") or 0) for puzzle in puzzles for answer in (puzzle.get("answers") or [])]\n        scores = [(puzzle.get("meta") or {}).get("difficultyScore") for puzzle in puzzles]\n        cells = [len(puzzle.get("mask") or []) for puzzle in puzzles]\n        words = [len(puzzle.get("answers") or []) for puzzle in puzzles]\n        return {\n            "key": f"{start_level}-{end_level}", "from": start_level, "to": end_level, "puzzles": len(puzzles),\n            "structure": {\n                "meanCells": ladder_average(cells), "meanWords": ladder_average(words),\n                "meanDifficultyScore": ladder_average(scores), "meanTurnsPerWord": ladder_average(turns),\n                "lowTurnShare": round(sum(1 for turn in turns if turn <= 1) / len(turns), 3) if turns else None,\n            },\n            "behavior": {\n                "starts": len(attempts_band), "completed": len(completed_band),\n                "completionRate": round(len(completed_band) / len(attempts_band), 3) if attempts_band else None,\n                "medianMs": _median(times), "avgHints": ladder_average(hints_band),\n                "avgWrong": ladder_average(wrong_band), "cleanRate": ladder_average(clean_band),\n            },\n        }\n\n    difficulty_ladder = {"bands": {}}\n    for difficulty in ("easy", "medium", "hard", "hardcore"):\n        difficulty_ladder["bands"][difficulty] = [ladder_band(difficulty, start, end) for start, end in band_ranges]\n    late_medium = difficulty_ladder["bands"]["medium"][-1]\n    early_hard = difficulty_ladder["bands"]["hard"][0]\n    medium_ms = late_medium["behavior"].get("medianMs")\n    hard_ms = early_hard["behavior"].get("medianMs")\n    time_ratio = round(hard_ms / medium_ms, 2) if medium_ms and hard_ms else None\n    medium_completion = late_medium["behavior"].get("completionRate")\n    hard_completion = early_hard["behavior"].get("completionRate")\n    completion_drop = round(medium_completion - hard_completion, 3) if medium_completion is not None and hard_completion is not None else None\n    if time_ratio is None:\n        bridge_status = "awaiting_data"\n    elif time_ratio > 3.0 or (completion_drop is not None and completion_drop > 0.20):\n        bridge_status = "cliff"\n    elif time_ratio > 2.0 or (completion_drop is not None and completion_drop > 0.12):\n        bridge_status = "watch"\n    else:\n        bridge_status = "healthy"\n    difficulty_ladder["bridge"] = {\n        "status": bridge_status, "timeRatio": time_ratio, "completionDrop": completion_drop,\n        "lateMedium": late_medium, "earlyHard": early_hard,\n    }\n\n    helper_summary = {}\n'''
    if marker not in text:
        raise RuntimeError("quality ladder insertion marker not found")
    text = text.replace(marker, ladder, 1)
    text = text.replace('''        "priorities": priorities[:30],\n        "rows": rows,\n''', '''        "priorities": priorities[:30],\n        "difficultyLadder": difficulty_ladder,\n        "rows": rows,\n''', 1)
    path.write_text(text, encoding="utf-8")


def finalize_admin() -> None:
    path = ROOT / "public" / "admin.js"
    text = path.read_text(encoding="utf-8")
    marker = '''function qualityFlag(row){const flag=row.flag||'ok';return `<span class="flag ${flag}">${flag==='too_hard'?'Příliš těžká':flag==='too_easy'?'Příliš lehká':flag==='watch'?'Sledovat':'OK'}</span>`}\nfunction renderQuality(){\n'''
    replacement = '''function qualityFlag(row){const flag=row.flag||'ok';return `<span class="flag ${flag}">${flag==='too_hard'?'Příliš těžká':flag==='too_easy'?'Příliš lehká':flag==='watch'?'Sledovat':'OK'}</span>`}\nfunction renderDifficultyLadder(data){\n const ladder=data.difficultyLadder;if(!ladder?.bands)return '';const rows=[];for(const diff of ['easy','medium','hard','hardcore'])for(const band of ladder.bands[diff]||[]){const s=band.structure||{},b=band.behavior||{};rows.push(`<tr><td><strong>${esc(DIFF[diff]||diff)}</strong><small>${esc(band.key)}</small></td><td>${s.meanCells==null?'—':Number(s.meanCells).toFixed(1)}</td><td>${s.meanWords==null?'—':Number(s.meanWords).toFixed(1)}</td><td>${s.meanTurnsPerWord==null?'—':Number(s.meanTurnsPerWord).toFixed(2)}</td><td>${fmtPct(s.lowTurnShare)}</td><td>${b.starts||0}</td><td>${fmtPct(b.completionRate)}</td><td>${fmtTime(b.medianMs)}</td></tr>`)}\n const bridge=ladder.bridge||{},labels={healthy:'Most vypadá zdravě ✓',watch:'Most sledovat',cliff:'Pozor: obtížnostní cliff',awaiting_data:'Čeká na data hráčů'},klass=bridge.status==='cliff'?'warn':'ok',note=bridge.timeRatio==null?'Statická struktura je vidět hned; behaviorální poměr se dopočítá z nových pokusů.':`Těžká / pozdní Střední: ${Number(bridge.timeRatio).toFixed(2)}× čas · rozdíl dokončení ${bridge.completionDrop==null?'—':fmtPct(bridge.completionDrop)}.`;\n return `<section class="section-panel panel"><p class="eyebrow">OBTÍŽNOSTNÍ RAMPA</p><h2>Progrese napříč celou hrou</h2><div class="launch-health ${klass}"><b>${esc(labels[bridge.status]||bridge.status||'—')}</b><span>${esc(note)}</span></div><div class="table-panel"><table class="data-table"><thead><tr><th>Obtížnost</th><th>Políčka</th><th>Slova</th><th>Zatáčky/slovo</th><th>≤1 zatáčka</th><th>Pokusy</th><th>Dokončení</th><th>Medián</th></tr></thead><tbody>${rows.join('')}</tbody></table></div></section>`;\n}\nfunction renderQuality(){\n'''
    if marker not in text:
        raise RuntimeError("admin quality marker not found")
    text = text.replace(marker, replacement, 1)
    old = ''' $('#qualityContent').className='';$('#qualityContent').innerHTML=`<div class="kpi-grid">'''
    new = ''' $('#qualityContent').className='';$('#qualityContent').innerHTML=`${renderDifficultyLadder(data)}<div class="kpi-grid">'''
    if old not in text:
        raise RuntimeError("admin quality render marker not found")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def main() -> None:
    finalize_specs()
    finalize_gen3_writer()
    finalize_audit()
    finalize_app()
    finalize_server()
    finalize_admin()
    print("Finalized v3.31.6 progression architecture")


if __name__ == "__main__":
    main()
