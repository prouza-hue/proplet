const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('public/valid-word-feedback-v3330.js','utf8');
const code=source.slice(source.indexOf('  const loadLocalWords=()=>{'),source.indexOf('  const migrateGuestDiscoveries='));
function client(fetch,broad){const ctx={fetch,Set,Map,window:{PropletBonusLexicon:broad}};vm.createContext(ctx);vm.runInContext("let localWords=null,localWordsPromise=null;const recognitionCache=new Map(),BLOCKED_DISCOVERY_WORDS=new Set(['NEGR']);const normalize=w=>String(w||'').normalize('NFC').trim().toLocaleUpperCase('cs-CZ');"+code+';globalThis.recognize=recognizeWord;',ctx);return ctx;}
(async()=>{
 let calls=0;const offline=client(async()=>{calls++;throw Error('offline')});
 for(const w of ['SETR','BÍGL','LABRADOR','JILM','KANCL','STÁJ'])assert.equal((await offline.recognize(w)).recognized,true);
 assert.equal(calls,0,'editorial words work without any network');
 let seedCalls=0,apiCalls=0;
 const retry=client(async url=>{if(url.startsWith('/valid-words')){seedCalls++;throw Error('seed unavailable')};apiCalls++;if(apiCalls===1)throw Error('network');return {ok:true,json:async()=>({recognized:true,source:'server'})};});
 assert.equal((await retry.recognize('strom')).unavailable,true);
 assert.equal((await retry.recognize('strom')).recognized,true);assert.equal(apiCalls,2);assert.equal(seedCalls,2,'failed offline seed load retries too');
 await retry.recognize('strom');assert.equal(apiCalls,2,'positive cache still works');
 let negativeCalls=0;const negative=client(async url=>url.startsWith('/valid-words')?{ok:true,text:async()=>'strom'}:{ok:true,json:async()=>{negativeCalls++;return {recognized:false}}},{recognizes:async()=>false});
 assert.equal((await negative.recognize('qxzq')).recognized,false);await negative.recognize('qxzq');assert.equal(negativeCalls,1,'confirmed negatives remain cached');
 assert.equal((await offline.recognize('negr')).recognized,false);
 let broadCalls=0,missCalls=0;
 const broadRetry=client(async url=>url.startsWith('/valid-words')?{ok:true,text:async()=>'strom'}:{ok:true,json:async()=>{missCalls++;return {recognized:false}}}, {recognizes:async()=>{if(++broadCalls===1)throw Error('partial download');return true}});
 assert.equal((await broadRetry.recognize('AORTA')).recognized,false);
 assert.equal((await broadRetry.recognize('AORTA')).recognized,true,'a server miss cannot poison a dictionary that failed to load');
 assert.equal(missCalls,1);assert.equal(broadCalls,2);
 const normalized=client(async()=>{throw Error('offline')},{recognizes:async w=>w==='KOČKAMI'});
 assert.equal((await normalized.recognize('koc\u030ckami')).recognized,true,'NFD and NFC share recognition');
 console.log('PASS: offline editorial recognition, transient retry, seed retry, negative caching and blocklist');
})().catch(e=>{console.error(e);process.exitCode=1});
