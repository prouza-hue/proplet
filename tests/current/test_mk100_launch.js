'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/app/mozkokalypsa-launch.js','utf8');
const seen='proplet:content-release:mk100-v2';
function setup({local=new Map([['onboard','done']]),session=new Map(),screen='daily',blocked=false,quiet=false,missing=false,denied=false}={}){
 const events=new Map(),nodes=new Map(),timers=[],games=[];
 const storage=map=>({getItem:k=>{if(denied)throw Error('blocked');return map.get(k)},setItem:(k,v)=>{if(denied)throw Error('blocked');map.set(k,v)},removeItem:k=>map.delete(k)});
 function node(){const classes=new Set(),handlers=new Map(),children=new Map();return {inert:false,isConnected:true,style:{},classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)},set className(s){s.split(' ').forEach(x=>classes.add(x))},setAttribute(){},focus(){},contains(){return false},querySelector(s){if(!children.has(s))children.set(s,node());return children.get(s)},querySelectorAll(){return [...children.values()]},addEventListener:(e,f)=>handlers.set(e,f),emit:(e,v={})=>handlers.get(e)?.(v)}};
 const main=node();main.tagName='MAIN';const body={children:[main],style:{overflow:'auto'},appendChild:n=>{body.children.push(n);nodes.set(n.id,n)}};
 const document={body,hidden:false,activeElement:main,createElement:node,querySelector:()=>blocked?{}:null,addEventListener:(e,f)=>events.set(e,f)};
 const context={document,localStorage:storage(local),sessionStorage:storage(session),ONBOARD_KEY:'onboard',currentScreen:screen,onboardingMandatory:false,puzzleDB:{free:{mozkokalypsa:Array.from({length:missing?99:100},(_,i)=>({id:`mk100-v2-${i}`}))}},openTransientModal:()=>blocked?{}:null,setTimeout:f=>timers.push(f),window:{startFree:d=>games.push(d),PropletFirstSteps:{quiet:()=>quiet}}};
 vm.createContext(context);vm.runInContext(source,context);
 return {context,main,local,session,games,document,emit:e=>events.get(e)?.(),flush(){while(timers.length)timers.shift()()},modal:()=>nodes.get('mk100LaunchPreview')};
}
// Completing onboarding, navigation, reload and OAuth return remain quiet in visit one.
const first=setup({local:new Map()});first.emit('proplet:ready');assert(!first.modal());
first.local.set('onboard','done');first.emit('proplet:screen-changed');first.flush();assert(!first.modal());
const reload=setup({local:first.local,session:first.session});reload.emit('proplet:ready');assert(!reload.modal());
const next=setup({local:first.local,session:new Map()});next.emit('proplet:ready');assert(next.modal());assert(next.main.inert);
next.modal().querySelector('[data-mk-launch-back]').emit('click');assert.equal(next.local.get(seen),'1');assert(!next.main.inert);
next.emit('visibilitychange');assert(next.modal().classList.contains('hidden'));
const dismissed=setup({local:next.local});dismissed.emit('proplet:ready');assert(!dismissed.modal());
for(const options of [{denied:true},{quiet:true},{missing:true},{blocked:true},{screen:'game'}]){const x=setup(options);x.emit('proplet:ready');assert(!x.modal())}
const defer=setup({screen:'game'});defer.emit('proplet:ready');defer.context.currentScreen='free';defer.emit('proplet:screen-changed');defer.flush();assert(defer.modal());
defer.context.window.PropletContentRelease.close();assert(defer.modal().classList.contains('hidden'));assert(!defer.main.inert);
const play=setup();play.emit('proplet:ready');play.modal().querySelector('[data-mk-launch-play]').emit('click');assert.deepEqual(play.games,['mozkokalypsa']);assert.equal(play.local.get(seen),'1');
console.log('PASS: onboarding first visit/reload/OAuth suppression, next visit, once dismissal, safe screens, content availability, storage failures and play action');
