/* Static-only implementation of the real patron API contract. No bank or database access. */
(()=>{
 'use strict';if(!window.PROPLET_STUDIO_PREVIEW)throw Error('Patron fixtures require isolation');
 window.PROPLET_PATRON_PREVIEW=true;
 const KEY='patron-server-fixture-v1',ACCOUNT='5531840001/5500';
 const fresh=()=>({intents:[],receipts:[],preferences:{},bankTransactions:{},firstSeen:{},newsReceipts:{},completedBoards:{},thanksClaimed:{},scenario:'eligible',offset:0});
 const read=()=>{try{return JSON.parse(localStorage.getItem(KEY))||fresh()}catch{return fresh()}};
 const write=s=>localStorage.setItem(KEY,JSON.stringify(s));
 const now=s=>Date.now()+(s.offset||0),who=()=>typeof getProfile==='function'?getProfile():JSON.parse(localStorage.getItem('proplet-v2-profile')||'null');
 const error=(status,message)=>{const e=new Error(message);e.status=status;throw e};
 const prefs=(s,id)=>s.preferences[id]||{publicBadge:false,offersDisabled:false};
 const HOUR=3600000,DAY=24*HOUR,ordinary=new Set(['daily','daily_special','free','tajenka']);
 const historicalBoards=s=>[7,6,5,4,3].map((days,index)=>({mode:'free',key:'historic-'+index,at:now(s)-days*DAY}));
 function state(s){
  const p=who(),id=p?.id,pr=prefs(s,id),authenticated=!!p?.token;
  const patron=s.intents.some(i=>i.playerId===id&&i.status==='confirmed');
  const recent=s.receipts.filter(r=>r.playerId===id&&r.at>now(s)-90*DAY),cool=recent.some(r=>r.at>now(s)-30*DAY);
  s.firstSeen=s.firstSeen||{};s.newsReceipts=s.newsReceipts||{};s.completedBoards=s.completedBoards||{};s.thanksClaimed=s.thanksClaimed||{};
  if(authenticated&&s.firstSeen[id]===undefined){s.firstSeen[id]=now(s)-(s.scenario==='first_visit'?0:49*HOUR);write(s);}
  if(authenticated&&!s.completedBoards[id]){s.completedBoards[id]=historicalBoards(s);write(s);}
  const newsAt=s.newsReceipts[id],anchor=newsAt??s.firstSeen[id]??now(s),played=(s.completedBoards[id]||[]).filter(b=>ordinary.has(b.mode));
  const distinct=rows=>new Set(rows.map(b=>b.mode+':'+b.key)).size;
  const boards=distinct(played),days=new Set(played.map(b=>new Date(b.at).toLocaleDateString('en-CA',{timeZone:'Europe/Prague'}))).size;
  const postAnchorBoards=distinct(played.filter(b=>b.at>anchor));
  const offerWaitReason=!authenticated?'authentication':patron?'patron':pr.offersDisabled?'disabled':now(s)<anchor+48*HOUR?'release_wait':newsAt!==undefined&&postAnchorBoards<2?'post_news_boards':boards<5||days<3?'playing_history':recent.length>=2?'offer_limit':cool?'cooldown':null;
  const contributions=s.intents.filter(i=>i.playerId===id&&i.status==='confirmed').flatMap(i=>(i.payments||[]).map(r=>({id:r.id,amountCzk:r.amountCzk,frequency:i.frequency||'once',confirmedAt:r.confirmedAt}))).sort((a,b)=>Date.parse(b.confirmedAt)-Date.parse(a.confirmedAt)).slice(0,50);
  return {ok:true,enabled:true,authenticated,patron,publicBadge:patron&&pr.publicBadge,offersDisabled:pr.offersDisabled,
   canOffer:offerWaitReason===null,offerCount90d:recent.length,displayGranted:false,receiptId:null,
   offerWaitReason,offerAnchorSource:newsAt===undefined?'first_seen':'release_news',offerAvailableAt:new Date(anchor+48*HOUR).toISOString(),postAnchorBoards,
   thanksPending:patron&&!s.thanksClaimed[id],contributions};
 }
 // Same BBAN and SPAYD escaping as backend/patrons.py; input is the persisted model intent.
 const bban='5500'+'000000'+'5531840001',IBAN='CZ'+String(98-Number(BigInt(bban+'123500')%97n)).padStart(2,'0')+bban;
 const spaydQuote=value=>encodeURIComponent(value).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase()).replace(/%20/g,' ');
 function payment(i){
  let spd=`SPD*1.0*ACC:${IBAN}*AM:${i.amountCzk}.00*CC:CZK*X-VS:${i.reference}*MSG:${spaydQuote(i.message)}`;
  if(i.frequency==='monthly')spd+=`*FRQ:1M*DT:${i.firstPaymentDate.replace(/-/g,'')}`;
  const qr=window.qrcode(0,'M');qr.addData(spd,'Byte');qr.make();
  return {iban:IBAN,spd,qrSvg:qr.createSvgTag({cellSize:8,margin:32}),synthetic:true,account:ACCOUNT};
 }
 function testReference(s){
  // Preview-local TEST namespace only; these references are not registered in production.
  let reference;do{reference='99'+String(crypto.getRandomValues(new Uint32Array(1))[0]%100000000).padStart(8,'0')}while(s.intents.some(i=>i.reference===reference));return reference;
 }
 async function request(url,options={}){const u=new URL(url,location.href),method=options.method||'GET',body=typeof options.body==='string'?JSON.parse(options.body):options.body||{},s=read(),p=who();
  if(u.pathname==='/api/patrons'&&method==='GET')return state(s);
  if(u.pathname.startsWith('/api/admin/patrons'))return admin(u.pathname,{...options,body,reference:u.searchParams.get('reference')});
  if(!p?.token)error(401,'Nejdřív se přihlas ke svému účtu.');
  if(u.pathname==='/api/patrons/thanks/claim'&&method==='POST'){const status=state(s);if(!status.thanksPending)return {ok:true,displayGranted:false,patron:status.patron};s.thanksClaimed[p.id]=new Date(now(s)).toISOString();write(s);return {ok:true,displayGranted:true,patron:true};}
  if(u.pathname==='/api/patrons/intents'&&method==='POST'){
   if(!Number.isInteger(body.amountCzk)||body.amountCzk<1||body.amountCzk>100000||typeof body.requestId!=='string')error(400,'Neplatná částka nebo požadavek.');
   const frequency=body.frequency||'once',firstPaymentDate=body.firstPaymentDate||null;if(!['once','monthly'].includes(frequency)||(frequency==='monthly'&&!/^\d{4}-\d{2}-\d{2}$/.test(firstPaymentDate||''))||(frequency==='once'&&firstPaymentDate))error(400,'Neplatná četnost nebo datum.');let i=s.intents.find(i=>i.playerId===p.id&&i.requestId===body.requestId);if(i&&(i.amountCzk!==body.amountCzk||(i.frequency||'once')!==frequency||(i.firstPaymentDate||null)!==firstPaymentDate))error(409,'Požadavek už patří jiné částce.');
   if(!i){const suffix=' podporuje Proplet';i={id:crypto.randomUUID(),requestId:body.requestId,playerId:p.id,nicknameSnapshot:p.name,currentNickname:p.name,amountCzk:body.amountCzk,frequency,firstPaymentDate,paymentCount:0,totalConfirmedCzk:0,payments:[],currency:'CZK',account:ACCOUNT,reference:testReference(s),message:Array.from(String(p.name||'Hráč').replace(/[\x00-\x1f\x7f]/g,'')).slice(0,60-suffix.length).join('')+suffix,createdAt:new Date(now(s)).toISOString(),status:'qr_created'};s.intents.push(i);write(s);}
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
 const nativeFetch=window.fetch.bind(window);window.fetch=async(input,init)=>{const url=new URL(typeof input==='string'?input:input.url,location.href);if(url.pathname.startsWith('/api/patrons')){try{return new Response(JSON.stringify(await request(url.href,init||{})),{status:200,headers:{'content-type':'application/json'}})}catch(e){return new Response(JSON.stringify({detail:e.message}),{status:e.status||503,headers:{'content-type':'application/json'}})}}const response=await nativeFetch(input,init);if(!/rankings|leaderboard/.test(url.pathname)||!response.ok)return response;try{const value=await response.clone().json(),s=read(),status=state(s);const decorate=rows=>rows?.map(r=>({...r,patron:r.isMine===true?status.publicBadge:['review-klara','review-matej','review-2'].includes(r.id)}));if(Array.isArray(value.players))value.players=decorate(value.players);if(Array.isArray(value.rows))value.rows=decorate(value.rows);return new Response(JSON.stringify(value),{status:response.status,headers:{'content-type':'application/json'}});}catch{return response}};
 window.PropletPatronApi={request,admin,read,reset(){write(fresh());document.dispatchEvent(new Event('proplet:patron-updated'));},scenario(value){const s=read(),id=who()?.id;state(s);s.scenario=value;
   s.firstSeen[id]=now(s)-(value==='first_visit'?0:49*HOUR);delete s.newsReceipts[id];s.completedBoards[id]=historicalBoards(s);
   if(value==='news_wait')s.newsReceipts[id]=now(s);
   if(value==='post_news_boards')s.newsReceipts[id]=now(s)-49*HOUR;
   write(s);document.dispatchEvent(new Event('proplet:patron-updated'));},
  newsReceipt(){const s=read(),id=who()?.id;state(s);if(s.newsReceipts[id]===undefined)s.newsReceipts[id]=now(s);write(s);document.dispatchEvent(new Event('proplet:patron-updated'));},
  completeBoard(mode='free'){const s=read(),id=who()?.id;state(s);s.completedBoards[id].push({mode,key:crypto.randomUUID(),at:now(s)+1});write(s);document.dispatchEvent(new Event('proplet:patron-updated'));},advance(days){const s=read();s.offset+=days*86400000;write(s);document.dispatchEvent(new Event('proplet:patron-updated'));}};
})();
