'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
// Minimal DOM for the real grouping renderer; parses native row markup and keeps
// node identities so accidental cloning/removal of award detail targets fails.
class Element{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attrs={};this.className='';this._text='';this.open=false;this.classList={contains:n=>this.className.split(/\s+/).includes(n),add:(...names)=>{for(const n of names)if(!this.classList.contains(n))this.className+=' '+n;},remove:(...names)=>{this.className=this.className.split(/\s+/).filter(n=>n&&!names.includes(n)).join(' ');},toggle:(n,on)=>on?this.classList.add(n):this.classList.remove(n)};}
 get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
 set textContent(v){this.replaceChildren();this._text=String(v);}
 get nextElementSibling(){const a=this.parentElement?.children||[];return a[a.indexOf(this)+1]||null;}
 append(...items){for(const n of items){n.remove();n.parentElement=this;this.children.push(n);}}
 appendChild(n){this.append(n);return n;}
 prepend(n){n.remove();n.parentElement=this;this.children.unshift(n);}
 remove(){if(this.parentElement){const a=this.parentElement.children;a.splice(a.indexOf(this),1);this.parentElement=null;}}
 replaceChildren(...items){this.children.forEach(c=>c.parentElement=null);this.children=[];this._text='';this.append(...items);}
 before(n){const p=this.parentElement;n.remove();n.parentElement=p;p.children.splice(p.children.indexOf(this),0,n);}
 after(n){const p=this.parentElement;n.remove();n.parentElement=p;p.children.splice(p.children.indexOf(this)+1,0,n);}
 contains(n){for(let x=n;x;x=x.parentElement)if(x===this)return true;return false;}
 setAttribute(k,v){this.attrs[k]=String(v);if(k==='class')this.className=String(v);if(k==='id')this.id=String(v);if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(v);}
 getAttribute(k){return this.attrs[k]??null;}hasAttribute(k){return Object.hasOwn(this.attrs,k);}removeAttribute(k){delete this.attrs[k];}
 matches(s){return s.split(',').some(part=>{part=part.trim();return part.startsWith('.')?this.classList.contains(part.slice(1)):part.startsWith('[')?this.hasAttribute(part.slice(1,-1)):this.tagName===part.toUpperCase();});}
 querySelectorAll(s){const direct=s.startsWith(':scope > '),selector=direct?s.slice(9):s;return this.children.flatMap(c=>[...(c.matches(selector)?[c]:[]),...(!direct?c.querySelectorAll(selector):[])]);}
 querySelector(s){return this.querySelectorAll(s)[0]||null;}
 closest(s){for(let n=this;n;n=n.parentElement)if(n.matches(s))return n;return null;}
 set innerHTML(html){
  this.replaceChildren();const stack=[this];
  for(const token of html.match(/<[^>]+>|[^<]+/g)||[]){
   if(token.startsWith('</')){stack.pop();continue;}
   if(token.startsWith('<')){const match=token.match(/^<(\w+)/);if(!match)continue;const e=new Element(match[1]);for(const a of token.slice(match[0].length,-1).matchAll(/([\w:-]+)(?:="([^"]*)")?/g))e.setAttribute(a[1],a[2]||'');stack.at(-1).append(e);if(!['IMG','INPUT','BR'].includes(e.tagName))stack.push(e);}
   else stack.at(-1)._text+=token;
  }
  this.parsedRows=this.querySelectorAll(':scope > .unlock-row');
 }
}
const app=fs.readFileSync('public/app.js','utf8'),modal=new Element(),card=new Element(),primary=new Element('button'),secondary=new Element(),box=new Element();
modal.append(card);box.id='newBadgeBox';secondary.className='win-secondary-actions';card.append(box,primary,secondary);
const listeners={},ctx={window:{},document:{documentElement:new Element('html'),createElement:t=>new Element(t),addEventListener:(name,fn)=>listeners[name]=fn},$:s=>({'#winModal':modal,'#winModal .win-card':card,'#newBadgeBox':box,'#winPrimaryBtn':primary}[s]||null),saveState(){throw Error('Presentation must not change player data');},getState(){throw Error('Presentation must not recalculate earned state');}};
vm.createContext(ctx);vm.runInContext(app.slice(app.indexOf('function renderWinBadges('),app.indexOf('const $$=')),ctx);
const start=app.indexOf('const ACHIEVEMENTS=['),end=app.indexOf('\n];',start)+3;vm.runInContext(app.slice(start,end),ctx);
const achievements=vm.runInContext('ACHIEVEMENTS',ctx);
vm.runInContext(fs.readFileSync('public/ribbon-catalog.js','utf8'),ctx);vm.runInContext(fs.readFileSync('public/ribbon-ui.js','utf8'),ctx);
const ids=['all-5','clean-1','easy-1','medium-1','hard-1','daily-1','speed-300','xp-100','discovery-1','mozkokalypsa-1'];
const markup=list=>'<div class="unlock-title">Nové úspěchy</div>'+list.map(id=>{const a=achievements.find(x=>x.id===id);assert(a);return `<div class="unlock-row achievement-unlock" data-achievement-detail="${a.id}" role="button" tabindex="0" aria-haspopup="dialog"><span class="emoji">${a.icon}</span><div><strong>${a.name}</strong><small>${a.desc}</small></div></div>`;}).join('');
const streak='<div class="unlock-row" data-streak-detail="První zářez" role="button" tabindex="0" aria-haspopup="dialog"><span class="emoji">🥉</span><div><strong>Nový odznak · První zářez</strong><small>1 den v řadě</small></div></div>';
function check(list,withStreak=false){
 ctx.renderWinBadges((withStreak?streak:'')+markup(list));const originals=box.parsedRows,rows=box.querySelectorAll('.unlock-row');
 assert.equal(rows.length,list.length+(withStreak?1:0));assert.equal(new Set(rows).size,originals.length);assert(originals.every(r=>rows.includes(r)),'every original earned row survives grouping');
 const featured=box.querySelector('.win-award-featured');assert.equal(box.children[0],featured);assert.equal(featured,originals.find(r=>r.dataset.achievementDetail?.startsWith('mozkokalypsa-'))||originals[0]);
 const details=box.querySelector('details');if(rows.length>1){assert(details);assert.equal(details.open,false);assert.equal(details.querySelector('summary').textContent,`Další odměny (${rows.length-1})`);assert.equal(details.querySelectorAll('.unlock-row').length,rows.length-1);details.open=true;}else assert.equal(details,null);
 assert.equal(box.querySelector('.unlock-title'),null);assert.equal(secondary.nextElementSibling,box,'all awards follow continuation and secondary actions');
 for(const row of rows){assert.equal(row.getAttribute('tabindex'),'0');assert.equal(row.getAttribute('role'),'button');const name=row.querySelector('strong').textContent,category=row.dataset.streakDetail?'streak':'achievement',art=ctx.window.PropletRibbonArt.art(name,{category,size:84});assert(art,'actual catalog artwork for '+name);row.querySelector('.emoji').replaceChildren(art);const file=art.querySelector('img').src.split('?')[0];assert(fs.existsSync('public'+file),'catalog asset exists: '+file);}
 return rows;
}
ctx.renderWinBadges();assert(box.classList.contains('hidden'));assert.equal(box.children.length,0);
check(ids.slice(0,1));check(ids.slice(0,3));const many=check(ids,true);assert.equal(many[0].dataset.achievementDetail,'mozkokalypsa-1');
// Existing keyboard detail delegation still reaches each preserved identity.
const detail=fs.readFileSync('public/achievement-details.js','utf8'),opened=[];
Object.assign(ctx,{dialog:null,open:id=>opened.push(['achievement',id]),openStreak:id=>opened.push(['streak',id]),openRank:id=>opened.push(['rank',id])});
vm.runInContext(detail.slice(detail.indexOf(' function activate(trigger){'),detail.indexOf(" document.addEventListener('proplet:account-changed'")),ctx);
for(const row of many){let prevented=false;listeners.keydown({target:row,key:'Enter',repeat:false,preventDefault(){prevented=true;}});assert(prevented);assert.deepEqual(opened.at(-1),row.dataset.streakDetail?['streak',row.dataset.streakDetail]:['achievement',row.dataset.achievementDetail]);}
const count=opened.length;listeners.keydown({target:many[0],key:' ',repeat:true,preventDefault(){}});assert.equal(opened.length,count,'repeat does not reopen the detail');
check(ids.slice(0,1));assert.equal(box.querySelector('details'),null,'many-to-one removes stale disclosure');ctx.renderWinBadges();assert.equal(box.children.length,0);assert(!box.classList.contains('win-awards-grouped'));assert.equal(box.dataset.awardCount,undefined);
modal.classList.add('first-steps-win');ctx.renderWinBadges(markup(ids.slice(0,3)));assert(!box.classList.contains('win-awards-grouped'));assert.equal(box.querySelector('details'),null,'protected first-steps structure stays native');
console.log('PASS earned awards: zero/one/three/many transitions, original nodes, native art/detail keyboard actions and first-steps protection');
