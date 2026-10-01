"""Offline candidate manufacture; no production imports, network or player writes.

Reuses Gen6 interwoven_geometry.cpp, board_from_paths and the independent Gen5
exact-cover Solver. Every solver budget exhaustion rejects a candidate. The
complete frozen current-runtime recognition snapshot is required before running.
"""
from __future__ import annotations
from collections import Counter
from concurrent.futures import ProcessPoolExecutor
from copy import deepcopy
from datetime import datetime, timezone
import argparse
import hashlib
import json
from pathlib import Path
import random
import statistics
import subprocess
import time

from tools.gen5.catalog import ROOT, digest, norm, read_json
from tools.gen5.validation import Solver, structural, geometry_errors
from tools.gen6.catalog import board_hash
from tools.gen6.eight import profile_for, write
from tools.gen6.interwoven import weave_metrics, shape_signature, unlock_metrics
from tools.mozkokalypsa_lab import board_from_paths, residual_metrics, full_profile

OUT = ROOT/'content/gen6/mozkokalypsa-100'
LAB = ROOT/'work/mk100/pools-v2'
SEED = 202610010100
SHAPE = [5]+[6]*3+[7]*4+[8]*5+[9]
PROFILE_TIERS = {'relief':{'A':6,'B':6,'C':2}, 'main':{'A':4,'B':6,'C':4},
                 'challenge':{'A':2,'B':6,'C':6}, 'summit':{'A':2,'B':4,'C':8}}
POLARIZING_CAP = {'relief':0,'main':1,'challenge':2,'summit':2}
# Concrete editorial judgments, distinct from inherited difficulty tiers. These
# words can create a domain-specific recognition barrier on a Czech word board.
NARROW = set('CITERA RAZNICE PLOTICE ŠTOČEK PROPUST HŘEBELEC ŠEROSVIT DEVĚTSIL KAMENINA PODBĚL DŘEVORYT HMATNÍK PŘESLIČKA LINORYT LYSKA MINCÍŘ OROBINEC SVORNÍK STŘEVLÍK TOBOLKA POTÁPNÍK SÍTOTISK ZÁVLAČKA ZÁVITNÍK ÚŽLABINA STAVIDLO ZDYMADLO POLNÍČEK STRAKAPOUD'.lower().split())
# Low written-corpus frequency alone is not lexical obscurity. Ordinary physical
# objects, activities and familiar story words retain everyday editorial status.
ORDINARY_LOWFREQ = set('baculatý barakuda blatouch bludička broskvoň bystřina chlebník chrastit desetník drobenka družička drátěnka formička fujavice hastrman housátko hustilka háčkovat iniciála jehelník jehňátko jeřabina jádřinec kapybara kedluben klopýtat klíčenka krahujec kremrole kropítko kružítko langusta letokruh lišejník minotaur navlékat nemotora neposeda nátělník otakárek pantofel pastelka permoník pihovatý plejtvák ploštice podběrák podnožka područka podšívka prskavka přadlena přezůvka rampouch rolnička rozmotat rozplést sardinka skotačit strouhat stupačka střapatý svodidlo sáňkovat termoska táborník uvozovka veslovat vlásenka voskovka zkumavka zrádkyně zástrčka čenichat šlapadlo žebřiňák žemlovka'.split())
EXCLUDE_THIS_EDITION = set('erotoman software ninja firewall hřebelec negr lunochod sněhová'.split())
REPRESENTATIVE_ORDINALS = [1,3,8,2,4,5,7,9,10,6,11,20]
EDITION = 'mozkokalypsa-100-candidate-v2'
PROFILE_VERSION = 'mk100-morphology-v2'


def geometry_profile(c, name):
    p=full_profile(c)
    minimum,mean,straight={'relief':(1,3.0,.75),'main':(1,3.7,.67),
                           'challenge':(2,4.3,.60),'summit':(2,4.7,.55)}[name]
    p.update(min_path_turns=minimum,min_mean_turns=mean,
             max_path_straight_share=straight,geometry_profile=PROFILE_VERSION+'-'+name)
    return p

