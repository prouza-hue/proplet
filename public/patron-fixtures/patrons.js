/* Static-only implementation of the real patron API contract. No bank or database access. */
(()=>{
 'use strict';if(!window.PROPLET_STUDIO_PREVIEW)throw Error('Patron fixtures require isolation');
 window.PROPLET_PATRON_PREVIEW=true;
 const KEY='patron-server-fixture-v1',ACCOUNT='5531840001/5500';
 const fresh=()=>({sequence:8800000000,intents:[],receipts:[],preferences:{},bankTransactions:{},scenario:'eligible',offset:0});
 const read=()=>{try{return JSON.parse(localStorage.getItem(KEY))||fresh()}catch{return fresh()}};
 const write=s=>localStorage.setItem(KEY,JSON.stringify(s));
 const now=s=>Date.now()+(s.offset||0),who=()=>typeof getProfile==='function'?getProfile():JSON.parse(localStorage.getItem('proplet-v2-profile')||'null');
 const error=(status,message)=>{const e=new Error(message);e.status=status;throw e};
 const prefs=(s,id)=>s.preferences[id]||{publicBadge:false,offersDisabled:false};
 function state(s){const p=who(),id=p?.id,pr=prefs(s,id);const patron=s.intents.some(i=>i.playerId===id&&i.status==='confirmed');const recent=s.receipts.filter(r=>r.playerId===id&&r.at>now(s)-90*86400000);const cool=recent.some(r=>r.at>now(s)-30*86400000);return {enabled:true,authenticated:!!p?.token,patron,publicBadge:patron&&pr.publicBadge,offersDisabled:pr.offersDisabled,canOffer:!!p?.token&&!patron&&!pr.offersDisabled&&!cool&&recent.length<2&&s.scenario==='eligible'&&p.supportMode!=='younger',offerCount90d:recent.length};}
 const payment=i=>({iban:null,spd:null,qrSvg:null,synthetic:true,qrUrl:'/patron-demo-qr.png',account:ACCOUNT});
 async function request(url,options={}){const u=new URL(url,location.href),method=options.method||'GET',body=typeof options.body==='string'?JSON.parse(options.body):options.body||{},s=read(),p=who();
  if(u.pathname==='/api/patrons'&&method==='GET')return state(s);
  if(u.pathname.startsWith('/api/admin/patrons'))return admin(u.pathname,{...options,body,reference:u.searchParams.get('reference')});
  if(!p?.token)error(401,'Nejdřív se přihlas ke svému účtu.');
  if(u.pathname==='/api/patrons/intents'&&method==='POST'){
   if(!Number.isInteger(body.amountCzk)||body.amountCzk<1||body.amountCzk>100000||typeof body.requestId!=='string')error(400,'Neplatná částka nebo požadavek.');
   const frequency=body.frequency||'once',firstPaymentDate=body.firstPaymentDate||null;if(!['once','monthly'].includes(frequency)||(frequency==='monthly'&&!/^\d{4}-\d{2}-\d{2}$/.test(firstPaymentDate||''))||(frequency==='once'&&firstPaymentDate))error(400,'Neplatná četnost nebo datum.');let i=s.intents.find(i=>i.playerId===p.id&&i.requestId===body.requestId);if(i&&(i.amountCzk!==body.amountCzk||(i.frequency||'once')!==frequency||(i.firstPaymentDate||null)!==firstPaymentDate))error(409,'Požadavek už patří jiné částce.');
   if(!i){const suffix=' podporuje Proplet';i={id:crypto.randomUUID(),requestId:body.requestId,playerId:p.id,nicknameSnapshot:p.name,currentNickname:p.name,amountCzk:body.amountCzk,frequency,firstPaymentDate,paymentCount:0,totalConfirmedCzk:0,payments:[],currency:'CZK',account:ACCOUNT,reference:String(++s.sequence),message:String(p.name||'Hráč').slice(0,60-suffix.length)+suffix,createdAt:new Date(now(s)).toISOString(),status:'qr_created'};s.intents.push(i);write(s);}
   return {intent:i,payment:payment(i)};
  }
  if(u.pathname.startsWith('/api/patrons/intents/')&&method==='GET'){const i=s.intents.find(i=>i.id===u.pathname.split('/').pop()&&i.playerId===p.id);if(!i)error(404,'Příprava nebyla nalezena.');return {intent:i,payment:payment(i)};}
  if(u.pathname==='/api/patrons/preferences'&&method==='POST'){if(typeof body.publicBadge!=='boolean'||typeof body.offersDisabled!=='boolean')error(400,'Neplatná preference.');if(body.publicBadge&&!state(s).patron)error(409,'Příspěvek ještě není potvrzený.');s.preferences[p.id]={publicBadge:body.publicBadge,offersDisabled:body.offersDisabled};write(s);return state(s);}
  if(u.pathname==='/api/patrons/offers/claim'&&method==='POST'){const status=state(s);if(!status.canOffer)return {...status,displayGranted:false};const r={id:crypto.randomUUID(),playerId:p.id,at:now(s),action:'shown'};s.receipts.push(r);write(s);return {...state(s),displayGranted:true,receiptId:r.id};}
  if(u.pathname==='/api/patrons/offers/dismiss'&&method==='POST'){const r=s.receipts.find(r=>r.id===body.receiptId&&r.playerId===p.id);if(!r)error(404,'Nabídka nebyla nalezena.');if(!['declined','ignored','opened'].includes(body.action))error(400,'Neplatná akce.');r.action=body.action;write(s);return state(s);}
  error(404,'Tato ukázková operace není dostupná.');
 }
 async function admin(path,options={}){const s=read(),body=options.body||{};
  if(path==='/api/admin/patrons')return {items:s.intents.filter(i=>options.reference?i.reference===options.reference:Date.parse(i.createdAt)>=now(s)-7*86400000).slice().reverse().map(i=>({...i,currentNickname:who()?.id===i.playerId?who().name:i.nicknameSnapshot})),synthetic:true};
  if(path==='/api/admin/patrons/confirm'){
   const i=s.intents.find(i=>i.id===body.intentId);if(!i)error(404,'Příprava platby nebyla nalezena.');
   if(body.reference!==i.reference||body.amountCzk!==i.amountCzk||body.currency!=='CZK'||body.recipientAccount!==ACCOUNT)error(409,'Údaje převodu neodpovídají připravené platbě.');
   if(typeof body.bankTransactionId!=='string'||!body.bankTransactionId.trim())error(400,'Doplň identifikátor bankovní transakce.');
   const tx=body.bankTransactionId.trim(),other=s.bankTransactions[tx];if(other&&other!==i.id)error(409,'Tento bankovní převod už je přiřazený jinému příspěvku.');
   if(other===i.id||i.bankTransactionId===tx)return {ok:true,alreadyConfirmed:true,intent:i,patron:true};if(i.status==='confirmed'&&(i.frequency||'once')==='once')error(409,'Tento příspěvek už má jiný potvrzený převod.');
   const stamp=new Date(now(s)).toISOString();i.payments=i.payments||[];i.payments.push({id:crypto.randomUUID(),bankTransactionId:tx,amountCzk:body.amountCzk,confirmedAt:stamp,confirmedBy:'synthetic-admin'});i.paymentCount=i.payments.length;i.totalConfirmedCzk=i.paymentCount*i.amountCzk;i.lastConfirmedAt=stamp;i.status='confirmed';i.confirmedAt=i.confirmedAt||stamp;i.bankTransactionId=i.bankTransactionId||tx;i.confirmedBy='synthetic-admin';s.bankTransactions[tx]=i.id;write(s);document.dispatchEvent(new Event('proplet:patron-updated'));return {ok:true,alreadyConfirmed:false,intent:i,patron:true};
  }error(404,'Neznámá adminová operace.');
 }
 const nativeFetch=window.fetch.bind(window);window.fetch=async(input,init)=>{const url=new URL(typeof input==='string'?input:input.url,location.href);const response=await nativeFetch(input,init);if(!/rankings|leaderboard/.test(url.pathname)||!response.ok)return response;try{const value=await response.clone().json(),s=read(),status=state(s);const decorate=rows=>rows?.map(r=>({...r,patron:r.isMine===true?status.publicBadge:['review-klara','review-matej','review-2'].includes(r.id)}));if(Array.isArray(value.players))value.players=decorate(value.players);if(Array.isArray(value.rows))value.rows=decorate(value.rows);return new Response(JSON.stringify(value),{status:response.status,headers:{'content-type':'application/json'}});}catch{return response}};
 window.PropletPatronApi={request,admin,read,reset(){write(fresh());document.dispatchEvent(new Event('proplet:patron-updated'));},scenario(value){const s=read();s.scenario=value;write(s);document.dispatchEvent(new Event('proplet:patron-updated'));},advance(days){const s=read();s.offset+=days*86400000;write(s);document.dispatchEvent(new Event('proplet:patron-updated'));}};
})();
