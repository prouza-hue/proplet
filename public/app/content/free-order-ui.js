/* Called from app.js with explicit dependencies; no preview profiles or test shortcuts. */
(function(root){'use strict';
root.PropletFreeOrderUI={mount({store,progress,labels,change}){
 if(!store.enabled())return;
 for(const diff of ['easy','medium']){
  const card=document.querySelector('#difficultyCards .cp-card[data-diff="'+diff+'"]');if(!card)continue;
  const r=store.record(diff),q=progress(diff),node=document.createElement('div');node.className='order-controls';
  if(!r.offered)node.innerHTML='<strong>Zkus pestřejší pořadí</strong><p>Novější desky mezi těmi zbývajícími. Tvůj postup zůstane.</p><div class="order-actions"><button type="button" class="order-optin" data-order-mode="varied">Zapnout</button><button type="button" class="order-later" data-order-mode="numeric">Zatím ne</button></div>';
  else node.innerHTML='<div class="order-switch" role="group" aria-label="Pořadí: '+labels[diff].label+'"><button type="button" data-order-mode="varied" aria-pressed="'+(r.mode==='varied')+'">Pestře</button><button type="button" data-order-mode="numeric" aria-pressed="'+(r.mode==='numeric')+'">Podle čísel</button></div>';
  const next=q.resume||q.nextUnsolved,summary=document.createElement('small');summary.className='order-next';summary.textContent='Vyřešeno '+q.done+' z '+q.total+(next?' · '+(q.resume?'Rozehráno':'Další')+': č. '+next.meta.level:' · Všechno hotovo');node.append(summary);card.append(node);
  for(const button of node.querySelectorAll('[data-order-mode]'))button.onclick=e=>{e.stopPropagation();button.disabled=true;change(diff,button.dataset.orderMode).finally(()=>button.disabled=false)};
 }
}};
})(typeof globalThis!=='undefined'?globalThis:this);