# Scoped semantic corrections for inherited broad legacy labels. These maps
# annotate selection only; working Lexikon v3 stays byte-identical.
SCOPED_TOPIC_GROUPS = {
 'rostliny, zahrada a pěstování': 'borovice brambora kukuřice rostlina třešnička broskev pšenice bobule kaktus kytice třešně jasan hrách obilí',
 'hudba, zvuky a divadlo': 'klarinet hudebník pianista nahrávka nahrávání předehra kytarista troubení herectví bubeník bubínek jeviště herečka muzikál saxofon skladba varhany klavír kytara pódium valčík buben hymna piano',
 'dům, bydlení a domácnost': 'apartmán interiér lednička podkroví porcelán příbytek schránka sklepení tiskárna obrazovka povlečení polštářek přístřeší nábytek pohovka skříňka okenice stodola komora mrazák nádoba nádobí pračka sprcha větrák žebřík šuplík kotel komín lůžko stěna vrata ubrus',
 'doprava, cesty a cestování': 'jízdenka kormidlo loděnice motocykl námořník nárazník plavidlo rozcestí stíhačka zastávka projížďka doprava dodávka křižník loďstvo motorka odbočka plachta posádka taxikář jachta parník plavba provoz stezka trasa vagón loďka',
 'škola, jazyk, knihy a papír': 'kalendář kapitola metafora originál povídání pozvánka příručka reportáž slovíčko angličan gramatika matematik vydavatel životopis inkoust otazník přízvuk recenze sloveso slovník stránka studium zeměpis číslice adresa dialog hláška latina nákres plakát přepis sbírka rozvrh soubor ročník školné autor album deska tečka',
 'zvířata a péče o ně': 'akvárium holubice kohoutek kousnutí kříženec medvídek prasátko rybaření skořápka skořápky štěňátko beránek dobytek koníček koťátko kuřátko motýlek návnada ploutev plemeno potrava rybička samička štěnice vajíčko blecha hřebec klíště krocan ocásek ovečka pejsek samice smečka vačice beran hejno hříbě kanec kačer koník kozel krysa lišák lvice mládě muška myška rybka samec stádo zobák žabák šelma',
 'kuchyně, jídlo a stolování': 'hostinec hostitel kuchařka hostina hospoda lasagne masíčko páreček buchta chřest dortík doušek koření mandle muffin oříšek perník semeno soudek potrava výživa celer houba nanuk ořech pasta sádlo šťáva čočka',
 'oděv, textil a doplňky': 'figurína medailon náušnice prstýnek trenýrky zástěrka švadlena peněženka klobouček hedvábí kravata kraťasy tepláky smoking bikiny kašmír korzet košile opasek roucho spodky trenky šortky džíny hadry pásek rifle rukáv tílko vesta závoj šátek župan',
 'počasí, obloha a světlo': 'atmosféra dopoledne červenec sluníčko včerejšek ovzduší povětří pozítří sezóna slunko tajfun úplněk zítřek jitro oblak vánek',
 'krajina, voda a geologie': 'kontinent jihozápad zahraničí jezírko pobřeží podnebí pozemek pohoří potopa region zámoří oceán odliv poušť úpatí',
 'sport, hry a odpočinek': 'baseball kluziště mistryně podívaná volejbal trenérka basketbal gymnastka olympiáda přihrávka sportovec šampionát atlet maraton loterie skákání skokan seskok soutěž utkání remíza rallye hrátky hráčka výherce herna klaun polka šermíř',
 'tělo, zdraví a péče': 'epidemie genetika kapalina kyselina ochrnutí orgasmus tekutina adrenalin bradavice karanténa předloktí ultrazvuk choroba dýchání horečka infekce ledvina lékařka lékárna malíček obratel pediatr spermie srdíčko stolice teplota terapie trávení trubice vyrážka zápěstí záchvat žaludek žlučník bříško kostra kotník kyslík mandle nádech otrava spánek sperma stehno střevo trauma výdech výživa čelist brada hrdlo hřbet jazyk lebka loket obočí orgán palec plíce porod páteř sluch žebro',
 'dílna, řemesla a materiály': 'materiál petrolej pochodeň zásobník plechovka kladivo nástroj řemeslo rukojeť stavění stříbro žárovka cement kleště krejčí nářadí palivo poleno oprava trubka vrtání řezání špalek železo beton bedna bronz dříví kolík olovo šroub uhlík vidle vodík',
 'vlastnosti, pocity a chování': 'blízkost důsledek fantazie myšlenka nevýhoda pobavení ponížení sobectví minulost prázdnota nepohodlí odpuštění odloučení pochopení závislost bezpečí deprese hodnota jistota kariéra loučení problém respekt známost zážitek neklid náhoda nálada odvaha povaha samota smutno talent urážka úsudek útěcha záhada záliba emoce hanba kuráž návyk obava pocit pýcha půvab smysl snaha touha vztah zlost úleva úsilí úvaha',
}
SCOPED_TOPICS = {w: topic for topic, words in SCOPED_TOPIC_GROUPS.items() for w in words.split()}



def catalog():
    from tools.gen6.mk100_catalog import Mk100Catalog
    return Mk100Catalog()


def edition_order():
    wave=['relief','main','relief','main','main','challenge','main','relief','main','main',
          'challenge','main','main','relief','main','challenge','main','main','main','summit']
    return wave*5


def editorial_topic(e):
    if e['word'] in SCOPED_TOPICS:return SCOPED_TOPICS[e['word']]
    topic=e.get('capacity_topic') or e.get('topic') or e.get('theme') or 'nezařazené'
    if topic=='historická smíšená témata':
        return 'všední svět — zděděné široké zařazení'
    return topic


