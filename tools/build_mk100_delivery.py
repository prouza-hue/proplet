"""Bind final individual reviews and produce the readable unpublished catalogue."""
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
import argparse, json, statistics
from tools.gen5.catalog import ROOT, digest, norm, read_json
from tools.gen5.validation import Solver
from tools.gen6.catalog import board_hash
from tools.gen6.mk100_endgame import endgame_metrics

DIRECTORY=ROOT/'content/gen6/mozkokalypsa-100'
LABELS={'relief':'Úleva','main':'Hlavní série','challenge':'Výzva','summit':'Vrchol'}

def write(name, payload):
    (DIRECTORY/name).write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

def reviews():
    result={}
    for name in ('editorial-review-001-050.json','editorial-review-051-100.json'):
        payload=read_json(DIRECTORY/name)
        for row in payload.get('records',payload.get('boards',[])):
            result[row['ordinal']]=row
    if set(result)!=set(range(1,101)):raise ValueError('Missing individual lexical review')
    amendments=DIRECTORY/'editorial-amendments-v2.json'
    if amendments.exists():
        for row in read_json(amendments)['records']:
            if result[row['ordinal']]['wordsetHash']!=row['oldReviewWordsetHash']:
                raise ValueError('Unbound scoped editorial amendment')
            result[row['ordinal']]=row
    return result

def audit_endgames():
    bank=read_json(DIRECTORY/'bank.json')
    plan=read_json(DIRECTORY/'lexical-plan.json')
    words=(DIRECTORY/'recognition-words.txt').read_text(encoding='utf-8').splitlines()
    solver=Solver(words)
    lexical=reviews()
    records=[]
    for board in bank['boards']:
        if not board['meta']['targetedEndgame']:continue
        ordinal=board['meta']['level']
        audit=endgame_metrics(board,solver.prefixes,plan['entries'],exhaustive=True,
                              seed=plan['seed']+ordinal,random_orders=6)
        if audit['exhaustive']['triples']!=364:raise ValueError('Incomplete last-three audit')
        if audit['summary']['endgameSelectionScore']<23.4209 or audit['summary']['plausiblePressureMinimum']<20:
            raise ValueError('Declared targeted selection floor failed: '+board['id'])
        if audit['summary']['plausibleAllThreeSimpleChains']:
            raise ValueError('Targeted remainder collapses into three independent simple chains')
        polarizing=lexical[ordinal]['polarizingWords']
        records.append({'id':board['id'],'ordinal':ordinal,'contentHash':board_hash(board),
                        'mechanism':'construction-plus-scoped-lexical-texture' if polarizing else 'primarily-construction',
                        'consciousLexicalBarriers':polarizing,
                        'humanEffect':'unmeasured; AI editorial and structural simulations only',**audit})
        print('AFTER11_COMPLETE',board['id'],audit['summary']['endgameSelectionScore'],
              'all364_P25',audit['exhaustive']['pressureP25'],flush=True)
    if len(records)!=20:raise ValueError('Expected20 targeted ending experiments')
    reference=next(r for r in read_json(ROOT/'docs/mk100-recovery/reference-audit.json')['references'] if r['id']=='mk2-10')
    reference_p25=reference['exhaustive']['pressureP25']
    below_reference=sum(r['exhaustive']['pressureP25']<reference_p25 for r in records)
    result={'status':'complete-offline-after11-audit','bankContentHash':bank['contentHash'],
            'recognitionDictionaryHash':solver.hash,'recognitionEntries':len(words),'targetedBoardCount':20,
            'exhaustiveTailCount':20*364,'records':records,
            'broadOrderComparison':{'reference':'mk2-10','referencePressureP25':reference_p25,
                'targetedBelowReferenceP25':below_reference,'targetedCount':20,
                'conclusion':'Broad-order improvement remains unproven; named hypotheses are only selection proxies.'},
            'references':'docs/mk100-recovery/reference-audit.json: ten unchanged historical boards',
            'limitations':['Scores and all orderings are proxies; no synthetic player telemetry.',
                           'A good minimum across named hypotheses does not prove a difficult ending for people.',
                           f'{below_reference}/20 exhaustive pressureP25 scores remain below reference mk2-10; broad-order improvement is unproven.',
                           'Every one of364 triples is retained; weak sensitivity tails are visible and not omitted.',
                           'Bonus recognition and exact uniqueness use the complete current frozen corpus.']}
    write('endgame-audit-v2.json',result)
    return result

