/* Proplet ribbon presentation. Reward identities and predicates stay in app.js. */
(function(global){
'use strict';
document.documentElement.classList.add('ribbon-ui');
const catalog=global.PropletRibbonCatalog||{};
function identity(label,category){
 const name=String(label||'').replace(/^Nový odznak · /,'').replace(/^\d+[. ·–-]*\s*/, '').trim();
 if(category)return {name,key:catalog[category]?.[name]};
 const matches=Object.values(catalog).map(f=>f[name]).filter(Boolean);
 return {name,key:matches.length===1?matches[0]:null};
}
function art(label,{locked=false,size=40,category}={}){
 const found=identity(label,category),name=found.name;let key=found.key;
 if(!key)return null;if(locked&&key==='prvni-proplet')key='zamceno';
 const wrap=document.createElement('span');wrap.className='ribbon-art'+(locked?' is-locked':'');wrap.dataset.ribbon=key;wrap.setAttribute('role','img');wrap.setAttribute('aria-label',name+(locked?', zamčeno':''));
 for(const theme of ['light','dark']){
  const img=document.createElement('img');img.className='ribbon-'+theme;img.alt='';img.setAttribute('aria-hidden','true');img.width=size;img.height=size;img.draggable=false;img.loading='lazy';img.decoding='async';
  img.src='/rewards/ribbons/'+theme+'/'+key+'-'+(size<=32?'small':'regular')+'.svg?v=5';wrap.appendChild(img);
 }
 return wrap;
}
global.PropletRibbonArt=Object.freeze({art,identity});
})(window);
