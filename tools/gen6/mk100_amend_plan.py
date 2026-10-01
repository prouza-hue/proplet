"""Apply the two individually reviewed technical palindrome corrections.

The full lexicon and recognition snapshot stay immutable. The exact original
reviewed plan is preserved before amendment, and all per-board/global constraints
are checked using the same saved editorial entries as manufacture.
"""
from collections import Counter, defaultdict
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
from pathlib import Path
import zipfile
from tools.gen5.catalog import digest, read_json
from tools.gen6.mk100_manufacture import OUT, catalog, prepare_entries, SHAPE, PROFILE_TIERS, POLARIZING_CAP
from tools.gen6.eight import write

REPLACEMENTS={16:('radar','laser'),88:('radar','sloka')}


def main():
    path=OUT/'lexical-plan.json';original=path.read_bytes()
    original_hash=hashlib.sha256(original).hexdigest()
    payload=read_json(path);c=catalog();available=prepare_entries(c)
    amendment_path=OUT/'lexical-plan-amendments-v2.json'
    if amendment_path.exists():
        existing=read_json(amendment_path)
        if original_hash==existing['amendedPlanSha256']:
            print('AMENDMENT_ALREADY_APPLIED',original_hash);return
        raise ValueError('Existing amendment does not bind this plan')
    archive=OUT/'checkpoints/lexical-plan-before-palindrome-amendment.zip'
    with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr('lexical-plan.json',original)
    records=[]
    for ordinal,(old,new) in REPLACEMENTS.items():
        row=payload['boards'][ordinal-1];before=deepcopy(row)
        if old not in row['words'] or new in row['words']:raise ValueError('Unexpected lexical amendment input')
        entry=available[new]
        if len(old)!=len(new) or payload['entries'][old]['tier']!=entry['tier']:
            raise ValueError('Replacement changes length or tier')
        payload['entries'][new]=entry
        row['words']=sorted(new if w==old else w for w in row['words'])
        row['topicCounts']=dict(Counter(payload['entries'][w]['editorialTopic'] for w in row['words']))
        row['tierCounts']=dict(Counter(payload['entries'][w]['tier'] for w in row['words']))
        row['expansionWords']=sum(w in c.additions for w in row['words'])
        row['polarizingWords']=sorted(w for w in row['words'] if payload['entries'][w]['intentionalPolarizing'])
        row['lexicalSelectionScore']=round(row['expansionWords']*.1+len(row['topicCounts'])*.3+
            sum(payload['entries'][w]['zipfEditorialProxy'] for w in row['words'])/14-.3*len(row['polarizingWords']),4)
        records.append({'ordinal':ordinal,'id':row['id'],'oldWord':old.upper(),'newWord':new.upper(),
                        'oldWords':before['words'],'newWords':row['words'],
                        'oldWordsHash':digest(before['words']),'newWordsHash':digest(row['words']),
                        'replacementTier':entry['tier'],'replacementLength':len(new),
                        'replacementSourceCohort':entry['source_cohort'],
                        'replacementEntryHash':digest(entry),
                        'reason':'RADAR is a palindrome: exact current solver sees valid forward and reverse target paths for every possible geometry. Replace only candidate target; keep recognized RADAR unchanged.',
                        'editorialReview':'Root individually reviewed both full14-word contexts, accepted LASER16 and SLOKA88; see editorial-amendments-v2.json'})
    used={w for row in payload['boards'] for w in row['words']}
    payload['entries']={w:e for w,e in payload['entries'].items() if w in used}
    positions=defaultdict(list);families=defaultdict(list);variants=defaultdict(list)
    for row in payload['boards']:
        words=row['words'];p=row['profile'];es=payload['entries']
        if len(words)!=14 or Counter(map(len,words))!=Counter(SHAPE):raise ValueError('Shape changed')
        if Counter(es[w]['tier'] for w in words)!=Counter(PROFILE_TIERS[p]):raise ValueError('Tier mix changed')
        if len(row['topicCounts'])<7 or max(row['topicCounts'].values())>3:raise ValueError('Topic limits changed')
        if len(row['polarizingWords'])>POLARIZING_CAP[p] or row['expansionWords']<6:raise ValueError('Editorial limits changed')
        for w in words:
            if w==w[::-1]:raise ValueError('Palindrome remains: '+w)
            positions[w].append(row['ordinal'])
            if es[w].get('family'):families[es[w]['family']].append(row['ordinal'])
            if es[w].get('variant_group'):variants[es[w]['variant_group']].append(row['ordinal'])
    if any(len(pos)>2 or any(b-a<20 for a,b in zip(pos,pos[1:])) for pos in positions.values()):raise ValueError('Exact repetition contract changed')
    if any(any(b-a<8 for a,b in zip(pos,pos[1:])) for pos in families.values()):raise ValueError('Family spacing changed')
    if any(len(pos)>1 for pos in variants.values()):raise ValueError('Variant groups repeated')
    payload.setdefault('technicalAmendments',[]).append({'date':'2026-10-01','file':amendment_path.name,'ordinals':[16,88],'lexiconUnchanged':True,'recognitionUnchanged':True})
    write(path,payload)
    write(amendment_path,{'schemaVersion':1,'createdAt':datetime.now(timezone.utc).isoformat(),
         'originalPlanSha256':original_hash,'amendedPlanSha256':hashlib.sha256(path.read_bytes()).hexdigest(),
         'originalPlanArchive':archive.relative_to(OUT).as_posix(),
         'immutableLexiconSha256':c.lexicon_hash,'recognitionByteSha256':hashlib.sha256((OUT/'recognition-words.txt').read_bytes()).hexdigest(),
         'palindromeScan':'all100 reviewed lexical sets; only RADAR16/88 found',
         'records':records,'globalChecks':{'wordOccurrences':sum(map(len,positions.values())),'uniqueWords':len(positions),'exactRepeatMaximum':max(map(len,positions.values())),'allConstraintsPreserved':True},
         'representative12WordsAndPathsUnchanged':True,'productionChanged':False})
    print('AMENDMENT_COMPLETE',hashlib.sha256(path.read_bytes()).hexdigest(),len(positions))


if __name__=='__main__':main()
