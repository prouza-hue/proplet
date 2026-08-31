#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const appPath = path.join(root, 'public/app.js');
const apiModulePath = path.join(root, 'public/app/core/api-client.js');
const storageModulePath = path.join(root, 'public/app/core/storage.js');
const appSource = fs.readFileSync(appPath, 'utf8');

function has(pattern, label) {
  assert(pattern.test(appSource), `legacy characterization missing: ${label}`);
}

// Characterize the public contract before Sprint 10 changes runtime ownership.
has(/async function api\(path,opts=\{\}\)/, 'global api adapter');
has(/'Content-Type':'application\/json'/, 'default JSON content type');
has(/'X-Proplet-Version':APP_VERSION/, 'version header');
has(/headers\.Authorization=`Bearer \$\{p\.token\}`/, 'Bearer auth header');
has(/headers\['X-Proplet-Anon-ID'\]=getAnonymousId\(\)/, 'anonymous header');
has(/headers\['X-Proplet-Preview-As-Of'\]=CONTENT_PREVIEW_DATE/, 'preview header');
has(/setTimeout\(\(\)=>controller\.abort\(\),12000\)/, '12s timeout');
has(/cache:'no-store'/, 'no-store API cache');
has(/new Error\('Server se neozval včas'\)/, 'timeout message');
has(/new Error\(navigator\.onLine\?'Spojení se serverem selhalo':'Telefon je offline'\)/, 'network/offline messages');
has(/error\.status=r\.status/, 'HTTP status propagation');

has(/function scopedStorageKey\(base,scope=playerScope\(\)\)\{return `\$\{base\}:\$\{scope\}`\}/, 'scope key format');
has(/const marker='proplet-v3-9-scoped-storage'/, 'legacy migration marker');
has(/localStorage\.removeItem\(guestStateKey\);localStorage\.removeItem\(guestQueueKey\)/, 'guest adoption cleanup');

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: key => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => map.set(String(key), String(value)),
    removeItem: key => map.delete(key),
    dump: () => Object.fromEntries(map),
  };
}

async function verifyApiModule() {
  if (!fs.existsSync(apiModulePath)) {
    console.log('PASS: Sprint 10 API baseline characterized (module not installed yet)');
    return;
  }
  const {create} = require(apiModulePath);
  assert.strictEqual(typeof create, 'function');

  let captured = null;
  const client = create({
    fetch: async (url, options) => {
      captured = {url, options};
      return {ok:true, json:async()=>({ok:true})};
    },
    getProfile: () => ({token:'token-1'}),
    getAnonymousId: () => 'anon-1',
    getVersion: () => '4.01.39',
    getPreviewDate: () => '2026-09-01',
    isOnline: () => true,
    timeoutMs: 12000,
  });
  assert.deepStrictEqual(await client('/api/example',{method:'POST',headers:{'X-Custom':'yes'},body:'{}'}),{ok:true});
  assert.strictEqual(captured.url,'/api/example');
  assert.strictEqual(captured.options.method,'POST');
  assert.strictEqual(captured.options.headers['Content-Type'],'application/json');
  assert.strictEqual(captured.options.headers['X-Proplet-Version'],'4.01.39');
  assert.strictEqual(captured.options.headers.Authorization,'Bearer token-1');
  assert.strictEqual(captured.options.headers['X-Proplet-Preview-As-Of'],'2026-09-01');
  assert.strictEqual(captured.options.headers['X-Custom'],'yes');
  assert.strictEqual(captured.options.cache,'no-store');
  assert(captured.options.signal);

  let anonCaptured = null;
  const anonClient = create({
    fetch: async (_url, options) => { anonCaptured=options; return {ok:true,json:async()=>({})}; },
    getProfile: () => null,
    getAnonymousId: () => 'anon-2',
    getVersion: () => '4.01.39',
    getPreviewDate: () => '',
    isOnline: () => true,
  });
  await anonClient('/api/anon');
  assert.strictEqual(anonCaptured.headers['X-Proplet-Anon-ID'],'anon-2');
  assert(!('Authorization' in anonCaptured.headers));
  assert(!('X-Proplet-Preview-As-Of' in anonCaptured.headers));

  const httpClient = create({
    fetch: async () => ({ok:false,status:409,json:async()=>({detail:'Konflikt',requestId:'req:1'})}),
    getProfile:()=>null,getAnonymousId:()=> 'a',getVersion:()=> 'v',getPreviewDate:()=>'',isOnline:()=>true,
  });
  await assert.rejects(httpClient('/api/fail'), error => error.message==='Konflikt · kód req:1' && error.status===409);

  const timeoutClient = create({
    fetch: async (_u,o) => new Promise((_,reject) => o.signal.addEventListener('abort',()=>{const e=new Error('aborted');e.name='AbortError';reject(e);})),
    getProfile:()=>null,getAnonymousId:()=> 'a',getVersion:()=> 'v',getPreviewDate:()=>'',isOnline:()=>true,timeoutMs:5,
  });
  await assert.rejects(timeoutClient('/api/slow'), /Server se neozval včas/);

  const offlineClient = create({
    fetch: async()=>{throw new Error('network')},getProfile:()=>null,getAnonymousId:()=> 'a',
    getVersion:()=> 'v',getPreviewDate:()=>'',isOnline:()=>false,
  });
  await assert.rejects(offlineClient('/api/offline'), /Telefon je offline/);
  console.log('PASS: API client preserves URL/header/auth/timeout/error contracts');
}

