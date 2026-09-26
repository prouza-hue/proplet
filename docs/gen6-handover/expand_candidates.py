#!/usr/bin/env python3
"""Read-only editorial candidate expansion. Not a production lexicon builder.
Uses source snapshots, never treats corpus absence as lexical invalidity.
"""
from __future__ import annotations
import argparse, ast, collections, csv, hashlib, json, re, unicodedata
from pathlib import Path

WORD=re.compile(r'^[a-záčďéěíňóřšťúůýž]{4,10}$')
def norm(s): return unicodedata.normalize('NFC',s).strip().casefold()
def load(p): return json.loads(p.read_text(encoding='utf-8'))
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def git_blob(p):
 b=p.read_bytes(); return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
def literal_set(path,name):
 for n in ast.parse(path.read_text(encoding='utf-8')).body:
  if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id==name for t in n.targets):
   if isinstance(n.value,ast.Set):return set(ast.literal_eval(n.value))
   if isinstance(n.value,ast.Call) and isinstance(n.value.args[0],ast.Call):
    return set(n.value.args[0].func.value.value.split())
 raise ValueError('Missing expected literal: '+name)

SPECIAL=set('fóliovník okvětí blizna úponek dobromysl tuřín doubrava letokruh pryskyřice úvrať hranostaj kozoroh otakárek střevlík mandelinka jiřička strnad koroptev tetřev žluna dudek čejka lyska potápka sýček kalous luňák krahujec kuňka hrouzek candát cejn plotice teslice svorník závitník závlačka kaučuk plst fermež lazura rydlo raznice hoblice glazura kamenina záševek kamaše slivoň škraboška rusalka hastrman polednice klekánice permoník hejkal divoženka bludička fujara kontrabas cimbál citera hoboj fagot nástupiště vpust ložisko ráhno závětří návětří viadukt násadka kvaš rudka štoček linoryt dřevoryt lept sítotisk iniciála mincíř nálevka šamot'.split())
EXPRESSIVE=set('pelášit hopsat šmejdit chroustat čmárat parťák šikula dobrák rošťák šprýmař popleta zmatkař loudal kulich bačkora ešus karimatka buzola vandr'.split())
PLURALIA=set('kamna prádlo vrátka jáhly povidla nudle kšandy kamaše přesýpačky žebřiny červánky nebesa chrastí chvojí jehličí křoví mlází borůvčí proutí kapradí smetí'.split())
FAMILY_GROUPS=[
 ('válet','váleček'),('kropit','kropítko'),('šlehat','šlehač','šlehačka'),('strouhat','struhadlo','strouhátko'),
 ('vysávat','vysavač'),('včela','včelař','včelín','včelstvo'),('kovář','kovadlina'),('řezba','řezbář','vyřezávat'),
 ('tisk','tiskař','obtisk','otisk','sítotisk'),('hoblík','hoblice','hoblina'),('plést','rozplést','splétat'),
 ('bublina','bublat','bublifuk'),('cinkat','cinkot'),('šustit','šustot'),('šumět','šum'),('bzučet','bzukot'),
 ('hučet','hukot'),('praskat','praskot'),('pískat','pískot','píšťala','píšťalka'),('dřímat','dřímota'),
 ('hravý','hravost'),('zvídavý','zvídavost'),('laskavý','laskavost'),('jasan','jasánek'),
 ('nálepka','samolepka','lepit'),('svítilna','svítání','svítit'),('mlynář','mlýn','mlýnek'),
 ('loutka','loutkář'),('pohádka','pohádkář'),('kouzlo','kouzelník'),('náves','vesnice'),
 ('špenát','špenátový'),('truhlář','truhla','truhlice'),('vyřezávat','řezbář','řezba'),
]
# These are proposed relationships for repetition control, never synonym equivalence.
FAMILY={w:sorted(set(ws)) for ws in FAMILY_GROUPS for w in ws}
SAMPLES={
 'hraboš':{'publisher':'Lingea','url':'https://www.nechybujte.cz/slovnik-soucasne-cestiny/hrabo%C5%A1','checked_on':'2026-09-26','scope':'headword and animal meaning inspected; not runtime approval'},
 'nora':{'publisher':'Lingea','url':'https://www.nechybujte.cz/slovnik-soucasne-cestiny/nora','checked_on':'2026-09-26','scope':'headword and animal-den meaning inspected; not runtime approval'},
}

