#!/usr/bin/env python3
"""Restore the exact historical candidate evidence from text inputs; no network or production writes."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import tempfile
import expand_candidates

IDENTITY_SHA = '80f6ba3abfaf28229ee191fea1d3d8f87d94f13392c91152eacaa1e0ad31978c'
OUTPUT_HASHES = {
    'kandidati-vse-1143.json': '0c53368ca5ba6bcb297581272b457a7a88530a5f956b039c3c67a1015ff81033',
    'kandidati-varka-2.json': '2f6a883231fe92af04c164373e31b7bbb16b9803935e90109b5e32838b7e5789',
    'audit-v2.json': 'b8250c5b49a0bb60ae823174b96c98ebaae5657a96c6c25cee370db746391b9a',
}

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, required=True, help='Historical source tree matching audit-v2.json')
    parser.add_argument('--out', type=Path, required=True, help='New output directory outside source and handover trees')
    args = parser.parse_args()
    here, root, out = Path(__file__).resolve().parent, args.root.resolve(), args.out.resolve()
    if out.exists() or out == root or root in out.parents or out == here or here in out.parents:
        raise SystemExit('Choose a new output directory outside the source and handover trees.')
    audit = json.loads((here/'audit-v2.json').read_text(encoding='utf-8'))
    for name, expected in audit['inputs_sha256'].items():
        path = root/name
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise SystemExit(f'Historical source mismatch: {name}. Do not overwrite historical provenance; use the specified baseline.')
    seeds = json.loads((here/'candidate-seeds.json').read_text(encoding='utf-8'))
    rows, identity, words, counts = [], [], set(), {}
    for wave in (1, 2):
        index = 0
        for theme, text in seeds[str(wave)].items():
            for word in text.split():
                index += 1
                if word in words:
                    raise SystemExit(f'Duplicate input: {word}')
                words.add(word)
                identity.append(f'L3-W{wave}-{index:04d}\t{wave}\t{word}\t{theme}')
                if wave == 1:
                    rows.append({'word': word, 'proposed_theme': theme})
        counts[wave] = index
    digest = hashlib.sha256(('\n'.join(identity)+'\n').encode('utf-8')).hexdigest()
    if counts != {1: 267, 2: 876} or digest != IDENTITY_SHA:
        raise SystemExit('Candidate identity mismatch; stop instead of inventing/replacing missing words.')
    with tempfile.TemporaryDirectory(prefix='proplet-gen6-inputs-') as tmp:
        previous, wave2 = Path(tmp)/'wave1.json', Path(tmp)/'wave2.json'
        previous.write_text(json.dumps({'candidates': rows}, ensure_ascii=False), encoding='utf-8')
        wave2.write_text(json.dumps(seeds['2'], ensure_ascii=False), encoding='utf-8')
        expand_candidates.run(root, previous, wave2, out, audit['source_main_sha'])
    for name, expected in OUTPUT_HASHES.items():
        actual = hashlib.sha256((out/name).read_bytes()).hexdigest()
        if actual != expected:
            raise SystemExit(f'Restored output mismatch: {name}. Output is not the verified historical snapshot.')
    print('VERIFIED: 1,143 original candidate IDs/words/themes and exact original detailed JSON/audit hashes.')

if __name__ == '__main__':
    main()
