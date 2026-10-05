'use strict';
const assert=require('node:assert/strict');
const client=require('../candidate/public/app/content/daily-dated.js');
const progression=require('../candidate/public/app/content/progression.js');
const row=(day,id='new-daily')=>({schemaVersion:1,dailyDate:day,serverToday:day,bankVersion:'test-bank',puzzleId:id,contentHash:'a'.repeat(64),challengeKey:`daily:${day}`,validUntil:'2026-10-07T22:00:00+00:00',puzzle:{id,letters:['A'],answers:[{word:'A',path:[0]}]}});
(async()=>{
 let deviceDay='2026-10-06',now=Date.parse('2026-10-07T12:00:00Z'),calls=0;
 let network=true;
 const store=client.create({dateISO:()=>deviceDay,now:()=>now,fetchFn:async(url,options)=>{
  calls++;assert.equal(url,'/api/daily');assert.equal(options.cache,'no-store');
  if(!network)throw new Error('offline');return {ok:true,json:async()=>row('2026-10-07')};
 }});
 await Promise.all([store.refresh(),store.refresh()]);
 assert.equal(calls,1,'one request for concurrent entry');
 assert.equal(store.today(),'2026-10-07','server Prague date wins over stale device clock');
 assert.equal(store.cached('2026-10-07').puzzleId,'new-daily');
 deviceDay='2026-10-07';network=false;
 assert.equal((await store.refresh()).puzzleId,'new-daily','same-date offline restore');
 now=Date.parse('2026-10-07T22:00:00Z');deviceDay='2026-10-08';
 await assert.rejects(store.refresh(),/offline/,'expired yesterday cannot become today');
 assert.throws(()=>store.remember(row('2026-10-07','other-id')),/daily-binding-conflict/);
 const db={datedDaily:{cutover:'2026-10-07',activeUntil:'2027-01-14'},dailyGeneration4From:'2026-08-24',dailyRotationBaseDate:'2026-08-24',daily:[{id:'old',meta:{contentGeneration:4}}]};
 const control=progression.create({getPuzzleDB:()=>db,datedDaily:store,dayOffsetISO:()=>0});
 assert.equal(control.dailyPuzzleFor('2026-10-06').id,'old');
 assert.equal(control.dailyPuzzleFor('2026-10-07').id,'new-daily');
 assert.throws(()=>control.dailyPuzzleFor('2026-10-08'),/musí načíst ze serveru/);
 assert.throws(()=>control.dailyPuzzleFor('2027-01-15'),/musí načíst ze serveru/,'no post-bank modulo');
 console.log('dated-client contract PASS: server date, concurrent entry, offline expiry, identity conflict, no modulo');
})().catch(error=>{console.error(error);process.exitCode=1});
