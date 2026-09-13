(()=>{
'use strict';
const {old,levels}=window.RANK_PROGRESSION_PREVIEW,fmt=n=>Number(n).toLocaleString('cs-CZ');
const levelAt=(rows,xp)=>rows.reduce((found,row,i)=>xp>=row.xp?{row,index:i}:found,{row:rows[0],index:0});
const roadmap=document.querySelector('#roadmap');
roadmap.innerHTML=levels.map((row,i)=>{
 const previous=old.find(x=>x.xp===row.xp),phase=i===0||row.phase!==levels[i-1].phase?`<h3 class="phase">${row.phase}</h3>`:'';
 return `${phase}<div class="rank-row ${previous?'':'inserted'}" data-index="${i}"><span class="number">${i+1}.</span><img src="/rewards/printshop/${row.key}.svg?v=rankprogress1" alt="" width="48" height="48" loading="lazy"><div><strong>${row.name}</strong><small>${previous?`Dříve: ${previous.name}`:'Nový mezistupeň'}</small></div><div class="xp">${fmt(row.xp)} XP<small>${i?'+'+fmt(row.xp-levels[i-1].xp)+' od předchozí':'Začátek'}</small></div></div>`;
}).join('');
const maxGap=rows=>Math.max(...rows.slice(1).map((x,i)=>x.xp-rows[i].xp));
document.querySelector('#gaps').innerHTML=[['Dříve',old,'old'],['Nově',levels,'new']].map(([name,rows,style])=>`<div class="gap-row"><b>${name}</b><div><div class="bar ${style}" style="width:${maxGap(rows)/25000*100}%">${fmt(maxGap(rows))} XP</div></div></div>`).join('');
const input=document.querySelector('#points');
function render(){
 const xp=Math.max(0,Math.min(1000000,Number(input.value)||0));
 document.querySelector('#comparison').innerHTML=[['Původní cesta',old,'old'],['Nová cesta',levels,'new']].map(([title,rows,style])=>{
  const {row,index}=levelAt(rows,xp),next=rows[index+1];
  return `<div class="compare-card ${style}"><h3>${title} · hodnost ${index+1}</h3><strong>${row.name}</strong><p>${fmt(xp)} XP celkem</p><p>${next?`Do další hodnosti <b>${fmt(next.xp-xp)} XP</b><br>${next.name}`:'Nejvyšší hodnost dosažena'}</p></div>`;
 }).join('');
 const current=levelAt(levels,xp).index;
 roadmap.querySelectorAll('.rank-row').forEach(row=>row.classList.toggle('current',Number(row.dataset.index)===current));
}
input.addEventListener('input',render);
document.querySelectorAll('[data-xp]').forEach(button=>button.addEventListener('click',()=>{input.value=button.dataset.xp;render()}));
render();
})();
