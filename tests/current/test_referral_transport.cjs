'use strict';
// Read-only API mocks: no account, invitation or reward writes occur in this test.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../../public/referral-transport.js'),'utf8');
const storage=()=>{const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)}};
function fixture({identity=null,search=''}={}){
 let account=identity?{id:identity}:null,now=1000000;const calls=[],events=new Map(),toasts=[];
 const context={URLSearchParams,Date:{now:()=>now},location:{search},localStorage:storage(),sessionStorage:storage(),getProfile:()=>account,
  document:{addEventListener:(name,fn)=>events.set(name,fn)},showToast:value=>toasts.push(value),
  api:(url,options)=>{assert.equal(options,undefined,'Load must never create an invitation');let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});calls.push({url,resolve,reject});return promise;}};
 context.window=context;vm.runInNewContext(source,context);
 return {transport:context.PropletReferrals,calls,toasts,session:context.sessionStorage,tick:ms=>{now+=ms},account:(id,notify=true)=>{account=id?{id}:null;if(notify)events.get('proplet:account-changed')?.()}};
}
const data=name=>({enabled:true,incoming:{id:'incoming-'+name,inviter:{name},completedBoards:5,paid:true,rewardDismissed:true},invite:{url:'https://example.invalid/'+name},referrals:[{name:name+' friend',completedBoards:2}]});
const snapshot=model=>JSON.parse(JSON.stringify(model));
const privateEmpty=model=>{assert.equal(model.incoming,false);assert.equal(model.inviteUrl,'');assert.equal(model.inviterName,'');assert.equal(model.count,0);assert.equal(model.referrals.length,0);assert.equal(model.paid,false);assert.equal(model.accepted,false)};

(async()=>{
 const guest=fixture();assert.equal(guest.transport.model.availability,'idle');
 await guest.transport.load();await guest.transport.load(true);assert.equal(guest.transport.model.availability,'guest');assert.equal(guest.calls.length,0);privateEmpty(guest.transport.model);

 const f=fixture({identity:'A'}),t=f.transport;
 const initial=t.load();assert.equal(t.model.availability,'loading');assert.equal(t.model.ready,false);
 const dedup=t.load(true);assert.equal(f.calls.length,1);f.calls[0].reject(new Error('network unavailable'));await Promise.all([initial,dedup]);
 assert.equal(t.model.availability,'error');assert.equal(t.model.ready,false);privateEmpty(t.model);
 const retry=t.load();assert.equal(f.calls.length,2);f.calls[1].resolve({enabled:false});await retry;
 assert.equal(t.model.availability,'disabled');assert.equal(t.model.ready,false);privateEmpty(t.model);
 await t.load();assert.equal(f.calls.length,2,'Disabled successful response respects normal cache');
 const enabled=t.load(true);f.calls[2].resolve(data('A'));await enabled;assert.equal(t.model.availability,'ready');assert.equal(t.model.ready,true);assert.equal(t.model.referrals[0].count,2);
 const confirmed=snapshot(t.model),outage=t.load(true);f.calls[3].reject(Object.assign(new Error('server unavailable'),{status:503}));await outage;
 assert.deepEqual(snapshot(t.model),{...confirmed,availability:'error'},'Same-owner outage must retain confirmed progress and invite history');
 const recovered=t.load();assert.equal(f.calls.length,5);f.calls[4].resolve(data('A'));await recovered;
 await t.load();assert.equal(f.calls.length,5);f.tick(30001);const expired=t.load();assert.equal(f.calls.length,6);f.calls[5].resolve({enabled:false});await expired;privateEmpty(t.model);
 assert.equal(t.model.availability,'disabled');
 f.account('B');assert.equal(t.model.availability,'idle');privateEmpty(t.model);const b=t.load();f.calls[6].resolve(data('B'));await b;
 f.account(null);assert.equal(t.model.availability,'idle');privateEmpty(t.model);await t.load();assert.equal(t.model.availability,'guest');assert.equal(f.calls.length,7);

 // A -> B -> A must not let the first A response or its finally replace the newest request.
 const race=fixture({identity:'A'}),r=race.transport,oldA=r.load();
 race.account('B');const pendingB=r.load();race.account('A');const newA=r.load();assert.equal(race.calls.length,3);
 race.calls[0].resolve(data('stale-A'));await oldA;assert.equal(r.model.availability,'loading');privateEmpty(r.model);
 const stillDedup=r.load(true);assert.equal(race.calls.length,3,'Stale finally must not clear new owner flight');
 race.calls[1].reject(new Error('stale B failure'));await pendingB;assert.equal(r.model.availability,'loading');
 race.calls[2].resolve(data('new-A'));await Promise.all([newA,stillDedup]);assert.equal(r.model.inviterName,'new-A');assert.equal(r.model.availability,'ready');

 const landing=fixture({search:'?invite=VALIDCODE123'}),first=landing.transport.load();
 assert.equal(landing.calls[0].url,'/api/referrals/invite/VALIDCODE123');landing.calls[0].resolve({enabled:true,inviter:{name:'Inviter'}});await first;
 assert.equal(landing.transport.model.availability,'ready');assert.equal(landing.transport.model.accepted,false);
 const invalid=landing.transport.load(true);landing.calls[1].reject(Object.assign(new Error('expired'),{status:404}));await invalid;
 assert.equal(landing.transport.model.availability,'error');assert.equal(landing.transport.model.ready,false);privateEmpty(landing.transport.model);assert.equal(landing.transport.pendingCode(),null);assert.equal(landing.toasts.length,1);
 await landing.transport.load();assert.equal(landing.transport.model.availability,'guest');assert.equal(landing.calls.length,2);
 const disabledLanding=fixture({search:'?invite=VALIDCODE123'}),disabled=disabledLanding.transport.load();disabledLanding.calls[0].resolve({enabled:false});await disabled;
 assert.equal(disabledLanding.transport.model.availability,'disabled');assert.equal(disabledLanding.transport.model.ready,false);privateEmpty(disabledLanding.transport.model);
 console.log('PASS referral transport: availability, initial/same-owner failures, disabled, no-API guest, cache/dedup, identity reset, A-B-A race, invalid landing');
})().catch(error=>{console.error(error);process.exitCode=1});
