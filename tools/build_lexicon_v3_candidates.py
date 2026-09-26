#!/usr/bin/env python3
"""Build a separate editorial candidate lexicon. Never mutates runtime v2.

Inputs are the original independent proposals and explicit individual reviews.
Dictionary references are factual evidence, never an automatic acceptance rule.
"""
from __future__ import annotations

import argparse
import ast
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
WORD = re.compile(r'^[a-záčďéěíňóřšťúůýž]{4,10}$')


def norm(value):
    return unicodedata.normalize('NFC', value).strip().casefold()


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def build(directory):
    seeds_path = directory / 'candidate-seeds.json'
    review_path = directory / 'editorial-batch-001.json'
    seeds, review = read(seeds_path), read(review_path)
    existing = {norm(e['word']) for e in read(ROOT / 'data/lexicon_v2.json')['entries']}
    forbidden = {norm(w) for w in read(ROOT / 'data/target_generation_exclusions_v334.json')['remove_from_target_generation']}
    for node in ast.parse((ROOT / 'tools/build_lexicon_v2.py').read_text(encoding='utf-8')).body:
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'TARGET_BLOCK' for t in node.targets):
            if isinstance(node.value, ast.Set):
                forbidden |= {norm(w) for w in ast.literal_eval(node.value)}
            else:
                forbidden |= {norm(w) for w in node.value.args[0].func.value.value.split()}
    forbidden |= {'lunochod', 'červodíra', 'blockchain', 'pulsar', 'tensor'}
    originals = {}
    for wave, groups in seeds.items():
        index = 0
        for theme, text in groups.items():
            for word in text.split():
                index += 1
                if word in originals or not WORD.fullmatch(word) or word in forbidden or word in existing:
                    raise ValueError('Original candidate collision/invalid: ' + word)
                originals[word] = {'candidate_id': f'L3-W{wave}-{index:04d}', 'word': word,
                                   'wave': int(wave), 'original_theme': theme}
    if len(originals) != 1143:
        raise ValueError('Original candidate inventory must retain all 1,143 entries')
    reviews = {}
    accepted = []
    for record in review['records']:
        word = norm(record['original_word'])
        if word not in originals or word in reviews:
            raise ValueError('Review must reference one unique original candidate: ' + word)
        if record['runtime_approved'] is not False:
            raise ValueError('This builder cannot grant production approval')
        decision = record['editorial_status']
        if decision not in {'accepted', 'corrected', 'deferred', 'rejected'}:
            raise ValueError('Unknown editorial state: ' + decision)
        approved = decision in {'accepted', 'corrected'}
        if record['candidate_generation_allowed'] is not approved:
            raise ValueError('Generation permission must follow explicit review: ' + word)
        if approved:
            canonical = norm(record['word'])
            if not WORD.fullmatch(canonical) or canonical in existing or canonical in forbidden:
                raise ValueError('Reviewed spelling invalid/excluded/already present: ' + word)
            if record['tier'] not in {'A', 'B', 'C', 'D'} or record.get('pos') not in {'noun', 'verb', 'adjective', 'adverb'} or not record.get('meaning_cs'):
                raise ValueError('Missing editorial classification: ' + word)
            if not record.get('reviewer') or not record.get('reviewed_at') or not record.get('evidence'):
                raise ValueError('Missing individual review provenance: ' + word)
            for evidence in record['evidence']:
                if not evidence.get('verified') or not evidence.get('url', '').startswith('https://') or not evidence.get('headword') or not evidence.get('observation') or not evidence.get('retrieved_at'):
                    raise ValueError('Incomplete actual dictionary check: ' + word)
            accepted.append({**record, 'candidate_id': originals[word]['candidate_id'], 'word': canonical.upper(),
                             'editorial_status': 'accepted', 'original_decision': decision})
        reviews[word] = record
    if len({norm(e['word']) for e in accepted}) != len(accepted):
        raise ValueError('Canonical spellings collide')
    inventory = []
    for word, original in originals.items():
        r = reviews.get(word)
        inventory.append({**original, 'editorial_status': r['editorial_status'] if r else 'pending',
                          'candidate_generation_allowed': bool(r and r['candidate_generation_allowed']),
                          'runtime_approved': False})
    counts = Counter(r['editorial_status'] for r in inventory)
    provenance = {'source_main_sha': review['source_main_sha'], 'date': review['date'],
                  'seeds_sha256': sha(seeds_path), 'review_sha256': sha(review_path),
                  'legacy_v2_sha256': sha(ROOT / 'data/lexicon_v2.json')}
    write(directory / 'candidate-lexicon.json', {
        'schema_version': 3, 'status': 'candidate-only-not-production', 'batch_id': review['batch_id'],
        'provenance': provenance, 'runtime_approved': False,
        'tier_basis': 'Individual AI editorial estimates, not measured player familiarity or difficulty.',
        'entries': accepted})
    write(directory / 'candidate-inventory.json', {'schema_version': 1, 'provenance': provenance, 'candidates': inventory})
    dimensions = {}
    for key, func in [('length', lambda e: str(len(e['word']))), ('tier', lambda e: e['tier']),
                      ('pos', lambda e: e['pos']), ('topic', lambda e: e['topic'])]:
        dimensions[key] = dict(sorted(Counter(func(e) for e in accepted).items()))
    length_tier = {str(n): {t: sum(len(e['word']) == n and e['tier'] == t for e in accepted)
                            for t in 'ABCD'} for n in range(4, 11)}
    capacity = {'provenance': provenance, 'total_original_candidates': len(originals),
                'reviewed': len(reviews), 'states': dict(counts), 'accepted_for_candidate_generation': len(accepted),
                'production_approved': 0, 'accepted_breakdown': dimensions, 'length_tier': length_tier,
                'scope': 'Capacity of the new individually reviewed additions only; legacy v2 is not re-certified.',
                'limitations': ['A dictionary headword is not a measurement of fun or familiarity.',
                               'Pending entries are unreviewed, not linguistically rejected.',
                               'Deferred source access does not prove invalid Czech.',
                               'No production recognizer, bank, generation ID or player data is modified.']}
    write(directory / 'capacity.json', capacity)
    report = ['# Lexikon v3 — první uzavřená redakční dávka', '',
              f"{review['date']}: z {len(reviews)} posouzených kandidátů přijato {len(accepted)} pro izolovanou výrobu.",
              f"Z původních 1 143 zbývá {counts.get('pending', 0)} neposouzených a {counts.get('deferred', 0)} odložených. Produkční schválení: 0.", '',
              'Každé přijetí má skutečně prohlédnutý doklad hesla a gramatiky. Významy jsou vlastní stručné popisy; tier je redakční odhad AI, nikoli měření zábavnosti nebo znalosti hráčů.', '',
              '| Slovo | Tier | Slovní druh | Téma | Doklad |',
              '|---|---|---|---|---|']
    for e in accepted:
        source = e['evidence'][0]
        report.append(f"| {e['word']} | {e['tier']} | {e['pos']} | {e['topic'].replace('_', ' ')} | [heslo]({source['url']}) |")
    report += ['', '## Odložené položky', '']
    for r in reviews.values():
        if not r['candidate_generation_allowed']:
            report.append(f"- **{r['original_word'].upper()}**: {r['decision_reason']}")
    report += ['', '## Rozsah a zachování původu', '',
               '- Původní ID, pořadí a témata všech 1 143 návrhů zůstávají v candidate-inventory.json.',
               '- Podrobné doklady, autor revize, datum, význam, varianty a stav: editorial-batch-001.json.',
               '- V2 se nemění ani zpětně nevydává za nově ověřený. Nová vrstva je candidate-only.',
               '- Individuální konzultace IJP / SSJČ / Lingea; bez hromadného importu slovníků a bez použití MorfFlexu.',
               '- Případné další prameny moderního významu jsou u konkrétního hesla (ÚVAZEK: český výrobce Tendon).',
               '- Rozšířené uznávání produkčních vedlejších slov, hráčská data a běžící playtest se nemění.', '']
    (directory / 'EDITORIAL-BATCH-001.md').write_text('\n'.join(report), encoding='utf-8')
    return capacity


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, default=ROOT / 'content/lexicon-v3')
    args = parser.parse_args()
    print(json.dumps(build(args.directory), ensure_ascii=False, indent=2))
