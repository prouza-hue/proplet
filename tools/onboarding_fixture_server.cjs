// Loopback-only onboarding integration fixture. No upstream API or database access.
// API writes below are explicitly synthetic and retained only in process memory.
'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const repo=path.resolve(__dirname,'..'),root=path.join(repo,'public');
const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
const baseline=process.env.TEST_BASELINE_SHA||null;
if(process.env.EXPECTED_SHA&&process.env.EXPECTED_SHA!==sha)throw Error('checkout SHA mismatch');
if(baseline&&!/^[a-f0-9]{40}$/.test(baseline))throw Error('TEST_BASELINE_SHA must be a full commit SHA');
if(baseline)execFileSync('git',['cat-file','-e',baseline+'^{commit}'],{cwd:repo});
const fixtureDir=path.join(repo,'tests/fixtures/browser');
const config={...JSON.parse(fs.readFileSync(path.join(fixtureDir,'config.json'))),environment:'production',pushAvailable:false};
const syntheticProfile={id:'onboarding-synthetic',name:'Fixture Player',token:'fixture-token-not-a-credential',avatar:'🙂',supportMode:'younger',publicRankings:false,hasPassword:true,stats:{points:125,completed:1}};
let controls={release:'current',rolling:'ok',eventDelayMs:40,failDatabase:false,failDatabaseRequests:0,progress:[],firstSteps:false,auth:'ok',result:'ok'};
let events=[],requests=[],heldRolling=[];
const historical=new Map();
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
function json(res,status,value){if(res.destroyed)return;res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value))}
async function body(req){let raw='';for await(const part of req){raw+=part;if(raw.length>100000)throw Error('body too large')}return raw?JSON.parse(raw):{}}
function rolling(res){json(res,controls.rolling==='fail'?503:200,controls.rolling==='fail'?{detail:'synthetic rolling outage'}:{version:2,asOf:'2026-09-15',puzzles:{},latestBatch:null,nextRelease:null,availableFreeCounts:{}})}
function asset(name){
 if(controls.release==='baseline'&&baseline){
  if(!historical.has(name)){try{historical.set(name,execFileSync('git',['show',baseline+':public/'+name],{cwd:repo,maxBuffer:64*1024*1024,stdio:['ignore','pipe','ignore']}))}catch{historical.set(name,null)}}
  if(historical.get(name))return historical.get(name);
 }
 const filename=path.resolve(root,name);if(!filename.startsWith(root+path.sep)||!fs.existsSync(filename)||!fs.statSync(filename).isFile())return null;
 return fs.readFileSync(filename);
}
const server=http.createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,'http://127.0.0.1'),p=u.pathname;
  if(!['127.0.0.1','localhost','[::1]'].includes(new URL('http://'+req.headers.host).hostname))return json(res,403,{detail:'loopback only'});
  if(p==='/api/health')return json(res,200,{isolatedFixture:true,database:false,sha,baseline,release:controls.release});
  if(p==='/__fixture/events'&&req.method==='GET')return json(res,200,{events,requests});
  if(p==='/__fixture/control'&&req.method==='POST'){
   const value=await body(req);if(value.reset){events=[];requests=[];controls={release:'current',rolling:'ok',eventDelayMs:40,failDatabase:false,failDatabaseRequests:0,progress:[],firstSteps:false,auth:'ok',result:'ok'}}
   for(const key of ['release','rolling','eventDelayMs','failDatabase','failDatabaseRequests','progress','firstSteps','auth','result','firstBoardPolicy'])if(Object.hasOwn(value,key))controls[key]=value[key];
   if(!['current','baseline'].includes(controls.release)||!['ok','hold','fail'].includes(controls.rolling))return json(res,400,{detail:'invalid control'});
   if(controls.rolling!=='hold'){for(const pending of heldRolling)rolling(pending);heldRolling=[]}
   return json(res,200,{ok:true,controls});
  }
  if(p.startsWith('/api/')){
   const data=['GET','HEAD'].includes(req.method)?null:await body(req);
   requests.push({method:req.method,path:p,headers:req.headers,at:Date.now()});
   if(['/api/product-event','/api/product-events','/api/challenge-event'].includes(p)&&req.method==='POST'){
    const batch=p==='/api/product-events'?(Array.isArray(data.events)?data.events:[]):[data];
    for(const item of batch)if(item.event_type!=='account_created')events.push({endpoint:p,event:item.event_type,headers:{...req.headers,...(item.id?{'x-proplet-event-id':item.id}:{}),...(item.created_at?{'x-proplet-event-time':item.created_at}:{})},at:Date.now()});
    return setTimeout(()=>json(res,200,{ok:true,synthetic:true}),controls.eventDelayMs);
   }
   if(p==='/api/config')return json(res,200,config);
   if(p==='/api/daily'&&req.method==='GET'){
    // The Gen6 release reads dated Daily through HTTP. Model the published
    // legacy date used by this fixture; do not contact production or disclose futures.
    const selected=u.searchParams.get('daily_date')||config.date;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(selected)||selected>config.date)return json(res,404,{detail:'fixture Daily not available'});
    const db=JSON.parse(fs.readFileSync(path.join(repo,'data/puzzles.json'),'utf8'));
    const bank=db.daily,base=db.dailyRotationBaseDate||db.dailyGeneration4From;
    const days=Math.floor((Date.parse(selected+'T00:00:00Z')-Date.parse(base+'T00:00:00Z'))/86400000);
    const puzzle=bank[((days%bank.length)+bank.length)%bank.length];
    const contentHash=require('node:crypto').createHash('sha256').update(JSON.stringify(puzzle)).digest('hex');
    return json(res,200,{schemaVersion:1,dailyDate:selected,bankVersion:'legacy-daily',puzzleId:puzzle.id,contentHash,
     challengeKey:'daily:'+selected,serverToday:config.date,validUntil:config.date+'T23:59:59+02:00',official:true,
     cacheKey:'daily:'+selected+':legacy-daily',puzzle});
   }
   if(p==='/api/first-board/assignment'&&req.method==='POST'){
    const identity=req.headers['x-proplet-anon-id']||'',key='first-board-v1';let hash=2166136261;
    for(const char of key+':'+identity){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619)}
    const identityBucket=(hash>>>0)%100,rollout=controls.firstBoardPolicy==='challenger_rollout_20261007';
    const bucket=rollout?50+(identityBucket%50):identityBucket,variant=bucket<50?'control_e001':'challenger_e009',boardId=variant==='control_e001'?'g4-e-001':'g4-e-009',allocationPolicy=rollout?'challenger_rollout_20261007':'hash50_v1';
    events.push({endpoint:p,event:'first_board_experiment_assigned',authoritative:true,headers:{...req.headers,'x-proplet-puzzle':boardId,'x-proplet-experiment':key,'x-proplet-experiment-variant':variant,'x-proplet-experiment-bucket':String(bucket),'x-proplet-experiment-policy':allocationPolicy},at:Date.now()});
    return json(res,200,{key,variant,bucket,identityBucket,allocationPolicy,boardId,firstStepsRunId:data.first_steps_run_id,assignmentRecorded:true});
   }
   if(p==='/api/tajenka')return json(res,200,JSON.parse(fs.readFileSync(path.join(fixtureDir,'tajenka.json'))));
   if(p==='/api/rolling-content'){if(controls.rolling==='hold'){heldRolling.push(res);return}return rolling(res)}
   if(p==='/api/free-order/config'||p==='/api/play-session/config')return json(res,200,{enabled:false});
   if(p==='/api/login-integrity'&&req.method==='POST')return data.name===syntheticProfile.name&&data.password==='fixture-password'?json(res,200,syntheticProfile):json(res,401,{detail:'synthetic login rejected'});
   if(p==='/api/auth/google/start'){res.writeHead(302,{location:controls.auth==='cancel'?'/?auth=google#error=access_denied':'/?auth=google#access_token=synthetic-google-token'});return res.end()}
   if(p==='/api/auth/google/complete'||p==='/api/player'){
    if(controls.auth==='fail')return json(res,503,{detail:'synthetic auth outage'});
    events.push({endpoint:p,event:'account_created',headers:req.headers,authoritative:true,at:Date.now()});
    return json(res,200,p==='/api/player'?{...syntheticProfile,accountCreated:true}:{profile:syntheticProfile,linked:false,accountCreated:true});
   }
   if(p==='/api/result'){if(controls.result==='fail')return json(res,503,{detail:'synthetic save outage'});controls.progress.push({...data,puzzleId:data.puzzle_id,challengeKey:data.challenge_key,contentGeneration:data.content_generation,completedAt:data.completed_at});return json(res,200,{ok:true,synthetic:true})}
   if(p==='/api/me')return json(res,200,syntheticProfile);
   if(p==='/api/progress')return json(res,200,{completed:controls.progress});
   if(p==='/api/account/snapshot')return json(res,200,{...syntheticProfile,completed:controls.progress,cursor:new Date().toISOString()});
   if(p==='/api/support-mode')return json(res,200,{supportMode:data?.support_mode||'younger'});
   if(['/api/anonymous/claim','/api/result','/api/attempt/start','/api/attempt/checkpoint','/api/attempt/finish'].includes(p))return json(res,200,{ok:true,synthetic:true});
   if(p==='/api/rankings/xp')return json(res,200,{players:[],rows:[],total:0,myRank:null});
   if(p.includes('leaderboard'))return json(res,200,{rows:[],total:0,myRank:null});
   if(p==='/api/push/account-state')return json(res,200,{enabled:false});
   return json(res,503,{detail:'isolated fixture: endpoint disabled'});
  }
  if(!['GET','HEAD'].includes(req.method))return json(res,405,{detail:'method disabled'});
  if(['/puzzles.json','/puzzles-bootstrap.json'].includes(p)&&(controls.failDatabase||controls.failDatabaseRequests>0)){if(controls.failDatabaseRequests>0)controls.failDatabaseRequests--;return json(res,503,{detail:'synthetic database asset outage'})}
  const name=p==='/'?'index.html':decodeURIComponent(p).slice(1);
  if(name.split('/').includes('..'))return json(res,400,{detail:'invalid path'});
  let bytes=asset(name);if(name==='runtime-meta.js'&&bytes)bytes=Buffer.concat([Buffer.from('window.PROPLET_FIRST_STEPS_ENABLED='+JSON.stringify(controls.firstSteps)+';\n'),bytes]);if(!bytes)return json(res,404,{detail:'not found'});
  res.writeHead(200,{'content-type':types[path.extname(name)]||'application/octet-stream','cache-control':'no-store','service-worker-allowed':'/'});res.end(req.method==='HEAD'?undefined:bytes);
 }catch(error){if(!res.headersSent)json(res,400,{detail:error.message});else res.end()}
});
server.listen(Number(process.env.PORT||8765),'127.0.0.1',()=>console.log(`Synthetic onboarding fixture ${sha} on ${server.address().port}`));



