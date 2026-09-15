'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/content-release.js','utf8');
const app=fs.readFileSync('public/app.js','utf8');
const key='proplet:content-release:g5-r1';
const diffs=['easy','medium','hard','hardcore','mozkomor'];

function setup({preview=false,query='',stored=false,screen='daily',blocked=false,storageFails=false}={}){
 const nodes=new Map(),timers=[],events=new Map(),windowEvents=new Map(),local=new Map(),session=new Map(),games=[],navigations=[];
 if(stored)(preview?session:local).set(key,'1');
 const storage=map=>({getItem:k=>{if(storageFails)throw Error('denied');return map.get(k)},setItem:(k,v)=>{if(storageFails)throw Error('denied');map.set(k,v)}});
 function node(tag='div'){
  const handlers=new Map(),classes=new Set(),children=[],selectors=new Map();
  const el={tag,id:'',open:false,value:'',children,showCalls:0,
   classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)},
   addEventListener:(name,fn)=>handlers.set(name,fn),emit:(name,event={})=>handlers.get(name)?.(event),
   setAttribute(){},append(child){children.push(child);if(child.id)nodes.set(child.id,child);if(tag==='select'&&!el.value)el.value=child.value},
   before(child){nodes.set(child.id,child)},replaceChildren(){children.length=0;el.value=''},
   querySelector(selector){if(!selectors.has(selector))selectors.set(selector,node('button'));return selectors.get(selector)},
   showModal(){el.open=true;el.showCalls++},close(){if(el.open){el.open=false;el.emit('close')}}};
  Object.defineProperty(el,'innerHTML',{set(value){el.markup=value;if(value.includes('<form>')){const form=node('form');form.elements={difficulty:node('select'),board:node('select')};form.elements.difficulty.value='easy';selectors.set('form',form)}}});
  return el;
 }
 const root=node(),body=node(),cards=node();nodes.set('difficultyCards',cards);
 const document={hidden:false,body,documentElement:root,createElement:node,getElementById:id=>nodes.get(id)||null,
  querySelector(selector){const modal=nodes.get('contentReleaseModal');if(selector==='#contentReleaseModal[open]')return modal?.open?modal:null;return document.blocked||(modal?.open?modal:null)},
  blocked,addEventListener(name,fn){events.set(name,fn)}};
 const context={window:{PROPLET_RUNTIME_META:{gen5CandidatePreview:preview},addEventListener:(name,fn)=>windowEvents.set(name,fn)},
  document,location:{search:query,href:'https://example.test/'},localStorage:storage(local),sessionStorage:storage(session),URLSearchParams,
  currentScreen:screen,puzzleDB:{free:Object.fromEntries(diffs.map(d=>[d,Array.from({length:d==='mozkomor'?50:100},(_,i)=>({id:`g5-r1-${d}-${String(i+1).padStart(3,'0')}`}))]))},
  setTimeout(fn){timers.push(fn)},setInterval(){throw Error('CTA must not poll')},requestAnimationFrame(){throw Error('CTA must not animate-loop')},
  startGame:(...args)=>games.push(args),nav:s=>navigations.push(s)};
 vm.createContext(context);
 vm.runInContext(app.slice(app.indexOf('function transientModals(){'),app.indexOf('function goBackFromGame(){')),context);
 vm.runInContext(source,context);
 return {context,document,nodes,root,local,session,games,navigations,timers,windowEvents,
  emit:name=>events.get(name)?.(),flush(){let count=0;while(timers.length){assert(++count<20,'timer queue must settle');timers.shift()()}},
  modal:()=>nodes.get('contentReleaseModal')};
}

