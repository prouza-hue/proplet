const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('public/valid-word-feedback-v3330.js','utf8');
const code=source.slice(source.indexOf('  const loadLocalWords=()=>{'),source.indexOf('  const migrateGuestDiscoveries='));
function client(fetch){const ctx={fetch,Set,Map};vm.createContext(ctx);vm.runInContext("let localWords=null,localWordsPromise=null;const recognitionCache=new Map(),BLOCKED_DISCOVERY_WORDS=new Set(['negr']);const normalize=w=>w.normalize('NFC').trim().toLowerCase();"+code+';globalThis.recognize=recognizeWord;',ctx);return ctx;}
(async()=>{
 let calls=0;const offline=client(async()=>{calls++;throw Error('offline')});
 for(const w of ['SETR','BÍGL','LABRADOR','JILM'])assert.equal((await offline.recognize(w)).recognized,true);
 assert.equal(calls,0,'editorial words work without any network');
 let seedCalls=0,apiCalls=0;
 const retry=client(async url=>{if(url.startsWith('/valid-words')){seedCalls++;throw Error('seed unavailable')};apiCalls++;if(apiCalls===1)throw Error('network');return {ok:true,json:async()=>({recognized:true,source:'server'})};});
 assert.equal((await retry.recognize('strom')).unavailable,true);
 assert.equal((await retry.recognize('strom')).recognized,true);assert.equal(apiCalls,2);assert.equal(seedCalls,2,'failed offline seed load retries too');
 await retry.recognize('strom');assert.equal(apiCalls,2,'positive cache still works');
 let negativeCalls=0;const negative=client(async url=>url.startsWith('/valid-words')?{ok:true,text:async()=>''}:{ok:true,json:async()=>{negativeCalls++;return {recognized:false}}});
 assert.equal((await negative.recognize('qxzq')).recognized,false);await negative.recognize('qxzq');assert.equal(negativeCalls,1,'confirmed negatives remain cached');
 assert.equal((await offline.recognize('negr')).recognized,false);
 const limits=source.slice(source.indexOf('  const localLimitReason='),source.indexOf('  const refreshVisibleUi='));
 const l={localDay:()=> '2026-09-15',DAILY_XP_LIMIT:50};vm.createContext(l);vm.runInContext(limits+';globalThis.limit=localLimitReason;',l);
 const entries=Object.fromEntries(Array.from({length:6},(_,i)=>[i,{status:'local',puzzleId:'same',rewardDay:'2026-09-15'}]));
 assert.equal(l.limit({puzzleId:'same'},{entries}),null,'sixth and later word allowed');
 for(let i=6;i<50;i++)entries[i]={status:'local',puzzleId:'same',rewardDay:'2026-09-15'};
 assert.equal(l.limit({puzzleId:'same'},{entries}),'daily_limit');
 console.log('PASS: offline editorial recognition, transient retry, seed retry, negative caching and blocklist');
})().catch(e=>{console.error(e);process.exitCode=1});