def prepare_entries(c):
    from wordfreq import zipf_frequency
    entries={}
    for w,e in c.available_for_mk100().items():
        if not 5<=len(w)<=9 or e['tier'] not in 'ABC' or w in EXCLUDE_THIS_EDITION:
            continue
        z=zipf_frequency(w,'cs')
        # Do not mass recertify v3. This is a scoped series-selection preference.
        if e.get('fun',3)<3 or (w not in c.additions and z<2.7):
            continue
        x=deepcopy(e);x['zipfEditorialProxy']=round(z,3);x['editorialTopic']=editorial_topic(e)
        x['intentionalPolarizing']=w in NARROW or (z<2.4 and w not in ORDINARY_LOWFREQ)
        x['polarizingBasis']=('narrow-domain-editorial-list' if w in NARROW else
                              'low-written-frequency-flag-for-individual-review' if x['intentionalPolarizing'] else None)
        entries[w]=x
    return entries


def allocate(c, entries, seed=SEED):
    """Allocate100 boards globally; repeat spacing is part of actual selection."""
    profiles=edition_order()
    for restart in range(8):
        rng=random.Random(digest([seed,'lexical',restart]))
        used=Counter();last={};family_last={};used_variants=set();topic_global=Counter();plans=[]
        provisional=read_json(OUT/'lexical-plan.json') if (OUT/'lexical-plan.json').exists() else {}
        if provisional.get('status','').startswith('provisional'):
            plans=deepcopy(provisional['boards'])
            for row in plans:
                for w in row['words']:
                    e=entries[w] if w in entries else provisional['entries'][w]
                    used[w]+=1;last[w]=row['ordinal'];topic_global[e['editorialTopic']]+=1
                    if e.get('family'):family_last[e['family']]=row['ordinal']
                    if e.get('variant_group'):used_variants.add(e['variant_group'])
        for ordinal,p in enumerate(profiles,1):
            if ordinal<=len(provisional.get('boards',[])) and provisional.get('status','').startswith('provisional'):continue
            best=None
            for attempt in range(100):
                remaining=Counter(PROFILE_TIERS[p]);shape=SHAPE.copy();rng.shuffle(shape)
                from tools.gen5.catalog import assign_tiers
                eligible={w:e for w,e in entries.items() if used[w]<2 and (w not in last or ordinal-last[w]>=20) and w not in c.playtest_words}
                tier_policy={'min_fraction':{t:v/14 for t,v in PROFILE_TIERS[p].items()},'max_fraction':{t:v/14 for t,v in PROFILE_TIERS[p].items()},'weights':{'A':1,'B':1,'C':1}}
                tiers=assign_tiers(shape,eligible,tier_policy,rng)
                if tiers is None:continue
                slots=sorted(zip(shape,tiers),key=lambda x:(x[1]!='C',-x[0]))
                words=[];themes=Counter();families=set();variants=set();polar=0
                for n,tier in slots:
                    opts=[w for w,e in entries.items() if len(w)==n and e['tier']==tier and remaining[e['tier']] and w not in words
                          and (tier=='C' or sum(v in c.additions for v in words)>=6 or w in c.additions)
                          and used[w]<2 and (w not in last or ordinal-last[w]>=20)
                          and themes[e['editorialTopic']]<3
                          and (not e.get('family') or (e['family'] not in families and ordinal-family_last.get(e['family'],-100)>=8))
                          and (not e.get('variant_group') or (e['variant_group'] not in used_variants and e['variant_group'] not in variants))
                          and polar+int(e['intentionalPolarizing'])<=POLARIZING_CAP[p]
                          and (w not in c.playtest_words)]
                    if not opts:break
                    # Rare terms are eligible, not a quota. Familiar terms win
                    # ties; prior content gets a soft penalty, never a fake ban.
                    opts.sort();weights=[]
                    for w in opts:
                        e=entries[w];historical=c.released_counts[w]+.4*c.reserved_counts[w]
                        fresh=2.1 if w in c.additions else 1
                        z=e['zipfEditorialProxy'];familiar=1.0+min(1.6,max(0,z-2.7))
                        narrow=.35 if e['intentionalPolarizing'] else 1
                        weights.append(fresh*familiar*narrow/((1+historical)**.55*(1+used[w])**2*(1+themes[e['editorialTopic']])**1.9*(1+.018*topic_global[e['editorialTopic']])))
                    w=rng.choices(opts,weights=weights,k=1)[0];e=entries[w]
                    words.append(w);remaining[e['tier']]-=1;themes[e['editorialTopic']]+=1;polar+=int(e['intentionalPolarizing'])
                    if e.get('family'):families.add(e['family'])
                    if e.get('variant_group'):variants.add(e['variant_group'])
                expansion=sum(w in c.additions for w in words)
                if len(words)!=14 or expansion<6 or len(themes)<7 or max(themes.values())>3:continue
                lexical_score=expansion*.1+len(themes)*.3+sum(entries[w]['zipfEditorialProxy'] for w in words)/14-.3*polar
                if best is None or lexical_score>best[0]:best=(lexical_score,words,themes,families,variants,polar)
                if attempt>=7 and best:break
            if best is None:
                write(LAB/'failed-allocation.json',{'ordinal':ordinal,'profile':p,'plans':plans,'lastWords':words,'expansion':expansion,'topics':dict(themes),'remaining':dict(remaining),'used':dict(used),'last':last,'familyLast':family_last,'variants':list(used_variants)})
                break
            score,words,themes,families,variants,polar=best
            print('LEXICAL_ACCEPT',restart,ordinal,flush=True)
            used.update(words);last.update({w:ordinal for w in words});family_last.update({f:ordinal for f in families});used_variants.update(variants);topic_global.update(themes)
            plans.append({'ordinal':ordinal,'id':f'mk100-v1-{ordinal:03d}','wave':(ordinal-1)//20+1,'profile':p,
                          'targetedEndgame':ordinal in ({5,9,45,65,85}|({6,11,16,26,31,36,46,51,56,66,71,76,86,91,96}-{36,76,96})|{20,60,100}),'words':sorted(words),'tierCounts':dict(Counter(entries[w]['tier'] for w in words)),
                          'topicCounts':dict(themes),'expansionWords':expansion,'polarizingWords':sorted(w for w in words if entries[w]['intentionalPolarizing']),
                          'lexicalSelectionScore':round(score,4)})
        if len(plans)==100:return plans,restart
        print('LEXICAL_RESTART',restart,'completed',len(plans),flush=True)
    raise ValueError('Global lexical contract could not be met; no relaxed fallback')