def run(root, previous, seeds, out, source_sha):
 root=root.resolve();out=out.resolve()
 if root==out or root in out.parents:raise ValueError('Write outputs outside the repository')
 inputs=['data/lexicon_v2.json','data/lexicon_v2_wikidata_raw.json','data/source_cs_50k.txt','data/words.txt','public/valid-words-v3328.txt','data/target_generation_exclusions_v334.json','data/puzzles.json','data/playtests/mozkokalypsa-v2.json','tools/build_lexicon_v2.py','word_recognition_v3330.py','tools/gen5/catalog.py','tools/gen5/package.py','public/app/content/free-order-engine.js','public/app/content/free-order-store.js','content/gen5/profiles.json']
 before={p:sha(root/p) for p in inputs}
 lex=load(root/inputs[0])['entries']; existing={norm(x['word']) for x in lex}
 raw_payload=load(root/inputs[1]);raw=raw_payload['entries']; lemmas=collections.defaultdict(list)
 for e in raw:lemmas[norm(e['lemma'])].append(e)
 freq={}
 for line in (root/inputs[2]).read_text(encoding='utf-8').splitlines():
  try:w,n=line.rsplit(' ',1);freq[norm(w)]=int(n)
  except ValueError:pass
 prohibited=set(map(norm,load(root/inputs[5])['remove_from_target_generation']))
 prohibited |= literal_set(root/'tools/build_lexicon_v2.py','TARGET_BLOCK')
 prohibited |= {'červodíra','blockchain','pulsar','tensor'}
 overlay=literal_set(root/'word_recognition_v3330.py','RECOGNITION_OVERLAY')
 static=set(existing)|overlay
 for p in ['data/words.txt','public/valid-words-v3328.txt']:static|={norm(w) for w in (root/p).read_text().splitlines()}
 static|={norm(e['lemma']) for e in raw if e['lemma']==e['lemma'].lower()}
 static={w for w in static if re.fullmatch('[a-záčďéěíňóřšťúůýž]{4,24}',w) and w!='negr'}
 bank=load(root/'data/puzzles.json');free=collections.Counter(norm(a['word']) for bs in bank['free'].values() for b in bs for a in b['answers'])
 round2=collections.Counter(norm(a['word']) for b in load(root/'data/playtests/mozkokalypsa-v2.json')['boards'] for a in b['answers'])
 old=load(previous)['candidates']; proposed=load(seeds); seen=set(); allrows=[]
 def append(word,theme,wave,index):
  w=norm(word)
  assert WORD.fullmatch(w),(w,'invalid current length/alphabet')
  assert w not in existing,(w,'already target')
  assert w not in seen,(w,'duplicate candidate')
  assert w not in prohibited,(w,'previously blocked')
  seen.add(w)
  noun_lemma=any(e['lemma']==w and e['part_of_speech']=='noun' for e in lemmas.get(w,[]))
  blockers=[]
  if not lemmas.get(w):blockers.append('absent_from_stored_lemma_snapshot')
  elif not noun_lemma:blockers.append('no_exact_lowercase_noun_in_snapshot')
  if w not in freq:blockers.append('absent_exact_headword_from_top50k_forms')
  if not blockers:blockers.append('both_sources_present_check_later_editorial_history')
  pos='verb' if theme=='Pohyb a činnosti' else 'adjective' if theme=='Vlastnosti a vjemy' else 'noun'
  notes=[]
  if w in PLURALIA:notes.append('check_dictionary_headword_plural_or_collective; do_not_force_singular')
  if w in FAMILY:notes.append('proposed_family_relation_not_same_meaning; review_before_cooldown_grouping')
  if w in EXPRESSIVE:notes.append('colloquial_or_expressive_register_needs_explicit_review')
  if pos=='verb':notes.append('verify_infinitive_and_reflexive_usage; no inflected-form import')
  if not lemmas.get(w):notes.append('dictionary_lemma_evidence_still_required')
  allrows.append({'candidate_id':f'L3-W{wave}-{index:04d}','word':w,'length':len(w),'wave':wave,'proposed_theme':theme,'proposed_part_of_speech':pos,
   'editorial_priority':'occasional_specialized_or_cultural' if w in SPECIAL else 'review_for_general_vocabulary',
   'word_origin':'assistant_editorial_proposal_not_dictionary_extraction','direction_approved_by_user':True,'editorial_word_approval':'pending','runtime_approved':False,
   'snapshot_lemma_evidence':[{'lexeme_id':e['lexeme_id'],'lemma':e['lemma'],'part_of_speech':e['part_of_speech'],'snapshot_date':raw_payload['retrieved_at']} for e in lemmas.get(w,[])],
   'frequency2018_exact_form_count':freq.get(w),'in_static_recognition_union':w in static,'wordfreq_fallback_checked':False,
   'existing_import_barriers':blockers,'released_free_occurrences':free[w],'round2_occurrences':round2[w],
   'proposed_related_words':FAMILY.get(w,[]),'review_notes':notes,'external_headword_check':SAMPLES.get(w)})
 for i,r in enumerate(old,1):append(r['word'],r['proposed_theme'],1,i)
 i=0
 for group,words in proposed.items():
  for w in words.split():i+=1;append(w,group,2,i)
 waves={}
 for wave in [1,2]:
  rows=[r for r in allrows if r['wave']==wave]
  waves[str(wave)]={'count':len(rows),'with_snapshot_lemma_evidence':sum(bool(r['snapshot_lemma_evidence']) for r in rows),'with_frequency_exact_form':sum(r['frequency2018_exact_form_count'] is not None for r in rows),'with_either_snapshot_signal':sum(bool(r['snapshot_lemma_evidence']) or r['frequency2018_exact_form_count'] is not None for r in rows),'neither_snapshot_signal':sum(not r['snapshot_lemma_evidence'] and r['frequency2018_exact_form_count'] is None for r in rows),'in_static_recognition':sum(r['in_static_recognition_union'] for r in rows),'by_length':dict(sorted(collections.Counter(r['length'] for r in rows).items())),'by_pos':dict(collections.Counter(r['proposed_part_of_speech'] for r in rows)),'by_theme':dict(collections.Counter(r['proposed_theme'] for r in rows)),'barriers':dict(collections.Counter(b for r in rows for b in r['existing_import_barriers'])),'runtime_approved':0}
 after={p:sha(root/p) for p in inputs}; assert before==after,'Source inputs altered'
 stats={'source_main_sha':source_sha,'archive_sha':'e1b7ba273fb84e1a0160369cffb6cbc7dff60994','comparison':'GitHub compare verified all listed inputs unchanged vs main; not a full current working checkout','as_of':'2026-09-26','target_count':len(lex),'target_origins':dict(collections.Counter(e['origin'] for e in lex)),'target_tiers':dict(collections.Counter(e['tier'] for e in lex)),'static_recognition_count':len(static),'static_text_rows':13940,'static_text_mirrors_identical':(root/'data/words.txt').read_bytes()==(root/'public/valid-words-v3328.txt').read_bytes(),'frequency_source_git_blob':git_blob(root/'data/source_cs_50k.txt'),'frequency_upstream_matched_git_blob':'ef626682b7e1144e0f6e87f7af899daf5327d256','frequency_upstream':'https://github.com/hermitdave/FrequencyWords/blob/master/content/2018/cs/cs_50k.txt','lemma_snapshot_metadata':{k:v for k,v in raw_payload.items() if k!='entries'},'inputs_sha256':before,'input_mutations':0,'candidate_duplicates':0,'candidate_existing_target_collisions':0,'candidate_blocklist_collisions':0,'candidate_words_outside_4_10':0,'waves':waves,'total_candidates':len(allrows),'runtime_approved_candidates':0,'new_candidates_externally_headword_checked':sum(r['external_headword_check'] is not None for r in allrows if r['wave']==2),'limits':['NFC casefold counts spellings, not independent meanings.','No actual player exposure inferred.','Source presence is evidence, not automatic editorial approval.','Absence is absence from frozen finite snapshots, not from Czech language.','No live wordfreq package query or per-word corpus study was performed.','Priority, themes, word classes and family relations are editorial proposals.']}
 out.mkdir(parents=True,exist_ok=True)
 (out/'audit-v2.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2)+'\n')
 for wave,name in [(2,'kandidati-varka-2.json'),(None,'kandidati-vse-1143.json')]:
  (out/name).write_text(json.dumps({'schema_version':1,'status':'editorial_candidates_not_runtime','as_of':'2026-09-26','source_main_sha':source_sha,'candidates':[r for r in allrows if wave is None or r['wave']==wave]},ensure_ascii=False,indent=2)+'\n')
 with (out/'kandidati-vse.csv').open('w',encoding='utf-8-sig',newline='') as f:
  writer=csv.writer(f,delimiter=';');writer.writerow(['ID','Slovo','Várka','Písmen','Téma (návrh)','Slovní druh (návrh)','Priority','Wikidata snapshot','Titulková evidence','Statické uznávání','Vydaná volná hra: výskyty','Příbuzná slova (návrh)','Stav'])
  for r in allrows:writer.writerow([r['candidate_id'],r['word'].upper(),r['wave'],r['length'],r['proposed_theme'],r['proposed_part_of_speech'],r['editorial_priority'],', '.join(e['lexeme_id'] for e in r['snapshot_lemma_evidence']),'ano' if r['frequency2018_exact_form_count'] is not None else 'nenalezeno','ano' if r['in_static_recognition_union'] else 'ne; wordfreq neověřen',r['released_free_occurrences'],', '.join(r['proposed_related_words']),'návrh, nikoli schválení do hry'])
 lines=['# Lexikon v3 — druhá várka kandidátů','',f"{waves['2']['count']} dalších návrhů. S první várkou {len(allrows)} kandidátů. Směr schválen; jednotlivá hesla nejsou automaticky schválena do produkce.",'','Všechna slova níže jsou nová vůči aktuálnímu cílovému lexikonu i první várce, mají 4–10 písmen a neobcházejí současné vyřazovací seznamy. Základní slovníkové ověření není hotové pro všechna hesla. Zdejší členění je redakční návrh, ne finální obtížnost.','']
 for group,words in proposed.items():lines.extend(['## '+group,'',', '.join(w.upper() for w in words.split())+'.',''])
 (out/'kandidati-varka-2.md').write_text('\n'.join(lines))
 print(json.dumps({k:stats[k] for k in ['target_origins','static_recognition_count','waves','total_candidates']},ensure_ascii=False,indent=2))
 return stats,allrows
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('--root',type=Path,required=True);p.add_argument('--previous',type=Path,required=True);p.add_argument('--seeds',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--source-sha',required=True)
 a=p.parse_args();run(a.root,a.previous,a.seeds,a.out,a.source_sha)
