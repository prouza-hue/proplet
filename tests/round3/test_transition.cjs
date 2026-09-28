const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const boundary=Date.parse('2026-09-28T22:00:00Z'),r2='mozkokalypsa-round2-20260925',r3='mozkokalypsa-round3-interwoven-v2';
 let now=boundary-2000,serial=0,requests=0;const timers=new Map(),nodes=new Map(),local=new Map();
 class Clock extends Date{static now(){return now}}
 const node=id=>{if(nodes.has(id))return nodes.get(id);const classes=new Set();const n={textContent:'',value:'',children:[],innerHTML:'',classList:{add:s=>classes.add(s),remove:s=>classes.delete(s),contains:s=>classes.has(s),toggle(s,v){if(v)classes.add(s);else classes.delete(s)}},querySelector(){return null},querySelectorAll(){return []},replaceChildren(...x){n.children=x},appendChild(){},after(){},prepend(){},focus(){},getClientRects(){return []}};nodes.set(id,n);return n};
 const owner='test-invited',oldKey=`proplet-playtest:${r2}:${owner}`,newKey=`proplet-playtest:${r3}:${owner}`;
 const old=JSON.stringify({attempts:{'mk2-01':{board_id:'mk2-01',completed:true,reward_points:200,pending:[]}}});local.set(oldKey,old);
 const ctx={URLSearchParams,Date:Clock,Intl,console,location:{search:''},navigator:{onLine:true},localStorage:{getItem:k=>local.get(k),setItem:(k,v)=>local.set(k,v)},crypto:{randomUUID:()=>`uid-${++serial}`},setTimeout(fn,delay){const id=++serial;timers.set(id,{fn,at:now+delay});return id},clearTimeout:id=>timers.delete(id),document:{hidden:false,documentElement:node('html'),querySelector:node,addEventListener(){},createElement:()=>node(`new-${++serial}`)},addEventListener(){},getProfile:()=>({id:owner}),showToast(){},stopTimer(){},releaseGameWakeLock(){},nav(){},
 api:async(path)=>{requests++;assert(path==='/api/mozkokalypsa/status');const third=now>=boundary;return {eligible:true,qa:false,round:third?3:2,experimentId:third?r3:r2,order:Array.from({length:third?8:12},(_,i)=>(third?'mk3w2-':'mk2-')+String(i+1).padStart(2,'0')),attempts:[],serverNow:new Date(now).toISOString(),closesAt:new Date(third?boundary+172800000:boundary).toISOString(),...(third?{}:{nextTransitionAt:new Date(boundary).toISOString()})}}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('public/app/mozkokalypsa.js','utf8'),ctx);await new Promise(r=>setImmediate(r));
 assert.equal(node('#mkInviteTitle').textContent,'Mozkokalypsa se vrací.');assert.equal(requests,1);
 now=boundary+100;for(const [id,t] of [...timers])if(t.at<=now){timers.delete(id);t.fn()}
 await new Promise(r=>setImmediate(r));
 assert.equal(node('#mkInviteTitle').textContent,'Mozkokalypsa potřetí.');assert.equal(node('#mkInviteProgress').children.length,8);
 assert.equal(local.get(oldKey),old,'old completion/reward must not move or reset');assert.deepEqual(JSON.parse(local.get(newKey)),{attempts:{}});
 assert.equal(requests,2,'exactly one transition fetch, no polling');assert.equal(node('html').classList.contains('mk-round3-preview'),false,'real round must not display local-only preview UX');
 console.log('PASS midnight UI: one transition request, real 8-board invitation, no earlier cache overwrite or carried reward');
})().catch(e=>{console.error(e);process.exitCode=1});