def plan():
    if (OUT/'lexical-plan.json').exists():
        raise ValueError('The recovered individually reviewed100 lexical plan is immutable; no regeneration is authorized')
    c=catalog();entries=prepare_entries(c);plans,restart=allocate(c,entries)
    OUT.mkdir(parents=True,exist_ok=True);LAB.mkdir(parents=True,exist_ok=True)
    result={'status':'lexical-plan-only-not-board-bank','createdAt':datetime.now(timezone.utc).isoformat(),'seed':SEED,'restart':restart,
            'lexiconHash':c.lexicon_hash,'representativeOrdinals':REPRESENTATIVE_ORDINALS,'profileCounts':dict(Counter(p['profile'] for p in plans)),
            'policy':{'tierCounts':PROFILE_TIERS,'polarizingCaps':POLARIZING_CAP,'exactRepeatMaximum':2,'exactRepeatMinimumGap':20,'familyMinimumGap':8,
                      'minimumTopicsPerBoard':7,'maximumSameTopic':3,'minimumExpansionWords':6,'variantGroupsUsedAtMostOnce':True,
                      'frequencyMeaning':'Pinned corpus frequency is a screening/tie-break proxy, not a claim of human familiarity. Narrow labels and ordinary exceptions are concrete editorial judgments.'},
            'boards':plans,'entries':{w:entries[w] for p in plans for w in p['words']}}
    write(OUT/'lexical-plan.json',result)
    for p in plans:
        print(p['ordinal'],p['profile'],','.join(p['words']),'polar:',p['polarizingWords'],flush=True)


_SOLVER=None
_PREFIXES=None
_ENTRIES=None
_POOL=None
_BASE_PROFILE=None


def init_worker(words,entries,pool,profile):
    global _SOLVER,_PREFIXES,_ENTRIES,_POOL,_BASE_PROFILE
    _SOLVER=Solver(words);_PREFIXES=_SOLVER.prefixes;_ENTRIES=entries;_POOL=pool;_BASE_PROFILE=profile


def transform_path(path, variant):
    result=[]
    for cell in path:
        r,c=divmod(cell,10)
        if variant&4:r,c=c,r
        if variant&2:r=9-r
        if variant&1:c=9-c
        result.append(r*10+c)
    return result


def canonical_tiling(board):
    """Ordered answer paths modulo square symmetries and individual reversal.

    Letters, answer order and reading direction cannot disguise the same path
    construction. This does not collapse different traversals of equal cells.
    """
    variants=[]
    for variant in range(8):
        paths=[]
        for answer in board['answers']:
            path=tuple(transform_path(answer['path'],variant))
            paths.append(min(path,path[::-1]))
        variants.append(tuple(sorted(paths)))
    return min(variants)


