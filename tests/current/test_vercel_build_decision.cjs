'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync,spawnSync}=require('node:child_process');
const {decide}=require('../../tools/vercel_build_decision.cjs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'proplet-build-policy-'));
const git=(...args)=>execFileSync('git',['-c','user.name=Fixture','-c','user.email=fixture@example.invalid',...args],{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
function commit(file,body){fs.mkdirSync(path.dirname(path.join(dir,file)),{recursive:true});fs.writeFileSync(path.join(dir,file),body);git('add','--',file);git('commit','-m',file);return git('rev-parse','HEAD');}
try{
  git('init');const base=commit('server.py','base'),runtime=commit('server.py','changed'),docs=commit('docs/note.md','note');
  const env={VERCEL_ENV:'production',VERCEL_GIT_PREVIOUS_SHA:base,VERCEL_GIT_COMMIT_SHA:docs};
  assert.equal(decide(env,dir).build,true,'runtime change earlier in a batch must deploy');
  assert.equal(decide({...env,VERCEL_GIT_PREVIOUS_SHA:runtime},dir).build,false,'docs-only change skips');
  assert.equal(decide({...env,VERCEL_ENV:'preview'},dir).build,true,'requested preview remains possible');
  assert.equal(decide({...env,PROPLET_FORCE_BUILD:'1'},dir).build,true);
  assert.equal(decide({...env,VERCEL_GIT_PREVIOUS_SHA:docs},dir).build,true,'same-SHA config redeploy');
  assert.equal(decide({...env,VERCEL_GIT_PREVIOUS_SHA:'0'.repeat(40)},dir).build,true,'missing Git history must not skip');
  assert.equal(decide({VERCEL_ENV:'production'},dir).build,true,'first deploy');
  const script=path.resolve(__dirname,'../../tools/vercel_build_decision.cjs');
  assert.equal(spawnSync(process.execPath,[script],{cwd:dir,env:{...process.env,...env,VERCEL_GIT_PREVIOUS_SHA:runtime}}).status,0,'Vercel skip exit contract');
  assert.equal(spawnSync(process.execPath,[script],{cwd:dir,env:{...process.env,...env}}).status,1,'Vercel build exit contract');
  git('mv','server.py','docs/server.py');git('commit','-m','Move runtime file');const renamed=git('rev-parse','HEAD');
  assert.equal(decide({...env,VERCEL_GIT_PREVIOUS_SHA:docs,VERCEL_GIT_COMMIT_SHA:renamed},dir).build,true,'runtime deletion cannot hide behind rename into docs');
  const cfg=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../vercel.json')));
  assert.deepEqual(cfg.git.deploymentEnabled,{'**':false,main:true});
  console.log('PASS build decisions: batched runtime, docs-only, manual preview/redeploy, missing history and exit codes');
}finally{assert.equal(path.dirname(fs.realpathSync(dir)),fs.realpathSync(os.tmpdir()));assert(path.basename(dir).startsWith('proplet-build-policy-'));fs.rmSync(dir,{recursive:true,force:true});}
