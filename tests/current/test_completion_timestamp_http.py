"""Legacy result route submits the original completion, with unchanged result/XP semantics."""
from contextlib import ExitStack
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
import sys
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
import server

original='2026-10-31T22:59:59+00:00'
player={'id':'2329cdad-d562-456f-9d60-7a9bdf124c01','family_code':'SOLO_TEST'}
payload=server.ResultCreate(puzzle_id='qa-time',challenge_key='free:qa-time',mode='free',difficulty='easy',elapsed_ms=42000,moves=12,attempt_id='1230ae26-23d1-4c8e-8e76-d5f494879aa1',completed_at=original)
request=SimpleNamespace(headers={},state=SimpleNamespace(),client=SimpleNamespace(host='127.0.0.1'),url=SimpleNamespace(path='/api/result'))
results=[];attempt={'id':payload.attempt_id,'player_id':player['id'],'puzzle_id':payload.puzzle_id,'challenge_key':payload.challenge_key,'mode':'free','difficulty':'easy','completed_at':original}
writes=[]
def select(table,**filters):
    if table=='puzzle_attempts':return [attempt.copy()]
    if table=='results':return results.copy()
    raise AssertionError('unexpected external read '+table)
def insert(table,row):
    assert table=='results';results.append(row.copy());return [row]
def update(table,filters,row):
    writes.append((table,row.copy()))
    if table=='puzzle_attempts':attempt.update(row)
    elif table=='results':results[0].update(row)
    else:raise AssertionError(table)
with ExitStack() as stack:
    for name,value in [('ATOMIC_RESULT_V1_ENABLED',False),('auth_player',lambda _:player),('enforce_rate_limit',lambda *a,**k:None),('puzzle_exists',lambda *a:True),('validate_result_sanity',lambda *a:None),('free_puzzle_info',lambda *a:{'generation':4,'level':9,'puzzle':{}}),('is_puzzle_released',lambda *a:True),('rankings_v2_schema_ready',lambda:False),('record_puzzle_run',lambda *a:None),('player_stats',lambda *a:{'points':15}),('db_select',select),('db_insert',insert),('db_update',update)]:stack.enter_context(patch.object(server,name,value))
    first=server.result(payload,request,'Bearer fixture')
    again=server.result(payload,request,'Bearer fixture')
    assert first['firstCompletion'] is True and first['awardedPoints']==15
    assert again['firstCompletion'] is False and again['awardedPoints']==0 and len(results)==1
    for table,row in writes:
        if table=='puzzle_attempts':assert datetime.fromisoformat(row['completed_at'])==datetime.fromisoformat(original),'account sync substituted receive time'
    assert datetime.fromisoformat(results[0]['completed_at'])==datetime.fromisoformat(original)
print('PASS legacy result route: original day through delayed/repeated submit, one official result and unchanged XP')
