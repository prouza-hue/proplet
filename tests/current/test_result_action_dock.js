const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
// Exercise the existing result owner with real native node/handler identities.
class Node{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.classes=new Set();this.dataset={};this.attributes={};this.hidden=false;this._text='';this.classList={contains:n=>this.classes.has(n),add:n=>this.classes.add(n),remove:n=>this.classes.delete(n),toggle:(n,v)=>v?this.classes.add(n):this.classes.delete(n)}}
 get className(){return [...this.classes].join(' ')}set className(v){this.classes=new Set(v.split(/\s+/).filter(Boolean))}
 get textContent(){return this._text+this.children.map(n=>n.textContent).join('')}set textContent(v){this.children.forEach(n=>n.parentElement=null);this.children=[];this._text=String(v)}
 get childNodes(){return this.children}get firstElementChild(){return this.children[0]||null}
 get nextElementSibling(){const a=this.parentElement?.children||[];return a[a.indexOf(this)+1]||null}
 appendChild(n){n.remove();n.parentElement=this;this.children.push(n);return n}
 append(...ns){ns.forEach(n=>this.appendChild(n))}prepend(n){n.remove();n.parentElement=this;this.children.unshift(n)}
 replaceChildren(...ns){this.textContent='';this.append(...ns)}
 remove(){if(this.parentElement){const p=this.parentElement;p.children.splice(p.children.indexOf(this),1);this.parentElement=null}}
 insertBefore(n,ref){if(n===ref)return;if(ref)assert.equal(ref.parentElement,this);n.remove();n.parentElement=this;const i=ref?this.children.indexOf(ref):this.children.length;this.children.splice(i,0,n)}
 before(n){this.parentElement.insertBefore(n,this)}after(n){this.parentElement.insertBefore(n,this.nextElementSibling)}
 setAttribute(k,v){this.attributes[k]=String(v)}getAttribute(k){return this.attributes[k]??null}hasAttribute(k){return Object.hasOwn(this.attributes,k)}removeAttribute(k){delete this.attributes[k]}
 querySelector(sel){const raw=sel.replace(':scope > ',''),key=raw.slice(1),direct=sel.startsWith(':scope'),match=n=>raw[0]==='#'?n.id===key:raw[0]==='.'?n.classes.has(key):n.tagName.toLowerCase()===raw;return this.children.find(match)||(!direct?this.children.map(n=>n.querySelector(sel)).find(Boolean):null)}
}
const make=(tag,id,cls='',text='')=>{const n=new Node(tag);n.id=id;n.className=cls;n.textContent=text;return n};
const modal=make('div','winModal'),card=make('div',null,'win-card');modal.append(card);
const title=make('h2','winTitle','','Hotovo'),xp=make('div','winXp'),chips=make('div',null,'win-summary-chips'),summary=make('div',null,'win-summary');
const performance=make('p','winText','','2:34 · 7 tahů · Střední'),clean=make('div','winClean','','2 nápovědy');summary.append(performance,chips);chips.append(xp,clean);
const extra=make('button','winExtraBtn','hidden','Hraj Extra'),primary=make('button','winPrimaryBtn','primary-btn','Hraj další úroveň'),ranking=make('div','levelLeaderboardBox','','Pořadí se nepodařilo načíst'),secondary=make('div',null,'win-secondary-actions'),share=make('button','winShareBtn'),menu=make('button','winMenuBtn'),details=make('details','winDetails'),badge=make('div','newBadgeBox','','Skutečně získaný úspěch');
card.append(title,summary,extra,primary,ranking,secondary,badge,details);secondary.append(share,menu);
const calls=[];const nativeContinue=()=>calls.push('canonical continue'),nativeShare=()=>calls.push('canonical share');primary.onclick=nativeContinue;share.onclick=nativeShare;extra.onclick=()=>calls.push('canonical Extra');
const source=fs.readFileSync('public/challenge-cta-v3333.js','utf8');
const ctx={$:s=>s==='#winModal'?modal:modal.querySelector(s),document:{createElement:tag=>new Node(tag)},currentGame:{mode:'free',finished:true,puzzle:{meta:{}}},tajenkaRecapOpen:false,closeWinToMenu:()=>calls.push('canonical menu')};
vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('  const primaryHandlers='),source.indexOf('  function boot(){')),ctx);
function setXp(value,detail){if(detail){const strong=make('strong',null,'',value),small=make('small',null,'',detail);xp.replaceChildren(strong,small)}else xp.textContent=value}
function checkLayout(){
 const header=modal.querySelector('.win-result-heading'),actions=modal.querySelector('#winResultActions');assert(header&&actions);
 assert.equal(header.nextElementSibling,summary,'own performance precedes all optional rankings');
 assert.equal(actions.nextElementSibling,secondary);assert.equal(secondary.nextElementSibling,ranking,'main/utility actions never wait below ranking');
 assert.equal(share.parentElement,secondary);assert.equal(xp.parentElement,chips,'canonical economic output stays in its native summary');assert.equal(badge.parentElement,card,'earned awards are retained');
 assert.equal(performance.textContent,'2:34 · 7 tahů · Střední');assert.equal(clean.textContent,'2 nápovědy');
 assert.equal(ranking.textContent,'Pořadí se nepodařilo načíst','presentation does not invent or replace ranking data');
 return actions;
}
setXp('+103 XP','100 základ · +3 bonus');ctx.syncShareCtas();const actions=checkLayout();
assert.equal(primary.parentElement,actions);assert.equal(primary.onclick,nativeContinue);assert.equal(share.onclick,nativeShare);
assert.equal(modal.querySelector('#winRewardValue').textContent,'+103 XP');assert.equal(modal.querySelector('#winRewardStatus').textContent,'100 základ · +3 bonus');assert.equal(xp.textContent,'+103 XP100 základ · +3 bonus','presentation never rewrites the reward source');
assert.equal(share.textContent,'Sdílet výsledek');assert(!share.classList.contains('challenge-share-cta'));primary.onclick();share.onclick();assert.deepEqual(calls,['canonical continue','canonical share']);
ctx.syncShareCtas();assert.equal(checkLayout(),actions,'repeated paint preserves wrappers and native callbacks');

