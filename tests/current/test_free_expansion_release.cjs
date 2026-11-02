'use strict';
const assert=require('node:assert/strict');
const {create,receiptKey}=require('../../public/app/engagement/announcements.js');
const release=require('../../public/app/content/free-expansion-release.js');
const store=map=>({getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value)});
const validBank=()=>({freeExpansionRelease:{batchId:release.id,totalNewLevels:600,newLevelCounts:{easy:100,medium:100,hard:100,hardcore:100,mozkomor:100,mozkokalypsa:100}}});
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve()};
function setup(options={}){
 const local=options.local||new Map(),session=options.session||new Map(),listeners=new Map(),nodes=new Map(),events=[];
 const context={ready:true,account:'a',authenticated:true,completed:12,onboarded:true,quiet:false,blocked:false,hidden:false,incoming:false,screen:'daily',...options.context};
 let playing=false,externalModal=false;
 function control(){return {isConnected:true,focusCount:0,getClientRects:()=>[{}],focus(){this.focusCount++},events:new Map(),addEventListener(name,fn){this.events.set(name,fn)}}}
 const opener=control(),choice=control();
 const doc={hidden:false,activeElement:opener,addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(fn)},body:{classList:{contains:()=>playing},append(node){nodes.set(node.id,node)}},
  createElement(){const node=control();node.attrs={};node.setAttribute=(key,value)=>{node.attrs[key]=value};node.open=false;node.showModal=()=>{node.open=true;events.push('expansion')};node.close=()=>{node.open=false};node.controls={title:control(),play:control(),close:[control(),control()]};node.querySelector=selector=>selector==='h2'?node.controls.title:node.controls.play;node.querySelectorAll=()=>node.controls.close;return node},
  querySelector(selector){if(selector.startsWith('dialog[open]'))return externalModal||[...nodes.values()].find(node=>node.open)||null;if(selector.startsWith('#difficultyCards'))return choice;return null}};
 const queue=create({context:()=>context,storage:store(local),sessionStorage:store(session)});
 if(options.beforeInstall)options.beforeInstall(queue,context,events);
 const root={document:doc,PropletAnnouncements:queue,puzzleDB:options.bank||validBank(),currentScreen:'daily',nav(screen){events.push('nav:'+screen);root.currentScreen=screen;context.screen=screen},PropletPatrons:{refresh:options.refresh||(()=>Promise.resolve())}};
 const api=release.install(root);
 function emit(name){for(const fn of listeners.get(name)||[])fn()}
 return {api,queue,context,root,doc,nodes,events,local,session,opener,choice,emit,
  async boot(){emit('proplet:ready');await flush()},
  setPlaying(value){playing=value;context.screen=value?'game':'daily';root.currentScreen=context.screen},
  setModal(value){externalModal=value;context.blocked=value}};
}
(async()=>{
 const first=setup();await first.boot();assert.deepEqual(first.events,['expansion']);
 const dialog=first.nodes.get('freeExpansionRelease');assert(dialog.open);assert.equal(dialog.attrs['aria-labelledby'],'freeExpansionTitle');
 assert.equal(first.local.get(receiptKey(release.id,'a')),'1');assert.equal(first.queue.sessionUsed(),true);
 assert.equal((dialog.innerHTML.match(/class="expansion-series-card/g)||[]).length,6);
 for(const text of ['600 nových úrovní','Po 100 v každé obtížnosti.','Vybrat si hru','Teď ne'])assert(dialog.innerHTML.includes(text));
 dialog.controls.close[1].events.get('click')();assert.equal(dialog.open,false);assert.equal(first.opener.focusCount,1);
 await first.queue.kick();assert.deepEqual(first.events,['expansion'],'closing does not chain another automatic offer');
 const reload=setup({local:first.local,session:first.session});await reload.boot();assert.equal(reload.events.length,0,'same tab reload retains session budget');
 const seen=setup({local:first.local});await seen.boot();assert.equal(seen.events.length,0,'same account already read this release');
 const other=setup({local:first.local,context:{account:'b'}});await other.boot();assert.deepEqual(other.events,['expansion'],'receipt is scoped to account');

 // Actual bank metadata is required; an old cached bank cannot announce missing levels.
 for(const mutate of [b=>b.freeExpansionRelease.batchId='old',b=>b.freeExpansionRelease.totalNewLevels=300,b=>b.freeExpansionRelease.newLevelCounts.mozkokalypsa=0]){
  const bank=validBank();mutate(bank);const stale=setup({bank});await stale.boot();assert.equal(stale.events.length,0);assert.equal(stale.local.size,0);
 }
 const guest=setup({context:{account:'',authenticated:false}});await guest.boot();assert.equal(guest.events.length,0);
 const deferred=setup();deferred.setPlaying(true);await deferred.boot();assert.equal(deferred.events.length,0);
 deferred.setPlaying(false);deferred.setModal(true);await deferred.queue.kick();assert.equal(deferred.events.length,0);
 deferred.setModal(false);await deferred.queue.kick();assert.deepEqual(deferred.events,['expansion']);

 // The Patron refresh can discover a higher-priority offer after preparation began.
 for(const [id,priority] of [['patron-thanks-v1',-10],['patron-support-v1',-20]]){
  let ready=false,finish;const promise=new Promise(resolve=>finish=resolve);
  const pending=setup({beforeInstall(queue,context,events){queue.register({id,priority,repeatable:true,eligible:()=>ready,show:()=>{events.push(id);return true}})},refresh:async()=>{await promise;ready=true;void pending.queue.kick()}});
  const boot=pending.boot();await flush();assert.equal(pending.events.length,0);finish();await boot;await flush();
  assert.deepEqual(pending.events,[id]);assert.equal(pending.local.get(receiptKey(release.id,'a')),undefined,'deferred release keeps its own receipt pending');
 }
 const news=setup({beforeInstall(queue,context,events){queue.register({id:'november-2026-release-v1',priority:120,eligible:()=>true,show:()=>{events.push('november');return true}})}});
 await news.boot();assert.deepEqual(news.events,['november'],'existing November announcement keeps priority');

 // Account/navigation changes during preparation invalidate the old display ticket.
 for(const change of [x=>{x.context.account='b'},x=>{x.context.screen='game';x.root.currentScreen='game'}]){
  let finish;const pending=setup({refresh:()=>new Promise(resolve=>finish=resolve)});const boot=pending.boot();await flush();change(pending);finish();await boot;
  assert.equal(pending.events.length,0);assert.equal(pending.local.size,0);assert.equal(pending.queue.sessionUsed(),false);
 }

 // Explicitly opening the release acknowledges only this item, without spending the automatic budget.
 const manual=setup({context:{completed:4}});await manual.boot();assert.equal(manual.api.open(),true);
 assert.equal(manual.local.get(receiptKey(release.id,'a')),'1');assert.equal(manual.queue.sessionUsed(),false);
 manual.nodes.get('freeExpansionRelease').controls.play.events.get('click')();assert(manual.events.includes('nav:free'));assert.equal(manual.choice.focusCount,1);
 assert.equal(manual.nodes.get('freeExpansionRelease').open,false);
 manual.queue.register({id:'other',priority:1,eligible:()=>true,show:()=>true});manual.context.completed=5;await manual.queue.kick();assert.equal(manual.queue.sessionUsed(),true);
 console.log('PASS: 600-level announcement content gate, account/session receipt, Patron preparation priority, navigation races, deferred display and manual entry');
})().catch(error=>{console.error(error);process.exit(1)});
