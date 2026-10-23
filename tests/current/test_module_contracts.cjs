'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('public/app.js','utf8'),transport=fs.readFileSync('public/app/client-diagnostics.js','utf8');
const reporter=transport.match(/REPORTER_RELEASE='([^']+)'/)[1];
function hints(){
 const hidden=new Set(),calls=[],g={mode:'free',hints:0},c={currentGame:g,gameHintsController:null,
  window:{PropletGameHints:{create:'broken'}},globalThis:null,
  $:selector=>selector==='#hintModal'?{classList:{add:x=>hidden.add(x)}}:{focus:()=>calls.push('focus')},
  reportClientError:()=>calls.push('reported'),showToast:()=>calls.push('toast'),gameSession:()=>null,supportMode:()=> 'none'};
 c.globalThis=c.window;vm.createContext(c);
 vm.runInContext(app.slice(app.indexOf('function gameHints(){'),app.indexOf('async function api(')),c);
 vm.runInContext(app.slice(app.indexOf('let hintContractReported='),app.indexOf('function pickHintTarget(')),c);
 for(const bad of [null,{}, {closeModal:1}, {create:()=>({pickTarget:1,applyState(){},choices(){}})}]){
  c.window.PropletGameHints=bad;c.closeHintModal();assert(hidden.has('hidden'));assert.equal(c.gameHints(),null);
 }
 assert.equal(g.hints,0,'invalid module cannot charge a hint');assert.equal(c.currentGame,g);
 c.window.PropletGameHints=require('../../public/app/game/hints.js');
 assert.equal(typeof c.gameHints().applyState,'function');
 console.log('PASS callable hint contract and DOM close fallback preserve game/counters');
}
async function diagnostics(){
 const calls=[],c={URL,URLSearchParams,Headers,Request,location:{href:'https://hrajproplet.cz/',origin:'https://hrajproplet.cz',pathname:'/',search:''},APP_PREVIEW_RELEASE:'proplet-v4.09.9-mama1'};
 c.window={fetch:(input,init)=>{calls.push({input,init});return Promise.resolve({ok:true})},navigator:{onLine:true}};
 vm.createContext(c);vm.runInContext(transport,c);
 const headers={'Content-Type':'application/json','Authorization':'Bearer fixture','X-Proplet-Test':'1','X-Proplet-Client-Release':reporter};
 const legacy={code:'window_error',message:'legacy signature',client_release:reporter,reporter_release:'wrong',source_file:'/app.js?code=secret',source_line:1230,source_column:103,stack:'secret private',arbitrary:'secret'};
 await c.window.fetch('/api/client-error',{method:'POST',headers,body:JSON.stringify(legacy)});
 let body=JSON.parse(calls[0].init.body);
 assert.equal(body.client_release,c.APP_PREVIEW_RELEASE);assert.equal(body.reporter_release,reporter);assert.equal(body.source_availability,'available');assert.equal(body.source_frames.length,1);assert.equal(body.source_file,'/app.js');assert.equal(body.is_test,true);
 assert(!/secret|private|arbitrary|stack/.test(calls[0].init.body));assert.equal(calls[0].init.headers.get('Authorization'),'Bearer fixture');
 const request=new Request('https://hrajproplet.cz/api/client-error',{method:'POST',headers,body:JSON.stringify({code:'window_error',message:'Script error.'})});
 await c.window.fetch(request);body=JSON.parse(calls[1].init.body);assert.equal(body.source_availability,'opaque');assert.equal(body.client_release,c.APP_PREVIEW_RELEASE);
 c.APP_PREVIEW_RELEASE=undefined;
 await c.window.fetch('/api/client-error',{method:'POST',headers,body:JSON.stringify(legacy)});body=JSON.parse(calls[2].init.body);
 assert.equal(body.client_release,undefined);assert.equal(body.unknown_producer_reason,'before_app_release');assert.equal(calls[2].init.headers.get('X-Proplet-Client-Release'),null);
 const ordinary={method:'POST',body:'unchanged'};await c.window.fetch('/api/result',ordinary);assert.equal(calls.at(-1).init,ordinary,'other API writes untouched');
 await c.window.fetch('/api/client-error',{method:'POST',body:'not-json'});assert.equal(calls.at(-1).init.body,'not-json');assert.equal(calls.length,5,'one input request means one native fetch');
 await c.window.fetch('/api/client-error',{method:'POST',body:JSON.stringify({code:'client_error',message:'synthetic legacy',is_test:true})});assert.equal(JSON.parse(calls.at(-1).init.body).is_test,true);assert.equal(calls.at(-1).init.headers.get('X-Proplet-Test'),'1','legacy explicit test marker must never be downgraded');
 // Standalone fallback is truthful when the bootstrap diagnostics asset failed.
 const fallbackCalls=[],f={...c,APP_PREVIEW_RELEASE:reporter,APP_VERSION:'99.0.0',navigator:{onLine:true},analyticsHeaders:()=>({}),getProfile:()=>null,getAnonymousId:()=> 'fixture',fetch:(url,init)=>{fallbackCalls.push(init);return Promise.resolve({ok:true})},window:{}};
 vm.createContext(f);vm.runInContext(app.slice(app.indexOf('let reportingClientError=false;'),app.indexOf('let accountUIController=')),f);
 await f.reportClientError('window_error','Script error.',{message:'Script error.'});body=JSON.parse(fallbackCalls[0].body);assert.equal(body.source_availability,'opaque');assert.equal(body.reporter_release,reporter);assert.equal(body.client_version,'4.09.13');
 console.log('PASS legacy string/Request enrichment, producer/reporter split, safe frames, unknown producer, fallback and no duplicate writes');
}
(async()=>{hints();await diagnostics()})().catch(e=>{console.error(e);process.exitCode=1});
