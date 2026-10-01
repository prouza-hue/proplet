#!/usr/bin/env python3
"""Compile the complete offline Lexikon v3 foundation. Never builds boards.

The frozen first batch and prototype remain historical artifacts. This compiler
requires a resolved decision for every original ID and cannot authorize runtime.
"""
from __future__ import annotations

import argparse
import ast
from collections import Counter
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import re
import sys
from types import SimpleNamespace
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.gen6.catalog import HISTORY_FILES, frozen_validation_words, walk_boards

DIRECTORY = ROOT / 'content/lexicon-v3/working'
DECISION_URL = 'https://github.com/prouza-hue/proplet/pull/148#issuecomment-5849652613'
BASELINE_SHA = 'f04c99e2477c738a1de1880abcb7eb63388f9d71'
ALPHABET = re.compile(r'^[a-záčďéěíňóřšťúůýž]{4,10}$')
TIERS = 'ABCD'
OUTPUTS = ('lexicon.json', 'inventory.json', 'capacity.json', 'recognition-words.txt', 'source-limitations.json', 'README.md')


def norm(value):
    return unicodedata.normalize('NFC', value).strip().casefold()


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def original_inventory():
    result = []
    for wave, groups in read(ROOT / 'content/lexicon-v3/candidate-seeds.json').items():
        ordinal = 0
        for topic, words in groups.items():
            for word in words.split():
                ordinal += 1
                result.append({'candidate_id': f'L3-W{wave}-{ordinal:04d}', 'original_word': word,
                               'wave': int(wave), 'original_theme': topic})
    if len(result) != 1143 or len({r['original_word'] for r in result}) != 1143:
        raise ValueError('Original approved inventory must contain exactly 1,143 unique words')
    return result


def new_word_exclusions():
    result = set(read(ROOT / 'data/target_generation_exclusions_v334.json')['remove_from_target_generation'])
    for node in ast.parse((ROOT / 'tools/build_lexicon_v2.py').read_text()).body:
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'TARGET_BLOCK' for t in node.targets):
            if isinstance(node.value, ast.Set):
                result |= ast.literal_eval(node.value)
            else:
                result |= set(node.value.args[0].func.value.value.split())
    return {norm(w) for w in result}


def validated_reviews(records):
    originals = original_inventory()
    by_id = {r['candidate_id']: r for r in records}
    if len(by_id) != len(records) or set(by_id) != {r['candidate_id'] for r in originals}:
        raise ValueError('Every original ID must have exactly one resolved review')
    legacy = {norm(e['word']) for e in read(ROOT / 'data/lexicon_v2.json')['entries']}
    forbidden = new_word_exclusions()
    canonicals = set()
    for original in originals:
        r = by_id[original['candidate_id']]
        if any(r.get(k) != v for k, v in original.items()):
            raise ValueError('Original identity changed: ' + original['candidate_id'])
        status = r.get('editorial_status')
        if status not in {'accepted', 'corrected', 'exception'}:
            raise ValueError('Unresolved lexical review: ' + original['candidate_id'])
        if r.get('runtime_approved') is not False or r.get('user_approval', {}).get('status') != 'approved-inventory':
            raise ValueError('Inventory approval and production authorization must be separate')
        permitted = status in {'accepted', 'corrected'}
        if r.get('candidate_generation_allowed') is not permitted:
            raise ValueError('Lexical target eligibility must match the individual decision')
        if not r.get('reviewer') or not r.get('reviewed_at') or not r.get('decision_reason'):
            raise ValueError('Missing individual review attribution')
        if not permitted:
            if not r.get('exception_reason') or not r.get('proposed_resolution'):
                raise ValueError('An exception needs a specific defect and proposed resolution')
            continue
        word = norm(r['word'])
        if not ALPHABET.fullmatch(word) or word in legacy or word in canonicals or word in forbidden:
            raise ValueError('Invalid, duplicated or excluded canonical word: ' + word)
        canonicals.add(word)
        if r.get('tier') not in set(TIERS) or r.get('pos') not in {'noun', 'verb', 'adjective', 'adverb'}:
            raise ValueError('Invalid classification: ' + word)
        if any(not r.get(k) for k in ('meaning_cs', 'grammar', 'topic', 'register')):
            raise ValueError('Incomplete editorial description: ' + word)
        if not r.get('evidence') and not (r.get('evidence_depth') == 'editorial-judgment-no-independent-reference'
                                         and r.get('reference_limitation')):
            raise ValueError('Missing source evidence or explicit individual evidence limitation: ' + word)
        for source in r['evidence']:
            if (source.get('verified') is not True or not source.get('url', '').startswith('https://')
                    or any(not source.get(k) for k in ('headword', 'observation', 'retrieved_at'))):
                raise ValueError('Unverified factual source observation: ' + word)
    # Preserve completed work byte-for-byte at the record-field level. Extra
    # approval/source-depth fields may be added; original findings are not erased.
    for old in read(ROOT / 'content/lexicon-v3/editorial-batch-001.json')['records']:
        if old['editorial_status'] == 'accepted':
            new = next(r for r in records if r['original_word'] == old['original_word'])
            if any(new.get(k) != v for k, v in old.items()):
                raise ValueError('Frozen first-batch review changed: ' + old['original_word'])
    return [deepcopy(by_id[r['candidate_id']]) for r in originals]


