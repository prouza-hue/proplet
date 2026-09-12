"""Account sync must not mistake a PostgREST page for complete history."""
import sys
from pathlib import Path
from unittest.mock import patch
import pytest
from fastapi import HTTPException
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from backend import db
import server


def history_transport(rows, cap=1000):
    def request(method, table, *, params):
        assert method == 'GET'
        assert params['player_id'] == 'eq.test-player'
        assert params['order'] == 'id.asc'
        after = params.get('id', 'gt.').removeprefix('gt.')
        return [r for r in rows if r['id'] > after][:cap]
    return request


@pytest.mark.parametrize('count,cap', [(0,1000),(1000,1000),(1049,1000),(2049,500)])
@pytest.mark.parametrize('table', ['results','account_rewards','streak_rescues'])
def test_complete_account_history(count, cap, table):
    rows = [{'id':f'{i:08d}'} for i in range(count)]
    assert db.db_select(table, history_transport(rows,cap), player_id='test-player') == rows


def test_progress_recovers_new_levels_after_first_thousand():
    rows = [{'id':f'{i:08d}', 'challenge_key':f'free:test-{i}', 'mode':'free',
             'puzzle_id':f'test-{i}', 'points':100} for i in range(1049)]
    with patch.object(server,'auth_player',return_value={'id':'test-player'}), \
         patch.object(server,'enforce_rate_limit'), \
         patch.object(server,'free_puzzle_info',return_value=None), \
         patch.object(server,'db_request',side_effect=history_transport(rows)):
        result = server.progress(object(),'Bearer test')['completed']
    assert len(result)==1049
    assert result[-1]['challengeKey']=='free:test-1048'
    assert sum(r['points'] for r in result)==104900


def test_later_page_error_never_returns_partial_history():
    calls = 0
    def request(*args, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 1: return [{'id':'0001'}]
        raise HTTPException(503,'Unavailable')
    with pytest.raises(HTTPException):
        db.db_select('results',request,player_id='test-player')


def test_point_lookup_remains_single_request():
    with patch.object(db,'db_request',return_value=[]) as request:
        db.db_select('results',player_id='test-player',challenge_key='free:g4-e-001')
    request.assert_called_once_with('GET','results',params={
        'select':'*','player_id':'eq.test-player','challenge_key':'eq.free:g4-e-001'})


def test_reward_guard_sees_completion_beyond_first_page():
    rows = [{'id':f'{i:08d}', 'mode':'daily', 'points':100} for i in range(1000)]
    rows.append({'id':'00001000','mode':'free','difficulty':'hardcore',
                 'puzzle_id':'g4-x-202','points':100})
    with patch.object(server,'db_request',side_effect=history_transport(rows)), \
         patch.object(server,'free_puzzle_info',return_value={'level':202}):
        assert server.free_slot_already_rewarded('test-player','hardcore',202)


def test_stalled_cursor_fails_instead_of_looping():
    with pytest.raises(HTTPException):
        db.db_select('results',lambda *a, **k: [{'id':'0001'}],player_id='test-player')