def manufacture_one(plan_row):
    ordinal=plan_row['ordinal'];p=plan_row['profile'];rng=random.Random(digest([SEED,'placement',ordinal]));options=[];reject=Counter()
    indexes=[i for i,row in enumerate(_POOL) if row['constructionProfile']==p];rng.shuffle(indexes)
    targeted=plan_row['targetedEndgame']
    tries=0;budget=65536 if targeted else 8192;want=48 if targeted else 16
    started=time.monotonic()
    for attempt in range(budget):
        tries+=1;index=indexes[attempt%len(indexes)];geometry=_POOL[index];variant=rng.randrange(8);placement_seed=int(digest([SEED,'letters',ordinal,attempt])[:16],16)
        rr=random.Random(placement_seed);paths=[transform_path(path,variant) for path in geometry['paths']]
        if rr.randrange(2):paths=[path[::-1] for path in paths]
        b=board_from_paths(paths,plan_row['words'],rr);g=structural(b)
        errors=geometry_errors(g,_BASE_PROFILE[p])
        if errors:reject['geometry-'+','.join(errors)]+=1;continue
        proof=_SOLVER.verify(b,seconds=5,node_limit=1000000)
        if proof['status']!='unique' or not proof['targetPathsUnique']:
            reject['solver-'+proof['status']+('-nonunique-target' if not proof['targetPathsUnique'] else '')]+=1;continue
        w=weave_metrics(b);pressure=residual_metrics(b,_PREFIXES)
        b['id']=plan_row['id'];b['meta']={'level':ordinal,'candidateOnly':True,'playtestOnly':True,'generatorGeneration':6,
                  'edition':EDITION,'profile':p,'profileVersion':PROFILE_VERSION,'contentHash':board_hash(b),'seed':placement_seed,
                  'wave':plan_row['wave'],'targetedEndgame':plan_row['targetedEndgame']}
        if plan_row['targetedEndgame']:
            from tools.gen6.mk100_endgame import endgame_metrics
            endgame=endgame_metrics(b,_PREFIXES,_ENTRIES,seed=SEED+ordinal,random_orders=6)
        else:endgame=None
        # More difficult construction is intentional only in challenge/summit.
        # Relief selects a gentler recognizer-prefix load on the same path rules.
        proxy=pressure['selectionScore']
        if p=='relief':score=-proxy+0.04*w['crossContacts']
        elif p=='main':score=proxy+0.08*w['crossContacts']+0.2*w['axisReentries']
        else:score=proxy+0.12*w['crossContacts']+0.4*w['axisReentries']
        if endgame:
            score+=endgame_score(endgame)*3
        options.append({'board':b,'proof':proof,'geometry':g,'geometryProfile':_BASE_PROFILE[p],'weave':w,'pressure':pressure,'endgame':endgame,
                        'selectionScore':round(score,6),'provenance':{'geometryPoolIndex':index,'geometrySeed':geometry.get('seed'),'geometryStep':geometry.get('step'),
                                                                 'transform':variant,'attempt':attempt,'placementSeed':placement_seed}})
        if len(options)>=want and (not targeted or sum(endgame_meets_floor(o['endgame']) for o in options)>=4):break
    if len(options)<want:raise ValueError(f'Only{len(options)} of requested{want} exact verified options for{ordinal}: {reject}')
    if targeted and not any(endgame_meets_floor(o['endgame']) for o in options):
        raise ValueError(f'No target-ending option meets the declared reference proxy floor for{ordinal}')
    options.sort(key=lambda o:o['selectionScore'],reverse=True)
    evidence={'ordinal':ordinal,'profile':p,'attempts':tries,'verifiedCandidates':len(options),'rejections':dict(reject),'seconds':round(time.monotonic()-started,3),
              'requestedVerifiedPool':want,'options':options}
    write(LAB/f'board-{ordinal:03d}-pool.json',evidence)
    return {'ordinal':ordinal,'verifiedCandidates':len(options),'attempts':tries,'seconds':evidence['seconds']}


def endgame_score(result):
    # The helper owns transparent proxy definitions. This selects broadly robust
    # residuals over multiple orders, never a preferred author-only order.
    if 'selectionScore' in result:return float(result['selectionScore'])
    if 'score' in result:return float(result['score'])
    if 'summary' in result:
        s=result['summary']
        for key in ('endgameSelectionScore','selectionScore','robustnessScore','score'):
            if key in s:return float(s[key])
    for key in ('robustnessScore','robustScore'):
        if key in result:return float(result[key])
    return 0


def endgame_meets_floor(result):
    return (result is not None and endgame_score(result)>=23.4209
            and result['summary']['plausiblePressureMinimum']>=20
            and result['summary']['plausibleAllThreeSimpleChains']==0)


def load_geometry():
    records=read_json(OUT/'geometry-production-v2.json')
    raw=(OUT/'geometry-pool-v2.jsonl').read_bytes()
    if hashlib.sha256(raw).hexdigest()!=records['poolSha256']:raise ValueError('New geometry pool hash differs')
    pool=[json.loads(line) for line in raw.decode('utf-8').splitlines()]
    if len(pool)!=records['poolSize'] or len(pool)<128:raise ValueError('Incomplete new geometry pool')
    if any(r['exitCode']!=0 or r['completed']!=r['requested'] for r in records['profiles']):raise ValueError('Incomplete requested geometry generation')
    return pool,records


