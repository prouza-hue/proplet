const assert=require('assert');
const {create}=require('../../public/app/core/result-queue.js');
const analytics=require('../../public/app/analytics.js');
async function main(){
 let time=1000,rows=[{queueId:'one'},{queueId:'two'}],retry={},calls=0;
 const options={getQueue:()=>rows,saveQueue:r=>rows=r,getRetry:()=>retry,saveRetry:r=>retry=r,now:()=>time,post:async()=>{calls++;throw Object.assign(new Error('limit'),{status:429,retryAfterMs:3600000})}};
 let queue=create(options);await queue.sync();assert.equal(calls,1);assert.equal(rows.length,2);
 queue=create(options);await queue.sync();assert.equal(calls,1,'Cooldown survives reload');
 time+=3600001;queue=create({...options,post:async()=>{calls++}});await queue.sync();assert.equal(rows.length,0);assert.equal(calls,3);
 let memoryRows=[{queueId:'x'},{queueId:'y'}],memoryCalls=0;
 const memoryQueue=create({now:()=>time,getQueue:()=>memoryRows,saveQueue:r=>memoryRows=r,post:async()=>{memoryCalls++;throw new Error('offline')}});
 await memoryQueue.sync();await memoryQueue.sync();assert.equal(memoryCalls,1);
 // Offline analytics persists the original event id and ignores arbitrary properties.
 const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 let offline=true,sent=[];
 const trackOptions={storage,now:()=>time,getScope:()=> 'a:guest',request:async(p,o)=>{if(offline)throw new Error('offline');sent.push(o)}};
 let tracker=analytics.create(trackOptions);tracker.track('starter_started',{email:'never-send'});await tracker.flush();
 const saved=JSON.parse(map.get('proplet-events-v2:a:guest'));assert.equal(saved.length,1);
 offline=false;time+=60001;tracker=analytics.create(trackOptions);await tracker.flush();
 assert.deepEqual(JSON.parse(sent[0].body),{event_type:'starter_started'});
 assert.equal(sent[0].headers['X-Proplet-Event-ID'],saved[0].id);
 assert.equal(JSON.parse(map.get('proplet-events-v2:a:guest')).length,0);
 console.log('PASS sync cooldown, reload recovery, queue preservation and durable analytics');
}
main().catch(e=>{console.error(e);process.exit(1)});
