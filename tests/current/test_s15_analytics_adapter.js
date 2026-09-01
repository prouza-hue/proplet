const assert = require('assert');
const analytics = require('../../public/app/analytics.js');

async function main(){
  const calls=[];
  const tracker=analytics.create({
    request:(path,opts)=>{
      calls.push({path,opts});
      return Promise.resolve({ok:true});
    },
    isDisabled:()=>false,
  });

  assert.strictEqual(tracker.track('app_open'),undefined);
  assert.strictEqual(calls.length,1);
  assert.strictEqual(calls[0].path,'/api/product-event');
  assert.deepStrictEqual(calls[0].opts,{
    method:'POST',
    body:JSON.stringify({event_type:'app_open'}),
  });

  tracker.track('starter_hint_used',{level:3,email:'must-not-send'});
  assert.strictEqual(calls.length,2);
  assert.deepStrictEqual(JSON.parse(calls[1].opts.body),{event_type:'starter_hint_used'});

  let disabledCalls=0;
  const disabled=analytics.create({
    request:()=>{disabledCalls++;return Promise.resolve({ok:true})},
    isDisabled:()=>true,
  });
  disabled.track('app_open');
  assert.strictEqual(disabledCalls,0);

  const throwing=analytics.create({
    request:()=>{throw new Error('offline')},
    isDisabled:()=>false,
  });
  assert.doesNotThrow(()=>throwing.track('app_open'));

  let rejectedHandled=true;
  process.once('unhandledRejection',()=>{rejectedHandled=false});
  const rejected=analytics.create({
    request:()=>Promise.reject(new Error('offline')),
    isDisabled:()=>false,
  });
  rejected.track('app_open');
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.strictEqual(rejectedHandled,true);

  console.log('PASS Sprint 15 analytics adapter: one request/event, no properties, failure is non-blocking');
}

main().catch(error=>{console.error(error);process.exit(1)});