(async()=>{
 // Actual new content, not shell metadata, controls eligibility.
 const missing=setup();missing.context.puzzleDB.free.mozkomor.pop();missing.emit('proplet:ready');assert.equal(missing.modal(),undefined);
 missing.context.puzzleDB.free.mozkomor.push({id:'g5-r1-mozkomor-050'});missing.emit('proplet:screen-changed');missing.flush();assert(missing.modal().open);
 const absent=setup();absent.context.puzzleDB={free:{}};absent.emit('proplet:ready');assert.equal(absent.modal(),undefined);

 // Boot/game/tutorial/other modal guards defer until a safe screen is reached.
 const playing=setup({screen:'game'});playing.emit('proplet:screen-changed');playing.flush();assert.equal(playing.modal(),undefined);
 playing.emit('proplet:ready');assert.equal(playing.modal(),undefined);
 playing.context.currentScreen='free';playing.document.blocked=true;playing.emit('proplet:screen-changed');playing.flush();assert.equal(playing.modal(),undefined);
 playing.document.blocked=false;playing.document.hidden=true;playing.emit('visibilitychange');assert.equal(playing.modal(),undefined);
 playing.document.hidden=false;playing.emit('visibilitychange');assert(playing.modal().open);

 // All dismissals persist; repeated screen/visibility events do not reopen or poll.
 const once=setup();once.emit('proplet:ready');assert(once.root.classList.contains('content-release-open'));
 assert.equal(once.context.openTransientModal(),once.modal());
 once.context.closeTransientModals();assert.equal(once.modal().open,false);assert.equal(once.local.get(key),'1');
 assert.equal(once.root.classList.contains('content-release-open'),false);
 for(let i=0;i<10;i++){once.emit('proplet:screen-changed');once.emit('visibilitychange')}
 once.flush();assert.equal(once.modal().showCalls,1);assert.equal(once.timers.length,0);
 const alreadySeen=setup({stored:true});alreadySeen.emit('proplet:ready');assert.equal(alreadySeen.modal(),undefined);
 const noStorage=setup({storageFails:true});noStorage.emit('proplet:ready');noStorage.context.window.PropletContentRelease.close();noStorage.emit('visibilitychange');assert.equal(noStorage.modal().showCalls,1);

 // CTA closes through the shared controller before changing screen.
 const play=setup();play.emit('proplet:ready');play.modal().querySelector('.content-release-play').emit('click');
 assert.deepEqual(play.navigations,['free']);assert.equal(play.modal().open,false);assert.equal(play.local.get(key),'1');

 // Preview force is restricted to preview and does not consume production storage.
 const prodForce=setup({query:'?releasePreview=1',stored:true});prodForce.emit('proplet:ready');assert.equal(prodForce.modal(),undefined);assert.equal(prodForce.nodes.has('gen5PreviewPicker'),false);
 const demo=setup({preview:true,query:'?releasePreview=1',stored:true});demo.emit('proplet:ready');assert(demo.modal().open);
 demo.context.window.PropletContentRelease.close();assert.equal(demo.local.size,0);assert.equal(demo.session.get(key),'1');
 const picker=demo.nodes.get('gen5PreviewPicker'),form=picker.querySelector('form');assert.equal(form.elements.board.children.length,100);
 form.elements.difficulty.value='mozkomor';form.elements.difficulty.emit('change');assert.equal(form.elements.board.children.length,50);
 form.elements.board.value='50';let prevented=false;form.emit('submit',{preventDefault(){prevented=true}});
 assert(prevented);assert.equal(demo.games[0][0].id,'g5-r1-mozkomor-050');assert.equal(demo.games[0][1],'free');
 demo.emit('proplet:ready');assert.equal(demo.nodes.get('gen5PreviewPicker'),picker,'ready events must not duplicate the picker');

 // Browser Back uses the app's real transient branch, closing the dialog rather
 // than hiding it with a legacy CSS class and leaving the page inert.
 const back=setup();back.emit('proplet:ready');let pushed=0;
 Object.assign(back.context,{ROUTE_SCREENS:new Set(['daily','free','game']),history:{state:null,replaceState(){},pushState(){pushed++}},applyScreen(){}});
 vm.runInContext(app.slice(app.indexOf('function initNavigation(){'),app.indexOf('function transientModals(){')),back.context);
 back.context.initNavigation();await back.windowEvents.get('popstate')({state:{proplet:true,screen:'free'}});
 assert.equal(back.modal().open,false);assert.equal(pushed,1);assert.equal(back.local.get(key),'1');
 console.log('PASS: Gen5 CTA content gate, safe-screen deferral, once persistence, no polling, preview isolation/picker and Back close');
})().catch(error=>{console.error(error);process.exit(1)});
