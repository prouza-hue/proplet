"""Fail a release build on unpublished Daily content or manifest drift."""
from pathlib import Path
import json,sys,re,hashlib
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from backend.dated_daily import DatedDaily,assert_no_private_payload,puzzle_digest

def check():
    pack=DatedDaily.load(ROOT/'data/daily_gen6_private.json')
    public=json.loads((ROOT/'public/puzzles.json').read_text())
    marker=public.get('datedDaily') or {}
    assert marker.get('cutover')==pack.cutover.isoformat()
    assert marker.get('activeUntil')==pack.active_until.isoformat()
    assert 'PROPLET_DATED_DAILY_ENABLED' in (ROOT/'vercel.json').read_text()
    assert not (ROOT/'public/data/daily_gen6_private.json').exists()
    proof=assert_no_private_payload(ROOT/'public',pack)
    print(json.dumps({'datedDailyCount':len(pack._bindings),'cutover':pack.cutover.isoformat(),'activeUntil':pack.active_until.isoformat(),'staticScan':proof},sort_keys=True))

if __name__=='__main__':check()
