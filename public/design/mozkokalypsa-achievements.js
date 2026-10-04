'use strict';
const series=[
 [1,'První trhlina','První deska. První puklina v nemožném.'],
 [5,'Za bodem zlomu','Pětkrát dovnitř. Pětkrát ven.'],
 [10,'Oko bouře','Kolem zuří chaos. Ty vidíš cestu.'],
 [25,'Krotitel pohromy','I pohroma se dá rozplést.'],
 [50,'Nezlomná mysl','Padesát desek. Hlava stále drží.'],
 [75,'Vládce epicentra','Uprostřed největšího zmatku máš jasno.'],
 [100,'Poslední slovo','Mozkokalypsa skončila. Poslední slovo máš ty.']
];
const gallery=document.querySelector('#gallery'),progress=document.querySelector('#progress');let selected=100;
const asset=n=>'/rewards/printshop/achievement-mozkokalypsa-'+n+'.svg';
function detail(n){selected=n;const [target,name,copy]=series.find(x=>x[0]===n);document.querySelector('#detail').innerHTML=`<img src="${asset(n)}" alt="${name}" width="170" height="170"><div><h2>${name}</h2><p>${copy}</p><p>Za ${target} ${target===1?'dokončenou desku':'různých dokončených desek'} Mozkokalypsy.</p><div class="sizes" aria-label="Skutečné velikosti ve hře">${[24,34,58].map(size=>`<span><img src="${asset(n)}" width="${size}" height="${size}" alt="">${size} px</span>`).join('')}</div></div>`;for(const b of gallery.children)b.setAttribute('aria-pressed',String(Number(b.dataset.target)===n));}
function render(){const count=Number(progress.value);document.querySelector('#count').value=count;gallery.innerHTML=series.map(([n,name])=>`<button class="badge ${count<n?'locked':''}" type="button" data-target="${n}" aria-pressed="${selected===n}"><img src="${asset(n)}" width="168" height="168" alt=""><h2>${name}</h2><span class="milestone">${n} ${n===1?'deska':n<5?'desky':'desek'}</span><span class="track" aria-hidden="true"><span style="width:${Math.min(100,count/n*100)}%"></span></span><span class="state">${count>=n?'Splněno ✓':Math.min(count,n)+' / '+n}</span></button>`).join('');}
gallery.addEventListener('click',e=>{const b=e.target.closest('[data-target]');if(b)detail(Number(b.dataset.target))});progress.addEventListener('input',render);document.querySelector('#theme').addEventListener('click',e=>{const dark=document.body.classList.toggle('dark');e.currentTarget.textContent=dark?'Světlý režim':'Tmavý režim'});render();detail(selected);
