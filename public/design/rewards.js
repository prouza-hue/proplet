'use strict';
const grid=document.querySelector('#grid'),family=document.querySelector('#family'),locked=document.querySelector('#locked');
function render(){grid.replaceChildren();for(const name of Object.keys(window.PropletRibbonCatalog[family.value])){
 const card=document.createElement('article');card.className='reward';
 const hero=document.createElement('div');hero.className='specimen';const art=window.PropletRibbonArt.art(name,{category:family.value,size:80,locked:locked.checked});art.style.width='80px';art.style.height='80px';hero.append(art);card.append(hero);
 const title=document.createElement('h3');title.textContent=name;card.append(title);const sizes=document.createElement('div');sizes.className='sizes';
 for(const size of [24,32,40,64]){const col=document.createElement('span');const icon=window.PropletRibbonArt.art(name,{category:family.value,size,locked:locked.checked});icon.style.width=size+'px';icon.style.height=size+'px';col.append(icon,document.createTextNode(String(size)));sizes.append(col)}
 card.append(sizes);grid.append(card);
}}
family.onchange=render;locked.onchange=render;document.querySelector('#theme').onclick=e=>{const dark=document.documentElement.dataset.theme!=='dark';document.documentElement.dataset.theme=dark?'dark':'light';document.body.classList.toggle('dark',dark);e.target.textContent=dark?'Světlý režim':'Tmavý režim'};
render();
