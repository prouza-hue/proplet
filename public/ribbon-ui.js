/* Proplet ribbon presentation. Reward identities and predicates stay in app.js. */
(function(global){
'use strict';
document.documentElement.classList.add('ribbon-ui','tiskarna-ui');
const catalog=global.PropletRibbonCatalog||{};
const printshop=new Set(["novacek", "alchymista", "legenda", "prvni-proplet", "achievement-tajenka-10", "nemesis", "streak-02", "tyden", "streak-10", "medaile", "medal-2", "medal-3"]);
function identity(label,category){
 const name=String(label||'').replace(/^Nový odznak · /,'').replace(/^\d+[. ·–-]*\s*/, '').trim();
 if(category)return {name,key:catalog[category]?.[name]};
 const matches=Object.values(catalog).map(f=>f[name]).filter(Boolean);
 return {name,key:matches.length===1?matches[0]:null};
}
function art(label,{locked=false,size=40,category}={}){
 const found=identity(label,category),name=found.name;let key=found.key;
 if(!key)return null;const printKey=key==='symbol-complete'?'prvni-proplet':key;const printed=printshop.has(printKey);if(locked&&key==='prvni-proplet'&&!printed)key='zamceno';
 const wrap=document.createElement('span');wrap.className='ribbon-art'+(locked?' is-locked':'');wrap.dataset.ribbon=key;if(printed)wrap.classList.add('printshop-art');wrap.setAttribute('role','img');wrap.setAttribute('aria-label',name+(locked?', zamčeno':''));
 for(const theme of (printed?['print']:['light','dark'])){
  const img=document.createElement('img');img.className='ribbon-'+theme;img.alt='';img.setAttribute('aria-hidden','true');img.width=size;img.height=size;img.draggable=false;img.loading='lazy';img.decoding='async';
  img.src=printed?'/rewards/printshop/'+printKey+'.svg?v=1':'/rewards/ribbons/'+theme+'/'+key+'-'+(size<=32?'small':'regular')+'.svg?v=5';wrap.appendChild(img);
 }
 return wrap;
}
global.PropletRibbonArt=Object.freeze({art,identity});
})(window);
