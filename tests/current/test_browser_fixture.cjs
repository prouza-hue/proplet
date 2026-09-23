const {spawn}=require('node:child_process');
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const child=spawn(process.execPath,[path.join(root,'tools/browser_fixture_server.cjs')],{env:{...process.env,PORT:'0',EXPECTED_SHA:''},stdio:['ignore','pipe','pipe']});
 try{
  const port=await new Promise((resolve,reject)=>{
   let text='';const timeout=setTimeout(()=>reject(Error('fixture startup timeout')),5000);
   child.once('error',e=>{clearTimeout(timeout);reject(e)});
   child.once('exit',code=>{clearTimeout(timeout);reject(Error('fixture exited '+code))});
   child.stdout.on('data',bytes=>{text+=bytes;const m=text.match(/listening on (\d+)/);if(m){clearTimeout(timeout);resolve(Number(m[1]))}});
  });
  const url='http://127.0.0.1:'+port;
  const health=await(await fetch(url+'/api/health')).json();
  assert.equal(health.isolatedFixture,true);assert.equal(health.database,false);assert.match(health.sha,/^[a-f0-9]{40}$/);
  assert.equal(await(await fetch(url+'/app.js')).text(),fs.readFileSync(path.join(root,'public/app.js'),'utf8'));
  for(const method of ['POST','PUT','DELETE','PATCH'])assert.equal((await fetch(url+'/api/result',{method,body:'synthetic'})).status,503);
  assert.equal((await fetch(url+'/api/account')).status,503);
  assert.equal((await fetch(url+'/%2e%2e%2fserver.py')).status,404);
  const config=await(await fetch(url+'/api/config')).json();assert.equal(config.environment,'preview');assert.equal(config.pushAvailable,false);
  console.log('PASS browser fixture identity, exact assets, disabled writes and path boundary');
 }finally{child.kill()}
})().catch(e=>{console.error(e);process.exitCode=1});
