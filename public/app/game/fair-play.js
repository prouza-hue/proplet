(function(global){
'use strict';
function create(deps){
 const owner=deps.owner||global.crypto.randomUUID();
 let sequence=0,configPromise=null,active=null,chain=Promise.resolve(),timer=null;
 const config=()=>configPromise||(configPromise=deps.api('/api/play-session/config',{timeoutMs:2000}).then(value=>{global.PROPLET_ISOLATED_FAIR_PLAY_PREVIEW=value.isolatedPreview===true;try{global.localStorage?.setItem('proplet:fair-play-config',JSON.stringify(value))}catch{}return value}).catch(()=>{configPromise=null;try{return JSON.parse(global.localStorage?.getItem('proplet:fair-play-config')||'{}')}catch{return {enabled:false}}}));
 function snapshot(g){return {found:g.found||[],elapsedMs:Math.round(deps.elapsed(g)),moves:g.moves||0,hints:g.hints||0,wrongAttempts:g.wrongAttempts||0,maxHintLevel:g.maxHintLevel||0,calmMode:!!g.calmMode,unverified:!!g.timingUnverified,mergedAttempts:!!g.mergedAttempts}}
 function command(g,action,progress){return {action,puzzle_id:g.puzzle.id,challenge_key:deps.key(g.mode,g.puzzle,g.dailyDate),mode:g.mode,difficulty:g.puzzle.difficulty,attempt_id:g.attemptId,owner_id:owner,sequence:++sequence,progress}}
 function stop(){if(timer!=null){deps.clearInterval(timer);timer=null}}
 function send(g,action){
   if(!g?.fairPlay)return Promise.resolve(null);
   const body=command(g,action,snapshot(g)),profile=deps.profile();
   const operation=()=>deps.api('/api/play-session',{method:'POST',body:JSON.stringify(body),authProfile:profile,keepalive:action==='pause'});
   const work=chain.then(operation,operation);chain=work.catch(()=>{});
   return work.then(row=>{if(row.verified===false){g.timingUnverified=true;deps.status?.(g)}return row}).catch(error=>{
     // A single lost heartbeat can recover within the server's 45-second lease.
     if(action!=='pulse')g.timingUnverified=true;
     deps.status?.(g);
     if(error.status===409){stop();deps.conflict?.(g,error.message)}
     return null;
   });
 }
 async function prepare(puzzle,mode,dailyDate,restored){
   if(!['daily','free','tajenka'].includes(mode)||(await config()).enabled!==true)return {restored};
   const g={puzzle,mode,dailyDate,...restored,found:restored?.found||[],attemptId:restored?.attemptId||global.crypto.randomUUID(),fairPlay:true,timingUnverified:restored?.timingUnverified};
   const progress={...snapshot(g),elapsedMs:restored?.elapsedMs||0};
   try{
     await chain;
     const profile=deps.profile();
     const row=await deps.api('/api/play-session',{method:'POST',body:JSON.stringify(command(g,'open',progress)),authProfile:profile});
     if(row.finished&&deps.completed?.(puzzle,mode,dailyDate))return {restored:null,fairPlay:false,replay:true};
     return {restored:{...restored,...row.progress,puzzleId:puzzle.id,mode,dailyDate,attemptId:row.attempt_id,timingUnverified:row.verified===false},fairPlay:true};
   }catch(error){
     if(error.status===409)throw error;
     return {restored:{...restored,timingUnverified:true,attemptId:g.attemptId},fairPlay:true};
   }
 }
 function start(g){stop();active=g;if(!g?.fairPlay||g.finished||g.pausedAt!=null)return;timer=deps.setInterval(()=>{if(active===g&&!g.finished&&g.pausedAt==null)send(g,'pulse');else stop()},15000)}
 function pause(g){stop();return send(g,'pause')}
 async function resume(g){
   await deps.claim?.();
   const row=await send(g,'open');
   if(row){
     const progress=row.progress||{},found=new Map();
     for(const word of [...(g.found||[]),...(progress.found||[])])found.set(word.answerIndex,word);
     g.found=[...found.values()].map((word,index)=>({...word,colorIndex:index}));
     g.used=new Map();for(const word of g.found)for(const cell of word.path)g.used.set(cell,word.colorIndex);
     for(const key of ['moves','hints','wrongAttempts','maxHintLevel'])g[key]=Math.max(g[key]||0,progress[key]||0);
     g.calmMode=!!(g.calmMode||progress.calmMode);
     g.baseElapsedMs=Math.max(deps.elapsed(g),Number(row.elapsed_ms)||0);g.start=deps.now();g.pausedAt=g.start;
     g.attemptId=row.attempt_id;deps.restored?.(g);
   }
   return row;
 }
 async function finish(g){stop();const row=await send(g,'finish');if(row){g.baseElapsedMs=Math.max(deps.elapsed(g),Number(row.elapsed_ms)||0);g.start=deps.now();if(g.pausedAt!=null)g.pausedAt=g.start}return row}
 return {prepare,start,pause,resume,finish,stop,send,config,drain:()=>chain};
}
const api={create};if(global)global.PropletFairPlay=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
