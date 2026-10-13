'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/app/mozkokalypsa-launch.js','utf8');
const seen='proplet:content-release:mk100-v2';
const {create}=require('../../public/app/engagement/announcements.js');
function setup({local=new Map([['onboard','done']]),session=new Map(),screen='daily',blocked=false,quiet=false,missing=false,denied=false,profile={id:'tester',token:'test'},prior=false,completed=10}={}){
 const events=new Map(),nodes=new Map(),timers=[],games=[];
 const storage=map=>({getItem:k=>{if(denied)throw Error('blocked');return map.get(k)},setItem:(k,v)=>{if(denied)throw Error('blocked');map.set(k,v)},removeItem:k=>map.delete(k)});
 function node(){const classes=new Set(),handlers=new Map(),children=new Map();return {inert:false,isConnected:true,style:{},classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)},set className(s){s.split(' ').forEach(x=>classes.add(x))},setAttribute(){},focus(){},contains(){return false},querySelector(s){if(!children.has(s))children.set(s,node());return children.get(s)},querySelectorAll(){return [...children.values()]},addEventListener:(e,f)=>handlers.set(e,f),emit:(e,v={})=>handlers.get(e)?.(v)}};
 const main=node();main.tagName='MAIN';const body={children:[main],style:{overflow:'auto'},appendChild:n=>{body.children.push(n);nodes.set(n.id,n)}};
 const document={body,hidden:false,activeElement:main,createElement:node,querySelector:()=>blocked?{}:null,addEventListener:(e,f)=>events.set(e,f)};
 const context={getProfile:()=>profile,getState:()=>({completed:prior?{old:true}:{}}),document,localStorage:storage(local),sessionStorage:storage(session),ONBOARD_KEY:'onboard',currentScreen:screen,onboardingMandatory:false,puzzleDB:{free:{mozkokalypsa:Array.from({length:missing?99:100},(_,i)=>({id:`mk100-v2-${i}`}))}},openTransientModal:()=>blocked?{}:null,setTimeout:f=>timers.push(f),window:{startFree:d=>games.push(d),PropletFirstSteps:{quiet:()=>quiet}}};
 const queue=create({context:()=>({ready:true,account:profile?.id||'',authenticated:!!profile?.token,completed,onboarded:local.get('onboard')==='done',screen:context.currentScreen,blocked,quiet}),storage:context.localStorage,sessionStorage:context.sessionStorage});
 context.window.PropletAnnouncements=queue;
 vm.createContext(context);vm.runInContext(source,context);
 return {queue,context,main,local,session,games,document,setProfile:p=>{profile=p},emit:e=>events.get(e)?.(),flush(){while(timers.length)timers.shift()()},modal:()=>nodes.get('mk100LaunchPreview')};
}
(async()=>{
 // Shared automatic gates supersede the old guest/first-visit heuristics.
 for(const options of [{profile:null},{completed:4},{local:new Map()},{denied:true},{quiet:true},{missing:true},{blocked:true},{screen:'game'}]){
  const x=setup(options);await x.queue.kick();assert(!x.modal());
 }
 const returning=setup();await returning.queue.kick();assert(returning.modal());assert(returning.main.inert);
 assert.equal(returning.local.get(seen+':account:tester'),'1','receipt saved only after a real display');
 returning.modal().querySelector('[data-mk-launch-back]').emit('click');assert(!returning.main.inert);
 await returning.queue.kick();assert(returning.modal().classList.contains('hidden'));
 const dismissed=setup({local:returning.local});await dismissed.queue.kick();assert(!dismissed.modal());
 const defer=setup({screen:'game'});await defer.queue.kick();defer.context.currentScreen='free';await defer.queue.kick();assert(defer.modal());
 defer.context.window.PropletContentRelease.close();assert(defer.modal().classList.contains('hidden'));assert(!defer.main.inert);
 const play=setup();await play.queue.kick();play.modal().querySelector('[data-mk-launch-play]').emit('click');assert.deepEqual(play.games,['mozkokalypsa']);
 // Old unscoped dismissals never belong to a different signed-in player.
 const shared=setup({local:new Map([['onboard','done'],[seen,'1']])});await shared.queue.kick();assert(shared.modal());
 const switched=setup({profile:{id:'a',token:'test'}});await switched.queue.kick();switched.setProfile({id:'b',token:'test'});await switched.queue.kick();
 assert(switched.modal().classList.contains('hidden'),'account switch closes old dialog');
 assert(!switched.local.has(seen+':account:b'),'one session budget does not transfer a receipt');
 const higher=setup();let news=0;higher.queue.register({id:'archive',priority:100,eligible:()=>true,show:()=>{news++;return true}});await higher.queue.kick();assert.equal(news,1);assert(!higher.modal());
 console.log('PASS: Mozkokalypsa uses shared account/session gates, legacy receipts, deferred display, accessible close, play action and current-news priority');
})().catch(error=>{console.error(error);process.exit(1)});
