const assert=require('node:assert/strict');
const {create}=require('../../public/app/content/daily-dated.js');
(async()=>{
 let now=Date.parse('2026-10-07T22:05:00Z'),day='2026-10-08',calls=0,offline=false;
 const row={schemaVersion:1,dailyDate:day,serverToday:day,puzzleId:'g6-d-20261008',bankVersion:'approved',contentHash:'a'.repeat(64),challengeKey:`daily:${day}`,validUntil:'2026-10-08T22:00:00Z',puzzle:{id:'g6-d-20261008',letters:['A'],answers:[]}};
 const storage={data:null,getItem(){return this.data},setItem(k,v){this.data=v}};
 const store=create({now:()=>now,dateISO:()=>day,storage,fetchFn:async()=>{calls++;if(offline)throw Error('offline');await new Promise(r=>setImmediate(r));return {ok:true,json:async()=>row}}});
 await Promise.all([store.refresh(),store.refresh()]);assert.equal(calls,1);
 assert.equal(store.today(),day);offline=true;assert.equal((await store.refresh()).puzzleId,row.puzzleId);
 now=Date.parse('2026-10-08T22:01:00Z');day='2026-10-09';await assert.rejects(store.refresh());assert.equal(store.cached(day),null);
 assert.throws(()=>store.remember({...row,puzzleId:'other',puzzle:{id:'other',letters:[],answers:[]}}),/conflict/);
 assert.equal((await store.historical('2026-10-08','g6-d-20261008')).puzzleId,row.puzzleId);
 const restored=create({storage,now:()=>Date.parse('2026-10-07T22:10:00Z'),dateISO:()=>day});assert.equal(restored.today(),'2026-10-08');
 console.log('PASS: shared refresh, offline same-day cache, midnight expiry, history/conflict and restart');
})().catch(e=>{console.error(e);process.exit(1)});
