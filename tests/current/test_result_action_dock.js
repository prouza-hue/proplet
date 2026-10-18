const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
// Characterize approved inline results while preserving actual native nodes.
class Node{
 constructor(name){this.name=name;this.children=[];this.className='';this.classes=new Set();this.classList={contains:n=>this.classes.has(n),toggle:(n,v)=>v?this.classes.add(n):this.classes.delete(n)}}
 get childNodes(){return this.children}
 get nextElementSibling(){const a=this.parentElement?.children||[];return a[a.indexOf(this)+1]||null}
 appendChild(n){n.remove();n.parentElement=this;this.children.push(n);return n}
 append(...ns){ns.forEach(n=>this.appendChild(n))}
 prepend(n){n.remove();n.parentElement=this;this.children.unshift(n)}
 remove(){if(this.parentElement){const p=this.parentElement;p.children.splice(p.children.indexOf(this),1);this.parentElement=null}}
 insertBefore(n,ref){if(n===ref)return;n.remove();n.parentElement=this;const i=ref?this.children.indexOf(ref):this.children.length;this.children.splice(i,0,n)}
 before(n){this.parentElement.insertBefore(n,this)}
 after(n){this.parentElement.insertBefore(n,this.nextElementSibling)}
 querySelector(sel){const raw=sel.replace(':scope > ',''),key=raw.slice(1),direct=sel.startsWith(':scope');return this.children.find(n=>raw[0]==='#'?n.id===key:n.className===key)||(!direct?this.children.map(n=>n.querySelector(sel)).find(Boolean):null)}
}
const modal=new Node('modal'),card=new Node('card');card.className='win-card';modal.append(card);
const title=new Node('title'),xp=new Node('xp'),chips=new Node('chips'),summary=new Node('summary');
chips.className='win-summary-chips';summary.className='win-summary';summary.append(chips);chips.append(xp);
const extra=new Node('extra'),primary=new Node('primary'),ranking=new Node('ranking'),secondary=new Node('secondary'),share=new Node('share'),details=new Node('details'),badge=new Node('earned badge');
secondary.className='win-secondary-actions';card.append(title,summary,primary,ranking,secondary,badge,details);secondary.append(share);
let mobile=true,clicks=0;primary.onclick=()=>clicks++;share.onclick=()=>clicks+=10;
const source=fs.readFileSync('public/challenge-cta-v3333.js','utf8');
const ctx={$:s=>({'#winModal':modal,'#winExtraBtn':extra,'#winPrimaryBtn':primary,'#winTitle':title,'#winXp':xp,'#levelLeaderboardBox':ranking}[s]||modal.querySelector(s)),document:{createElement:()=>new Node('wrapper')},window:{matchMedia:()=>({matches:mobile})},setClass:(n,k,v)=>n.classList.toggle(k,v)};
vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('  function syncWinLayout('),source.indexOf('  function setChallengeContent(')),ctx);
function inline(){const actions=modal.querySelector('#winResultActions');assert(actions);assert.equal(ranking.nextElementSibling,actions);assert.equal(primary.parentElement,actions);assert.equal(extra.parentElement,actions);assert.equal(extra.nextElementSibling,primary);assert.equal(primary.nextElementSibling,share);assert.equal(title.parentElement.className,'win-result-heading');assert.equal(xp.parentElement,title.parentElement);assert(xp.classList.contains('xp-sticker'));assert.equal(badge.parentElement,card);assert(!card.querySelector('.win-result-footer'));assert(!card.querySelector('.win-result-scroll'));return actions}
ctx.syncWinLayout(share);const actions=inline();ctx.syncWinLayout(share);assert.equal(inline(),actions,'idempotent wrapper preserves nodes');primary.onclick();share.onclick();assert.equal(clicks,11);
mobile=false;ctx.syncWinLayout(share);assert.equal(inline(),actions,'desktop has same inline action order');
const scroll=new Node('legacy scroll'),footer=new Node('legacy footer');scroll.className='win-result-scroll';footer.className='win-result-footer';card.append(scroll,footer);scroll.append(ranking,badge);footer.append(primary);ctx.syncWinLayout(share);inline();assert.equal(badge.parentElement,card,'legacy dock migration must preserve achievements');
modal.classes.add('starter-win');ctx.syncWinLayout(share);assert.equal(summary.nextElementSibling,primary);assert.equal(share.parentElement,secondary);assert.equal(xp.parentElement,chips);assert.equal(title.parentElement,card);assert(!xp.classList.contains('xp-sticker'));assert(!modal.querySelector('#winResultActions'));
modal.classes.delete('starter-win');ctx.syncWinLayout(share);inline();primary.classes.add('hidden');ctx.syncWinLayout(share);inline();assert(primary.classList.contains('hidden'),'layout must preserve native visibility');
console.log('PASS inline result actions: same mobile/desktop order, native nodes/handlers, idempotency, achievements, training and native visibility');
