// Exercise the real fixture in an isolated browser-like environment; emit its actual SVGs.
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const crypto=require('node:crypto').webcrypto,storage=new Map();
let player={id:'qr-player',token:'preview-only',name:'Žluťoučký 🧩 * & : % / !\'()'};
function context(){
 const window={PROPLET_STUDIO_PREVIEW:true,fetch:async()=>({ok:false})};
 const ctx={window,crypto,Uint32Array,URL,location:{href:'https://preview.example/patron-preview.html'},getProfile:()=>player,
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{dispatchEvent(){}},Event:class{}};
 vm.runInNewContext(fs.readFileSync('public/vendor/qrcode-generator/dist/qrcode.js','utf8'),ctx);window.qrcode=ctx.qrcode;
 vm.runInNewContext(fs.readFileSync('public/patron-fixtures/patrons.js','utf8'),ctx);return window.PropletPatronApi;
}
(async()=>{
 let api=context();const cases=[];
 for(const [amountCzk,frequency,firstPaymentDate] of [[99,'once',null],[199,'monthly','2026-12-05'],[12347,'once',null],[100000,'monthly','2027-01-31']]){
  if(amountCzk===100000)player={...player,name:'🧩Žluťoučký'.repeat(10)};
  const body={requestId:crypto.randomUUID(),amountCzk,frequency,...(firstPaymentDate?{firstPaymentDate}:{})};
  const result=await api.request('/api/patrons/intents',{method:'POST',body});
  const id=result.intent.id;
  assert.match(result.intent.reference,/^99\d{8}$/);
  assert.equal(result.payment.synthetic,true);
  assert.equal(result.intent.status,'qr_created');
  assert.equal((await api.request('/api/patrons')).patron,false,'creating/reading QR never grants support');
  const original=result.intent.message;player={...player,name:'Přejmenovaný hráč'};
  api=context(); // New page/tab, same persisted storage, no sequence reset or changed nickname binding.
  const retried=await api.request('/api/patrons/intents',{method:'POST',body});
  assert.equal(retried.intent.id,id);assert.equal(retried.intent.message,original);
  assert.equal(retried.payment.spd,result.payment.spd);assert.equal(retried.payment.qrSvg,result.payment.qrSvg);
  assert.equal((await api.request('/api/patrons/intents/'+id)).payment.spd,result.payment.spd);
  await assert.rejects(api.request('/api/patrons/intents',{method:'POST',body:{...body,amountCzk:amountCzk===99?100:99}}),e=>e.status===409);
  cases.push(result);player={...player,name:'Žluťoučký 🧩 * & : % / !\'()'};
 }
 assert.equal(new Set(cases.map(c=>c.intent.reference)).size,cases.length);
 assert.ok(!cases[0].payment.spd.includes('* &'),'nickname cannot inject SPAYD fields');
 // Separate local stores get randomized references rather than an identical first sequence value.
 const previous=new Set(cases.map(c=>c.intent.reference));storage.clear();api=context();
 const separate=await api.request('/api/patrons/intents',{method:'POST',body:{requestId:crypto.randomUUID(),amountCzk:99}});
 assert.ok(!previous.has(separate.intent.reference));
 console.log(JSON.stringify(cases));
})().catch(e=>{console.error(e);process.exit(1)});