def produce(stage,workers):
    c=catalog();payload=read_json(OUT/'lexical-plan.json');pool,production=load_geometry();words=c.full_dictionary();solver=Solver(words)
    palindromes=[(row['ordinal'],w) for row in payload['boards'] for w in row['words'] if w==w[::-1]]
    if palindromes:
        raise ValueError('Exact unique target orientation is impossible for palindrome targets: '+repr(palindromes))
    frozen=source_hashes(c);p={name:geometry_profile(c,name) for name in PROFILE_TIERS}
    ordinals=REPRESENTATIVE_ORDINALS if stage=='representative' else list(range(1,101))
    todo=[]
    for row in payload['boards']:
        if row['ordinal'] not in ordinals:continue
        cache=LAB/f"board-{row['ordinal']:03d}-pool.json"
        if (not cache.exists() or read_json(cache).get('requestedVerifiedPool',0)<(48 if row['targetedEndgame'] else 16)):
            todo.append(row)
    started=time.monotonic();results=[]
    LAB.mkdir(parents=True,exist_ok=True)
    with ProcessPoolExecutor(max_workers=workers,initializer=init_worker,initargs=(words,payload['entries'],pool,p)) as ex:
        for result in ex.map(manufacture_one,todo):
            results.append(result);print('VERIFIED',result,flush=True)
            write(OUT/f'{stage}-v2-production-checkpoint.json',{'status':'in-progress','stage':stage,'completedOrdinals':sorted([r['ordinal'] for r in results]),'frozenInputs':frozen,'results':results})
    for path,h in frozen.items():
        if hashlib.sha256((ROOT/path).read_bytes()).hexdigest()!=h:raise ValueError('Read-only input changed: '+path)
    select(stage,payload,c,solver,frozen,production)
    print('STAGE COMPLETE',stage,'seconds',round(time.monotonic()-started,2),flush=True)


def source_hashes(c):
    sources=['tools/gen6/mk100_manufacture.py','tools/gen6/mk100_catalog.py','tools/gen6/mk100_endgame.py','tools/gen6/mk100_geometry.py','tools/gen6/eight.py','tools/gen6/catalog.py','tools/gen5/catalog.py','content/gen6/mozkokalypsa-100/recognition-manifest.json','content/gen6/mozkokalypsa-100/geometry-pool-v2.jsonl','content/gen6/mozkokalypsa-100/geometry-production-v2.json','content/lexicon-v3/working/lexicon.json','tools/gen6/interwoven_geometry.cpp','tools/gen6/interwoven.py','tools/gen5/validation.py','tools/mozkokalypsa_lab.py',
             'word_recognition_v3330.py','content/gen6/mozkokalypsa-100/recognition-words.txt','content/gen6/mozkokalypsa-100/lexical-plan.json']
    sources.extend(p.relative_to(ROOT).as_posix() for p in (ROOT/'content/lexicon-v3/working').glob('*') if p.is_file())
    sources.extend(p.relative_to(ROOT).as_posix() for p in (ROOT/'data/playtests').glob('mozkokalypsa-v*.json'))
    sources.extend(['tools/gen6/mk100_amend_plan.py','content/gen6/mozkokalypsa-100/lexical-plan-amendments-v2.json'])
    return {p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in sorted(set(sources)) if (ROOT/p).exists()}


