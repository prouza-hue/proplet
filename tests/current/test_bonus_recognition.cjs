'use strict';
// Exercise the exact browser dataset, including corrupt/failed download recovery.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync('public/recognition/lexicon.js','utf8');
const positives=['OBRNA','STROFA','AORTA','KATION','obrny','obrnou','strofy','strofou','aorty','aortou','kationu','kationy','kationech','kočkami','kancelářemi'];
function client(failure){
 let calls=0;
 const ctx={window:{},Uint8Array,Uint32Array,DataView,ArrayBuffer,TextDecoder,TextEncoder,crypto:webcrypto,
  fetch:async url=>{
   calls++;
   assert(String(url).startsWith('/recognition/'),'dictionary lookup does not depend on a recognition API');
   if(failure==='network'&&calls===1)throw Error('offline during initial download');
   const path='public'+String(url).split('?')[0];
   let bytes=fs.readFileSync(path);
   if(failure==='corrupt'&&calls===1)bytes=bytes.subarray(0,30);
   return {ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),json:async()=>JSON.parse(bytes.toString())};
  }};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 return {api:ctx.window.PropletBonusLexicon,calls:()=>calls};
}
(async()=>{
 const offline=client('network');
 assert.equal(offline.api.has('aorta'),null);
 await assert.rejects(offline.api.load());
 assert.equal(offline.api.has('aorta'),null,'network failure remains unknown');
 await offline.api.load();
 for(const word of positives){
  assert.equal(offline.api.has(word),true,word);
  assert.equal(await offline.api.recognizes(word.normalize('NFD')),true,word+' (NFD)');
 }
 for(const word of ['qxzq','aortaa','kočkamii','aor-ta','1234','Paris','Aachen'])assert.equal(await offline.api.recognizes(word),false,word);
 const calls=offline.calls();
 await Promise.all(positives.map(word=>offline.api.recognizes(word)));
 assert.equal(offline.calls(),calls,'a loaded dictionary works with no further network');
 const interrupted=client('corrupt');
 await assert.rejects(interrupted.api.load());
 assert.equal(interrupted.api.has('aorta'),null,'an interrupted dictionary body never becomes a negative verdict');
 await interrupted.api.load();assert.equal(interrupted.api.has('aorta'),true);
 console.log('PASS offline exact Czech forms, normalization, negative controls, proper-name exclusion and initial-load retry');
})().catch(e=>{console.error(e);process.exitCode=1});
