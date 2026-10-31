// Exercise native patron UI gates, durable claim coordination and kill switch.
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const nodes=new Map(),events=new Map(),entries=new Map();let mounted=0,calls=[],removed=[];
function element(){return {setAttribute(){},addEventListener(){},append(){},remove(){removed.push(this.id);nodes.delete('#'+this.id)},querySelector(){return {onclick:null,addEventListener(){}}},querySelectorAll:()=>[],classList:{contains:()=>false,remove(){}},innerHTML:'',textContent:'',showModal(){this.open=true},close(){this.open=false},focus(){}};}
const footer={before(node){if(node.id==='patronOffer')mounted++;nodes.set('#'+node.id,node)}};
const document={createElement:element,body:{append(node){nodes.set('#'+node.id,node)}},querySelector(s){if(s==='.app-footer')return footer;return nodes.get(s)||null},querySelectorAll(s){return s.startsWith('#patronProfileEntry')?s.split(',').flatMap(key=>nodes.get(key)?[nodes.get(key)]:[]):[]},addEventListener(name,fn){events.set(name,fn)}};
const status={enabled:true,authenticated:true,patron:false,publicBadge:false,offersDisabled:false,canOffer:true};
const request=async path=>{calls.push(path);return path.endsWith('/claim')?{displayGranted:true,receiptId:'receipt'}:status};
const window={PropletAnnouncements:{register(e){entries.set(e.id,e)},kick(){}},addEventListener(){}};
const context={window,document,api:request,Intl,crypto:require('node:crypto').webcrypto,MutationObserver:class{observe(){}},requestAnimationFrame(){},getProfile:()=>({id:'a',token:'token',supportMode:'younger'}),currentScreen:'daily'};
vm.runInNewContext(fs.readFileSync('public/app/patrons.js','utf8'),context);
(async()=>{
 events.get('proplet:ready')();await window.PropletPatrons.refresh();
 const entry=entries.get('patron-support-v1'),thanks=entries.get('patron-thanks-v1');
 assert.equal(entry.eligible(),false,'initial page open never asks');
 window.PropletPatrons.resultCompleted();await Promise.resolve();assert.equal(entry.eligible(),true,'server policy determines eligibility across age preferences');
 assert.equal(await entry.show({isCurrent:()=>entry.eligible()}),true,'server claim must not invalidate its own display ticket');
 assert.equal(mounted,1);assert.equal(entry.eligible(),false);assert.equal(calls.filter(p=>p.endsWith('/claim')).length,1);
 Object.assign(status,{patron:true,thanksPending:true,canOffer:false,contributions:[{id:'payment',amountCzk:99,frequency:'monthly',confirmedAt:'2026-10-31T12:00:00Z'}]});
 await window.PropletPatrons.refresh();assert.equal(thanks.eligible(),true);assert.equal(entry.eligible(),false);
 assert.equal(await thanks.show({isCurrent:()=>thanks.eligible()}),true);
 assert.equal(nodes.get('#patronDialog').open,true);assert.equal(thanks.eligible(),false);
 assert.match(nodes.get('#patronDialog').innerHTML,/Tvoje potvrzené příspěvky/);assert.match(nodes.get('#patronDialog').innerHTML,/Přispět znovu/);
 assert.equal(calls.filter(p=>p==='/api/patrons/thanks/claim').length,1);
 // Live disable must remove previously rendered support and bank details with no write.
 for(const id of ['patronProfileEntry','patronTodayLink','patronOfferPreference']){const node=element();node.id=id;nodes.set('#'+id,node);}
 window.PropletPatrons.model.intent={id:'bound'};window.PropletPatrons.model.payment={spd:'bound'};
 status.enabled=false;const before=calls.length;await window.PropletPatrons.refresh();
 assert.equal(nodes.get('#patronDialog').open,false);assert.equal(window.PropletPatrons.model.intent,null);assert.equal(window.PropletPatrons.model.payment,null);
 for(const id of ['patronProfileEntry','patronTodayLink','patronOfferPreference','patronOffer'])assert.ok(removed.includes(id));
 assert.deepEqual(calls.slice(before),['/api/patrons'],'kill switch does not dismiss/claim/write');
 assert.equal(entry.eligible(),false);assert.equal(thanks.eligible(),false);window.PropletPatrons.offer();assert.equal(mounted,1);
 console.log('PASS patron client: server eligibility; async support/thanks claims; own history/repeat entry; live OFF clears only patron UI and QR without writes');
})().catch(e=>{console.error(e);process.exit(1)});
