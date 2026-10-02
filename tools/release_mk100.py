"""Bind the approved immutable hundred into the normal production bank."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def release():
    frozen = json.loads((ROOT / 'content/gen6/mozkokalypsa-100/bank.json').read_bytes())
    boards = frozen['boards']
    digest = hashlib.sha256(json.dumps(boards, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    assert digest == frozen['contentHash'] == '84d32ca0600f27f13cc57bd497bd553af41c1b1cd68023379f26997e92c58dab'
    assert len(boards) == 100
    released = deepcopy(boards)
    for board in released:
        board['difficulty'] = 'mozkokalypsa'
        board['meta'].update(candidateOnly=False, playtestOnly=False, contentGeneration=4,
                             releaseBatch='mk100-v2', availableFrom='2026-10-02')
    for name in ('data/puzzles.json', 'public/puzzles.json'):
        path = ROOT / name
        data = json.loads(path.read_bytes())
        assert not data['free'].get('mozkokalypsa') or data['free']['mozkokalypsa'] == released
        data['free']['mozkokalypsa'] = released
        data['freeLevelCounts']['mozkokalypsa'] = 100
        data['mozkomorUnlock'].update(requiresDifficulty=None, requiresCurrentBaseLevels=0, persistentOnceEarned=False)
        data['mozkokalypsaRelease'] = dict(seriesId='mk100-v2', productionApproved=True,
            availableFrom='2026-10-02', contentHash=digest, generatorGeneration=6, runtimeFreeGeneration=4)
        path.write_bytes((json.dumps(data, ensure_ascii=False, separators=(',', ':'))+'\n').encode('utf-8'))
    print('Bound 100 approved boards; original banks and generation/slot identities retained.')


if __name__ == '__main__':
    release()
