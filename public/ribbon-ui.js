/* Approved Proplet ribbon pilot. Presentation only; no reward predicates or economy. */
(function(global){
'use strict';
document.documentElement.classList.add('ribbon-ui');
const byName={ 'Nováček':'novacek','Slovní alchymista':'alchymista','Legenda beze konce':'legenda','První Proplet':'prvni-proplet','Mozkomorova Nemesis':'nemesis','Týden v plamenech':'tyden','Zlatá medaile':'medaile' };
function art(label,{locked=false,size=40}={}){
 const name=String(label||'').replace(/^Nový odznak · /,'').replace(/^\d+[. ·–-]*\s*/, '').trim();
 let key=byName[name];if(!key)return null;if(locked&&key==='prvni-proplet')key='zamceno';
 const wrap=document.createElement('span');wrap.className='ribbon-art'+(locked?' is-locked':'');wrap.dataset.ribbon=key;wrap.setAttribute('role','img');wrap.setAttribute('aria-label',name+(locked?', zamčeno':''));
 for(const theme of ['light','dark']){
  const img=document.createElement('img');img.className='ribbon-'+theme;img.alt='';img.setAttribute('aria-hidden','true');img.width=size;img.height=size;img.draggable=false;
  img.src='/rewards/ribbons/'+theme+'/'+key+'-'+(size<=32?'small':'regular')+'.svg';wrap.appendChild(img);
 }
 return wrap;
}
global.PropletRibbonArt=Object.freeze({art});
})(window);
