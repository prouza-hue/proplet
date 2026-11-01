'use strict';
const assert=require('node:assert/strict');
const {create}=require('../../public/app/game/fair-play.js');
const {create:gameSession}=require('../../public/app/game/state.js');
(async()=>{
 let online=true,fail=false,requests=[],pending=null;
 const controller=create({owner:'tab',isOnline:()=>online,profile:()=>({id:'p'}),elapsed:g=>g.baseElapsedMs||0,key:()=> 'daily:2026-11-01',now:()=>10,setInterval:()=>1,clearInterval(){},
 api:async(url,options)=>{if(url.endsWith('/config'))return {enabled:true};const body=JSON.parse(options.body);requests.push(body);if(pending){const wait=pending;pending=null;await wait;}if(fail)throw Error('network');return {attempt_id:'attempt',verified:true,finished:body.action==='finish',elapsed_ms:120000,progress:{found:[]}};}});
 const puzzle={id:'daily',answers:[],difficulty:'medium'};
 const prepared=await controller.prepare(puzzle,'daily','2026-11-01',null);
 assert.equal(prepared.restored.serverTimingAnchored,true);
 const g={...prepared.restored,puzzle,mode:'daily',fairPlay:true,found:[],pausedAt:null};
 online=false;await controller.pause(g);assert.equal(g.disconnected,true);assert.equal(g.timingUnverified,false);
 const restored=await controller.prepare(puzzle,'daily','2026-11-01',g);
 assert.equal(restored.fairPlay,true);assert.equal(restored.restored.serverTimingAnchored,true);assert.equal(restored.restored.timingUnverified,false);
 assert.equal(await controller.finish(g),null);assert.equal(g.timingUnverified,false);
 online=true;await controller.resume(g);assert.equal(requests.at(-1).progress.disconnected,true);assert.equal(g.disconnected,false);assert.equal(g.baseElapsedMs,120000);
 fail=true;await controller.pause(g);assert.equal(g.disconnected,true);
 fail=false;await controller.resume(g);assert.equal(requests.at(-1).progress.disconnected,true,'lost pause acknowledgement charges the entire gap');
 await controller.finish(g);assert.equal(g.disconnected,false);assert.equal(g.timingUnverified,false);
 // A new disconnection while a request is in flight survives its older acknowledgement.
 let release;pending=new Promise(resolve=>release=resolve);const request=controller.send(g,'pulse');await Promise.resolve();await Promise.resolve();controller.disconnected(g);release();await request;assert.equal(g.disconnected,true);
 await controller.send(g,'pulse');assert.equal(requests.at(-1).progress.disconnected,true);assert.equal(g.disconnected,false);
 online=false;const unanchored=await controller.prepare(puzzle,'daily','2026-11-01',null);assert.equal(unanchored.fairPlay,false);assert.equal(unanchored.restored.timingUnverified,true);
 let saved={inProgress:{}};const session=gameSession({readState:()=>saved,writeState:value=>saved=value,performanceNow:()=>10,dateNow:()=>100});
 const persisted={...g,finished:false,found:[],disconnected:true,baseElapsedMs:120000,start:10};session.replace(persisted);session.saveProgress(persisted);
 const row=Object.values(saved.inProgress)[0];assert.equal(row.serverTimingAnchored,true);assert.equal(row.disconnected,true);
 console.log('PASS anchored offline resume/finish, lost pause, acknowledgement race, reload persistence and unanchored exclusion');
})().catch(error=>{console.error(error);process.exitCode=1});
// The browser may remain "online" after an HTTP timeout: retry without a network event.
(async()=>{
 const fs=require('node:fs'),vm=require('node:vm');const source=fs.readFileSync('public/app.js','utf8');
 const timers=new Map();let next=0,resumes=0,finishes=0;const g={finished:false};
 const scope={currentGame:g,navigator:{onLine:true},clearTimeout:id=>timers.delete(id),setTimeout:fn=>{timers.set(++next,fn);return next},fairPlay:()=>({resume:async()=>{resumes++;return {finished:true}}}),finishGame:()=>{finishes++}};
 vm.createContext(scope);vm.runInContext(source.slice(source.indexOf('function retryPendingFinish('),source.indexOf('async function finishGame(')),scope);
 scope.retryPendingFinish(g);const tick=[...timers.values()][0];tick();await Promise.resolve();await Promise.resolve();assert.equal(resumes,1);assert.equal(finishes,1);
 scope.currentGame={};scope.retryPendingFinish(g);[...timers.values()].at(-1)();await Promise.resolve();assert.equal(resumes,1,'changed game cannot submit stale completion');
 console.log('PASS pending finish retries HTTP outage without an online event and respects game ownership');
})().catch(error=>{console.error(error);process.exitCode=1});

(async()=>{
 const text='Tento pokus přesáhl nejdelší podporovanou dobu měření (24 dní). Čas nelze zkrátit pro zařazení do pořadí.';
 let shown='',persisted=0,calls=0;
 const controller=create({owner:'tab',isOnline:()=>true,profile:()=>null,elapsed:()=>1,key:()=> 'daily:day',now:()=>0,clearInterval(){},failure:(_g,message)=>shown=message,persist:()=>persisted++,api:async url=>{if(url.endsWith('/config'))return {enabled:true};calls++;throw Object.assign(Error(text),{status:422})}});
 const g={puzzle:{id:'p'},mode:'daily',fairPlay:true,serverTimingAnchored:true};
 assert.equal(await controller.finish(g),null);assert.equal(g.fairPlayError,text);assert.equal(shown,text);assert.equal(g.fairPlay,false);assert.equal(persisted,1);
 await controller.finish(g);assert.equal(calls,1,'terminal duration cannot retry transport');
 await assert.rejects(controller.prepare({id:'p'},'daily','day',g),error=>error.status===422&&error.message===text);
 console.log('PASS duration validation preserves board, surfaces exact error and stops retry');
})().catch(error=>{console.error(error);process.exitCode=1});
