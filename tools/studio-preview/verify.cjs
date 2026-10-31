/* Node-only contracts; browser/gameplay QA is performed separately. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../..'),output=path.resolve(process.argv[2]||path.join(repo,'../studio-preview-public'));
const Daily=require(path.join(repo,'public/app/content/daily-dated.js')),Special=require(path.join(repo,'public/app/content/daily-special.js'));
function storage(){const v=new Map();return {getItem:k=>v.get(k)??null,setItem:(k,x)=>v.set(k,String(x)),removeItem:k=>v.delete(k),clear:()=>v.clear(),key:i=>[...v.keys()][i]??null,get length(){return v.size}}}
function fixture(query=''){
 const calls=[],listeners=[];let state={completed:{},inProgress:{}};
 const raw=new WeakMap();class Storage{constructor(){raw.set(this,new Map())}getItem(k){return raw.get(this).get(k)??null}setItem(k,v){raw.get(this).set(k,String(v))}removeItem(k){raw.get(this).delete(k)}clear(){raw.get(this).clear()}key(i){return [...raw.get(this).keys()][i]??null}get length(){return raw.get(this).size}}
 const local=new Storage(),session=new Storage();local.setItem('untouched-other-data','preserve');
 const context={Storage,console,URL,URLSearchParams,Headers,Response,TextEncoder,crypto:crypto.webcrypto,Date,JSON,Map,Set,WeakSet,DOMException,structuredClone,setTimeout,clearTimeout,
 location:new URL('https://studio.example/'+query),localStorage:local,sessionStorage:session,navigator:{sendBeacon(){throw Error('native beacon')},serviceWorker:{register(){throw Error('native worker')}}},
 document:{addEventListener:(type,fn)=>{(listeners[type]||=[]).push(fn)},documentElement:{hasAttribute:()=>true}},
 fetch:async(input,init)=>{const url=new URL(input,'https://studio.example');calls.push({url:url.href,method:init?.method||'GET',credentials:init?.credentials,authorization:new Headers(init?.headers).get('Authorization')});const file=path.resolve(output,'.'+url.pathname);assert(file.startsWith(output+path.sep));if(!fs.existsSync(file))return new Response('{}',{status:404});return new Response(fs.readFileSync(file),{status:200});},
 getState:()=>state,saveState:value=>{state=value},renderDaily(){},renderFree(){},renderProfile(){},currentLocalStats:()=>({points:Object.values(state.completed).reduce((sum,r)=>sum+r.points,0)})};
 context.window=context;vm.createContext(context);
 for(const file of ['guard.js','adapter.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,file),'utf8'),context);
 return {context,calls,listeners,readState:()=>state,rawStorage:()=>Object.fromEntries(raw.get(local))};
}
(async()=>{
 const report={checks:[],sourceFilesExact:[],network:[],browserGameplayVerified:false};
 const f=fixture(),fetch=(p,body)=>f.context.fetch(p,body?{method:'POST',body:JSON.stringify(body)}:{}).then(r=>r.json());
 const config=await fetch('/api/config');assert.equal(config.environment,'preview');assert.equal(config.archiveEnabled,true);assert.equal(config.pushAvailable,false);
 const dark=fixture('?theme=dark&account=member&state=ready');
 assert.equal(JSON.parse(vm.runInContext("localStorage.getItem('proplet-v3-settings')",dark.context)).theme,'dark');
 assert.equal(JSON.parse(dark.context.localStorage.getItem('proplet-v2-profile')).id,'studio-review');
 assert.equal(dark.context.localStorage.getItem('ax-seeded'),'1');assert.equal(JSON.parse(dark.context.localStorage.getItem('proplet-marketing-consent-v1')).value,'denied');
 assert(dark.context.localStorage instanceof dark.context.Storage);assert.equal(dark.context.localStorage.getItem('untouched-other-data'),null);
 dark.context.localStorage.clear();assert.deepEqual(dark.rawStorage(),{'untouched-other-data':'preserve'});
 report.checks.push('Native Storage identity retained; bare global reads see dark/member seeds; scoped clear preserves unrelated keys');
 const daily=await fetch('/api/daily');assert(daily.reviewOnly);assert(daily.puzzle.meta.reviewSourceId);assert.equal(daily.dailyDate,'2026-10-21');
 await Daily.create({fetchFn:async()=>new Response(JSON.stringify(daily)),dateISO:()=>daily.dailyDate}).refresh();
 const payload=await fetch('/api/daily-special'),special=payload.special;
 const client=Special.create({fetchFn:async()=>new Response(JSON.stringify(payload)),dateISO:()=>special.dailyDate});await client.refresh();assert.equal(client.resultState(special.dailyDate).puzzle.id,special.puzzle.id);
 report.checks.push('Current Daily/Special clients accept model descriptors from public free boards');
 assert.equal((await fetch('/api/play-session/config')).enabled,true);
 const command={action:'open',attempt_id:'fixture-attempt',challenge_key:special.challengeKey,puzzle_id:special.puzzleId,mode:'daily_special',difficulty:'hardcore',progress:{found:[],elapsedMs:0}};
 assert.equal((await fetch('/api/play-session',command)).finished,false);
 const finished=await fetch('/api/play-session',{...command,action:'finish',progress:{found:special.puzzle.answers.map((a,i)=>({...a,answerIndex:i})),elapsedMs:44000}});assert.equal(finished.finished,true);assert.equal(finished.verified,false);
 assert.equal((await fetch('/api/play-session',{...command,action:'open'})).finished,true);
 const missing=fixture('?receipt=missing');assert.equal((await missing.context.fetch('/api/play-session',{method:'POST',body:JSON.stringify({...command,action:'finish'})}).then(r=>r.json())).finished,false);
 report.checks.push('Synthetic session open/finish/reopen and refused finish; competitive time unverified');
 for(const state of ['done','complete']){const x=fixture('?state='+state);await x.context.PropletStudioFixture.seedState();assert.equal(Object.keys(x.readState().completed).length,state==='done'?1:2);await x.context.PropletStudioFixture.seedState();assert.equal(Object.keys(x.readState().completed).length,state==='done'?1:2);}
 const guest=fixture('?account=guest');assert.equal(guest.context.localStorage.getItem('proplet-v2-profile'),null);assert.notEqual(guest.context.PropletStudioFixture.getScenario().scope,f.context.PropletStudioFixture.getScenario().scope);
 const none=fixture('?extra=none');assert.equal((await none.context.fetch('/api/daily-special').then(r=>r.json())).special,null);
 report.checks.push('Once-only done/complete seeds, separate guest/member scopes, no-Extra scenario');
 assert.equal((await f.context.fetch('https://hrajproplet.cz/api/config')).status,403);assert.equal((await f.context.fetch('/unlisted-write',{method:'POST',body:'x'})).status,403);
 assert.equal(f.context.navigator.sendBeacon('/api/result','x'),false);assert.throws(()=>new f.context.WebSocket('wss://example.com'));assert.throws(()=>new f.context.XMLHttpRequest());await assert.rejects(f.context.navigator.serviceWorker.register('/sw.js'));
 assert(f.calls.every(row=>new URL(row.url).origin==='https://studio.example'&&!new URL(row.url).pathname.startsWith('/api/')&&row.method==='GET'));
 assert(f.calls.every(row=>row.credentials==='same-origin'&&row.authorization===null));
 report.checks.push('Same-origin asset requests retain private-host authentication; Proplet Authorization is stripped');
 report.checks.push('All API handled in memory; external fetch/write/XHR/beacon/socket/service worker blocked');
 for(const file of ['app.js','game.css','game-release-polish.css','ribbon-ui.css','app/game/board.js','app/game/input.js','app/game/hints.js','app/game/state.js','app/game/fair-play.js']){assert(fs.readFileSync(path.join(repo,'public',file)).equals(fs.readFileSync(path.join(output,file))),'Gameplay file differs: '+file);report.sourceFilesExact.push(file);}
 const index=fs.readFileSync(path.join(output,'index.html'),'utf8');assert(index.indexOf('/studio-fixtures/guard.js')<index.indexOf('/runtime-meta.js'));assert(index.includes("connect-src 'self'"));assert(index.includes("worker-src 'none'"));
 for(const file of ['data/daily_gen6_private.json','data/daily_specials_private.json'])assert(!fs.existsSync(path.join(output,file)));
 report.checks.push('Generated gameplay bytes equal branch; guard first; restrictive CSP; no private dated banks');
 report.network=f.calls;fs.writeFileSync(path.join(repo,'../studio-preview-contracts.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,network:report.network.map(x=>new URL(x.url).pathname)},null,2));
})().catch(error=>{console.error(error);process.exitCode=1});
