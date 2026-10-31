'use strict';
const assert=require('node:assert/strict');
const {KEY,WEEK,allowed,create,install}=require('../../public/ui-playtest-preview.js');
const preview='https://proplet-review-example.vercel.app/?reviewPlaytest=1';
assert(allowed({href:preview,environment:'preview',live:true}));
assert(!allowed({href:preview,environment:'preview'}),'a hostname-derived preview label alone is insufficient');
assert(!allowed({href:preview.replace('?reviewPlaytest=1',''),environment:'preview',live:true}));
assert(!allowed({href:preview.replace('=1','=0'),environment:'preview',live:true}));
assert(!allowed({href:preview,environment:'production',live:true}));
for(const host of ['hrajproplet.cz','www.hrajproplet.cz','other.hrajproplet.cz','proplet-nine.vercel.app','proplet-pavel-prouzas-projects.vercel.app','proplet-git-main-pavel-prouzas-projects.vercel.app'])
 assert(!allowed({href:'https://'+host+'/?reviewPlaytest=1',environment:'preview',live:true,isolated:true}),host);
assert(allowed({href:'http://127.0.0.1:8892/?reviewPlaytest=1',environment:'preview',isolated:true}));
assert(!allowed({href:preview,environment:'preview',isolated:true}),'isolated flag is accepted only on loopback');

function store(){const entries=new Map([['proplet-v2-profile','preserve-real-profile'],['proplet-progress','preserve-real-progress']]),writes=[];return {entries,writes,getItem:k=>entries.get(k)||null,setItem(k,v){writes.push(['set',k]);entries.set(k,v);},removeItem(k){writes.push(['remove',k]);entries.delete(k);}};}
let now=100000;const storage=store();let demo=create({storage,now:()=>now});
assert.equal(demo.snapshot().shows,0);assert.equal(storage.writes.length,0,'loading does not activate the campaign or show an invitation');
assert.equal(demo.accept().reason,'not-shown');assert.equal(demo.simulateGames().reason,'not-accepted');
assert(demo.invite().ok);assert.equal(demo.snapshot().shows,1);assert(demo.invite().ok);assert.equal(demo.snapshot().shows,1,'repainting an open invitation does not count another exposure');
assert(demo.snooze().ok);assert.equal(demo.snapshot().snoozeUntil,now+WEEK);assert.equal(demo.invite().reason,'snoozed');
now+=WEEK+1;assert(demo.invite().ok);assert.equal(demo.snapshot().shows,2);demo.snooze();now+=WEEK+1;
demo=create({storage,now:()=>now});assert.equal(demo.invite().reason,'limit','two-show limit survives reload');
assert(demo.reset().ok);assert(!storage.entries.has(KEY));assert(demo.invite().ok);assert(demo.decline().ok);
demo=create({storage,now:()=>now});assert.equal(demo.invite().reason,'declined','explicit dismissal persists until demo reset');
demo.reset();demo.invite();assert(demo.accept().ok);assert(demo.snapshot().accepted);assert.equal(demo.invite().reason,'accepted');
assert(demo.simulateGames().ok);assert.equal(demo.simulateGames().reason,'reminded','only one explicit simulated reminder');
demo.snooze();assert.equal(demo.simulateGames().reason,'snoozed');now+=WEEK+1;assert.equal(demo.simulateGames().reason,'reminded');
const before=JSON.stringify(demo.snapshot());assert.equal(demo.submit('', 'A comment alone').reason,'choice');assert.equal(JSON.stringify(demo.snapshot()),before);
assert.equal(demo.submit('better','x'.repeat(2001)).reason,'comment');assert.equal(JSON.stringify(demo.snapshot()),before);
assert(demo.submit('similar').ok,'one selected answer is sufficient');assert.equal(demo.snapshot().feedback.comment,'');
demo=create({storage,now:()=>now});assert.equal(demo.snapshot().feedback.choice,'similar','saved answer is reviewable after reload');
assert.equal(demo.simulateGames().reason,'answered');
const comment='<img src=x onerror=alert(1)> Upřímný názor.';assert(demo.submit('worse',comment).ok);assert.equal(demo.snapshot().feedback.comment,comment);
demo.reset();assert.equal(demo.snapshot().feedback,null);assert.equal(demo.snapshot().accepted,false);
assert.equal(storage.entries.get('proplet-v2-profile'),'preserve-real-profile');assert.equal(storage.entries.get('proplet-progress'),'preserve-real-progress');
assert(storage.writes.every(([,key])=>key===KEY),'only the demo namespace is written or removed');
const unavailable=create({storage:{getItem(){return null;},setItem(){throw Error('quota');},removeItem(){throw Error('quota');}}});
assert.equal(unavailable.invite().reason,'storage');assert.equal(unavailable.snapshot().shows,0);assert.equal(unavailable.submit('better').reason,'storage');assert.equal(unavailable.snapshot().feedback,null);

// Execute installation on normal and explicitly forbidden visits. Neither DOM,
// storage nor any outbound primitive may be used; readiness cannot bypass gate.
for(const [href,environment,live] of [[preview.replace('?reviewPlaytest=1',''),'preview',true],['https://hrajproplet.cz/?reviewPlaytest=1','preview',true],[preview,'production',true],[preview,'preview',false]]){
 const listeners=[],outbound=()=>{throw Error('No outbound request permitted');};
 const win={location:{href},PROPLET_RUNTIME_META:{environment},livePlayerPreview:()=>live,document:{readyState:'complete',querySelector(){throw Error('Forbidden visit must not inspect/mount UI');},addEventListener:(_n,f)=>listeners.push(f)},addEventListener:(_n,f)=>listeners.push(f),fetch:outbound,navigator:{sendBeacon:outbound},XMLHttpRequest:outbound,get localStorage(){throw Error('Forbidden visit must not read storage');}};
 install(win);listeners.forEach(fn=>fn());
}
console.log('PASS manual playtest demo: production/opt-in gates, local-only answers, validation, snooze/decline/two-show limit, reminder and isolated reset');
