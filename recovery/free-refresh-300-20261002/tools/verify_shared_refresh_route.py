"""Execute the actual isolated controller and native selection functions in Node.

This verifies a static preview concept. It does not migrate production route
records, create accounts, synchronize devices or exercise completion rewards.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / 'content/gen6/free-refresh-300'
DIFFICULTIES = ('easy', 'medium', 'hard')


def read(path):
    return json.loads(path.read_text(encoding='utf8'))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                                    separators=(',', ':')).encode()).hexdigest()


def native_function(source, name):
    """Extract a named native function, preserving its actual implementation."""
    match = re.search(r'(?:async )?function ' + re.escape(name) + r'\([^\n]*?\)\{', source)
    if not match:
        raise ValueError('Native function unavailable: ' + name)
    # Selected functions contain no unbalanced literal braces. Template
    # expressions and object literals have balanced braces in the source.
    depth = 0
    for index in range(source.index('{', match.start()), len(source)):
        if source[index] == '{':
            depth += 1
        elif source[index] == '}':
            depth -= 1
            if depth == 0:
                return source[match.start():index + 1]
    raise ValueError('Unclosed native function: ' + name)


HARNESS = r"""
'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const seed = {window:{}};
vm.runInNewContext(fs.readFileSync(input.fixturesPath, 'utf8'), seed);
const fixtures = seed.window.PROPLET_FREE_REFRESH_FIXTURES;
const source = fs.readFileSync(input.previewPath, 'utf8');
const progressionSource = fs.readFileSync(input.progressionPath, 'utf8');
const diffs = ['easy','medium','hard'];
const stateKey = 'proplet-v2-state:guest';
const results = [];
const failures = [];
function state() {
  return {completed:{},inProgress:{},rescues:{},dailyDates:[],statsVersion:5,
    totalXp:4321,wordDiscoveryXp:77,xpLedger:{sentinel:'preserve-verbatim'}};
}
function storage(map) {
  return {get length(){return map.size},key:index=>[...map.keys()][index]??null,
    getItem:key=>map.get(String(key))??null,
    setItem:(key,value)=>map.set(String(key),String(value)),
    removeItem:key=>map.delete(String(key)),clear:()=>map.clear()};
}
function make(options={}) {
  const map=options.map||new Map([
    ['proplet-v2-state:guest','production-progress-sentinel'],
    ['proplet-v2-profile','production-account-sentinel'],
    ['pestre-v1','production-route-sentinel']]);
  const events=new Map(),started=[];
  let nativeFetchCalls=0,apiCalls=0,saveStateCalls=0,saveProgressCalls=0;
  const hostname=options.hostname||'localhost';
  const ctx={URL,URLSearchParams,Response,Date,Map,Set,Promise,console,
    location:{hostname,origin:'http://'+hostname,href:'http://'+hostname+'/',search:''},
    navigator:{onLine:options.online!==false,sendBeacon:()=>true},
    document:{addEventListener:(name,handler)=>events.set(name,handler)},
    localStorage:storage(map),sessionStorage:storage(new Map()),
    fetch:async()=>{nativeFetchCalls++;throw new Error('Native network forbidden')},
    PROPLET_FREE_REFRESH_FIXTURES:options.fixtures||fixtures,
    getState:()=>JSON.parse(ctx.localStorage.getItem(stateKey)),
    saveState:value=>{saveStateCalls++;ctx.localStorage.setItem(stateKey,JSON.stringify(value))},
    getProfile:()=>null,
    api:async()=>{apiCalls++;throw new Error('Backend API forbidden')},
    allowAccountGameStart:()=>true,
    showToast:()=>{},
    startGame:(puzzle,mode,date)=>started.push({id:puzzle.id,mode,date}),
    saveGameProgress:()=>{saveProgressCalls++}
  };
  ctx.window=ctx;
  vm.createContext(ctx);
  vm.runInContext(source,ctx,{filename:input.previewPath});
  if(options.state)ctx.localStorage.setItem(stateKey,JSON.stringify(options.state));
  ctx.puzzleDB=ctx.PROPLET_FREE_REFRESH_FIXTURES.puzzles;
  ctx.DIFF=Object.fromEntries(Object.keys(ctx.puzzleDB.free).map(diff=>[diff,{}]));
  vm.runInContext(progressionSource,ctx,{filename:input.progressionPath});
  vm.runInContext(input.nativeFunctions,ctx,{filename:'actual-native-selection-functions.js'});
  ctx.freeOrder=()=>ctx.PROPLET_FREE_REFRESH_PREVIEW.controller;
  ctx.progression=()=>ctx.PropletContentProgression.create({
    getPuzzleDB:()=>ctx.puzzleDB,getState:ctx.getState,
    sortedFreeBank:ctx.sortedFreeBank,localFreeSlotState:ctx.localFreeSlotState,
    resumableFreePuzzle:ctx.resumableFreePuzzle});
  return {ctx,map,started,events,
    read:()=>JSON.parse(ctx.localStorage.getItem(stateKey)),
    replace:value=>ctx.localStorage.setItem(stateKey,JSON.stringify(value)),
    calls:()=>({nativeFetchCalls,apiCalls,saveStateCalls,saveProgressCalls})};
}
function complete(s,p) {
  s.completed['free:'+p.id]={puzzleId:p.id,mode:'free',difficulty:p.difficulty,
    level:p.meta.level,contentGeneration:p.meta.contentGeneration||fixtures.puzzles.freeGeneration,
    points:100,completedAt:'2026-10-02T00:00:00.000Z',attemptId:'existing-attempt'};
}
function fresh(diff){return fixtures.refreshBoards.filter(p=>p.difficulty===diff)}
function old(diff){return fixtures.puzzles.free[diff].filter(p=>!p.id.startsWith('g6-refresh-'))
  .sort((a,b)=>Number(a.meta.level)-Number(b.meta.level))}