def dimensions(entries):
    return {key: dict(sorted(Counter(str(getter(e)) for e in entries).items())) for key, getter in (
        ('length', lambda e: len(e['word'])), ('tier', lambda e: e['tier']),
        ('topic', lambda e: e['capacity_topic']), ('original_topic', lambda e: e['theme']),
        ('pos', lambda e: e['part_of_speech']),
        ('source_cohort', lambda e: e['source_cohort']))}


def length_tier(entries):
    counts = Counter((len(e['word']), e['tier']) for e in entries)
    return {str(n): {t: counts[n, t] for t in TIERS} for n in range(4, 11)}


def pool_report(entries):
    return {'words': len(entries), 'strict_variant_units': len({e['variant_unit'] for e in entries}),
            'breakdown': dimensions(entries), 'length_tier': length_tier(entries)}


def input_hashes(directory):
    paths = [ROOT / p for p in HISTORY_FILES]
    paths += [ROOT / p for p in (
        'data/lexicon_v2.json', 'data/lexicon_v2_wikidata_raw.json', 'data/words.txt',
        'public/valid-words-v3328.txt', 'word_recognition_v3330.py',
        'data/target_generation_exclusions_v334.json', 'tools/build_lexicon_v2.py',
        'content/gen5/profiles.json', 'content/lexicon-v3/candidate-seeds.json',
        'content/lexicon-v3/editorial-batch-001.json', 'tools/build_lexicon_v3_working.py',
        'tools/gen5/catalog.py', 'tools/gen5/validation.py', 'tools/gen6/catalog.py',
        'content/gen6/recognition-words.txt')]
    paths += [directory / p for p in ('editorial-reviews.json', 'source-manifest.json', 'variant-groups.json', 'topic-map.json')]
    return {str(p.relative_to(ROOT)) if p.is_relative_to(ROOT) else p.name: sha(p) for p in sorted(set(paths))}


