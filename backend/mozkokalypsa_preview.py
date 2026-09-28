"""Read-only in-game round-three preview. Not a production experiment."""
from copy import deepcopy
from datetime import datetime, timezone
from functools import lru_cache
import hashlib
import json
import os
from pathlib import Path
from fastapi import HTTPException

BRANCH = 'preview/mozkokalypsa3-in-game-20260928'
EXPERIMENT = 'mozkokalypsa-round3-interwoven-v2'
# Demonstration only, not an approved launch or closing date.
DEMO_CLOSES_AT = '2026-10-04T22:00:00Z'
BANK_SHA256 = 'c412ad3ccb8dc0a651387046389aff055c34ada15c5cf75398c8440c1ce22410'
ROOT = Path(__file__).resolve().parents[1]


def enabled():
    return os.getenv('VERCEL_ENV') == 'preview' and os.getenv('VERCEL_GIT_COMMIT_REF') == BRANCH


@lru_cache(maxsize=1)
def bank():
    raw = (ROOT/'data/playtests/mozkokalypsa-v3-preview.json').read_bytes()
    if hashlib.sha256(raw).hexdigest() != BANK_SHA256:
        raise RuntimeError('Approved eight-board content changed')
    data = json.loads(raw)
    if data['experimentId'] != EXPERIMENT or [b['id'] for b in data['boards']] != [f'mk3w2-{i:02d}' for i in range(1,9)]:
        raise RuntimeError('Invalid round-three preview bank')
    return data


def status():
    return {'eligible': True, 'qa': True, 'previewRound': 3, 'experimentId': EXPERIMENT,
            'order': [b['id'] for b in bank()['boards']], 'attempts': [], 'name': 'Mozkokalypsa III',
            'closesAt': DEMO_CLOSES_AT, 'deadlineIsExample': True, 'rewardXp': 200,
            'rewardsAreExample': True, 'serverNow': datetime.now(timezone.utc).isoformat()}


def puzzle(board_id):
    for board in bank()['boards']:
        if board['id'] == board_id:
            return deepcopy(board)
    raise HTTPException(404, 'Tato deska není součástí náhledu třetího kola.')
