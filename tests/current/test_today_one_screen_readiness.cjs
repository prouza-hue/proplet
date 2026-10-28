'use strict';
// Exercise the real presentation adapter without a browser, API or player data.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class Element{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attrs={};this.hidden=false;this.disabled=false;this.inert=false;this.className='';this._text='';
  this.classList={contains:n=>this.className.split(/\s+/).includes(n),add:(...ns)=>{for(const n of ns)if(!this.classList.contains(n))this.className+=' '+n;},toggle:(n,v)=>{this.className=this.className.split(/\s+/).filter(x=>x&&x!==n).concat(v?[n]:[]).join(' ');}};
  const styles=new Map();this.style={setProperty:(k,v,p)=>styles.set(k,[v,p]),removeProperty:k=>styles.delete(k),getPropertyValue:k=>styles.get(k)?.[0]||'',getPropertyPriority:k=>styles.get(k)?.[1]||''};
 }
 get textContent(){return this._text+this.children.map(e=>e.textContent).join('');}
 set textContent(v){this._text=String(v);this.children.forEach(c=>c.parentElement=null);this.children=[];}
 get isConnected(){return !!this.parentElement;}
 append(...nodes){for(const n of nodes){n.remove();n.parentElement=this;this.children.push(n);}}
 remove(){if(this.parentElement){const a=this.parentElement.children;a.splice(a.indexOf(this),1);this.parentElement=null;}}
 replaceChildren(...nodes){this.textContent='';this.append(...nodes);}
 insertBefore(node,anchor){node.remove();node.parentElement=this;const i=this.children.indexOf(anchor);if(i<0)this.children.push(node);else this.children.splice(i,0,node);}
 setAttribute(k,v){this.attrs[k]=String(v);}
 getAttribute(k){return this.attrs[k]??null;}
 matches(s){return s==='button'?this.tagName==='BUTTON':s.startsWith('#')?this.id===s.slice(1):s.startsWith('.')?this.classList.contains(s.slice(1)):false;}
 closest(s){if(s==='[inert],[aria-busy="true"]'){for(let e=this;e;e=e.parentElement)if(e.inert||e.attrs['aria-busy']==='true')return e;return null;}for(let e=this;e;e=e.parentElement)if(e.matches(s))return e;return null;}
 querySelector(s){for(const e of this.children){if(e.matches(s))return e;const nested=e.querySelector(s);if(nested)return nested;}return null;}
 click(){if(!this.disabled)this.onclick?.();}
}
const body=new Element('body'),screen=new Element(),hero=new Element(),play=new Element('button'),notice=new Element(),retry=new Element('button'),extra=new Element(),extraAction=new Element('button');
screen.id='screen-daily';hero.className='daily-hero';hero.dataset.studioState='before';play.id='playDailyBtn';play.textContent='Hrát Denní výzvu';notice.className='account-progress-status';notice.id='nativeNotice';notice._text='Postup se nepodařilo načíst. ';retry.textContent='Zkusit znovu';notice.append(retry);extra.id='studioExtraCard';extra.append(extraAction);extraAction.textContent='Hrát Extra';hero.append(play);screen.append(hero,notice,extra);body.append(screen);
const title=new Element('h2');title.textContent='Denní výzva';const meta=new Element();meta.textContent='Střední';const art=new Element('img');art.attrs.src='/daily.svg';
const selectors=new Map([['#screen-daily',screen],['#screen-daily .daily-hero',hero],['#playDailyBtn',play],['#dailyHeroTitle',title],['#dailyMeta',meta],['#studioDailyArt',art],['#screen-daily .account-progress-status',notice],['#studioExtraCard',extra],['#studioExtraCard>button',extraAction]]);
const listeners={},frames=[],observers=[];
const document={body,documentElement:new Element('html'),readyState:'loading',createElement:t=>new Element(t),querySelector:s=>selectors.get(s)||body.querySelector(s),querySelectorAll:()=>[],addEventListener:(n,f)=>listeners[n]=f};
const context={document,window:{addEventListener(){}},MutationObserver:class{constructor(callback){this.callback=callback;this.targets=[];observers.push(this);}observe(target){this.targets.push(target);}},requestAnimationFrame:f=>{frames.push(f);return frames.length;},getComputedStyle:()=>({getPropertyValue:()=>''}),Map,JSON,console};
vm.runInNewContext(fs.readFileSync(require.resolve('../../public/today-one-screen.js'),'utf8'),context);
const flushFrames=()=>{let n=0;while(frames.length){assert(++n<5,'must settle');frames.shift()();}};
const repaint=()=>{listeners['proplet:screen-changed']();flushFrames();};
const rendered=key=>{const all=[];function visit(e){all.push(e);e.children.forEach(visit);}visit(screen);return all.find(e=>e.dataset.osKey===key);};
let played=0,extraPlayed=0,retried=0;play.onclick=()=>played++;extraAction.onclick=()=>extraPlayed++;retry.onclick=()=>retried++;
body.classList.add('account-progress-pending');hero.inert=true;hero.setAttribute('aria-busy','true');listeners['proplet:ready']();repaint();
assert(rendered('feature').disabled,'hydration blocks the presented Daily action');
assert(rendered('extra').disabled,'hydration blocks Extra even when its old card has no inert flag');
assert.equal(notice.parentElement.className,'os-notices','native retry notice remains visible in the new view');
assert.equal(notice.style.getPropertyValue('display'),'');assert.equal(notice.parentElement.hidden,false);
rendered('feature').click();rendered('extra').click();assert.equal(played+extraPlayed,0);retry.click();assert.equal(retried,1,'original retry handler survives relocation');
body.classList.toggle('account-progress-pending',false);hero.inert=false;hero.setAttribute('aria-busy','false');notice.hidden=true;repaint();
assert.equal(rendered('feature').disabled,false);assert.equal(rendered('extra').disabled,false);assert.equal(notice.parentElement.hidden,true);
rendered('feature').click();rendered('extra').click();assert.equal(played,1);assert.equal(extraPlayed,1);
// A control can become unavailable before the next animation frame paints.
extraAction.disabled=true;rendered('extra').click();assert.equal(extraPlayed,1);repaint();assert(rendered('extra').disabled);
extraAction.disabled=false;repaint();body.classList.add('account-progress-pending');rendered('extra').click();assert.equal(extraPlayed,1);
// Authentication-required recovery uses the very same node and updated handler.
notice.hidden=false;retry.textContent='Přihlásit se';retry.onclick=()=>retried+=10;repaint();retry.click();assert.equal(retried,11);assert(rendered('feature').disabled);
// Cached progress remains playable when a later background refresh fails. Only
// the relocated native notice changes; there is no body-state or navigation event.
body.classList.toggle('account-progress-pending',false);notice.hidden=true;repaint();
const noticeParent=notice.parentElement,screenObserver=observers.find(o=>o.targets.includes(screen));
assert(screenObserver);assert.equal(noticeParent.hidden,true);assert.equal(frames.length,0);
let backgroundRetries=0;retry.textContent='Zkusit znovu';retry.onclick=()=>backgroundRetries++;
notice.hidden=false;screenObserver.callback([{type:'attributes',attributeName:'hidden',target:notice}]);
assert.equal(frames.length,1,'native hidden-to-visible transition must schedule without navigation');
flushFrames();assert.equal(notice.parentElement,noticeParent);assert.equal(noticeParent.hidden,false);
assert.equal(rendered('feature').disabled,false,'cached progress stays playable');
retry.click();assert.equal(backgroundRetries,1,'canonical background retry listener survives');
screenObserver.callback([{type:'characterData',target:{nodeType:3,parentElement:notice}}]);
assert.equal(frames.length,1,'native notice text mutations remain observed');flushFrames();
screenObserver.callback([{type:'childList',target:rendered('feature')}]);
assert.equal(frames.length,0,'presentation-only mutations must not create a repaint loop');
// Choosing Extra first must not strand the unfinished base Daily. Its visible
// proxy must select the canonical base mode before using the canonical action.
const dailyCalls=[];
context.dailySpecialUI=()=>({select(kind){dailyCalls.push('select:'+kind);hero.classList.toggle('daily-special-selected',false);play.textContent='Hrát Denní výzvu';}});
play.onclick=()=>{assert(!hero.classList.contains('daily-special-selected'));dailyCalls.push('play-base');};
hero.classList.add('daily-special-selected');title.textContent='Extra výzva';play.textContent='Hrát Mozkožrouta';extra.hidden=true;repaint();
assert(rendered('daily-base'),'unfinished Daily remains reachable after selecting Extra');
assert.equal(rendered('daily-base').disabled,false);rendered('daily-base').click();
assert.deepEqual(dailyCalls,['select:base','play-base'],'selection must precede the native play action');
dailyCalls.length=0;hero.classList.add('daily-special-selected');body.classList.add('account-progress-pending');repaint();
assert(rendered('daily-base').disabled);rendered('daily-base').click();rendered('daily-base').onclick();
assert.deepEqual(dailyCalls,[],'blocked progress permits neither base selection nor gameplay');
body.classList.toggle('account-progress-pending',false);repaint();
body.classList.add('account-progress-pending');rendered('daily-base').click();
assert.deepEqual(dailyCalls,[],'click-time readiness is checked before changing selected mode');
body.classList.toggle('account-progress-pending',false);play.textContent='Zobrazit výsledek speciálu';
const difficulty=new Element('span'),completed=new Element('span');difficulty.textContent='Mozkožrout';completed.textContent='✓ Hotovo';meta.replaceChildren(difficulty,completed);repaint();
assert.equal(rendered('feature').querySelector('.os-arrow').textContent,'Výsledek →','finished Extra uses a result action, not Play');
assert.match(rendered('feature').querySelector('.os-detail').textContent,/Mozkožrout.*Hotovo/);
assert.match(rendered('feature').getAttribute('aria-label'),/Hotovo.*Zobrazit výsledek/);
// The completed card retains one readable performance string and its native result action.
hero.classList.toggle('daily-special-selected',false);hero.dataset.studioState='complete';title.textContent='Denní výzva';
const dailyResult=new Element(),metrics=new Element('span'),resultButton=new Element('button');
metrics.className='studio-result-metrics';metrics.textContent='0:19 · 8 tahů';dailyResult.append(metrics,resultButton);screen.append(dailyResult);
selectors.set('#studioDailyResult',dailyResult);selectors.set('#studioDailyResult button',resultButton);
let openedResult=0;resultButton.onclick=()=>openedResult++;const playsBeforeResult=played;repaint();
assert.equal(rendered('feature').querySelector('.os-detail').textContent,'✓ Hotovo');
assert.equal(rendered('feature').querySelector('.os-metrics').textContent,'0:19 · 8 tahů');
assert.match(rendered('feature').getAttribute('aria-label'),/0:19 · 8 tahů/);
rendered('feature').click();assert.equal(openedResult,1);assert.equal(played,playsBeforeResult,'completed card never starts another game');
// All players use the same broad entry; owning a team must not force weekly.
const competitionNav=new Element('button'),weeklyOnly=new Element('button');let competitionEntries=0,weeklyEntries=0;
competitionNav.onclick=()=>competitionEntries++;weeklyOnly.onclick=()=>weeklyEntries++;
selectors.set('.bottom-nav [data-nav="leaderboard"]',competitionNav);
for(const teamMember of [false,true]){
 if(teamMember)selectors.set('#axHomeCompetitions .ax-card-action',weeklyOnly);else selectors.delete('#axHomeCompetitions .ax-card-action');
 repaint();rendered('team').click();
 assert.equal(rendered('team').querySelector('.os-title').textContent,'Soutěže');
 assert.equal(rendered('team').querySelector('.os-detail').textContent,'Týdenní · měsíční');
}
assert.equal(competitionEntries,2);assert.equal(weeklyEntries,0);
console.log('PASS one-screen readiness: guarded native actions, separate accessible result metrics, and completed Extra label');
