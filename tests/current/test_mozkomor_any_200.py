"""Released difficulties work without history; result/session safeguards stay active.

The historical filename remains in the current-suite manifest. All DB and auth
dependencies in these handler tests are synthetic; no live data is accessed.
"""
import sys
from contextlib import ExitStack
from datetime import date
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException
from starlette.requests import Request

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import server
from backend import content, progress
from backend.contracts import ResultCreate
from backend.play_sessions import SessionCommand

request = Request({'type': 'http', 'method': 'POST', 'path': '/api/result',
                   'headers': [], 'client': ('127.0.0.1', 1)})
player = {'id': '00000000-0000-4000-8000-000000000123', 'name': 'Nový hráč'}
anonymous = {'anonymous_id': '00000000-0000-4000-8000-000000000124'}


def rejected(call, status):
    try:
        call()
    except HTTPException as error:
        assert error.status_code == status, error
    else:
        raise AssertionError(f'Expected HTTP {status}')


# Old consumers may still pass a threshold or a false cached projection.
for count in (0, 1, 100, 199, 200):
    slots = {'current': {'hardcore': count}}
    assert server.mozkomor_unlocked_from_rows([], slots) is True
    assert content.mozkomor_unlocked_from_rows([], slots, required=200) is True
assert progress.calculate_stats([], today=date(2026, 10, 2), badges=server.BADGES,
    free_difficulties=server.FREE_DIFFICULTIES, mozkomor_unlocked=False)['mozkomorUnlocked'] is True


def bounded_result_reads(table, **filters):
    # No completion-history read is allowed solely for opening a difficulty.
    assert table in ('result_commands', 'puzzle_attempts'), (table, filters)
    assert filters['player_id'] == player['id']
    return []


for difficulty in server.FREE_DIFFICULTIES:
    puzzle = server.load_puzzles()['free'][difficulty][0]
    payload = ResultCreate(puzzle_id=puzzle['id'], challenge_key=f"free:{puzzle['id']}",
        mode='free', difficulty=difficulty, elapsed_ms=131000, moves=17,
        attempt_id=f'synthetic-unrestricted-{difficulty}')
    command = SessionCommand(action='open', puzzle_id=payload.puzzle_id,
        challenge_key=payload.challenge_key, mode='free', difficulty=difficulty,
        attempt_id=payload.attempt_id, owner_id=player['id'], sequence=1)
    with ExitStack() as stack:
        for name, value in {'enforce_rate_limit': lambda *a, **k: None,
                            'auth_player': lambda *a: player,
                            'db_select': bounded_result_reads,
                            'rankings_v2_schema_ready': lambda: False,
                            'atomic_result_public_response': lambda p, r, **kwargs: r,
                            'play_session_config': lambda: {'enabled': True}}.items():
            stack.enter_context(patch.object(server, name, value))
        stack.enter_context(patch.object(server, 'ATOMIC_RESULT_V1_ENABLED', True))
        submit = stack.enter_context(patch.object(server.result_domain, 'submit_atomic',
            return_value={'firstCompletion': True, 'awardedPoints': server.POINTS[difficulty]}))
        result = server.result(payload, request, authorization='synthetic')
        assert result['awardedPoints'] == server.POINTS[difficulty]
        submitted = submit.call_args.args[0]
        assert submitted['elapsedMs'] == 131000 and submitted['moves'] == 17
        assert submitted['attemptId'] == payload.attempt_id

        rpc = stack.enter_context(patch.object(server, 'db_rpc', return_value={'verified': True}))
        for actor in (anonymous, {'player_id': player['id']}):
            with patch.object(server, 'telemetry_actor', return_value=actor):
                assert server.play_session_command(command, request,
                    authorization='synthetic')['verified'] is True
                assert rpc.call_args.args[0] == 'proplet_play_session_v1'
                assert rpc.call_args.args[1]['p_player'] == actor.get('player_id')

        with patch.object(server, 'telemetry_actor', return_value=anonymous):
            # Availability never bypasses the release calendar or challenge identity.
            with patch.object(server, 'is_puzzle_released', return_value=False):
                rejected(lambda: server.result(payload, request, authorization='synthetic'), 400)
                rejected(lambda: server.play_session_command(command, request, authorization='synthetic'), 400)
            invalid_key = command.model_copy(update={'challenge_key': 'free:another-board'})
            rejected(lambda: server.play_session_command(invalid_key, request, authorization='synthetic'), 400)
            unfinished = command.model_copy(update={'action': 'finish'})
            rejected(lambda: server.play_session_command(unfinished, request, authorization='synthetic'), 400)
            invalid_path = command.model_copy(update={'progress': server.play_sessions.Progress(
                found=[server.play_sessions.FoundWord(answerIndex=0, path=[])])})
            rejected(lambda: server.play_session_command(invalid_path, request, authorization='synthetic'), 400)
        with patch.object(server, 'auth_player', side_effect=HTTPException(401, 'missing identity')):
            rejected(lambda: server.result(payload, request, authorization=None), 401)
        with patch.object(server, 'telemetry_actor', side_effect=HTTPException(401, 'missing identity')):
            rejected(lambda: server.play_session_command(command, request, authorization=None), 401)
        bad_payload = payload.model_copy(update={'challenge_key': 'free:another-board'})
        rejected(lambda: server.result(bad_payload, request, authorization='synthetic'), 400)


# Existing SQL is a projection with a service-only parameter, not enforcement.
# Zero makes it open even for an empty account; stale payloads stay open.
with (patch.object(server, 'enforce_rate_limit', lambda *a, **k: None),
      patch.object(server, 'auth_player', return_value=player),
      patch.object(server, 'db_rpc', return_value={'completed': [], 'stats': {
          'mozkomorUnlocked': False, 'currentStreak': 0, 'longestStreak': 0}}) as rpc):
    snapshot = server.account_snapshot(request, since=None, authorization='synthetic')
    assert rpc.call_args.args[0] == 'proplet_account_snapshot_v1'
    assert rpc.call_args.args[1]['p_mozkomor_unlock_base'] == 0
    assert snapshot['stats']['mozkomorUnlocked'] is True

print('PASS all5 released difficulties: fresh account results, anonymous/account sessions, RPC0 snapshot; auth/release/key/path/finish safeguards preserved')
