'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {create,receiptKey}=require('../../public/app/engagement/announcements.js');
const source=fs.readFileSync('public/app/content/refresh-release.js','utf8');
function setup({enabled=true,blocked=false,guest=false,local=new Map()}={}){
 const storage={getItem:k=>local.get(k),setItem:(k,v)=>local.set(k,v)};
 const context={ready:true,account:guest?'':'alex',authenticated:!guest,completed:65,onboarded:true,screen:'daily',blocked};
 const calls=[];
 const queue=create({context:()=>context,storage,sessionStorage:{getItem:()=>null,setItem(){}}});
 const window={PropletAnnouncements:queue,PropletArchiveExperience:{isEnabled:()=>enabled,announcement:options=>{calls.push(options);return true},closeModal:()=>calls.push('close')}};
 vm.runInNewContext(source,{window,localStorage:storage});
 return {queue,context,calls,local,window};
}
(async()=>{
 const x=setup();await x.queue.kick();assert.equal(x.calls.length,1);assert.equal(x.calls[0].includeExtra,true);
 assert.equal(x.local.get('proplet:daily-extra-intro:v1:account:alex'),'1','combined release must retire the separate Extra intro');
 assert.equal(x.local.get(receiptKey('archive-extra-v1','alex')),'1');
 x.window.PropletRefreshRelease.close();assert.equal(x.calls.length,1,'retired 300-board hook mounts nothing');
 const seen=setup({local:x.local});await seen.queue.kick();assert.equal(seen.calls.length,0);
 for(const options of [{guest:true},{enabled:false},{blocked:true}]){const t=setup(options);await t.queue.kick();assert.equal(t.calls.length,0);assert.equal(t.local.size,0)}
 const deferred=setup({blocked:true});await deferred.queue.kick();deferred.context.blocked=false;await deferred.queue.kick();assert.equal(deferred.calls.length,1);
 console.log('PASS: current Archive+Extra release, account receipt, guest suppression, archive gate, deferred delivery and retired 300 CTA');
})().catch(error=>{console.error(error);process.exit(1)});
