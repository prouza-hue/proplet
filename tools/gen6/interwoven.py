"""Private revision: natural vocabulary and interlocking paths, unchanged rules.

Run after the geometry pool has been produced with interwoven_geometry.cpp.
All production inputs, the complete v3 lexicon and the prior preview are read-only.
"""
from collections import Counter
from copy import deepcopy
from itertools import combinations, pairwise
import argparse
import hashlib
import json
from pathlib import Path
import random
import statistics
import time
from tools.gen5.catalog import ROOT, digest, norm, read_json, tier_mix_ok
from tools.gen5.validation import Solver, structural, geometry_errors, neighbours
from tools.mozkokalypsa_lab import board_from_paths, residual_metrics
from .full_catalog import FullCatalog
from .eight import SHAPE_FIXED, profile_for, write, measure
from .catalog import board_hash, walk_boards

DIRECTORY = ROOT/'content/gen6/round3-interwoven'
EDITION = 'lexicon-v3-eight-interwoven-v2'
EXPERIMENT = 'mozkokalypsa-round3-interwoven-v2'
SOURCE_SHA = 'a91a4bd0a63476f711c50ce863df22a72b034cff'
# Specific texture edits, NOT removals from the shared lexicon or etymology rules.
REPLACEMENTS = {
 'GENETIKA':'ZÁKULISÍ', 'HMOTNOST':'SKOŘÁPKA', 'ALGEBRA':'PODNEBÍ',
 'NOSTALGIE':'TAJEMSTVÍ', 'GALEONA':'POBŘEŽÍ', 'DRUID':'ŠIFRA',
 'MATICE':'POHOŘÍ', 'BAKTERIE':'KORMIDLO', 'MINOTAUR':'POTÁPNÍK', 'KENTAUR':'PŘÍZVUK',
}
TOPICS = {
 'zákulisí':'hudba, zvuky a divadlo', 'skořápka':'kuchyně, jídlo a stolování',
 'kormidlo':'doprava, cesty a cestování', 'podnebí':'počasí, obloha a světlo',
 'pobřeží':'krajina, voda a geologie', 'pohoří':'krajina, voda a geologie',
 'přízvuk':'škola, jazyk, knihy a papír',
}
SPECIALIST = set('CITERA RAZNICE PLOTICE ŠTOČEK PROPUST HŘEBELEC ŠEROSVIT DEVĚTSIL KAMENINA PODBĚL DŘEVORYT HMATNÍK PŘESLIČKA LINORYT LYSKA MINCÍŘ OROBINEC SVORNÍK STŘEVLÍK TOBOLKA POTÁPNÍK SÍTOTISK'.split())
ESTABLISHED_TEXTURE = {'CITERA', 'PERGAMEN', 'SYMFONIE'}
AVOID_THIS_EDITION = {'SOFTWARE','NINJA','EROTOMAN','FIREWALL'} | set(REPLACEMENTS)

class InterwovenCatalog(FullCatalog):
    def __init__(self):
        super().__init__('2026-09-27')
        self.policy = deepcopy(self.policy)
        self.policy['new_word_maximum_per_board'] = 12
        self.legacy_c_pool |= {norm(w) for w in REPLACEMENTS.values()}
        for word, topic in TOPICS.items():
            # Pilot-only editorial topics; do not recertify or mutate legacy v2.
            self.entries[word]['capacity_topic'] = topic
            self.entries[word]['topic'] = topic


