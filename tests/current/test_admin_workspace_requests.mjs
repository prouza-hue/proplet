import assert from 'node:assert/strict';
import {createRequestScope,api,onDenied,cancelAll} from '../../public/admin/api.js';
import {load,confirm,dismissConfirmation} from '../../public/admin/ui.js';

let token='owner-session';
globalThis.localStorage={getItem:()=>JSON.stringify({token})};
const pending=new Map();
// Deliberately ignore AbortSignal: a transport can complete even after cancellation.
globalThis.fetch=(path,options)=>new Promise(resolve=>pending.set(path,{resolve,signal:options.signal}));
const root=()=>({innerHTML:'',isConnected:true,setAttribute(){},removeAttribute(){}});
function respond(path,body,status=200){pending.get(path).resolve({ok:status<400,status,json:async()=>body})}

const scope=createRequestScope(),target=root();
const slowA=load(target,'/api/admin/users/A',d=>`account:${d.account}`,scope);
const fastB=load(target,'/api/admin/users/B',d=>`account:${d.account}`,scope);
assert.equal(pending.get('/api/admin/users/A').signal.aborted,true);
respond('/api/admin/users/B',{account:'B'});await fastB;
respond('/api/admin/users/A',{account:'A'});await slowA;
assert.match(target.innerHTML,/account:B/);
assert.doesNotMatch(target.innerHTML,/account:A/,'late A must never overwrite selected B');

const detached=root();const detachedRead=load(detached,'/detached',d=>d.account,createRequestScope());
detached.isConnected=false;const before=detached.innerHTML;respond('/detached',{account:'PRIVATE'});await detachedRead;
assert.equal(detached.innerHTML,before,'removed sections cannot receive private late data');

const identityTarget=root();const identityRead=load(identityTarget,'/identity',d=>d.account,createRequestScope());
token='different-session';respond('/identity',{account:'OLD_OWNER'});await identityRead;
assert.doesNotMatch(identityTarget.innerHTML,/OLD_OWNER/,'a changed bearer identity invalidates pending reads');

let denied=0;onDenied(error=>{assert.equal(error.status,403);denied++});
const deniedRead=api('/denied');respond('/denied',{detail:'Denied'},403);
await assert.rejects(deniedRead,error=>error.status===403);assert.equal(denied,1);

const parallelA=createRequestScope().begin(),parallelB=createRequestScope().begin();cancelAll();
assert.equal(parallelA.signal.aborted,true);assert.equal(parallelB.signal.aborted,true);
assert.equal(parallelA.current(),false);assert.equal(parallelB.current(),false);

// The old async action must not close or mutate a newly opened confirmation.
let action={disabled:false},resolveOld;
const dialog={open:false,showModal(){this.open=true},close(){this.open=false;this.onclose?.()}};
const content={innerHTML:'',querySelectorAll:()=>[],querySelector:selector=>selector==='#confirmAction'?action:{innerHTML:''}};
const opener={isConnected:true,focus(){}};
globalThis.document={activeElement:opener,getElementById:id=>id==='adminConfirm'?dialog:content};
confirm({title:'A',html:'Account A',onConfirm:()=>new Promise(resolve=>{resolveOld=resolve})});
const oldAction=action.onclick({target:action});
dismissConfirmation();action={disabled:false};
confirm({title:'B',html:'Account B',onConfirm:async()=>{}});
resolveOld();await oldAction;
assert.equal(dialog.open,true,'late action A cannot close the confirmation for B');
dismissConfirmation();
console.log('PASS admin workspace: delayed A→B, detached view, session change, denial, all-scope cancellation, confirmation generations');
