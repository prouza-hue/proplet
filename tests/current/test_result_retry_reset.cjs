'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c={module:{exports:{}},crypto:{randomUUID:()=> 'new-id'}};
vm.createContext(c);vm.runInContext(fs.readFileSync('public/app/core/result-queue.js','utf8'),c);
(async()=>{
 let clock=Date.parse('2026-11-03T11:13:27Z'),retry={},queue=[],calls=0,block=true;
 const q=c.module.exports.create({now:()=>clock,getRetry:()=>retry,saveRetry:r=>retry=r,
  getQueue:()=>queue,saveQueue:r=>queue=r,post:async()=>{
   calls++;if(block){const e=new Error('quota');e.status=429;e.retryAfterMs=2793000;throw e;}
  }});
 q.enqueue({mode:'free',challengeKey:'free:fixture',attemptId:'saved-attempt',completedAt:'2026-11-02T23:59:00Z'});
 const original=JSON.stringify(queue),r=await q.sync();
 assert.equal(r.left,1);assert.equal(JSON.stringify(queue),original);assert.equal(calls,1);
 assert.equal(retry.until,Date.parse('2026-11-03T12:00:00Z'));
 assert.equal(q.resetAuthRetry(),false,'session renewal cannot clear quota backoff');
 clock=Date.parse('2026-11-03T11:59:59.999Z');assert.equal((await q.sync()).deferred,true);assert.equal(calls,1);
 clock++;block=false;
 const x=q.sync(),y=q.sync();assert.equal(x,y,'concurrent reset triggers share one write');
 assert.equal((await x).sent,1);assert.equal(queue.length,0);assert.equal(calls,2);
 await q.sync();assert.equal(calls,2,'confirmed result is never sent twice');
 for(const header of [1000,0,NaN]){
  let t=0,wait={},rows=[{queueId:'short-reset',challengeKey:'free:second'}],posts=0;
  const c2=c.module.exports.create({now:()=>t,getQueue:()=>rows,saveQueue:x=>rows=x,
   getRetry:()=>wait,saveRetry:x=>wait=x,post:async()=>{posts++;if(posts===1){const e=new Error('quota');e.status=429;e.retryAfterMs=header;throw e;}}});
  await c2.sync();const expected=header===1000?1000:60000;
  assert.equal(wait.until,expected,'short authoritative reset wins; missing/invalid uses network backoff');
  t=expected-1;assert.equal((await c2.sync()).deferred,true);assert.equal(posts,1);
  t++;assert.equal((await c2.sync()).sent,1);assert.equal(posts,2);assert.equal(rows.length,0);
 }
 console.log('PASS 429 keeps exact result/finish time, auth and concurrent retries respect reset, one confirmation');
})().catch(e=>{console.error(e);process.exitCode=1});

