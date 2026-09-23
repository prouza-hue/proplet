const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/app.js','utf8');
function element(){return {hidden:false,inert:false,textContent:'',children:[],attrs:{},classList:{values:new Set(),contains(x){return this.values.has(x)},toggle(x,on){on?this.values.add(x):this.values.delete(x)}},getAttribute(k){return this.attrs[k]},setAttribute(k,v){this.attrs[k]=v},appendChild(e){this.children.push(e)},querySelector(){return this.notice||null},prepend(e){this.notice=e}}}
const elements=new Map(),states={};let profile=null,reads=[],merges=[],retryTimer=null;
const context={freeOrder:()=>({sync:async()=>{}}),console,Date,Number,Array,Promise,queueMicrotask,setTimeout:fn=>{retryTimer=fn;return 1},navigator:{onLine:true},
 getProfile:()=>profile,getState:id=>states[id]||{completed:{}},saveState:(s,id)=>states[id]=s,
 accountProfileMatches:p=>!!p?.id&&p.id===profile?.id&&p.token===profile?.token,
 $:selector=>{if(!elements.has(selector))elements.set(selector,element());return elements.get(selector)},
 document:{body:element(),createElement:element,dispatchEvent(){}},CustomEvent:function(){},
 showToast(){},validSupportMode:()=>true,rememberSupportMode(){},renderDaily(){context.renderAccountProgressStatus()},renderFree(){},renderProfile(){},
 updateAccountProfile:patch=>profile={...profile,...patch},
 mergeRemoteProgress:(rows,id)=>{merges.push(id);states[id]={completed:Object.fromEntries(rows.map(r=>[r.challengeKey,r]))}},
 api:(url)=>new Promise((resolve,reject)=>reads.push({url,resolve,reject}))
};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('let accountProgressRequest='),source.indexOf('function accountSession(){')),context);
vm.runInContext(source.slice(source.indexOf('async function refreshRemoteProfile('),source.indexOf('function renderPrivacyActions(){')),context);
const set=code=>vm.runInContext(code,context);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 assert(context.accountProgressAvailable(),'guest does not wait');
 profile={id:'a',token:'a-token'};
 assert(!context.accountProgressAvailable(),'new account cannot assume empty history');
 states.a={completed:{},remoteProgressLoadedAt:'invalid'};
 assert(!context.accountProgressAvailable(),'invalid cache is not accepted');
 states.a={completed:{saved:{challengeKey:'saved'}},remoteProgressLoadedAt:'2026-09-14T12:00:00Z'};
 assert(context.accountProgressAvailable(),'verified history displays immediately online');
 context.renderAccountProgressStatus();
 assert(!context.document.body.classList.contains('account-progress-pending'));
 assert.equal(elements.get('#quickPlayCard').inert,false);
 for(const screen of ['daily','free']){
  assert.equal(elements.get(`#screen-${screen}`).notice.hidden,true,'cached startup is silent');
  assert.equal(elements.get(`#screen-${screen}`).notice.textContent,'');
 }
 assert(elements.get('#screen-daily').notice.classList.contains('is-background'));
 const first=context.refreshRemoteProfile(),duplicate=context.refreshRemoteProfile();
 assert.equal(reads.length,2,'one me/progress pair despite concurrent callers');
 for(const screen of ['daily','free'])assert.equal(elements.get(`#screen-${screen}`).notice.hidden,true,'pending background refresh stays silent');
 assert(context.allowAccountGameStart(),'known account remains playable during refresh');
 reads[0].resolve({name:'A',stats:{points:100}});reads[1].resolve({completed:[{challengeKey:'new'}]});
 await Promise.all([first,duplicate]);
 assert(states.a.completed.new,'fresh history merged');
 assert.equal(elements.get('#screen-daily').notice.hidden,true,'background status disappears');
 set('accountProgressReady=null');reads=[];retryTimer=null;
 const transient=context.refreshRemoteProfile();reads[0].reject(new Error('offline'));reads[1].reject(new Error('offline'));await tick();
 assert.equal(set('accountProgressError'),false,'first transient failure stays silent');
 assert.equal(elements.get('#screen-daily').notice.hidden,true,'cached player sees no warning before automatic retry');
 assert.equal(reads.length,2);assert(retryTimer,'one retry is scheduled');
 retryTimer();await tick();assert.equal(reads.length,4,'automatic retry issues one fresh me/progress pair');
 reads[2].resolve({name:'A',stats:{points:100}});reads[3].resolve({completed:[{challengeKey:'after-retry'}]});await transient;
 assert(states.a.completed['after-retry'],'automatic retry can recover without user action');
 assert.equal(elements.get('#screen-daily').notice.hidden,true,'successful automatic retry stays silent');

 set('accountProgressReady=null');reads=[];retryTimer=null;
 const failed=context.refreshRemoteProfile();reads[0].reject(new Error('offline'));reads[1].reject(new Error('offline'));await tick();
 assert.equal(set('accountProgressError'),false,'persistent failure is still hidden until retry');
 retryTimer();await tick();reads[2].reject(new Error('offline'));reads[3].reject(new Error('offline'));await failed;
 assert(context.allowAccountGameStart(),'cached player continues after network failure');
 assert.equal(elements.get('#screen-daily').notice.hidden,false,'a second failed refresh explains how to retry');
 assert(elements.get('#screen-daily').notice.children.length,'retry is available');
 context.navigator.onLine=false;assert(context.accountProgressAvailable(),'offline cache still works');context.navigator.onLine=true;
 profile={id:'b',token:'b-token'};set('accountProgressReady=null;accountProgressError=false');
 context.renderAccountProgressStatus();assert(!context.accountProgressAvailable(),'other account cannot inherit cache');
 assert(elements.get('#quickPlayCard').inert,'unknown account guarded');
 assert.equal(elements.get('#screen-daily').notice.hidden,false,'first account load still explains why play is blocked');
 reads=[];const stale=context.refreshRemoteProfile();
 profile={id:'c',token:'c-token'};
 reads[0].resolve({stats:{}});reads[1].resolve({completed:[{challengeKey:'wrong'}]});await stale;
 assert(!states.b,'late response cannot write history for a switched account');
 assert(!context.accountProgressAvailable());
 reads=[];const empty=context.refreshRemoteProfile();reads[0].resolve({stats:{points:0}});reads[1].resolve({completed:[]});await empty;
 assert(context.accountProgressAvailable(),'verified empty history is valid');
 set('accountProgressReady=null');assert(context.accountProgressAvailable(),'empty verified history survives reload too');
 // Expired sessions must offer sign-in, never endless retries or data deletion.
 let loginMode='';context.openProfileModal=mode=>{loginMode=mode};
 profile={id:'expired',token:'old'};set('accountProgressReady=null');reads=[];retryTimer=null;
 const unauthorized=context.refreshRemoteProfile();
 reads[0].reject(Object.assign(new Error('Unauthorized'),{status:401}));reads[1].reject(Object.assign(new Error('Unauthorized'),{status:401}));await unauthorized;
 assert.equal(reads.length,2,'401 is not retried');assert.equal(retryTimer,null,'401 schedules no retry');
 assert(!context.accountProgressAvailable());
 const notice=elements.get('#screen-free').notice;
 assert(notice.textContent.includes('přihlas znovu'));
 notice.children.at(-1).onclick();assert.equal(loginMode,'login');
 assert.equal(profile.token,'old','do not clear identity or migrate its local data to guest');
 reads=[];profile={id:'expired',token:'new'};
 const recovered=context.refreshRemoteProfile();reads[0].resolve({stats:{}});reads[1].resolve({completed:[{challengeKey:'restored'}]});await recovered;
 assert(context.accountProgressAvailable());assert(states.expired.completed.restored);assert(notice.hidden);
 console.log('PASS account progress: cached startup, one silent transient retry, persistent failure, no 401 retry, deduplication, empty history and account isolation');
})().catch(e=>{console.error(e);process.exitCode=1});