def catalogue():
    bank=read_json(DIRECTORY/'bank.json')
    independent=read_json(DIRECTORY/'independent-verification.json')
    if independent['status']!='PASS' or independent['boardCount']!=100 or independent['bankContentHash']!=bank['contentHash']:
        raise ValueError('Final catalogue requires independent100-board PASS')
    lexical=reviews();construction={}
    for name in ('construction-review-001-050.json','construction-review-051-100.json'):
        payload=read_json(DIRECTORY/name)
        for row in payload.get('records',payload.get('boards',[])):construction[row['ordinal']]=row
    if set(construction)!=set(range(1,101)):raise ValueError('Missing final individual grid review')
    endgame=read_json(DIRECTORY/'endgame-audit-v2.json')
    if endgame['bankContentHash']!=bank['contentHash']:raise ValueError('Ending report belongs to another bank')
    evidence=read_json(DIRECTORY/'full-verification.json')
    records={r['ordinal']:r for r in evidence['boards']}
    summary=read_json(DIRECTORY/'summary.json')
    text=['# Mozkokalypsa — kandidátní stovka v2','',
          'Dokončená izolovaná kandidátní banka: 100 konkrétních desek 10×10, každá má 14 cílových slov a všech 100 polí bez překryvu. Pořadí je v pěti vlnách; skladba 20 úlev / 60 hlavních / 15 výzev / 5 vrcholů.','',
          f"Lexikon v3 beze změny; uznávání {independent['recognition']['entries']:,} slov. Každá deska má úplný přesný důkaz jednoznačnosti a nezávislou reprodukci. Vybráno z {evidence['selection']['verifiedPoolTotal']:,} plně ověřených kandidátů.", '',
          f"Celkem 1 400 cílových výskytů, {summary['uniqueWords']} různých slov, nejvýše {summary['maximumExactRepeat']} přesné výskyty s odstupem nejméně {summary['minimumExactRepeatGap']} desek. Vůči předchozím playtestům je přiznaná výjimka LAHODNÝ na desce 37; široká historie vydaných a rezervovaných bank má {summary['historyOverlapUnique']} různých shod. Historie bank není osobní historie hráče.",'',
          f"Konstrukce mají {summary['canonicalGeometry']['uniqueTilings']} odlišných kanonických tvarů po sjednocení otočení, zrcadlení a obrácení jednotlivých cest. Stejná konstrukce se vrací nejdříve po {summary['canonicalGeometry']['minimumRepeatGap']} deskách a nejvýše {summary['canonicalGeometry']['maximumRepeat']}krát. Nová písmena a slova sama o sobě nejsou novou konstrukcí.",'',
          'Dvacet cílených závěrů má tři pojmenované hypotézy pořadí, šest kontrol citlivosti a úplných 364 posledních trojic na každé desce. Jde o konstrukční experimenty. Náročnost, zábavnost a skutečný účinek závěru nové stovky dosud hráči změřené nejsou.','',
          f"V {endgame['broadOrderComparison']['targetedBelowReferenceP25']} z dvaceti experimentů je dolní kvartil tlaku přes všech 364 trojic nižší než u reference mk2-10. Zlepšení napříč libovolným pořadím proto není prokázané; slabé zbytky jsou v auditu zachovány.",'',
          'Redakce je individuální modelový úsudek o konkrétních slovech a mřížkách; nenahrazuje novou normativní slovníkovou certifikaci ani fyzický test zařízení. Produkční vydání a aktivace testu nejsou povoleny.','']
    bound=[]
    for board in bank['boards']:
        ordinal=board['meta']['level'];lex=lexical[ordinal];grid=construction[ordinal];record=records[ordinal]
        words=sorted(norm(a['word']) for a in board['answers'])
        if grid['contentHash']!=board_hash(board) or grid['wordsetHash']!=digest(words) or not grid['reviewedActualGridAndAnswerPaths']:
            raise ValueError('Grid review does not bind actual final content: '+board['id'])
        if grid['verdict'] not in ('accepted','accept','accepted-with-notes'):raise ValueError('Unresolved grid editorial decision')
        if lex['wordsetHash']!=digest(words):raise ValueError('Lexical review differs')
        risks=list(dict.fromkeys(lex.get('risks',[])+grid.get('risks',[])))
        text.extend([f"## {ordinal:03d} · {LABELS[board['meta']['profile']]} · {lex['character']}",'',
                     'Slova: '+', '.join(a['word'] for a in board['answers'])+'.','',
                     lex['whyIncluded'],'',grid['assessment'],''])
        if risks:text.extend(['Rizika: '+' '.join(risks),''])
        text.extend([f"Identita `{board['id']}`; obsahový hash `{board_hash(board)}`; seed `{board['meta']['seed']}`. Zatáčky v průměru {record['geometry']['meanTurns']:.2f}; přesný solver PASS, cesty unikátní. "+('Cílený závěrový experiment.' if board['meta']['targetedEndgame'] else 'Přirozené závěrečné zrychlení přípustné.'),''])
        bound.append({'id':board['id'],'ordinal':ordinal,'contentHash':board_hash(board),
                      'wordsetHash':digest(words),'individualLexicalReview':True,'individualGridReview':True,'risks':risks})
    (DIRECTORY/'CATALOG.md').write_text('\n'.join(text).rstrip()+'\n',encoding='utf-8')
    write('editorial-bindings-v2.json',{'status':'complete-individual-review100','createdAt':datetime.now(timezone.utc).isoformat(),
                                     'bankContentHash':bank['contentHash'],'records':bound,'reviewerType':'AI editorial model assessments'})
    return bound

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action',choices=('endgames','catalogue'))
    args=parser.parse_args()
    audit_endgames() if args.action=='endgames' else catalogue()
