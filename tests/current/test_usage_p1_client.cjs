const assert=require('assert');
const analytics=require('../../public/app/analytics.js');

const now=Date.now();
const rows=[1,2,3].map(n=>({
  id:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,
  event:n===1?'app_open':'app_session_started',
  endpoint:'/api/product-event',
  at:now-n,
  headers:{'X-Proplet-Analytics':'2'}
}));
const values=new Map([['proplet-events-v2:guest',JSON.stringify(rows)]]);
const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
const calls=[];
const client=analytics.create({storage,now:()=>now,getScope:()=> 'guest',request:async(endpoint,options)=>{calls.push({endpoint,options});}});

(async()=>{
  await client.flush();
  assert.equal(calls.length,1);
  assert.equal(calls[0].endpoint,'/api/product-events');
  const body=JSON.parse(calls[0].options.body);
  assert.equal(body.events.length,3);
  assert.equal(calls[0].options.headers['X-Proplet-Event-ID'],undefined);
  assert.deepEqual(JSON.parse(values.get('proplet-events-v2:guest')),[]);
  console.log('PASS analytics queue drains one compatible batch');
})().catch(error=>{console.error(error);process.exit(1)});
