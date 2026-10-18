'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {create,confirmedResult}=require('../../public/app/core/result-queue.js');
const local={queueId:'fold',attemptId:'same-attempt',puzzleId:'board',challengeKey:'free:board',mode:'free',difficulty:'hard',elapsedMs:43000,moves:13,completedAt:'2026-10-18T20:31:00Z'};
const official={...local,elapsedMs:42000,completedAt:'2026-10-18T20:30:00Z',points:150};
const receipt={committed:true,attemptId:local.attemptId,completed:official};
const conflict=()=>Object.assign(new Error('IDEMPOTENCY_CONFLICT'),{status:409});
const source=fs.readFileSync(require('node:path').join(__dirname,'../../public/app.js'),'utf8');
const adapters=source.slice(source.indexOf('async function committedResult('),source.indexOf('function resultQueue('));
async function main(){
 assert.equal(confirmedResult(local,receipt),official);
 for(const key of ['puzzleId','challengeKey','mode','difficulty'])assert.equal(confirmedResult(local,{...receipt,completed:{...official,[key]:'foreign'}}),null);
 assert.equal(confirmedResult(local,{...receipt,attemptId:'another'}),null);
 assert.equal(confirmedResult(local,{...receipt,committed:false}),null);
 let active=true,backup=true,merged=[],backups=[],reads=0;
 const context={URLSearchParams,window:{PropletResultQueue:{confirmedResult}},accountProfileMatches:()=>active,
  api:async(path,options)=>{assert(path.startsWith('/api/result-receipt?'));assert.equal(options.authProfile.id,'account');reads++;return receipt},
  quarantineRejectedResult:(row,reason,scope)=>{assert.equal(scope,'account');assert.equal(reason,'ALREADY_COMMITTED');backups.push(row);return backup},
  mergeRemoteProgress:(rows,scope)=>{assert.equal(scope,'account');merged.push(...rows)}};
 vm.runInNewContext(adapters,context);
 const profile={id:'account',token:'synthetic'};
 let queue=[{...local}],posts=0;
 const controller=create({getQueue:()=>queue,saveQueue:value=>{queue=value},isActive:()=>active,
  post:async()=>{posts++;throw conflict()},reconcile:row=>context.reconcileQueuedResult(row,profile,'account')});
 const result=await controller.sync();assert.equal(result.left,0);assert.equal(result.sent,0);assert.equal(result.reconciled,1);
 assert.equal(posts,1);assert.equal(reads,1);assert.equal(backups[0].completedAt,local.completedAt);assert.equal(merged[0].completedAt,official.completedAt);
 for(const failure of ['uncommitted','network','backup','merge','stale','other409']){
  queue=[{...local}];active=true;backup=failure!=='backup';
  context.api=async()=>{if(failure==='network')throw Error('network');if(failure==='stale')active=false;return failure==='uncommitted'?{committed:false}:receipt};
  context.mergeRemoteProgress=()=>{if(failure==='merge')throw Error('quota')};
  let resolves=0;
  const retry=create({getQueue:()=>queue,saveQueue:q=>{queue=q},isActive:()=>active,
   post:async()=>{throw failure==='other409'?Object.assign(new Error('SESSION_CONFLICT'),{status:409}):conflict()},
   reconcile:async row=>{resolves++;return context.reconcileQueuedResult(row,profile,'account')}});
  const pending=await retry.sync();assert.equal(pending.left,1,failure);assert.equal(queue[0].attemptId,local.attemptId);
  if(failure==='other409')assert.equal(resolves,0);
 }
 active=true;queue=[{...local}];let release,started;
 const paused=new Promise(resolve=>{release=resolve}),begin=new Promise(resolve=>{started=resolve});
 const concurrent=create({getQueue:()=>queue,saveQueue:q=>{queue=q},post:async()=>{throw conflict()},reconcile:async()=>{started();await paused;return true}});
 const syncing=concurrent.sync();await begin;concurrent.enqueue({...local,attemptId:'new-attempt'});release();await syncing;
 assert.equal(queue.length,1);assert.equal(queue[0].attemptId,'new-attempt');
 console.log('PASS committed attempt recovery, canonical history, retained backup, proof/binding/auth/network/quota guards and concurrent enqueue');
}
main().catch(error=>{console.error(error);process.exitCode=1});