def weave_metrics(board):
    """Measure the actual disjoint paths; no shared letter is a 'crossing'."""
    paths = [a['path'] for a in board['answers']]
    rows, cols = board['rows'], board['cols']
    owner = {c:i for i,p in enumerate(paths) for c in p}
    if len(owner) != sum(map(len, paths)):
        raise ValueError('Overlapping paths cannot be counted as interweaving')
    contacts, neighbor_words = 0, [set() for _ in paths]
    extra_self = 0
    true_edges = {tuple(sorted((a,b))) for p in paths for a,b in pairwise(p)}
    for c in owner:
        for n in neighbours(c, rows, cols, owner):
            if n <= c: continue
            if owner[c] != owner[n]:
                contacts += 1
                neighbor_words[owner[c]].add(owner[n]); neighbor_words[owner[n]].add(owner[c])
            elif (c,n) not in true_edges:
                extra_self += 1
    reentries, participating = 0, set()
    for axis in (0,1):
        for line in range(rows if axis==0 else cols):
            seq = [owner.get(line*cols+j) if axis==0 else owner.get(j*cols+line)
                   for j in range(cols if axis==0 else rows)]
            runs = [seq[0]] + [b for a,b in pairwise(seq) if a!=b]
            counts = Counter(runs)
            for word, count in counts.items():
                if word is not None and count>1:
                    reentries += count-1; participating.add(word)
    seams = []
    for axis, size in ((0, rows), (1, cols)):
        for cut in range(3, size-2):
            spans = [[(c//cols,c%cols)[axis] for c in p] for p in paths]
            seams.append(sum(min(p)<cut<=max(p) for p in spans))
    return {'crossContacts':contacts, 'extraSelfContacts':extra_self,
            'axisReentries':reentries, 'interdigitatingWords':len(participating),
            'neighborsMean':sum(map(len,neighbor_words))/len(paths),
            'neighborsMinimum':min(map(len,neighbor_words)),
            'minSeamCrossers':min(seams), 'seamCrossers':seams}


def unlock_metrics(board, prefixes):
    """Potential help: false 2..4-letter prefix paths broken by a DIFFERENT word.

    This is a transparent design proxy, not measured insight or player behavior.
    It does not assume every known prefix is a word the player would try.
    """
    owner={c:i for i,a in enumerate(board['answers']) for c in a['path']}
    mask=set(owner); cols=board['cols']; rows=board['rows']
    letters=[norm(c) for c in board['letters']]
    adj={c:neighbours(c,rows,cols,mask) for c in mask}
    helps=[set() for _ in board['answers']]; crossings=0
    def walk(path,text):
        nonlocal crossings
        n=len(path)
        if text not in prefixes.get(n,set()): return
        touched={owner[c] for c in path}; starting=owner[path[0]]
        if n>=2 and len(touched)>1:
            crossings+=1
            for found in touched-{starting}: helps[found].add(starting)
        if n<4:
            for c in adj[path[-1]]:
                if c not in path: walk(path+(c,),text+letters[c])
    for c in sorted(mask):walk((c,),letters[c])
    return {'crossWordPrefixPaths':crossings,
            'helpedOtherWordsMean':sum(map(len,helps))/len(helps),
            'helpedOtherWordsMinimum':min(map(len,helps)),
            'interpretation':'Potential elimination of false prefix paths in other words, not measured human unlocking.'}


def lexical_plan(catalog):
    previous=read_json(ROOT/'content/gen6/round3-eight/bank.json')
    sets=[];rows=[]
    for b in previous['boards']:
        words=sorted(norm(REPLACEMENTS.get(a['word'],a['word'])) for a in b['answers'])
        sets.append(words)
        rows.append({'previousId':b['id'],'replacements':{a['word']:REPLACEMENTS[a['word']] for a in b['answers'] if a['word'] in REPLACEMENTS},
                     'words':[{ 'word':w.upper(), 'tier':catalog.entries[w]['tier'],
                         'topic':catalog.entries[w]['capacity_topic'],
                         'sourceCohort':catalog.entries[w]['source_cohort'],
                         'specialistNaturalVocabulary':w.upper() in SPECIALIST,
                         'establishedBorrowedTexture':w.upper() in ESTABLISHED_TEXTURE,
                         'editorialAssessment':'Přirozené české užití; konkrétní věc, činnost nebo srozumitelný pojem. Užší odborná slova jsou označena zvlášť.'}
                              for w in words]})
    flat=[w for ws in sets for w in ws]
    if len(flat)!=112 or len(set(flat))!=112 or set(flat)&catalog.playtest_words:
        raise ValueError('Word repetition within edition or previous public playtests')
    for words in sets:
        if not set(words)<=set(catalog.available_for_round3()): raise ValueError('Word outside the full approved catalog')
        if tuple(sorted(map(len,words)))!=tuple(sorted(SHAPE_FIXED)): raise ValueError('Changed length profile')
        if not tier_mix_ok(words,catalog.entries,catalog.policy['category_policy']):raise ValueError('Changed tier labels')
        if set(w.upper() for w in words)&AVOID_THIS_EDITION:raise ValueError('Editorial texture exclusions')
        if sum(w.upper() in SPECIALIST for w in words)>3:raise ValueError('Too many narrow specialist words')
        topics=Counter(catalog.entries[w]['capacity_topic'] for w in words)
        if len(topics)<8 or max(topics.values())>3:raise ValueError('Insufficient topic variety: '+str(topics))
    return previous,sets,rows


def accept_geometry(board):
    g=weave_metrics(board)
    return g['crossContacts']>=76 and g['axisReentries']>=4 and g['minSeamCrossers']>=2 and g['neighborsMinimum']>=3 and g['neighborsMean']>=4


def shape_signature(board):
    return {tuple(sorted(a['path'])) for a in board['answers']}


def check_series(boards,catalog,solver):
    if len(boards)!=8:raise ValueError('Exactly eight boards required')
    _,sets,_=lexical_plan(catalog);known=set();proofs=[]
    for ordinal,b in enumerate(boards,1):
        if b['id']!=f'mk3w2-{ordinal:02d}' or b['id'] in catalog.historical_ids:raise ValueError('Wrong/new identity collision')
        if b['meta']['experimentId']!=EXPERIMENT or b['meta']['lexiconHash']!=catalog.lexicon_hash:raise ValueError('Wrong edition/lexicon provenance')
        if not b['meta']['playtestOnly'] or b['meta']['contentGeneration']!=catalog.free_generation:raise ValueError('Unsafe runtime metadata')
        if sorted(norm(a['word']) for a in b['answers'])!=sets[ordinal-1]:raise ValueError('Unreviewed word substitutions')
        if geometry_errors(structural(b),profile_for(catalog)) or not accept_geometry(b):raise ValueError('Geometry quality floor')
        h=board_hash(b)
        if h!=b['meta']['contentHash'] or h in known or h in catalog.historical_board_hashes:raise ValueError('Content hash/identity collision')
        v=solver.verify(b)
        if v['status']!='unique' or not v['targetPathsUnique']:raise ValueError('Incomplete independent proof')
        proofs.append(v);known.add(h)
    for a,b in combinations(boards,2):
        if len(shape_signature(a)&shape_signature(b))>=7:raise ValueError('Overly similar spatial tilings')
    return proofs


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--output',type=Path,required=True)
    args=ap.parse_args();out=args.output.resolve()
    if (ROOT/'lab-output/gen6').resolve() not in out.parents or out.exists():raise ValueError('New private lab-output/gen6 directory required')
    catalog=InterwovenCatalog();previous,sets,review=lexical_plan(catalog)
    frozen=catalog.input_hashes()
    for p in [DIRECTORY/'geometry-pool.jsonl',ROOT/'tools/gen6/interwoven_geometry.cpp',ROOT/'content/gen6/round3-eight/bank.json']:
        frozen[str(p.relative_to(ROOT))]=hashlib.sha256(p.read_bytes()).hexdigest()
    pool=[json.loads(s) for s in (DIRECTORY/'geometry-pool.jsonl').read_text().splitlines()]
    if len(pool)!=32:raise ValueError('Incomplete geometric search pool')
    solver=Solver(catalog.full_dictionary());out.mkdir(parents=True)
    boards=[];records=[];p=profile_for(catalog)
    for ordinal,words in enumerate(sets,1):
        candidates=[]; rejected=Counter()
        for i,geometry in enumerate(pool):
            for placement in range(64):
                rng=random.Random(digest([9272026,ordinal,i,placement]))
                paths=deepcopy(geometry['paths'])
                if rng.randrange(2):paths=[a[::-1] for a in paths]
                b=board_from_paths(paths,words,rng)
                if geometry_errors(structural(b),p) or not accept_geometry(b):
                    rejected['geometry']+=1;continue
                if any(len(shape_signature(b)&shape_signature(old))>=7 for old in boards):
                    rejected['spatial-repetition']+=1;continue
                proof=solver.verify(b,seconds=3)
                if proof['status']!='unique' or not proof['targetPathsUnique']:
                    rejected['solver-'+proof['status']]+=1;continue
                w=weave_metrics(b);u=unlock_metrics(b,solver.prefixes)
                # Lexicon is identical across candidates. Geometric integration
                # leads; legitimate alternative-path pressure is a tie-breaker.
                pressure=residual_metrics(b,solver.prefixes)
                key=(w['axisReentries'],w['crossContacts'],pressure['selectionScore'],u['helpedOtherWordsMean'])
                candidates.append((key,b,proof,w,u,i,placement))
        if not candidates:raise ValueError('No fully verified interwoven layout for '+str(ordinal)+' '+str(rejected))
        _,b,proof,w,u,index,placement=max(candidates,key=lambda x:x[0])
        b['id']=f'mk3w2-{ordinal:02d}'
        b['meta']={'level':ordinal,'experimentId':EXPERIMENT,'playtestOnly':True,'generatorGeneration':6,
                   'contentGeneration':catalog.free_generation,'contentHash':board_hash(b),
                   'lexiconHash':catalog.lexicon_hash,'lexicalPolicy':EDITION,'validation':proof}
        records.append({'id':b['id'],'verifiedCandidates':len(candidates),'rejections':dict(rejected),
                        'geometryPoolIndex':index,'placement':placement,'weave':w,'unlock':u,
                        'lexicalReview':review[ordinal-1],'geometry':structural(b),
                        'pressure':residual_metrics(b,solver.prefixes)})
        boards.append(b);print(b['id'],'pool',index,'options',len(candidates),w,u,flush=True)
    proofs=check_series(boards,catalog,solver)
    for path,value in frozen.items():
        if hashlib.sha256((ROOT/path).read_bytes()).hexdigest()!=value:raise ValueError('Changed read-only input: '+path)
    past=[b for b,_ in walk_boards(read_json(ROOT/'data/playtests/mozkokalypsa-v2.json'))]
    comparison={}
    for label,collection in [('round2',past),('previousPreview',previous['boards']),('interwoven',boards)]:
        metric=measure(collection,catalog,solver.prefixes)
        ww=[weave_metrics(b) for b in collection];uu=[unlock_metrics(b,solver.prefixes) for b in collection]
        metric['weaveMedian']={k:statistics.median(x[k] for x in ww) for k in ww[0] if k!='seamCrossers'}
        metric['unlockMean']={k:statistics.mean(x[k] for x in uu) for k in uu[0] if k!='interpretation'}
        comparison[label]=metric
    dictionary=deepcopy(previous['validationDictionary'])
    if dictionary['sha256']!=solver.hash or dictionary['size']!=len(solver.words):raise ValueError('Recognizer snapshot drift')
    bank={'kind':'gen6-unpublished-preview','schemaVersion':1,'edition':EDITION,'status':'verified-unpublished',
          'experimentId':EXPERIMENT,'sourceSha':SOURCE_SHA,'generatorGeneration':6,'runtimeFreeGeneration':catalog.free_generation,
          'publicationAuthorized':False,'controls':0,'humanDifficulty':'unmeasured','validationDictionary':dictionary,
          'lexiconHash':catalog.lexicon_hash,'parentBankHash':previous['contentHash'],'boards':boards,'contentHash':digest(boards)}
    report={'asOf':'2026-09-27','sourceSha':SOURCE_SHA,'productionShaAtStart':'f07a43d1a8a841ea1ef095a161fda5e47a511238',
            'status':'verified-unpublished','bankContentHash':bank['contentHash'],'lexiconHash':catalog.lexicon_hash,
            'frozenInputs':frozen,'dictionary':dictionary,'boards':records,'finalProofs':proofs,'comparison':comparison,
            'geometrySearch':{'seed':92720262,'maxAttempts':30000000,'requiredPool':32,'engine':'interwoven_geometry.cpp; deterministic xorshift, bounded annealing'},
            'interpretation':'Weave and unlocking metrics are design proxies. No measured claim of player difficulty, novelty, or enjoyment. User feedback is the product basis, not new telemetry.'}
    write(out/'bank.json',bank);write(out/'verification.json',report)
    write(out/'lexical-review.json',{'source':'Existing approved Lexikon v3 + targeted AI editorial review; no blanket foreign-word ban or new global exclusions',
                                  'replacements':REPLACEMENTS,'boards':review})
    print('COMPLETE',bank['contentHash'],json.dumps(comparison['interwoven'],ensure_ascii=False),flush=True)

if __name__=='__main__':main()