ctx.currentGame={mode:'daily',finished:true};extra.classes.delete('hidden');ctx.syncShareCtas();checkLayout();
assert.equal(extra.parentElement,actions);assert.equal(primary.parentElement,secondary);assert(primary.classList.contains('result-secondary-action'));assert.equal(primary.textContent,'Zpět na Dnes');assert.equal(menu.hidden,true);
extra.onclick();primary.onclick();assert.deepEqual(calls.slice(-2),['canonical Extra','canonical menu']);
extra.classes.add('hidden');ctx.syncShareCtas();assert.equal(primary.parentElement,actions);assert(!primary.classList.contains('result-secondary-action'));
ctx.currentGame={mode:'daily_special',finished:true};ctx.syncShareCtas();assert.equal(primary.onclick,nativeContinue,'Extra retains its canonical return route');assert.equal(primary.textContent,'Zpět na Dnes');
ctx.currentGame={mode:'free',finished:true,puzzle:{meta:{archiveExperience:true}}};primary.textContent='Další archivní deska';setXp('XP','Ověřujeme');ctx.syncShareCtas();checkLayout();
assert.equal(primary.onclick,nativeContinue,'Archive keeps canonical continuation');assert.equal(primary.textContent,'Další archivní deska');assert.equal(menu.hidden,false);assert.equal(modal.querySelector('#winRewardValue').hidden,true);assert.equal(modal.querySelector('#winRewardStatus').textContent,'Odměnu ověřujeme.');
setXp('+15 XP');ctx.syncShareCtas();assert.equal(modal.querySelector('#winRewardValue').textContent,'+15 XP');assert.equal(modal.querySelector('#winRewardStatus').hidden,true,'server-confirmed amount replaces pending presentation');
setXp('Tréninkový pokus · 200 XP už máš');ctx.syncShareCtas();assert.equal(modal.querySelector('#winRewardValue').hidden,true);assert.match(modal.querySelector('#winRewardStatus').textContent,/200 XP už máš/);
setXp('+2 XP','+2 bonusová slova');ctx.syncShareCtas();assert.equal(modal.querySelector('#winRewardValue').textContent,'+2 XP','replay bonus is not discarded or replaced by a guessed base reward');
setXp('+200 XP · jednou za tuto Tajenku');ctx.currentGame={mode:'tajenka',finished:true};ctx.syncShareCtas();assert.equal(modal.querySelector('#winRewardValue').textContent,'+200 XP');assert.equal(modal.querySelector('#winRewardStatus').textContent,'jednou za tuto Tajenku');
ctx.tajenkaRecapOpen=true;primary.textContent='Zavřít';ctx.syncShareCtas();assert.equal(primary.textContent,'Zavřít');assert.equal(primary.onclick,nativeContinue,'saved recap uses its canonical close handling');ctx.tajenkaRecapOpen=false;

// A protected onboarding owner may replace its callback while the result is open.
ctx.currentGame={mode:'daily',finished:true};ctx.syncShareCtas();const training=()=>calls.push('assigned first game');primary.onclick=training;modal.classes.add('first-steps-win');primary.classes.add('hidden');ctx.syncShareCtas();
assert.equal(primary.onclick,training);assert(primary.classList.contains('hidden'));assert.equal(title.parentElement,card);assert.equal(xp.parentElement,chips);assert.equal(modal.querySelector('#winRewardValue'),undefined);assert(!modal.querySelector('#winResultActions'));
modal.classes.delete('first-steps-win');modal.classes.add('starter-win');ctx.currentGame={mode:'starter'};ctx.syncShareCtas();assert.equal(primary.onclick,training);assert.equal(share.parentElement,secondary);
modal.classes.delete('starter-win');primary.classes.delete('hidden');primary.onclick=nativeContinue;ctx.currentGame={mode:'free',postStarterWarmup:true};ctx.syncShareCtas();assert.equal(primary.onclick,nativeContinue,'post-training choice keeps its canonical handler');

ctx.window={PropletReferrals:{model:{ready:true,incoming:false,paid:false},profile:()=>({id:'member'})}};ctx.currentGame={mode:'free',finished:true};ctx.syncShareCtas();
assert.equal(share.textContent,'Pozvat kamaráda');assert(share.classList.contains('challenge-share-cta'));assert.equal(share.onclick,nativeShare,'eligible chooser must not replace canonical sharing callback');
ctx.window.PropletReferrals.profile=()=>null;ctx.syncShareCtas();assert.equal(share.textContent,'Sdílet výsledek');assert(!share.classList.contains('challenge-share-cta'));
console.log('PASS result hierarchy: fallback metrics, true rewards, primary placement, eligible invitation entry, guest sharing and protected first steps');
