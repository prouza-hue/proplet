(function(global){
'use strict';
function create(deps){
 const owner=deps.owner||global.crypto.randomUUID();
 const online=()=>typeof deps.isOnline==='function'?deps.isOnline()!==false:global.navigator?.onLine!==false;
 let sequence=0,configPromise=null,active=null,chain=Promise.resolve(),timer=null,heartbeatMs=25000;
 const rememberConfig=value=>{const configured=Number(value?.heartbeatMs);if(configured>=10000&&configured<=30000)heartbeatMs=configured;return value};
 const config=()=>configPromise||(configPromise=deps.api('/api/play-session/config',{timeoutMs:2000}).then(value=>{global.PROPLET_ISOLATED_FAIR_PLAY_PREVIEW=value.isolatedPreview===true;try{global.localStorage?.setItem('proplet:fair-play-config',JSON.stringify(value))}catch{}return rememberConfig(value)}).catch(()=>{configPromise=null;try{return rememberConfig(JSON.parse(global.localStorage?.getItem('proplet:fair-play-config')||'{}'))}catch{return {enabled:false}}}));
 function snapshot(g){return {found:g.found||[],elapsedMs:Math.round(deps.elapsed(g)),moves:g.moves||0,hints:g.hints||0,wrongAttempts:g.wrongAttempts||0,maxHintLevel:g.maxHintLevel||0,calmMode:!!g.calmMode,unverified:!!g.timingUnverified,mergedAttempts:!!g.mergedAttempts,disconnected:!!g.disconnected}}
 function command(g,action,progress){return {action,puzzle_id:g.puzzle.id,challenge_key:deps.key(g.mode,g.puzzle,g.dailyDate),mode:g.mode,difficulty:g.puzzle.difficulty,attempt_id:g.attemptId,owner_id:owner,sequence:++sequence,progress}}
 function stop(){if(timer!=null){deps.clearInterval(timer);timer=null}}
 function disconnected(g){g.disconnected=true;g.disconnectionVersion=(g.disconnectionVersion||0)+1;if(!g.serverTimingAnchored)g.timingUnverified=true;deps.status?.(g);deps.persist?.(g)}
 function send(g,action){
   if(!g?.fairPlay)return Promise.resolve(null);
   if(!online()){disconnected(g);return Promise.resolve(null)}
   const profile=deps.profile();let disconnectVersion;
   const operation=()=>{disconnectVersion=g.disconnectionVersion||0;const body=command(g,action,snapshot(g));return deps.api('/api/play-session',{method:'POST',body:JSON.stringify(body),authProfile:profile,keepalive:action==='pause'})};
   const work=chain.then(operation,operation);chain=work.catch(()=>{});
   return work.then(row=>{g.serverTimingAnchored=true;if((g.disconnectionVersion||0)===disconnectVersion)g.disconnected=false;if(row.verified===false)g.timingUnverified=true;deps.status?.(g);deps.persist?.(g);return row}).catch(error=>{
     // Validation failures cannot recover by retrying the same command. Keep the saved board.
     if(error.status===422){g.fairPlayError=error.message;g.fairPlay=false;stop();deps.failure?.(g,error.message);deps.persist?.(g);return null}
     // Network gaps retain server timing; the next acknowledgement charges the full gap.
     disconnected(g);
     if(error.status===409){stop();deps.conflict?.(g,error.message)}
     return null;
   });
 }
 async function prepare(puzzle,mode,dailyDate,restored){
   if(!['daily','daily_special','free','tajenka'].includes(mode))return {restored};
   // A first offline launch may have no cached server policy at all. Keep the
   // local attempt playable, but never manufacture verified competitive time.
   if(!online())return {restored:{...restored,disconnected:true,timingUnverified:!!restored?.timingUnverified||!restored?.serverTimingAnchored},fairPlay:!!restored?.serverTimingAnchored};
   if((await config()).enabled!==true)return {restored};
   const g={puzzle,mode,dailyDate,...restored,found:restored?.found||[],attemptId:restored?.attemptId||global.crypto.randomUUID(),fairPlay:true,timingUnverified:restored?.timingUnverified};
   const progress={...snapshot(g),elapsedMs:restored?.elapsedMs||0};
   try{
     await chain;
     const profile=deps.profile();
     const row=await deps.api('/api/play-session',{method:'POST',body:JSON.stringify(command(g,'open',progress)),authProfile:profile});
     const practice=mode==='daily_special'&&puzzle?.meta?.dailySpecialBinding?.rewardEligible===false;
     if(row.finished&&(practice||deps.completed?.(puzzle,mode,dailyDate)||await deps.completedAttempt?.(puzzle,mode,dailyDate,row.attempt_id,profile)))return {restored:null,fairPlay:false,replay:true};
     return {restored:{...restored,...row.progress,puzzleId:puzzle.id,mode,dailyDate,attemptId:row.attempt_id,serverTimingAnchored:true,disconnected:false,timingUnverified:!!restored?.timingUnverified||row.verified===false},fairPlay:true};
   }catch(error){
     if(error.status===409||error.status===422)throw error;
     return {restored:{...restored,disconnected:true,timingUnverified:!!restored?.timingUnverified||!restored?.serverTimingAnchored,attemptId:g.attemptId},fairPlay:true};
   }
 }
 function start(g){stop();active=g;if(!g?.fairPlay||g.finished||g.pausedAt!=null)return;timer=deps.setInterval(()=>{if(active===g&&!g.finished&&g.pausedAt==null)send(g,'pulse');else stop()},heartbeatMs)}
 function pause(g){stop();return send(g,'pause')}
 async function resume(g){
   await deps.claim?.();
   const profile=deps.profile();
   const row=await send(g,'open');
   if(row){
     const progress=row.progress||{},found=new Map();
     for(const word of [...(g.found||[]),...(progress.found||[])])found.set(word.answerIndex,word);
     g.found=[...found.values()].map((word,index)=>({...word,colorIndex:index}));
     g.used=new Map();for(const word of g.found)for(const cell of word.path)g.used.set(cell,word.colorIndex);
     for(const key of ['moves','hints','wrongAttempts','maxHintLevel'])g[key]=Math.max(g[key]||0,progress[key]||0);
     g.calmMode=!!(g.calmMode||progress.calmMode);
     g.baseElapsedMs=Math.max(deps.elapsed(g),Number(row.elapsed_ms)||0);g.start=deps.now();g.pausedAt=g.start;
     g.attemptId=row.attempt_id;
     if(row.finished){
       try{if(await deps.completedAttempt?.(g.puzzle,g.mode,g.dailyDate,row.attempt_id,profile)){g.remoteCommitted=true;g.fairPlay=false}}catch{/* A pending result must stay playable and queued until proof arrives. */}
     }
     deps.restored?.(g);
   }
   return row;
 }
 async function finish(g){stop();const row=await send(g,'finish');if(row){g.baseElapsedMs=Math.max(deps.elapsed(g),Number(row.elapsed_ms)||0);g.start=deps.now();if(g.pausedAt!=null)g.pausedAt=g.start}return row}
 return {prepare,start,pause,resume,finish,stop,send,config,disconnected,drain:()=>chain};
}
const api={create};if(global)global.PropletFairPlay=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);


