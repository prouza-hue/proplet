// Exercise the shared automatic-offer adapter with actual async claim eligibility.
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const nodes=new Map(),events=new Map();let entry,mounted=0,calls=[];
function element(){return {setAttribute(){},addEventListener(){},append(){},remove(){},querySelector(){return {onclick:null}},classList:{contains:()=>false},innerHTML:'',textContent:''};}
const footer={before(node){if(node.id==='patronOffer'){mounted++;nodes.set('#patronOffer',node)}else nodes.set('#'+node.id,node)}};
const document={createElement:element,body:{append(node){nodes.set('#'+node.id,node)}},querySelector(s){if(s==='.app-footer')return footer;return nodes.get(s)||null},querySelectorAll:()=>[],addEventListener(name,fn){events.set(name,fn)}};
const status={enabled:true,authenticated:true,patron:false,publicBadge:false,offersDisabled:false,canOffer:true};
const window={PropletPatronApi:{async request(path){calls.push(path);return path.endsWith('/claim')?{displayGranted:true,receiptId:'receipt'}:status}},PropletAnnouncements:{register(e){entry=e},kick(){}},addEventListener(){}};
const context={window,document,location:{search:''},URLSearchParams,Intl,crypto:require('node:crypto').webcrypto,MutationObserver:class{observe(){}},requestAnimationFrame(){},getProfile:()=>({id:'a',token:'token',supportMode:'none'}),currentScreen:'daily'};
vm.runInNewContext(fs.readFileSync('public/app/patrons.js','utf8'),context);
(async()=>{
 events.get('proplet:ready')();await window.PropletPatrons.refresh();
 assert.equal(entry.eligible(),false,'initial page open never asks');
 window.PropletPatrons.resultCompleted();await Promise.resolve();assert.equal(entry.eligible(),true);
 assert.equal(await entry.show({isCurrent:()=>entry.eligible()}),true,'server claim must not invalidate its own display ticket');
 assert.equal(mounted,1);assert.equal(entry.eligible(),false);assert.equal(calls.filter(p=>p.endsWith('/claim')).length,1);
 console.log('PASS patron client: no ask before success, async server claim mounts once without invalidating itself');
})().catch(e=>{console.error(e);process.exit(1)});