def select(stage,payload,c,solver,frozen,production):
    ordinals=sorted(REPRESENTATIVE_ORDINALS if stage=='representative' else range(1,101));boards=[];records=[]
    representatives={}
    canonical_positions={};novelty_choices=0
    if stage=='full':
        representatives={b['id']:b for b in read_json(OUT/'representative-bank-v2.json')['boards']}
    for ordinal in ordinals:
        pool=read_json(LAB/f'board-{ordinal:03d}-pool.json');eligible=[]
        for candidate in pool['options']:
            b=candidate['board']
            if b['meta']['targetedEndgame'] and not endgame_meets_floor(candidate['endgame']):continue
            reserved=representatives.get(b['id'])
            if reserved and board_hash(b)!=board_hash(reserved):continue
            future_reserved=[old for key,old in representatives.items() if key!=b['id'] and old['meta']['level']>ordinal]
            if any(len(shape_signature(b)&shape_signature(old))>=7 for old in boards+future_reserved):continue
            if board_hash(b) in c.historical_board_hashes:continue
            canonical=canonical_tiling(b)
            if any(abs(ordinal-old)<8 for old in canonical_positions.get(canonical,[])):continue
            if any(abs(ordinal-old['meta']['level'])<8 and canonical==canonical_tiling(old) for old in future_reserved):continue
            candidate['canonicalTilingHash']=digest(canonical)
            eligible.append(candidate)
        if not eligible:raise ValueError('No globally distinct choice with canonical gap8 for '+str(ordinal))
        best_score=max(o['selectionScore'] for o in eligible)
        tie_window=.05*max(1,abs(best_score))
        equivalent=[o for o in eligible if o['selectionScore']>=best_score-tie_window]
        chosen=min(equivalent,key=lambda o:(len(canonical_positions.get(canonical_tiling(o['board']),[])),-o['selectionScore'],o['provenance']['attempt']))
        if chosen['selectionScore']<best_score:novelty_choices+=1
        b=chosen['board'];b['meta'].update(lexiconHash=c.lexicon_hash,contentGeneration=c.free_generation,validation=chosen['proof'])
        final_proof=solver.verify(b,seconds=15,node_limit=2000000)
        if final_proof['status']!='unique' or not final_proof['targetPathsUnique']:raise ValueError('Final exact proof failed'+b['id'])
        chosen['finalProof']=final_proof
        canonical_positions.setdefault(canonical_tiling(b),[]).append(ordinal)
        boards.append(b);records.append({'id':b['id'],'ordinal':ordinal,'verifiedPool':pool['verifiedCandidates'],'poolAttempts':pool['attempts'],'poolRejections':pool['rejections'],
                                          **{k:v for k,v in chosen.items() if k!='board'}})
    bank={'kind':'gen6-unpublished-preview','schemaVersion':1,'edition':EDITION,'status':'candidate-technically-verified-awaiting-editorial' if stage=='full' else 'representative-internally-verified',
          'publicationAuthorized':False,'playtestActivationAuthorized':False,'sourceSha':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
          'generatorGeneration':6,'runtimeFreeGeneration':c.free_generation,'humanDifficulty':'unmeasured','lexiconHash':c.lexicon_hash,
          'validationDictionary':{'sha256':solver.hash,'size':len(solver.words),'snapshot':'recognition-words.txt','manifest':'recognition-manifest.json'},
          'boards':boards,'contentHash':digest(boards)}
    filename='representative-bank-v2.json' if stage=='representative' else 'bank.json'
    write(OUT/filename,bank)
    verification_filename='representative-v2-verification.json' if stage=='representative' else 'full-verification.json'
    write(OUT/verification_filename,{'status':'exact-proofs-complete','createdAt':datetime.now(timezone.utc).isoformat(),'stage':stage,'boards':records,'bankContentHash':bank['contentHash'],
             'dictionary':bank['validationDictionary'],'frozenInputs':frozen,'geometryProduction':production,
             'selection':{'verifiedPoolTotal':sum(r['verifiedPool'] for r in records),'targetVerifiedPoolPerBoard':{'ordinary':16,'targetedEndgame':48},'targetedProxyFloor':{'reference':'mk2-10','endgameSelectionScoreMinimum':23.4209,'plausiblePressureMinimum':20,'plausibleAllThreeSimpleChainsMaximum':0},'notFirst100Passes':True,'minimumDistinctPathTilingsAgainstChosen':8,
                          'canonicalTilingMinimumGap':8,'canonicalNormalization':'orderedpaths modulo8square symmetries and individual reversal; words andanswerorder ignored',
                          'novelCanonicalPreferenceScoreWindowFraction':.05,'noveltyTieChoices':novelty_choices,
                          'canonicalTilingsUsed':len(canonical_positions),'canonicalRepeatMaximum':max(map(len,canonical_positions.values())),
                          'canonicalRepeatMinimumGap':min((y-x for p in canonical_positions.values() for x,y in zip(p,p[1:])),default=None)},
             'interpretation':'Recognition and exact-cover uniqueness are technically checked. Geometry, pressure and endgame scores are simulation proxies; player enjoyment and persistence of difficulty are unmeasured.'})
    write(OUT/f'{stage}-v2-production-checkpoint.json',{'status':'stage-complete','stage':stage,'boardCount':len(boards),'bankContentHash':bank['contentHash'],'completedOrdinals':ordinals,'open':'individual editorial review and isolated preview verification' if stage=='full' else 'internal editorial review before manufacturing remaining88'})
    if stage=='full':summarize(payload,bank,records,c)