function verifyStorageModule() {
  if (!fs.existsSync(storageModulePath)) {
    console.log('PASS: Sprint 10 scoped-storage baseline characterized (module not installed yet)');
    return;
  }
  const {create} = require(storageModulePath);
  assert.strictEqual(typeof create,'function');
  const blank=()=>({completed:{},rescues:{},inProgress:{},dailyDates:[],statsVersion:5});
  const first=(a,b)=>Number(a.elapsedMs||Infinity)<=Number(b.elapsedMs||Infinity)?a:b;
  const storage=memoryStorage({
    'state': JSON.stringify({completed:{old:{elapsedMs:90}}}),
    'queue': JSON.stringify([{attemptId:'legacy'}]),
  });
  let scope='guest';
  const core=create({storage,getScope:()=>scope,blankState:blank,firstResult:first});
  assert.strictEqual(core.scopedKey('state'),'state:guest');
  core.migrateLegacy({marker:'proplet-v3-9-scoped-storage',stateKey:'state',queueKey:'queue'});
  assert(storage.getItem('state:guest'));
  assert(storage.getItem('queue:guest'));
  assert.strictEqual(storage.getItem('proplet-v3-9-scoped-storage'),'1');

  core.writeState('state',{...blank(),completed:{g:{elapsedMs:50}}},'guest');
  core.writeQueue('queue',[{attemptId:'g1',challengeKey:'g'}],'guest');
  scope='player-1';
  core.writeState('state',{...blank(),completed:{p:{elapsedMs:40},g:{elapsedMs:80}},inProgress:{x:{v:1}},rescues:{p:1}},'player-1');
  core.writeQueue('queue',[{attemptId:'p1',challengeKey:'p'}],'player-1');
  core.adoptGuest({profileId:'player-1',stateKey:'state',queueKey:'queue'});
  const state=core.readState('state','player-1');
  assert(state.completed.p && state.completed.g);
  assert.strictEqual(state.completed.g.elapsedMs,50);
  const queue=core.readQueue('queue','player-1');
  assert.deepStrictEqual(queue.map(x=>x.attemptId),['p1','g1']);
  assert.strictEqual(storage.getItem('state:guest'),null);
  assert.strictEqual(storage.getItem('queue:guest'),null);

  storage.setItem('state:player-1','{broken');
  assert.deepStrictEqual(core.readState('state','player-1'),blank());
  storage.setItem('queue:player-1','{broken');
  assert.deepStrictEqual(core.readQueue('queue','player-1'),[]);
  console.log('PASS: scoped storage preserves key, migration, corruption fallback and guest adoption contracts');
}

(async()=>{
  await verifyApiModule();
  verifyStorageModule();
})().catch(error=>{console.error(error);process.exitCode=1;});

const indexSource = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const swSource = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
const apiPos=indexSource.indexOf('/app/core/api-client.js');
const storagePos=indexSource.indexOf('/app/core/storage.js');
const queuePos=indexSource.indexOf('/app/core/result-queue.js');
const appPos=indexSource.indexOf('/app.js');
assert(apiPos>=0 && storagePos>apiPos && queuePos>storagePos && appPos>queuePos, 'core load order changed');
assert(swSource.includes('/app/core/api-client.js') && swSource.includes('/app/core/storage.js'), 'new core assets are not in shell cache');
if (fs.existsSync(apiModulePath)) {
  const moduleSource=fs.readFileSync(apiModulePath,'utf8');
  assert(!/window\.fetch\s*=/.test(moduleSource), 'API module monkey-patches window.fetch');
}
console.log('PASS: Sprint 10 core modules load before legacy app and are cached offline');
