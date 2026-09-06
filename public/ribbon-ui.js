/* Proplet printshop presentation. Reward identities and predicates stay in app.js. */
(function(global){
'use strict';
document.documentElement.classList.add('ribbon-ui','tiskarna-ui');
const catalog=global.PropletRibbonCatalog||{};
function identity(label,category){
 const name=String(label||'').replace(/^Nový odznak · /,'').replace(/^\d+[. ·–-]*\s*/, '').trim();
 if(category)return {name,key:catalog[category]?.[name]};
 const matches=Object.values(catalog).map(f=>f[name]).filter(Boolean);
 return {name,key:matches.length===1?matches[0]:null};
}
function art(label,{locked=false,size=40,category}={}){
 const found=identity(label,category),name=found.name;let key=found.key;
 if(!key)return null;const printKey=key;const printed=true;
 const wrap=document.createElement('span');wrap.className='ribbon-art'+(locked?' is-locked':'');wrap.dataset.ribbon=key;if(printed)wrap.classList.add('printshop-art');wrap.setAttribute('role','img');wrap.setAttribute('aria-label',name+(locked?', zamčeno':''));
 for(const theme of ['print']){
  const img=document.createElement('img');img.className='ribbon-'+theme;img.alt='';img.setAttribute('aria-hidden','true');img.width=size;img.height=size;img.draggable=false;img.loading='lazy';img.decoding='async';
  img.src='/rewards/printshop/'+printKey+'.svg?v=3';wrap.appendChild(img);
 }
 return wrap;
}
global.PropletRibbonArt=Object.freeze({art,identity});
})(window);