def summarize(payload,bank,records,c):
    positions={};families={};variants={};words=[];entries=payload['entries']
    for b in bank['boards']:
        ordinal=b['meta']['level']
        for a in b['answers']:
            w=norm(a['word']);words.append(w);positions.setdefault(w,[]).append(ordinal)
            if entries[w].get('family'):families.setdefault(entries[w]['family'],[]).append({'word':w,'ordinal':ordinal})
            if entries[w].get('variant_group'):variants.setdefault(entries[w]['variant_group'],[]).append({'word':w,'ordinal':ordinal})
    repeats={w:p for w,p in positions.items() if len(p)>1}
    historical=[{'word':w,'seriesCount':len(pos),'ordinals':pos,'releasedCount':c.released_counts[w],'reservedCount':c.reserved_counts[w],'playtest':w in c.playtest_words} for w,pos in positions.items() if c.global_counts[w]]
    summary={'status':'candidate-technical-summary','boardCount':100,'profileCounts':dict(Counter(b['meta']['profile'] for b in bank['boards'])),'targetOccurrences':len(words),'uniqueWords':len(set(words)),
             'exactRepeats':repeats,'maximumExactRepeat':max(map(len,positions.values())),'minimumExactRepeatGap':min((b-a for p in repeats.values() for a,b in zip(p,p[1:])),default=None),
             'families':{k:v for k,v in families.items() if len(v)>1},'variantGroups':variants,'historyOverlap':historical,
             'historyOverlapUnique':len(historical),'playtestOverlap':sorted(set(words)&c.playtest_words),'tiers':dict(Counter(entries[w]['tier'] for w in words)),
             'topics':dict(Counter(entries[w]['editorialTopic'] for w in words)),'approvedExpansionUnique':len(set(words)&set(c.additions)),
             'geometryMedians':{k:statistics.median(r['geometry'][k] for r in records) for k in ('meanTurns','meanStraightShare','minPathTurns')},
             'weaveMedians':{k:statistics.median(r['weave'][k] for r in records) for k in ('crossContacts','axisReentries','neighborsMean','minSeamCrossers')},
             'pressureMedians':{k:statistics.median(r['pressure'][k] for r in records) for k in ('initial','after3Median','halfMedian','selectionScore')},
             'targetedEndgameCount':sum(b['meta']['targetedEndgame'] for b in bank['boards']),'endgameByBoard':{r['id']:r['endgame'] for r in records if r['endgame']},
             'humanValidation':'No newly activated playtest. Human difficulty and enjoyment remain unmeasured. Historicalbank overlap does not imply individual player exposure.'}
    write(OUT/'summary.json',summary)
    canonical_positions={}
    for board in bank['boards']:
        canonical_positions.setdefault(digest(canonical_tiling(board)),[]).append(board['meta']['level'])
    summary['canonicalGeometry']={'normalization':'orderedpaths modulo8square symmetries andindividualreversal',
                                 'uniqueTilings':len(canonical_positions),'minimumRepeatGap':min((b-a for p in canonical_positions.values() for a,b in zip(p,p[1:])),default=None),
                                 'maximumRepeat':max(map(len,canonical_positions.values())),
                                 'repeatPositions':{h:p for h,p in canonical_positions.items() if len(p)>1},
                                 'designLimitation':'Construction templates can recur after at least8boards; newletterplacements andwords do not imply a newcanonicaltiling.'}
    write(OUT/'summary.json',summary)
    manifest={'schemaVersion':1,'edition':bank['edition'],'status':'candidate-unpublished','publicationAuthorized':False,'bankContentHash':bank['contentHash'],
              'generatorGeneration':6,'runtimeFreeGeneration':c.free_generation,'lexiconHash':c.lexicon_hash,'recognitionHash':bank['validationDictionary']['sha256'],
              'representativeOrdinals':REPRESENTATIVE_ORDINALS,'boards':[{'ordinal':b['meta']['level'],'id':b['id'],'profile':b['meta']['profile'],'wave':b['meta']['wave'],
                       'contentHash':b['meta']['contentHash'],'seed':b['meta']['seed'],'targetedEndgame':b['meta']['targetedEndgame'],'wordCount':len(b['answers']),'cellCount':len(b['mask'])} for b in bank['boards']]}
    write(OUT/'manifest.json',manifest)
    write(OUT/'candidate-pool-provenance.json',{'status':'complete-new-candidate-pool','seed':SEED,'geometryEngine':'tools/gen6/mk100_geometry.py based on unchanged interwoven_geometry.cpp','candidateCount':sum(r['verifiedPool'] for r in records),
           'selectedCount':100,'sources':[{'id':r['id'],'verifiedCandidates':r['verifiedPool'],'attempts':r['poolAttempts'],'rejections':r['poolRejections'],'selected':r['provenance']} for r in records],
           'proof':'Individual candidate pool files retained in candidate-pools-v2.zip; finalselected exact proofs are in full-verification.json. All solver budget exhaustion rejected; no historical board substituted.'})
    import zipfile
    with zipfile.ZipFile(OUT/'candidate-pools-v2.zip','w',compression=zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(LAB.glob('board-*-pool.json')):archive.write(path,path.name)


def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('action',choices=['representative','full']);ap.add_argument('--workers',type=int,default=4);args=ap.parse_args()
    if args.action=='plan':plan()
    else:produce(args.action,args.workers)

if __name__=='__main__':main()