function snapshot(h){return JSON.stringify(h.read())}
function unchanged(h,before) {
  assert.equal(snapshot(h),before,'Selection must preserve progress and XP byte-for-byte');
  assert.equal(h.map.get('proplet-v2-state:guest'),'production-progress-sentinel');
  assert.equal(h.map.get('proplet-v2-profile'),'production-account-sentinel');
  assert.equal(h.map.get('pestre-v1'),'production-route-sentinel');
  assert.equal(h.calls().nativeFetchCalls,0);
  assert.equal(h.calls().apiCalls,0);
  assert.equal(h.calls().saveStateCalls,0);
}
async function scenario(name,run) {
  try {const evidence=await run();results.push({name,passed:true,...evidence})}
  catch(error){failures.push({name,error:error.message});results.push({name,passed:false,error:error.message})}
}

(async()=>{
await scenario('new-player-common-first-board',async()=>{
  const h=make({state:state()}),before=snapshot(h),ids={};
  for(const diff of diffs){await h.ctx.startFree(diff);ids[diff]=h.started.at(-1).id;
    assert.equal(ids[diff],fixtures.routes[diff][0]);}
  unchanged(h,before);return {selectedIds:ids};
});
await scenario('veteran-resumes-original-board-before-refresh',async()=>{
  const s=state(),ids={};
  for(const diff of diffs){const p=old(diff)[9];ids[diff]=p.id;
    s.inProgress['free:'+p.id]={puzzleId:p.id,mode:'free',difficulty:diff,
      savedAt:123,elapsedMs:45678,found:[{answerIndex:0}],routeVersion:'pestre-v1',wordDiscoveryXpAwarded:19};
    const stale=old(diff)[11];complete(s,stale);
    s.inProgress['free:'+stale.id]={puzzleId:stale.id,mode:'free',difficulty:diff,savedAt:999};}
  const h=make({state:s}),before=snapshot(h);
  for(const diff of diffs){await h.ctx.startFree(diff);assert.equal(h.started.at(-1).id,ids[diff]);}
  unchanged(h,before);return {selectedIds:ids,savedOriginalVersion:'pestre-v1'};
});
await scenario('veteran-completion-preserved-and-fresh-gaps-skipped',async()=>{
  const s=state();for(const diff of diffs){old(diff).forEach(p=>complete(s,p));
    complete(s,fresh(diff)[0]);complete(s,fresh(diff)[2]);}
  const h=make({state:s}),before=snapshot(h),ids={};
  for(const diff of diffs){await h.ctx.startFree(diff);ids[diff]=h.started.at(-1).id;
    assert.equal(ids[diff],fresh(diff)[1].id);}
  unchanged(h,before);return {selectedIds:ids,originalCompletions:900};
});
await scenario('all-fresh-complete-continues-unfinished-originals',async()=>{
  const s=state();for(const diff of diffs){fresh(diff).forEach(p=>complete(s,p));complete(s,old(diff)[0]);}
  const h=make({state:s}),before=snapshot(h),ids={};
  for(const diff of diffs){await h.ctx.startFree(diff);ids[diff]=h.started.at(-1).id;
    assert.equal(ids[diff],old(diff)[1].id);}
  unchanged(h,before);return {selectedIds:ids};
});
await scenario('entire-catalogue-complete-retains-native-replay',async()=>{
  const s=state();for(const diff of diffs)fixtures.puzzles.free[diff].forEach(p=>complete(s,p));
  const h=make({state:s}),before=snapshot(h),ids={};
  for(const diff of diffs){assert.equal(h.ctx.freeOrder().next(diff,null),null);
    await h.ctx.startFree(diff);ids[diff]=h.started.at(-1).id;assert.equal(ids[diff],old(diff)[0].id);}
  unchanged(h,before);return {selectedIds:ids,routeExhausted:true,nativeReplay:true};
});
await scenario('numeric-mode-retains-native-numbered-catalogue',async()=>{
  const h=make({state:state()}),before=snapshot(h),ids={};
  for(const diff of diffs){await h.ctx.freeOrder().change(diff,'numeric');
    await h.ctx.startFree(diff);ids[diff]=h.started.at(-1).id;assert.equal(ids[diff],old(diff)[0].id);
    assert.equal(h.ctx.freeOrder().record(diff).mode,'numeric');
    await h.ctx.freeOrder().change(diff,'varied');await h.ctx.startFree(diff);
    assert.equal(h.started.at(-1).id,fresh(diff)[0].id);}
  unchanged(h,before);return {numericSelectedIds:ids,originalNumbersPreserved:true};
});
await scenario('all-300-catalogue-entries-open-by-original-id',async()=>{
  const h=make({state:state()}),before=snapshot(h);
  for(const p of fixtures.refreshBoards){assert.equal(h.ctx.PROPLET_FREE_REFRESH_PREVIEW.openBoard(p.id),true);
    assert.deepEqual(h.started.at(-1),{id:p.id,mode:'free',date:null});}
  assert.equal(h.ctx.PROPLET_FREE_REFRESH_PREVIEW.openBoard('unknown-board'),false);
  assert.equal(h.started.length,300);unchanged(h,before);
  return {openedById:300,rewardCompletionExecuted:false};
});
await scenario('same-version-reload-preserves-only-preview-choice',async()=>{
  const first=make({state:state()});await first.ctx.freeOrder().change('easy','numeric');
  const s=first.read();complete(s,fresh('easy')[0]);first.replace(s);
  const second=make({map:first.map}),before=snapshot(second);
  assert.equal(second.ctx.freeOrder().record('easy').mode,'numeric');
  assert.equal(second.read().completed['free:'+fresh('easy')[0].id].points,100);
  await second.ctx.startFree('easy');assert.equal(second.started.at(-1).id,old('easy')[0].id);
  unchanged(second,before);return {sameBankNamespace:true};
});
await scenario('new-bank-namespace-does-not-touch-prior-preview-or-production',async()=>{
  const first=make({state:state()});await first.ctx.freeOrder().change('easy','numeric');
  const prior=first.map.get(first.ctx.PROPLET_FREE_REFRESH_PREVIEW.storagePrefix+stateKey);
  const changed={...fixtures,build:{...fixtures.build,
    bankSha256:'test-new-bank-namespace-000000',bankContentHash:'test-new-bank-namespace-000000'}};
  const second=make({map:first.map,fixtures:changed});
  assert.notEqual(second.ctx.PROPLET_FREE_REFRESH_PREVIEW.storagePrefix,first.ctx.PROPLET_FREE_REFRESH_PREVIEW.storagePrefix);
  assert.equal(second.ctx.freeOrder().record('easy').mode,'varied');
  assert.equal(first.map.get(first.ctx.PROPLET_FREE_REFRESH_PREVIEW.storagePrefix+stateKey),prior);
  const before=snapshot(second);await second.ctx.startFree('easy');unchanged(second,before);
  return {priorPreviewStatePreserved:true,productionStatePreserved:true};
});
await scenario('offline-saved-board-keeps-id-version-then-uses-current-route',async()=>{
  const s=state(),p=old('easy')[29];
  s.inProgress['free:'+p.id]={puzzleId:p.id,mode:'free',difficulty:'easy',savedAt:1,
    routeVersion:'pestre-v1',elapsedMs:20000,found:[{answerIndex:1}]};
  const changed={...fixtures,build:{...fixtures.build,routeVersion:'test-next-reviewed-route'},
    routes:{...fixtures.routes,easy:[fixtures.routes.easy[1],fixtures.routes.easy[0],...fixtures.routes.easy.slice(2)]}};
  const h=make({state:s,online:false,fixtures:changed}),before=snapshot(h);
  await h.ctx.startFree('easy');assert.equal(h.started.at(-1).id,p.id);unchanged(h,before);
  assert.equal(h.ctx.freeOrder().record('easy').plan.version,'test-next-reviewed-route');
  const after=h.read();complete(after,p);delete after.inProgress['free:'+p.id];h.replace(after);
  const finalBefore=snapshot(h);await h.ctx.startFree('easy');
  assert.equal(h.started.at(-1).id,fixtures.routes.easy[1]);unchanged(h,finalBefore);
  return {resumedId:p.id,savedVersion:'pestre-v1',currentPlanVersion:'test-next-reviewed-route',productionMigration:false};
});
await scenario('separate-devices-use-same-board-id-and-converge-on-same-history',async()=>{
  const s=state();complete(s,fresh('medium')[0]);
  const a=make({state:s}),b=make({state:s}),beforeA=snapshot(a),beforeB=snapshot(b);
  await a.ctx.startFree('medium');await b.ctx.startFree('medium');
  assert.equal(a.started.at(-1).id,b.started.at(-1).id);
  assert.equal(a.started.at(-1).id,fresh('medium')[1].id);
  unchanged(a,beforeA);unchanged(b,beforeB);
  const advanced=b.read();complete(advanced,fresh('medium')[1]);b.replace(advanced);
  await b.ctx.startFree('medium');assert.equal(b.started.at(-1).id,fresh('medium')[2].id);
  a.replace(advanced);await a.ctx.startFree('medium');assert.equal(a.started.at(-1).id,b.started.at(-1).id);
  return {sameHistorySameId:true,simulatedHistoryConvergence:true,realDeviceSynchronization:false};
});
await scenario('all-routes-pin-immutable-version-and-known-ids',async()=>{
  const h=make({state:state()}),before=snapshot(h);
  for(const diff of diffs){const record=h.ctx.freeOrder().record(diff);
    assert.equal(record.plan.version,fixtures.build.routeVersion);
    assert.deepEqual([...record.plan.ids],fixtures.routes[diff]);
    assert.equal(new Set(record.plan.ids).size,400);
    assert.ok(record.plan.ids.every(id=>fixtures.puzzles.free[diff].some(p=>p.id===id)));}
  await h.ctx.freeOrder().configure();await h.ctx.freeOrder().sync();
  await h.ctx.freeOrder().newAccount();h.ctx.freeOrder().adopt();unchanged(h,before);
  return {routeVersion:fixtures.build.routeVersion,idsPerDifficulty:400,serverCasExecuted:false};
});
await scenario('offline-fixtures-and-write-transports-are-isolated',async()=>{
  const h=make({state:state(),online:false}),before=snapshot(h);
  const data=await (await h.ctx.fetch('/puzzles.json')).json();
  assert.equal(data.free.easy.length,400);
  assert.equal((await h.ctx.fetch('/api/free-order/config')).status,200);
  for(const path of ['/api/free-order/activate','/api/free-order/change','/api/complete','/api/attempt/start'])
    assert.equal((await h.ctx.fetch(path,{method:'POST',body:'{}'})).status,409);
  assert.equal((await h.ctx.fetch('/api/free-order')).status,404);
  assert.equal((await h.ctx.fetch('https://hrajproplet.cz/api/config')).status,403);
  assert.equal(h.ctx.navigator.sendBeacon('/api/complete','{}'),false);
  const recognized=await (await h.ctx.fetch('/api/word-recognition?word='+encodeURIComponent(fixtures.recognitionWords[0]))).json();
  assert.equal(recognized.recognized,true);unchanged(h,before);
  return {nativeNetworkCalls:0,productionApiCalls:0,writeRequestsBlocked:true,recognitionWords:fixtures.recognitionWords.length};
});
await scenario('production-hosts-refuse-controller-before-any-write',async()=>{
  for(const hostname of ['hrajproplet.cz','www.hrajproplet.cz','proplet-nine.vercel.app',
    'proplet-pavel-prouzas-projects.vercel.app','proplet-git-main-pavel-prouzas-projects.vercel.app']) {
    const map=new Map([['proplet-v2-state:guest','production-progress-sentinel']]);
    assert.throws(()=>make({hostname,map}),/cannot run on production/);
    assert.deepEqual([...map],[['proplet-v2-state:guest','production-progress-sentinel']]);
  }
  return {productionHostsBlocked:5};
});
process.stdout.write(JSON.stringify({allPassed:failures.length===0,scenarioCount:results.length,results,failures}));
})().catch(error=>{process.stderr.write(error.stack);process.exitCode=1});
"""


def verify(dist, output, node):
    bank_path = CONTENT / 'bank.json'
    manifest_path = CONTENT / 'shared-route-manifest.json'
    bank, manifest = read(bank_path), read(manifest_path)
    fixture_path = dist / 'free-refresh-fixtures.js'
    text = fixture_path.read_text(encoding='utf8')
    prefix = 'window.PROPLET_FREE_REFRESH_FIXTURES='
    if not text.startswith(prefix) or not text.rstrip().endswith(';'):
        raise ValueError('Unexpected static fixture serialization')
    fixtures = json.loads(text[len(prefix):].rstrip()[:-1])
    source_puzzles = read(ROOT / 'public/puzzles.json')
    assert bank['contentHash'] == manifest['bankContentHash'] == fixtures['build']['bankContentHash'], 'Stale bank binding'
    assert fixtures['build']['routeVersion'] == manifest['version'], 'Stale route version'
    assert digest(fixtures['refreshBoards']) == digest(bank['boards']), 'Preview board metadata differs from final bank'
    assert digest(fixtures['routes']) == fixtures['build']['routesHash'], 'Route hash mismatch'
    for diff in DIFFICULTIES:
        old = sorted(source_puzzles['free'][diff], key=lambda p: int(p['meta']['level']))
        expected = list(manifest['routes'][diff])
        expected += [p['id'] for p in old if p['id'] not in set(expected)]
        assert expected == fixtures['routes'][diff], 'Unexpected route extension: ' + diff
        assert len(expected) == len(set(expected)) == 400, 'Incomplete/duplicate route: ' + diff
        existing = {p['id']: p for p in fixtures['puzzles']['free'][diff]}
        assert all(existing[p['id']] == p for p in old), 'Original catalogue changed: ' + diff
        assert set(expected[:100]) == {p['id'] for p in bank['boards'] if p['difficulty'] == diff}, 'Missing new board'
    assert len(fixtures['recognitionWords']) == 103836, 'Frozen broad recognition dictionary changed'
    dictionary_path = CONTENT / 'recognition-words.txt'
    frozen_words = sorted({w.strip().upper() for w in dictionary_path.read_text(encoding='utf8').splitlines() if w.strip()})
    assert fixtures['recognitionWords'] == frozen_words, 'Preview recognition differs from the exact frozen dictionary'
    html = (dist / 'index.html').read_text(encoding='utf8')
    assert "connect-src 'none'" in html and "form-action 'none'" in html, 'Static transport boundary missing'
    assert not (dist / 'sw.js').exists() and not (dist / 'manifest.webmanifest').exists(), 'Preview PWA boundary missing'
    preview_path = ROOT / 'public/app/free-refresh-preview.js'
    progression_path = ROOT / 'public/app/content/progression.js'
    app_path = ROOT / 'public/app.js'
    assert (dist / 'app/free-refresh-preview.js').read_bytes() == preview_path.read_bytes(), 'Stale exported preview controller'
    assert (dist / 'app.js').read_bytes() == app_path.read_bytes(), 'Stale exported native app'
    assert (dist / 'app/content/progression.js').read_bytes() == progression_path.read_bytes(), 'Stale exported native progression'
    app = app_path.read_text(encoding='utf8')
    functions = '\n'.join(native_function(app, name) for name in (
        'sortedFreeBank', 'freePuzzleSlot', 'localFreeSlotState', 'resumableFreePuzzle', 'freeProgress', 'startFree'))
    payload = {'fixturesPath': str(fixture_path), 'previewPath': str(preview_path),
               'progressionPath': str(progression_path), 'nativeFunctions': functions}
    with tempfile.TemporaryDirectory(prefix='shared-route-check-', dir=ROOT) as temporary:
        directory = Path(temporary)
        harness_path, input_path = directory / 'harness.cjs', directory / 'input.json'
        harness_path.write_text(HARNESS, encoding='utf8')
        input_path.write_text(json.dumps(payload, ensure_ascii=False), encoding='utf8')
        result = subprocess.run([node, str(harness_path), str(input_path)], check=True,
                                capture_output=True, text=True, encoding='utf8', timeout=45)
    scenarios = json.loads(result.stdout)
    report = {
        'schemaVersion': 1, 'kind': 'shared-refresh-route-static-concept-verification',
        'asOf': manifest['asOf'], 'scope': 'Actual preview controller plus extracted native selection functions in Node VM',
        'contentSourceMain': manifest['sourceProductionAtManufacture'], 'currentUiMain': manifest['currentUiMain'],
        'bankContentHash': bank['contentHash'], 'bankFileSha256': sha(bank_path),
        'routeVersion': manifest['version'], 'routeManifestSha256': sha(manifest_path),
        'exportedRoutesHash': fixtures['build']['routesHash'],
        'fixtureFileSha256': sha(fixture_path), 'recognitionPlaintextSha256': sha(dictionary_path),
        'previewControllerSha256': sha(preview_path),
        'nativeAppSha256': sha(app_path), 'nativeProgressionSha256': sha(progression_path),
        'verifierSha256': sha(Path(__file__)), 'staticBoundaryVerified': True,
        'productionWrites': False, 'serverCasExecuted': False,
        'limitations': [
            'No production migration, server CAS, account synchronization or cross-device transport is implemented or exercised.',
            'Separate devices are independent VM contexts; convergence uses explicitly supplied identical completion history.',
            'No completion reward path is executed; route selection, catalogue opening and choice changes preserve existing progress/XP.',
            'DOM rendering, onboarding visuals and actual board solving are verified separately in browser/content audits.'
        ], **scenarios}
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    print(json.dumps({'allPassed': report['allPassed'], 'scenarios': report['scenarioCount'],
                      'bankContentHash': report['bankContentHash'], 'failures': report['failures'],
                      'report': str(output)}, ensure_ascii=False))
    return report['allPassed']


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dist', type=Path, default=ROOT / 'dist-free-refresh-preview')
    parser.add_argument('--output', type=Path, default=CONTENT / 'shared-route-verification.json')
    parser.add_argument('--node', default=os.environ.get('CODEX_PRIMARY_RUNTIME_NODE') or shutil.which('node'))
    args = parser.parse_args()
    if not args.node:
        parser.error('Node runtime is required')
    raise SystemExit(0 if verify(args.dist, args.output, args.node) else 1)
