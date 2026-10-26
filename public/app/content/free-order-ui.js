/* The play card answers only: which board is next? Ordering belongs in Settings. */
(function(root){'use strict';
root.PropletFreeOrderUI={mount({store,progress,labels}){
 if(!store.enabled())return;
 for(const diff of Object.keys(labels)){
  const card=document.querySelector('#difficultyCards .cp-card[data-diff="'+diff+'"]');if(!card)continue;
  const play=card.querySelector('.cp-play');if(!play)continue;
  const q=progress(diff),next=q.resume||q.nextUnsolved,row=document.createElement('div');row.className='cp-action-row';
  const summary=document.createElement('p');summary.className='order-next';
  const label=document.createElement('span');label.textContent=next?(q.resume?'Rozehráno: ':'Další: '):'Všechno hotovo. ';
  const value=document.createElement('strong');value.textContent=next?'úroveň '+next.meta.level:'Můžeš si zahrát znovu';
  summary.append(label,value);row.append(summary,play);card.append(row);
 }
}};
})(typeof globalThis!=='undefined'?globalThis:this);
