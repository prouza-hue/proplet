'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const E=require('../../public/app/content/free-order-engine'),Store=require('../../public/app/content/free-order-store');
const M=require('../../public/content/free-order/shared-pestre-v3.json'),db=require('../../public/puzzles.json');
const remote={},memory=new Map();let profile=null,n=0,requests=0,done=[],resumeIds={};
const deps={engine:E,shared:M,storage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},profile:()=>profile,bank:d=>db.free[d],completed:()=>done,uuid:()=>`synthetic-request-${++n}`,hasHistory:()=>false,api:async(path,opts={})=>{
 if(path.endsWith('/config'))return{enabled:true};
 if(!opts.method)return{enabled:true,records:structuredClone(remote),resumeIds};
 requests++;const b=JSON.parse(opts.body),old=remote[b.difficulty];
 if(old&&(b.import_guest||old.revision!==b.expected_revision))return{conflict:!b.import_guest,record:structuredClone(old)};
 const record={mode:b.mode,offered:true,revision:(old?.revision||0)+1,plan:{version:E.VERSION,difficulty:b.difficulty,ids:[...new Set([...(old?.plan?.ids||[]),...b.ids])]}};
 remote[b.difficulty]=record;return{record:structuredClone(record)};
}};
(async()=>{
 const store=Store.create(deps);await store.configure();
 for(const d of M.variedDifficulties){assert.equal(store.record(d).mode,'varied');assert.equal(store.next(d,db.free[d][0]).id,M.routes[d][0]);}
 assert(!store.supports('mozkomor')&&!store.supports('mozkokalypsa'));
 memory.set('proplet-free-order-v1:guest',JSON.stringify({easy:{mode:'numeric',revision:0,offered:false}}));assert.equal(store.record('easy').mode,'varied');
 memory.set('proplet-free-order-v1:guest',JSON.stringify({easy:{mode:'numeric',revision:2,offered:true,plan:{ids:['g4-e-001'],version:E.VERSION,difficulty:'easy'}}}));assert.equal(store.record('easy').mode,'numeric');assert.equal(store.next('easy',db.free.easy[0]),db.free.easy[0]);
 await store.change('easy','varied');assert.equal(store.next('easy',null).id,M.routes.easy[0]);assert.deepEqual(store.record('easy').plan.ids,['g4-e-001']);
 done=M.routes.easy.slice(0,9);assert.equal(store.next('easy',null).id,M.routes.easy[9]);done=[];
 profile={id:'account-a',token:'synthetic'};remote.easy={mode:'numeric',offered:true,revision:8,plan:{version:E.VERSION,difficulty:'easy',ids:['g4-e-001']}};
 await store.sync();assert.equal(store.record('easy').mode,'numeric');assert.equal(requests,0,'passive sync must not rewrite old plans or preferences');
 await store.change('easy','varied');assert.equal(requests,1);assert.equal(remote.easy.revision,9);assert.deepEqual(remote.easy.plan.ids,['g4-e-001']);
 // Independent device cache, same revisioned server.
 const mem2=new Map();const device=Store.create({...deps,storage:{getItem:k=>mem2.get(k),setItem:(k,v)=>mem2.set(k,v),removeItem:k=>mem2.delete(k)}});await device.configure();await device.sync();assert.equal(device.record('easy').mode,'varied');assert.equal(device.next('easy',null).id,M.routes.easy[0]);
 resumeIds={easy:'g4-e-001'};await device.sync();assert.equal(device.next('easy',null).id,'g4-e-001');
 profile={id:'account-b',token:'other'};assert.equal(device.record('easy').mode,'varied');assert.equal(device.next('easy',null).id,M.routes.easy[0],'previous account resume must not leak');
 for(const d of Object.keys(db.free))assert.deepEqual(new Set(M.routes[d]),new Set(db.free[d].map(p=>p.id)));
 const generations=M.routes.easy.slice(0,100).map(id=>id.startsWith('g6-')?6:id.startsWith('g5-')?5:4);assert.equal(generations.filter(g=>g===6).length,50);assert.equal(generations.filter(g=>g===5).length,30);
 console.log('PASS shared routes: defaults, explicit opt-out, preserved plans, no passive writes, completed IDs, account scope, cross-device preference and resume');
})().catch(e=>{console.error(e);process.exit(1)});
