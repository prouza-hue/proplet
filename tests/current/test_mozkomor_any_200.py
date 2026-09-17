"""Unlock parity: weekly and new boards count, retries/legacy transfers don't."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
import server

def row(puzzle):
    return {'mode':'free','difficulty':'hardcore','puzzle_id':puzzle['id']}

base=server.load_puzzles()['free']['hardcore'][:197]
weekly=server.load_rolling_content()['puzzles']['hardcore'][:3]
rows=list(map(row,base+weekly))
assert server.free_slot_summary(rows)['baseCurrent']['hardcore']==197
assert server.mozkomor_unlocked_from_rows(rows)
server.enforce_mozkomor_unlock(rows)  # same guard used by session and result
assert not server.mozkomor_unlocked_from_rows(rows[:-1])
assert not server.mozkomor_unlocked_from_rows(rows[:-1]+[rows[0]]*10)
assert server.mozkomor_unlocked_from_rows(rows+rows)
new=[p for p in server.load_puzzles()['free']['hardcore'] if p['id'].startswith('g5-r1-')][:3]
assert server.mozkomor_unlocked_from_rows(list(map(row,base+new)))
assert server.mozkomor_unlocked_from_rows([{'mode':'free','difficulty':'mozkomor'}])
print('PASS 197 base + 3 weekly/new boards unlock; 199 and duplicate runs do not')

# Exercise both real HTTP handlers with synthetic dependencies, never a live DB.
from contextlib import ExitStack
from unittest.mock import patch
from starlette.requests import Request
from backend.contracts import ResultCreate
from backend.play_sessions import SessionCommand
from fastapi import HTTPException
request=Request({'type':'http','method':'POST','path':'/api/result','headers':[], 'client':('127.0.0.1',1)})
player={'id':'00000000-0000-4000-8000-000000000123'}
payload=ResultCreate(puzzle_id='g4-z-001',challenge_key='free:g4-z-001',mode='free',difficulty='mozkomor',elapsed_ms=131000,moves=17,attempt_id='synthetic-preserved-attempt')
with ExitStack() as stack:
    for name,value in {'enforce_rate_limit':lambda *a,**k:None,'auth_player':lambda *a:player,'db_select':lambda table,**k:rows if table=='results' else [],'rankings_v2_schema_ready':lambda:False,'atomic_result_public_response':lambda p,r:r}.items():
        stack.enter_context(patch.object(server,name,value))
    stack.enter_context(patch.object(server,'ATOMIC_RESULT_V1_ENABLED',True))
    submit=stack.enter_context(patch.object(server.result_domain,'submit_atomic',return_value={'firstCompletion':True,'awardedPoints':150}))
    result=server.result(payload,request,authorization='synthetic')
    assert result['awardedPoints']==150
    command=submit.call_args.args[0]
    assert command['elapsedMs']==131000 and command['moves']==17 and command['attemptId']==payload.attempt_id
    stack.enter_context(patch.object(server,'telemetry_actor',return_value={'player_id':player['id']}))
    stack.enter_context(patch.object(server,'play_session_config',return_value={'enabled':True}))
    execute=stack.enter_context(patch.object(server.play_sessions,'execute',return_value={'verified':True}))
    session=SessionCommand(action='open',puzzle_id=payload.puzzle_id,challenge_key=payload.challenge_key,mode='free',difficulty='mozkomor',attempt_id=payload.attempt_id,owner_id=player['id'],sequence=1)
    assert server.play_session_command(session,request,authorization='synthetic')['verified']
    execute.assert_called_once()
    with patch.object(server,'db_select',side_effect=lambda table,**k:rows[:-1] if table=='results' else []):
        try:
            server.result(payload,request,authorization='synthetic')
            raise AssertionError('199 boards must not submit a Mozkomor result')
        except HTTPException as error:
            assert error.status_code==403
print('PASS session/result handlers accept preserved queued completion at 200, reject 199')
