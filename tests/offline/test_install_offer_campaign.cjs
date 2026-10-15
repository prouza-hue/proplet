'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'../../public/app.js'),'utf8');
const nudgeCode=app.slice(app.indexOf('function getInstallNudgeState'),app.indexOf('function isIosDevice'))+'\n'+app.slice(app.indexOf('function installNudgeDue'),app.indexOf('function installOfferAvailable'));
const key=app.match(/const INSTALL_NUDGE_KEY='([^']+)'/)[1],campaign=app.match(/const INSTALL_NUDGE_CAMPAIGN='([^']+)'/)[1];
function fixture(initial,failWrite=false){
 let value=JSON.stringify(initial),writes=0,now=1700000000000;
 const storage={getItem:()=>value,setItem:(k,v)=>{if(failWrite)throw Error('quota');value=v;writes++;}};
 const api=new Function('localStorage','INSTALL_NUDGE_KEY','INSTALL_NUDGE_CAMPAIGN','Date',nudgeCode+";return {getInstallNudgeState,installNudgeDue,saveInstallNudgeState};")(storage,key,campaign,{now:()=>now});
 return {...api,stored:()=>JSON.parse(value),writes:()=>writes,advance:days=>{now+=days*86400000}};
}
for(const initial of [{declines:1,nextOfferAt:9999999999999,shown:1},{declines:2,done:true,shown:2},{done:true}]){
 const f=fixture(initial);assert.equal(f.installNudgeDue(),true);assert.equal(f.stored().declines,0);assert.equal(f.stored().shown,0);f.getInstallNudgeState();assert.equal(f.writes(),1);
}
for(const initial of [{installed:true,done:true},{accepted:true,done:true},{iosHintSeen:true,done:true}])for(const fail of [false,true])assert.equal(fixture(initial,fail).installNudgeDue(),false);
const f=fixture({campaign,declines:1,shown:1,nextOfferAt:1700000000000+7*86400000});
assert.equal(f.installNudgeDue(),false);f.advance(7);assert.equal(f.installNudgeDue(),true);
f.saveInstallNudgeState({campaign,declines:2,done:true,shown:2});assert.equal(f.installNudgeDue(),false);assert.equal(f.stored().declines,2);
for(const initial of [null,[],42,'bad'])assert.equal(fixture(initial).installNudgeDue(),true);
console.log('PASS: offline install campaign renews former declines once, preserves acceptance and retains the seven-day/two-decline limits');
