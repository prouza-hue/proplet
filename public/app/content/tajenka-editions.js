/* Published Tajenka editions; progress and rewards remain with the normal game. */
(function install(global){
 'use strict';
 const cacheKey='proplet-published-tajenky-v1',limit=7;
 let deps=null,stored=null,reviewList=null,pendingList=null,dialog=null,body=null,opener=null,view=0;
 const sampleBoards=new Map();
 const make=(tag,cls,value)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(value!=null)node.textContent=value;return node};
 const button=(cls,label)=>{const el=make('button',cls,label);el.type='button';return el};
 const isReview=()=>!!deps?.previewHost()&&new URLSearchParams(location.search).get('tajenkaReview')==='1';
 const available=()=>!!deps&&(isReview()||(deps.enabled()&&deps.today()>=deps.dailyFrom));
 const readyToday=()=>{const p=deps?.current();return available()&&!!p&&(isReview()||p.week===deps.slotForDate(deps.today()))};
 const validId=id=>typeof id==='string'&&/^tajenka-v2-week-\d{2,}$/.test(id);
 const validDate=date=>/^\d{4}-\d{2}-\d{2}$/.test(date||'');
 function cache(){
  if(stored)return stored;
  try{stored=JSON.parse(global.localStorage.getItem(cacheKey)||'null')}catch{}
  if(!stored||!Array.isArray(stored.boards))stored={boards:[],listing:null};
  return stored;
 }
 function save(){try{global.localStorage.setItem(cacheKey,JSON.stringify(cache()))}catch{}}
 function cached(id){
  const p=cache().boards.find(b=>b?.id===id);
  return p&&deps.valid(p)?p:null;
 }
 function remember(p){
  if(!deps.valid(p))return;
  const s=cache();s.boards=[p,...s.boards.filter(b=>b?.id!==p.id)].slice(0,limit);save();
 }
 function validateListing(data){
  if(!validDate(data?.date)||data?.dailyFrom!==deps.dailyFrom||!Array.isArray(data.editions))return null;
  const seen=new Set();
  for(const e of data.editions){
   if(!validDate(e?.date)||e.date>data.date||!validId(e.id)||!Number.isInteger(e.week)||e.id!=='tajenka-v2-week-'+String(e.week).padStart(2,'0')||seen.has(e.id))return null;
   seen.add(e.id);
  }
  return {date:data.date,dailyFrom:data.dailyFrom,editions:data.editions.slice(0,limit)};
 }
 async function list(){
  const review=isReview(),saved=review?reviewList:validateListing(cache().listing);
  if(saved&&(review||saved.date===deps.today()))return saved;
  if(!review&&navigator.onLine===false&&saved)return saved;
  if(pendingList)return pendingList;
  const job=Promise.resolve().then(()=>deps.fetchRecent(review)).then(data=>{
   const listing=validateListing(data);if(!listing)throw Error('editions');
   if(review)reviewList=listing;else{cache().listing=listing;save()}return listing;
  }).catch(error=>{if(saved)return saved;throw error});
  pendingList=job;
  try{return await job}finally{if(pendingList===job)pendingList=null}
 }
 async function load(id){
  if(!validId(id))throw Error('edition');
  const review=isReview(),hit=review?sampleBoards.get(id):cached(id);
  if(hit)return hit;
  const p=await deps.fetchPuzzle(id,review);
  if(!p||p.id!==id||!deps.valid(p))throw Error('edition');
  if(review)sampleBoards.set(id,p);else remember(p);
  return p;
 }
 function dateTitle(iso){
  const date=new Date(iso+'T12:00:00Z');
  return new Intl.DateTimeFormat('cs-CZ',{day:'numeric',month:'long',timeZone:'Europe/Prague'}).format(date);
 }
 function syncPlayEntry(){
  const parent=document.getElementById('playBrowseLinks');if(!parent)return;
  let el=document.getElementById('playTajenkaEditions');
  if(!available()){if(el)el.hidden=true;return}
  if(!el){el=button('play-browse-link','');el.id='playTajenkaEditions';el.append(make('span','','Tajenky'),make('small','','Posledních 7'));el.onclick=()=>open(el);parent.append(el)}
  el.hidden=false;
 }
 function ensureDialog(){
  if(dialog)return;
  dialog=make('dialog','taj-ed-dialog');dialog.id='tajenkaEditionsDialog';dialog.setAttribute('aria-labelledby','tajEdTitle');
  const header=make('header','taj-ed-head'),title=make('h2','','Tajenky');title.id='tajEdTitle';
  const closeButton=button('taj-ed-close','×');closeButton.setAttribute('aria-label','Zavřít');closeButton.onclick=close;
  header.append(title,closeButton);
  body=make('div','taj-ed-body');dialog.append(header,body);document.body.append(dialog);
  dialog.addEventListener('close',()=>{view++;body.replaceChildren();if(opener?.isConnected)opener.focus({preventScroll:true});opener=null});
  dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close()});
 }
 function close(){if(dialog?.open)dialog.close()}
 function showWait(text){
  const status=make('p','taj-ed-message',text);status.setAttribute('role','status');body.replaceChildren(status);
 }
 function errorMessage(text,retry){
  const line=make('p','taj-ed-message',text),again=button('secondary-btn','Zkusit znovu');line.setAttribute('role','status');again.onclick=retry;body.replaceChildren(line,again);again.focus({preventScroll:true});
 }
 async function open(trigger){
  if(!available())return false;
  ensureDialog();
  if(!dialog.open){opener=trigger?.isConnected?trigger:document.activeElement;dialog.showModal()}
  const token=++view,scope=deps.scope();
  dialog.querySelector('h2').textContent='Tajenky';showWait('Načítám poslední vydání…');
  try{
   const listing=await list();
   if(token!==view||!dialog.open||scope!==deps.scope())return false;
   if(!listing.editions.length){showWait('Zatím tu není žádné vydání.');return false}
   const days=make('div','taj-ed-days'),today=isReview()?listing.date:deps.today();
   const weekDay=new Intl.DateTimeFormat('cs-CZ',{weekday:'short',timeZone:'Europe/Prague'});
   listing.editions.forEach(entry=>{
    const state=deps.status(entry.id),isToday=entry.date===today;
    const row=button('taj-ed-row'+(isToday?' taj-ed-today':''),'');
    const leaf=make('span','taj-ed-leaf'),date=new Date(entry.date+'T12:00:00Z');
    leaf.setAttribute('aria-hidden','true');leaf.append(make('small','',weekDay.format(date)),make('b','',date.getUTCDate()));
    const label=(isToday?'Dnes · ':'')+dateTitle(entry.date);
    const meta=make('span','taj-ed-action',state==='done'?'Výsledek':state==='started'?'Pokračovat':'Luštit');
    const arrow=make('span','taj-ed-arrow','›');arrow.setAttribute('aria-hidden','true');
    row.append(leaf,make('strong','taj-ed-date',label),meta,arrow);
    row.setAttribute('aria-label',label+'. '+(state==='done'?'Hotovo, zobrazit výsledek':meta.textContent));
    row.onclick=()=>choose(entry);
    days.append(row);
   });body.replaceChildren(days);
  }catch{if(token===view&&dialog.open)errorMessage('Vydání se nepodařilo načíst.',()=>open())}
 }
 async function choose(entry){
  const token=++view,scope=deps.scope();showWait('Otevírám Tajenku…');
  try{
   const current=deps.current(),p=current?.id===entry.id?current:await load(entry.id);
   if(token!==view||!dialog.open||scope!==deps.scope())return;
   close();await deps.openPuzzle(p,true);
  }catch{if(token===view&&dialog.open)errorMessage(navigator.onLine===false?'Tuhle Tajenku si poprvé otevři s připojením.':'Tajenku se nepodařilo načíst.',()=>open())}
 }
 function openFromNews(){if(!available())return false;const p=deps.current();return !readyToday()||deps.status(p.id)==='done'?open():deps.openPuzzle(p)}
 document.addEventListener('proplet:tajenka-ready',()=>{if(dialog?.open)open()});
 const api={configure(options){deps=options},available,readyToday,isReview,remember,cached,list,load,open,openFromNews,syncPlayEntry,close};
 global.PropletDailyTajenka=api;
})(typeof window!=='undefined'?window:globalThis);
