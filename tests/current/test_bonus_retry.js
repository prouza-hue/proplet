const fs=require('fs'),vm=require('vm'),assert=require('assert');
(async()=>{
let token='expired',calls=0,status=401;
const context={window:{},document:{querySelector:()=>null},getProfile:()=>({id:'same',token}),api:async()=>{calls++;throw Object.assign(Error('failed'),{status})},setTimeout(){},Date,console};
vm.createContext(context);vm.runInContext(fs.readFileSync('public/account-bonus-v3331.js','utf8'),context);
await new Promise(r=>setImmediate(r));
for(let i=0;i<20;i++)await context.window.PROPLET_ACCOUNT_BONUS_API.sync();
assert.equal(calls,1,'invalid session must not retry bonus every 500ms');
token='new';status=503;await context.window.PROPLET_ACCOUNT_BONUS_API.sync();assert.equal(calls,2,'new login may retry');
await context.window.PROPLET_ACCOUNT_BONUS_API.sync();assert.equal(calls,2,'temporary errors back off too');
console.log('PASS: bonus auth failure stops retries; fresh credentials retry; transient errors back off.');
})().catch(e=>{console.error(e);process.exit(1)});
