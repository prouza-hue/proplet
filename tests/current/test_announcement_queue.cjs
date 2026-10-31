'use strict';
const assert=require('node:assert/strict');
const {create,receiptKey,SESSION_KEY}=require('../../public/app/engagement/announcements.js');
const storage=()=>{const map=new Map();return {map,getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)}};
const returning=()=>({ready:true,account:'a',authenticated:true,completed:5,onboarded:true,quiet:false,blocked:false,hidden:false,incoming:false,screen:'daily'});
function setup({local=storage(),session=storage(),context=returning()}={}){
 const state={context,events:[]};
 const queue=create({context:()=>state.context,storage:local,sessionStorage:session});
 const add=(id,priority,options={})=>queue.register({id,priority,eligible:()=>true,show:({isCurrent})=>{assert(isCurrent());state.events.push(id);return true},...options});
 return {state,queue,add,local,session};
}
(async()=>{
 // Higher-priority news wins even if lower-priority offers registered first.
 const x=setup();x.add('invite',20);x.add('archive',100);
 assert.equal(await x.queue.kick(),true);assert.deepEqual(x.state.events,['archive']);
 assert.equal(x.local.getItem(receiptKey('archive','a')),'1');
 for(let i=0;i<3;i++)assert.equal(await x.queue.kick(),false);
 assert.deepEqual(x.state.events,['archive']);
 // The budget survives reload, while a fresh session may show the waiting invite.
 const reload=setup({local:x.local,session:x.session});reload.add('invite',20);assert.equal(await reload.queue.kick(),false);
 const next=setup({local:x.local});next.add('archive',100);next.add('invite',20);assert.equal(await next.queue.kick(),true);assert.deepEqual(next.state.events,['invite']);
 // Guest, new registration, tutorial, ongoing gameplay, hidden tab, modal and
 // incoming invitation all defer without consuming either persistence key.
 for(const patch of [{account:'',authenticated:false},{completed:4},{onboarded:false},{quiet:true},{blocked:true},{hidden:true},{incoming:true},{screen:'game'},{screen:'archive'},{ready:false}]){
  const d=setup({context:{...returning(),...patch}});d.add('archive',100);
  assert.equal(await d.queue.kick(),false,JSON.stringify(patch));assert.equal(d.local.map.size,0);assert.equal(d.session.map.size,0);
  d.state.context=returning();assert.equal(await d.queue.kick(),true,'deferred offer must retry');
 }
 // A failed mount/preload is not a display; it cannot permanently lose a release.
 const f=setup();let mounts=0;f.add('archive',100,{show:()=>++mounts===1?false:true});
 assert.equal(await f.queue.kick(),false);assert(!f.queue.seen('archive'));assert.equal(await f.queue.kick(),true);
 // Async preparation is exclusive. A screen transition aborts it safely and
 // leaves it pending for the next safe screen.
 let resolve;const asyncOffer=setup();let attempts=0;
 asyncOffer.add('invite',20,{show:async permit=>{attempts++;await new Promise(r=>resolve=r);if(!permit.isCurrent())return false;asyncOffer.state.events.push('invite');return true}});
 const pending=asyncOffer.queue.kick();await asyncOffer.queue.kick();assert.equal(attempts,1);
 asyncOffer.state.context.screen='game';resolve();assert.equal(await pending,false);assert.equal(asyncOffer.local.map.size,0);
 asyncOffer.state.context.screen='daily';const resumed=asyncOffer.queue.kick();resolve();assert.equal(await resumed,true);
 // If content arrives while a lower-priority avatar preload is in flight,
 // only the newly available current release may open.
 const priority=setup();let finishArtwork;
 priority.add('invite',20,{show:async permit=>{await new Promise(r=>finishArtwork=r);if(!permit.isCurrent())return false;priority.state.events.push('invite');return true}});
 const low=priority.queue.kick();priority.add('archive',100);await priority.queue.kick();finishArtwork();
 assert.equal(await low,false);await Promise.resolve();assert.deepEqual(priority.state.events,['archive']);
 // Account switch during a preload invalidates the old ticket. A late promise
 // must not consume the next user's budget or mark either account as informed.
 const sw=setup();const waits=[];
 sw.add('news',100,{show:async permit=>{await new Promise(r=>waits.push(r));return permit.isCurrent()}});
 const old=sw.queue.kick();sw.state.context.account='b';const newer=sw.queue.kick();
 waits[0]();assert.equal(await old,false);assert.equal(sw.local.map.size,0);
 waits[1]();assert.equal(await newer,true);assert.equal(sw.local.getItem(receiptKey('news','a')),null);assert.equal(sw.local.getItem(receiptKey('news','b')),'1');
 // Already-visible auto dialogs close on logout. Manual dialogs are outside
 // this queue, and no callback is invoked for them.
 const visible=setup();let closes=0;visible.add('news',100,{close:()=>closes++});await visible.queue.kick();
 visible.state.context.account='';visible.state.context.authenticated=false;await visible.queue.kick();assert.equal(closes,1);
 // Seen receipts never leak across accounts, even on a shared device.
 const shared=setup({local:x.local});shared.state.context.account='b';shared.add('archive',100);assert.equal(await shared.queue.kick(),true);
 // Explicitly reading a release counts as informed without consuming the
 // automatic budget. Its combined-feature receipt hook still runs exactly once.
 const manual=setup();let acknowledged=0;
 manual.add('news',100,{onShown:()=>acknowledged++});manual.add('invite',20);
 assert.equal(manual.queue.acknowledge('news'),true);assert.equal(manual.queue.acknowledge('news'),false);
 assert.equal(acknowledged,1);assert.equal(manual.queue.sessionUsed(),false);
 await manual.queue.kick();assert.deepEqual(manual.state.events,['invite']);
 // Server-governed recurring offers keep the per-session budget without a permanent receipt.
 const recurring=setup();recurring.add('support',-20,{repeatable:true});
 assert.equal(await recurring.queue.kick(),true);assert.equal(await recurring.queue.kick(),false);
 assert.equal(recurring.local.getItem(receiptKey('support','a')),null);
 const later=setup({local:recurring.local});later.add('support',-20,{repeatable:true});assert.equal(await later.queue.kick(),true);
 // Denied persistent storage still has an in-memory session/receipt guard.
 const denied={getItem(){throw Error('denied')},setItem(){throw Error('denied')}};
 const fallback=setup({local:denied,session:denied});fallback.add('news',100);assert.equal(await fallback.queue.kick(),true);assert.equal(await fallback.queue.kick(),false);
 assert.equal(x.session.getItem(SESSION_KEY),'1');
 console.log('PASS: announcement priority, session budget/reload, account receipts, deferral, failed display, async races and storage fallback');
})().catch(error=>{console.error(error);process.exit(1)});