def build(directory=DIRECTORY):
    reviews = validated_reviews(read(directory / 'editorial-reviews.json')['records'])
    exclusions = {norm(w) for w in read(ROOT / 'data/target_generation_exclusions_v334.json')['remove_from_target_generation']}
    legacy = read(ROOT / 'data/lexicon_v2.json')['entries']
    variants = read(directory / 'variant-groups.json')['groups']
    units = {}
    for group in variants:
        unit = '|'.join(sorted(norm(w) for w in group['members']))
        for word in group['members']:
            word = norm(word)
            if word in units and units[word] != unit:
                raise ValueError('Overlapping strict variant groups: ' + word)
            units[word] = unit
    entries = []
    for old in legacy:
        word = norm(old['word'])
        entries.append({**deepcopy(old), 'source_cohort': 'legacy-v2',
                        'lexical_review_basis': 'Inherited v2; all original fields preserved; not re-certified by the 2026-09-26 expansion review',
                        'target_eligible': word not in exclusions,
                        'target_exclusion_reason': 'Existing product-owner exclusion' if word in exclusions else None,
                        'variant_unit': units.get(word, word),
                        'working_v3_runtime_approved': False})
    for r in reviews:
        if r['candidate_generation_allowed']:
            word = norm(r['word'])
            compact = {k: deepcopy(r.get(k)) for k in (
                'candidate_id', 'original_word', 'wave', 'original_theme', 'tier', 'meaning_cs',
                'grammar', 'register', 'family', 'variant_group', 'number_class', 'grammatical_gender',
                'editorial_status', 'candidate_generation_allowed', 'user_approval', 'runtime_approved',
                'evidence_depth')}
            entries.append({**compact, 'word': word, 'theme': r['topic'],
                            'part_of_speech': r['pos'], 'source_cohort': 'approved-expansion-1143',
                            'review_ref': {'file': 'editorial-reviews.json', 'candidate_id': r['candidate_id']},
                            'lexical_review_basis': 'Individual AI editorial review with scoped source evidence',
                            'target_eligible': True, 'target_exclusion_reason': None,
                            'variant_unit': units.get(word, word), 'working_v3_runtime_approved': False})
    entries.sort(key=lambda e: norm(e['word']))
    topic_map = read(directory / 'topic-map.json')['mapping']
    if set(topic_map) != {e['theme'] for e in entries}:
        raise ValueError('Topic map must explicitly cover every original theme, without guessing')
    for e in entries:
        e['capacity_topic'] = topic_map[e['theme']]
    if len({norm(e['word']) for e in entries}) != len(entries):
        raise ValueError('The full lexicon must have unique canonical entries')
    for group in variants:
        if not any(norm(e['word']) in {norm(w) for w in group['members']} for e in entries):
            raise ValueError('Variant mapping has no reviewed or inherited member')
    provenance = {'as_of': '2026-09-26', 'source_main_sha': BASELINE_SHA,
                  'binding_decision': DECISION_URL, 'input_sha256': input_hashes(directory)}
    lexicon = {'schema_version': 3, 'version': 'lexicon-v3-working-20260926-full',
               'status': 'complete-working-foundation-unpublished', 'provenance': provenance,
               'runtime_approved': False, 'legacy_entries': len(legacy),
               'approved_inventory_count': 1143, 'entries': entries,
               'tier_basis': 'New: individual AI familiarity estimates A/B/C/D; legacy: original v2 labels retained. Neither is a measurement of board difficulty.',
               'production_authorization': 'No permission to deploy, replace runtime recognition or change player state.'}
    write(directory / 'lexicon.json', lexicon)
    inventory = []
    for r in reviews:
        inventory.append({k: r.get(k) for k in ('candidate_id', 'original_word', 'word', 'wave',
                           'original_theme', 'editorial_status', 'candidate_generation_allowed',
                           'user_approval', 'runtime_approved', 'decision_reason',
                           'exception_reason', 'proposed_resolution', 'evidence_depth')})
    write(directory / 'inventory.json', {'schema_version': 2, 'approved_inventory_count': 1143,
                                         'unresolved_count': 0, 'candidates': inventory})
    source_limits = [{k: r.get(k) for k in ('candidate_id', 'word', 'evidence_depth', 'evidence',
                                          'evidence_limit', 'reference_limitation', 'source_notes', 'decision_reason')}
                     for r in reviews if r['evidence_depth'] not in {'individually-inspected-reference', 'headword-with-meaning'}]
    write(directory / 'source-limitations.json', {'scope': 'Individual source limitations, not lexical rejections or unreviewed inventory.',
                                                 'records': source_limits})
    eligible = [e for e in entries if e['target_eligible']]
    historical, playtest = set(), set()
    for path in HISTORY_FILES:
        for board, _ in walk_boards(read(ROOT / path)):
            words = {norm(a['word']) for a in board['answers']}
            historical |= words
            if 'playtests/' in path:
                playtest |= words
    profiles = {}
    for name, p in read(ROOT / 'content/gen5/profiles.json')['profiles'].items():
        pool = [e for e in eligible if p['min_len'] <= len(e['word']) <= p['max_len'] and e['tier'] in p['policy']['allowed']]
        selector = [e for e in pool if e['source_cohort'] != 'legacy-v2' or e.get('fun', 3) >= 3]
        profiles[name] = {'reference_profile': deepcopy(p), 'lexically_admissible': pool_report(pool),
                          'legacy_fun_gate_compatible': pool_report(selector),
                          'admissible_words': [e['word'] for e in pool],
                          'scope': 'Length/tier eligibility only. Reference quotas and geometry are retained, not relaxed. No board feasibility or human difficulty claim.',
                          'fun_gate_note': 'Existing selector excludes legacy fun<3. New entries have no fabricated fun score; editorial acceptance supplies working lexical eligibility.'}
    severe = [e for e in eligible if 5 <= len(e['word']) <= 10]
    no_playtest = [e for e in severe if norm(e['word']) not in playtest]
    no_history = [e for e in severe if norm(e['word']) not in historical]
    recognition = frozen_validation_words(SimpleNamespace(entries={norm(e['word']): e for e in entries}))
    (directory / 'recognition-words.txt').write_text('\n'.join(recognition) + '\n', encoding='utf-8')
    prototype_words = set((ROOT / 'content/gen6/recognition-words.txt').read_text(encoding='utf-8').splitlines())
    states = dict(Counter(r['editorial_status'] for r in reviews))
    capacity = {'schema_version': 1, 'provenance': provenance,
                'lexicon_sha256': sha(directory / 'lexicon.json'), 'original_approved_inventory': 1143,
                'resolved_reviews': len(reviews), 'unresolved_reviews': 0, 'review_states': states,
                'preserved_first_batch': 155, 'remaining_batch_resolved': 988,
                'evidence_depth_counts': dict(sorted(Counter(r['evidence_depth'] for r in reviews).items())),
                'full_working_lexicon': pool_report(entries), 'target_eligible': pool_report(eligible),
                'inherited_target_exclusions': sorted(e['word'] for e in entries if not e['target_eligible']),
                'new_additions': pool_report([e for e in entries if e['source_cohort'] != 'legacy-v2']),
                'profiles': profiles,
                'mozkokalypsa_iii_foundation': {
                    'status': 'lexical-capacity-only; final severe profile and board count not selected',
                    'length_range': [5, 10], 'all_tiers': list(TIERS),
                    'potential_pool': pool_report(severe),
                    'excluding_exact_round1_round2_targets': pool_report(no_playtest),
                    'absent_from_all_included_historical_banks': pool_report(no_history),
                    'history_sources': list(HISTORY_FILES),
                    'personal_exposure': 'unknown; content-bank membership is not personal player history',
                    'new_boards_generated': 0, 'prototype_boards_preserved': 12,
                    'prototype_requires_revalidation_against_full_recognition': True,
                    'length_profile_relaxed': False},
                'recognition': {'scope': 'Offline finite static union; dynamic wordfreq fallback is not enumerable or proved here',
                                'words': len(recognition), 'sha256': sha(directory / 'recognition-words.txt'),
                                'added_since_prototype': len(set(recognition) - prototype_words),
                                'removed_since_prototype': len(prototype_words - set(recognition)),
                                'runtime_modified': False},
                'limitations': ['Capacity counts are not generated boards, geometric feasibility, tier-quota allocation or measured human difficulty.',
                                'Legacy v2 labels and source quality are inherited, not claimed newly audited.',
                                'Source observations state their actual scope; spelling/lemma evidence does not independently prove a meaning.',
                                'Strict variant units prevent counting known spelling variants as independent capacity; soft families are not collapsed.',
                                'Inventory approval is already granted; production deployment remains separately unapproved.']}
    write(directory / 'capacity.json', capacity)
    report = ['# Lexikon v3 — úplný pracovní základ', '',
              f"Zpracováno všech **1 143/1 143** schválených kandidátů; neuzavřených: **0**. Stavy: {states}.",
              f"Zachováno 155 hotových přijetí, uzavřeno dalších 988 včetně PLYŠÁKU. Plný lexikon: **{len(entries)}** hesel; pro cíle způsobilých **{len(eligible)}**.", '',
              f'[Závazné rozhodnutí]({DECISION_URL}) schvaluje zásobu. `runtime_approved=false` znamená nevydáno do produkce, nikoli neschválenou zásobu.', '',
              'Významy a klasifikace jsou vlastní redakční posudky AI. Rozsah konkrétních dokladů i jednotlivé zdrojové mezery uvádí `source-limitations.json`; nepřímý kontext či pravopisný seznam se nevydává za samostatné výkladové heslo. Historická v2 je zachována včetně původu a výluk, bez tvrzení o nové revizi.', '',
              '## Kapacita podle současných profilů', '',
              '| Profil | Způsobilá hesla | Z v2 | Nová | Po starém filtru fun≥3 |',
              '|---|---:|---:|---:|---:|']
    for name, value in profiles.items():
        p = value['lexically_admissible']; cohorts = p['breakdown']['source_cohort']
        report.append(f"| {name} | {p['words']} | {cohorts.get('legacy-v2', 0)} | {cohorts.get('approved-expansion-1143', 0)} | {value['legacy_fun_gate_compatible']['words']} |")
    report += ['', 'Jde o způsobilost podle délky a tieru, nikoli počet vyrobitelných desek. Původní kvóty a geometrické požadavky jsou v capacity.json zachované. Novým slovům se nevymýšlí skóre fun. Délky, témata, slovní druhy, tiery a jejich průniky jsou v témže souboru.', '',
               '## Mozkokalypsa III', '',
               f"Základ délky 5–10: {len(severe)} hesel; bez přesných cílů obou předchozích kol {len(no_playtest)}; bez výskytu ve všech zahrnutých bankách {len(no_history)}.",
               'Náročný finální profil ani počet desek se nyní nevolí. Žádné nové desky nevznikly a délkové požadavky se neuvolnily. Existujících 12 desek je historický prototyp. Jejich důkaz platí pro tehdejší zmražené uznávání a musí se před budoucím použitím znovu ověřit.',
               f"Úplná pracovní statická sada uznávání má {len(recognition)} hesel, proti prototypu přidává {len(set(recognition) - prototype_words)}. Produkční uznávání se nemění.", '',
               '## Jednotlivé výjimky a opravy', '']
    changes = [r for r in reviews if r['editorial_status'] != 'accepted']
    for r in changes:
        report.append(f"- **{r['original_word'].upper()} → {r['word']}** ({r['editorial_status']}): {r['decision_reason']} {r.get('proposed_resolution', '')}")
    if not changes:
        report.append('Žádné změny kanonického zápisu ani lexikální výjimky. Omezení zdrojových dokladů jsou jednotlivě u hesel; nejsou odmítnutím platného slova.')
    for r in reviews:
        if not r['evidence']:
            report.append(f"- **{r['word']} — mezera v nezávislém dokladu**: {r['reference_limitation']}")
    report += ['', '## Soubory a reprodukce', '',
               '- `editorial-reviews.json`: všech 1 143 individuálních rozhodnutí, původní ID, glosy, zdroje a oddělená schválení.',
               '- `lexicon.json`: úplná v3 = zachovaná v2 + přijaté doplnění; všechna původní pole v2 zůstávají zachována, nové položky odkazují na úplný individuální posudek pomocí `review_ref`.',
               '- `inventory.json`, `capacity.json`, `variant-groups.json`, `topic-map.json`: uzavření zásoby, kapacita, explicitní varianty a sjednocení témat. Původní témata zůstávají zachována; neurčité historické štítky se nepředstírají jako nově tříděné.',
               '- `recognition-words.txt`: samostatné offline uznávání pro budoucí důkazy, bez zápisu do runtime.',
               '- `source-manifest.json`, `manifest.json`: původ, rozsah a kontrolní součty.', '',
               '```sh', 'python tools/build_lexicon_v3_working.py --check',
               'python -m unittest discover -s tests/lexicon_v3 -v', '```', '',
               'Výrobní ani publikační schválení z tohoto kompilátoru neplyne. Produkce, běžící druhé kolo a hráčský postup se nemění.', '']
    (directory / 'README.md').write_text('\n'.join(report), encoding='utf-8')
    write(directory / 'manifest.json', {'schema_version': 1, 'version': lexicon['version'],
                                       'provenance': provenance, 'outputs_sha256': {p: sha(directory / p) for p in OUTPUTS},
                                       'runtime_approved': False, 'new_boards_generated': 0})
    return capacity


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, default=DIRECTORY)
    parser.add_argument('--check', action='store_true', help='Rebuild deterministically and fail on drift')
    args = parser.parse_args()
    before = {p: (args.directory / p).read_bytes() for p in (*OUTPUTS, 'manifest.json')} if args.check else None
    result = build(args.directory)
    if before and any(before[p] != (args.directory / p).read_bytes() for p in before):
        raise SystemExit('Generated foundation drift: review and commit regenerated artifacts')
    print(json.dumps({'resolved': result['resolved_reviews'], 'states': result['review_states'],
                      'full_lexicon': result['full_working_lexicon']['words'],
                      'lexicon_sha256': result['lexicon_sha256']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
