'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('public/account-auth.js','utf8');
async function callback(search,hash='',linkState=null){
 const requests=[],accepted=[],messages=[],store=new Map(linkState?[['proplet-google-link-state',linkState]]:[]);
 const location={pathname:'/',search,hash};
 const ctx={URLSearchParams,location,sessionStorage:{getItem:k=>store.get(k),removeItem:k=>store.delete(k)},
  history:{state:null,replaceState(_state,_title,url){const u=new URL(url,'https://hrajproplet.cz');location.search=u.search;location.hash=u.hash}},
  ensureModals(){},toast:m=>messages.push(m),window:{},
  call:async(path,options)=>{requests.push({path,options});return {profile:{id:'google',token:'session'},linked:options.auth}},acceptProfile:p=>accepted.push(p)};
 vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('function cleanAuthUrl(){'),source.indexOf('function acceptProfile(')),ctx);
 vm.runInContext(source.slice(source.indexOf('function supabaseFragment(){'),source.indexOf('function closeModal(')),ctx);
 vm.runInContext(source.slice(source.indexOf('async function handleAuthReturn(){'),source.indexOf('function init(){')),ctx);
 await ctx.handleAuthReturn();return {requests,accepted,messages,location,store};
}
(async()=>{
 let r=await callback('?auth=google','#access_token=attacker');
 assert.equal(r.requests.length,0);assert.equal(r.accepted.length,0);assert.equal(r.location.hash,'');assert.equal(r.messages.length,1);
 r=await callback('?auth=google&code=one-time&state=state&campaign=safe');
 assert.equal(r.requests[0].options.auth,false,'ordinary login never carries player bearer');
 assert.equal(r.requests[0].options.body.code,'one-time');assert.equal(r.requests[0].options.body.state,'state');
 assert.equal(r.requests[0].options.body.accessToken,undefined);assert.equal(r.location.search,'?campaign=safe');
 r=await callback('?auth=google&code=one-time&state=state','', 'state');
 assert.equal(r.requests[0].options.auth,true);assert.equal(r.store.size,0);
 r=await callback('?auth=google&code=one-time&state=state','', 'other-state');
 assert.equal(r.requests[0].options.auth,false);assert.equal(r.store.size,0);
 r=await callback('?auth=google&state=state&error=access_denied','', 'state');
 assert.equal(r.requests.length,0);assert.equal(r.store.size,0);assert.equal(r.location.search,'');
 const nodes=new Map(['#confirmLinkGoogle','#linkGooglePassword','#linkGoogleMessage'].map(id=>[id,{disabled:false,value:id==='#linkGooglePassword'?'correct-password':'',textContent:''}]));
 const calls=[],state=new Map(),ctx={$:id=>nodes.get(id),location:{href:''},sessionStorage:{setItem:(k,v)=>state.set(k,v)},call:async(path,options)=>{calls.push({path,options});return {url:'https://provider.invalid/authorize',state:'bound-state'}}};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('async function startGoogleLink('),source.indexOf('function openProfileEditor(')),ctx);
 await ctx.startGoogleLink({preventDefault(){}});
 assert.equal(calls[0].path,'/api/auth/google/link/start');assert.equal(calls[0].options.body.password,'correct-password');
 assert.equal(nodes.get('#linkGooglePassword').value,'');assert.equal(state.get('proplet-google-link-state'),'bound-state');assert.equal(ctx.location.href,'https://provider.invalid/authorize');
 console.log('PASS Google callback rejects fragments, separates bearer intent, cleans URL and confirms linking');
})().catch(error=>{console.error(error);process.exitCode=1});
