/* Called from app.js with explicit dependencies; no preview profiles or test shortcuts. */
(function(root){'use strict';
root.PropletFreeOrderUI={mount({store,progress,labels,change}){
 if(!store.enabled())return;
 for(const diff of ['easy','medium','hard','hardcore']){
  const card=document.querySelector('#difficultyCards .cp-card[data-diff="'+diff+'"]');if(!card)continue;
  const r=store.record(diff),q=progress(diff),node=document.createElement('div');node.className='order-controls';
  node.innerHTML='<div class="order-switch" role="group" aria-label="Pořadí: '+labels[diff].label+'"><button type="button" data-order-mode="varied" aria-pressed="'+(r.mode==='varied')+'">Pestře</button><button type="button" data-order-mode="numeric" aria-pressed="'+(r.mode==='numeric')+'">Podle čísel</button></div>';
  if(!r.offered){const hint=document.createElement('p');hint.className='order-hint';hint.textContent='Pestře střídá nové a starší desky.';node.append(hint)}
  const next=q.resume||q.nextUnsolved,summary=document.createElement('small');summary.className='order-next';summary.textContent='Vyřešeno '+q.done+' z '+q.total+(next?' · '+(q.resume?'Rozehráno':'Další')+': č. '+next.meta.level:' · Všechno hotovo');node.append(summary);card.append(node);
  for(const button of node.querySelectorAll('[data-order-mode]'))button.onclick=e=>{e.stopPropagation();button.disabled=true;change(diff,button.dataset.orderMode).finally(()=>button.disabled=false)};
 }
}};
})(typeof globalThis!=='undefined'?globalThis:this);
