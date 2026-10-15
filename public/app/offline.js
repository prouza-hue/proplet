/* Public game content only. Player state and the result queue retain their own scoped stores. */
(()=>{
'use strict';
const INDEX='proplet-offline-index-v1',ACTIVE='/__proplet-offline__/active',PREFIX='proplet-offline-content-v1-';
const DIFFICULTIES=['easy','medium','hard','hardcore','mozkomor','mozkokalypsa'];
const ARCHIVE_REWARDS={easy:15,medium:25,hard:50,hardcore:100};
const MANIFEST='/api/offline-manifest',BANK='/puzzles.json',ARCHIVE='/api/archive/offline';
const noop=()=>{};
function create(deps={}){
 const host=deps.window||window,nav=deps.navigator||host.navigator||{},doc=deps.document||host.document;
 const storage=deps.caches||host.caches,fetcher=deps.fetch||(host.fetch&&host.fetch.bind(host));
 const ResponseClass=deps.Response||host.Response,Channel=deps.MessageChannel||host.MessageChannel;
 const Abort=deps.AbortController||host.AbortController,crypto=deps.crypto||host.crypto;
 const Encoder=deps.TextEncoder||host.TextEncoder,Decoder=deps.TextDecoder||host.TextDecoder;
 const later=deps.setTimeout||host.setTimeout.bind(host),cancel=deps.clearTimeout||host.clearTimeout.bind(host);
 const now=deps.now||Date.now,timeout=deps.timeoutMs||20000;
 const clone=value=>typeof host.structuredClone==='function'?host.structuredClone(value):JSON.parse(JSON.stringify(value));
 let options={},bound=false,observedInstall=false,persistRequested=false,flight=null,activeFlight=null,memo=null,checkedManifest=null,lastManifestCheck=0,sequence=0;
 let shellReady=false;
 const controllers=new Set();
 let state={preparing:false,contentReady:false,ready:false,offline:nav.onLine===false,pending:0,error:null,updatedAt:null};
 function getState(){return {...state};}
 function publish(patch){
  const changed=Object.entries(patch).some(([key,value])=>state[key]!==value);
  state={...state,...patch};
  if(changed)try{const out=options.onChange?.(getState());out?.catch?.(noop);}catch{}
  return getState();
 }
 function installed(){
  try{return observedInstall||(typeof options.isInstalled==='function'?options.isInstalled()===true:options.isInstalled===true)||nav.standalone===true||host.matchMedia?.('(display-mode: standalone)').matches===true;}catch{return observedInstall;}
 }
 function supported(){return !!(storage?.open&&fetcher&&ResponseClass&&Channel&&Abort&&Encoder&&Decoder&&nav.serviceWorker);}
 function persist(){
  if(persistRequested||!installed())return;persistRequested=true;
  try{Promise.resolve(nav.storage?.persist?.()).catch(noop);}catch{}
 }
 async function accountReady(){
  try{const profile=await options.getProfile?.(),id=profile?.id||'';const available=!id||await options.hasCachedProgress?.(profile)===true;return available&&((await options.getProfile?.())?.id||'')===id;}catch{return false;}
 }
 async function pending(){try{const value=Number(await options.getPendingCount?.());return Number.isFinite(value)?Math.max(0,Math.floor(value)):0;}catch{return 0;}}
 function manifestValue(data){
  if(data?.schemaVersion!==1||typeof data.archiveEnabled!=='boolean'||typeof data.bankVersion!=='string'||!(/^(?:sha256:)?[a-f0-9]{64}$/i).test(data.bankVersion)||data.archiveEdition!=='free-gen3-v1'||typeof data.archiveRevision!=='string'||!data.archiveRevision||data.archiveRevision.length>120||typeof data.version!=='string'||!data.version||data.version.length>80||(data.rollingVersion!==undefined&&(typeof data.rollingVersion!=='string'||!data.rollingVersion||data.rollingVersion.length>160))||!(/^\/api\/rolling-content\?week=\d{4}-\d{2}-\d{2}$/).test(data.rollingUrl||''))throw Error('offline-manifest-invalid');
  return {schemaVersion:1,bankVersion:data.bankVersion.toLowerCase(),archiveEnabled:data.archiveEnabled,archiveRevision:data.archiveRevision,archiveEdition:data.archiveEdition,rollingUrl:data.rollingUrl,rollingVersion:data.rollingVersion||data.rollingUrl,version:data.version};
 }
 function sameManifest(a,b){return !!a&&!!b&&JSON.stringify(a)===JSON.stringify(b);}
 const normalized=word=>String(word||'').normalize('NFC').trim().toUpperCase();
 function validateCover(puzzle,cover){
  if(!Array.isArray(cover)||!cover.length||cover.length!==puzzle.answers.length)throw Error('offline-solution-invalid');
  const active=new Set(puzzle.mask),used=new Set(),words=new Set();
  const lengths=cover.map(a=>normalized(a?.word).length).sort((a,b)=>a-b);
  const expected=puzzle.answers.map(a=>normalized(a?.word).length).sort((a,b)=>a-b);
  if(JSON.stringify(lengths)!==JSON.stringify(expected))throw Error('offline-solution-invalid');
  for(const answer of cover){
   const word=normalized(answer?.word),path=answer?.path;
   if(!word||words.has(word)||!Array.isArray(path)||path.length!==word.length||path.map(cell=>puzzle.letters[cell]||'').join('')!==word)throw Error('offline-solution-invalid');
   words.add(word);
   for(let i=0;i<path.length;i++){
    const cell=path[i];
    if(!Number.isInteger(cell)||!active.has(cell)||used.has(cell))throw Error('offline-solution-invalid');
    if(i){const before=path[i-1],distance=Math.abs(Math.floor(before/puzzle.cols)-Math.floor(cell/puzzle.cols))+Math.abs(before%puzzle.cols-cell%puzzle.cols);if(distance!==1)throw Error('offline-solution-invalid');}
    used.add(cell);
   }
  }
  if(used.size!==active.size)throw Error('offline-solution-invalid');
 }
 function playable(puzzle,difficulty){
  if(!puzzle||typeof puzzle.id!=='string'||!puzzle.id||![...DIFFICULTIES,'rescue'].includes(puzzle.difficulty)||(difficulty&&puzzle.difficulty!==difficulty)||!Number.isInteger(puzzle.rows)||!Number.isInteger(puzzle.cols)||puzzle.rows<1||puzzle.cols<1||puzzle.rows>32||puzzle.cols>32||!Array.isArray(puzzle.letters)||puzzle.letters.length!==puzzle.rows*puzzle.cols||!Array.isArray(puzzle.mask)||!puzzle.mask.length||new Set(puzzle.mask).size!==puzzle.mask.length||puzzle.mask.some(cell=>!Number.isInteger(cell)||cell<0||cell>=puzzle.letters.length||typeof puzzle.letters[cell]!=='string'||puzzle.letters[cell].length!==1)||!Array.isArray(puzzle.answers)||!puzzle.answers.length)throw Error('offline-puzzle-invalid');
  validateCover(puzzle,puzzle.answers);return puzzle;
 }
 function bankValue(data){
  if(data?.bootstrapSchema||![9,10,11].includes(Number(data?.version))||Number(data?.contentGeneration)!==4||Number(data?.dailyGeneration)!==4||!data.free)throw Error('offline-bank-invalid');
  const ids=new Set();
  for(const diff of DIFFICULTIES){
   if(!Array.isArray(data.free[diff])||!data.free[diff].length)throw Error('offline-bank-incomplete');
   const levels=new Set();
   for(const puzzle of data.free[diff]){
    playable(puzzle,diff);
    const level=puzzle.meta?.level;
    if(Number(puzzle.meta?.contentGeneration)!==4||!Number.isInteger(level)||level<1||levels.has(level)||ids.has(puzzle.id))throw Error('offline-bank-binding-invalid');
    levels.add(level);ids.add(puzzle.id);
   }
  }
  for(const key of ['daily','rescue'])if(Array.isArray(data[key]))for(const puzzle of data[key])if(puzzle?.meta?.retiredFutureDaily!==true)playable(puzzle);
  if(data.starter)playable(data.starter);
  return data;
 }
 function rollingValue(data){
  if(![1,2].includes(Number(data?.version))||!data.puzzles||typeof data.puzzles!=='object'||typeof data.asOf!=='string'||!(/^\d{4}-\d{2}-\d{2}$/).test(data.asOf))throw Error('offline-rolling-invalid');
  for(const [diff,puzzles] of Object.entries(data.puzzles)){
   if(!DIFFICULTIES.includes(diff)||!Array.isArray(puzzles))throw Error('offline-rolling-invalid');
   for(const puzzle of puzzles){playable(puzzle,diff);if(!Number.isInteger(puzzle.meta?.level)||puzzle.meta.level<1)throw Error('offline-rolling-invalid');}
  }
  return {version:Number(data.version),asOf:data.asOf,puzzles:data.puzzles,meta:data.meta||{},latestBatch:data.latestBatch||null,nextRelease:data.nextRelease||null,availableFreeCounts:data.availableFreeCounts||{}};
 }
 function puzzleIdentity(puzzle){return JSON.stringify({id:puzzle.id,difficulty:puzzle.difficulty,rows:puzzle.rows,cols:puzzle.cols,mask:puzzle.mask,letters:puzzle.letters,answers:puzzle.answers.map(answer=>({word:normalized(answer.word),path:answer.path}))});}
 function merge(bank,rolling){
  const result=clone(bank),ids=new Set(DIFFICULTIES.flatMap(diff=>result.free[diff].map(puzzle=>puzzle.id)));
  for(const diff of DIFFICULTIES){
   const base=result.free[diff],byId=new Map(base.map(puzzle=>[puzzle.id,puzzle])),levels=new Set(base.map(puzzle=>puzzle.meta.level));
   for(const puzzle of rolling.puzzles[diff]||[]){
    if(byId.has(puzzle.id)){if(puzzleIdentity(byId.get(puzzle.id))!==puzzleIdentity(puzzle))throw Error('offline-rolling-binding-invalid');continue;}
    if(ids.has(puzzle.id)||levels.has(puzzle.meta.level))throw Error('offline-rolling-binding-invalid');
    base.push(clone(puzzle));byId.set(puzzle.id,puzzle);ids.add(puzzle.id);levels.add(puzzle.meta.level);
   }
   base.sort((a,b)=>a.meta.level-b.meta.level);
  }
  result.rollingContent={...(result.rollingContent||{}),...rolling.meta};
  result.contentStatus={asOf:rolling.asOf,latestBatch:rolling.latestBatch,nextRelease:rolling.nextRelease,availableFreeCounts:rolling.availableFreeCounts};
  return result;
 }
 function coverKey(cover){return cover.map(a=>normalized(a.word)+':'+a.path.join(',')).sort().join('|');}
 function archiveValue(data,manifest){
  if(data?.formatVersion!==1||data.boardCount!==800||data.editionId!==manifest.archiveEdition||data.solutionPolicyRevision!==manifest.archiveRevision||data.completeCovers!==879||!Array.isArray(data.boards)||data.boards.length!==800||!Array.isArray(data.entries)||data.entries.length!==800)throw Error('offline-archive-invalid');
  const rows=new Map(),slots=new Set(),counts={easy:0,medium:0,hard:0,hardcore:0};
  const boards=data.boards.map(row=>{
   if(!row||typeof row.puzzleId!=='string'||!row.puzzleId||!Object.hasOwn(ARCHIVE_REWARDS,row.difficulty)||!Number.isInteger(row.level)||row.level<1||row.level>200||row.rewardXp!==ARCHIVE_REWARDS[row.difficulty]||row.rewardSlotKey!=='legacy-free:'+row.difficulty+':'+row.level||rows.has(row.puzzleId)||slots.has(row.rewardSlotKey))throw Error('offline-archive-binding-invalid');
   const safe={puzzleId:row.puzzleId,level:row.level,difficulty:row.difficulty,rewardXp:row.rewardXp,rewardSlotKey:row.rewardSlotKey};
   rows.set(row.puzzleId,safe);slots.add(row.rewardSlotKey);counts[row.difficulty]++;return safe;
  });
  const ids=new Set();let totalCovers=0;
  const entries=data.entries.map(entry=>{
   const puzzle=entry?.puzzle,solutions=entry?.solutions,row=rows.get(puzzle?.id);
   if(!row||ids.has(puzzle.id)||entry.editionId!==manifest.archiveEdition||entry.level!==row.level||entry.difficulty!==row.difficulty||entry.rewardXp!==row.rewardXp||entry.rewardSlotKey!==row.rewardSlotKey||puzzle.meta?.level!==row.level||puzzle.meta?.contentGeneration!==3||solutions?.puzzleId!==row.puzzleId||solutions.gameplayScope!=='archive'||solutions.solutionPolicyRevision!==manifest.archiveRevision||!Array.isArray(solutions.solutionSets)||!solutions.solutionSets.length)throw Error('offline-archive-binding-invalid');
   playable(puzzle,row.difficulty);
   if(JSON.stringify(solutions.solutionSets[0].map(a=>({word:normalized(a.word),path:a.path})))!==JSON.stringify(puzzle.answers.map(a=>({word:normalized(a.word),path:a.path}))))throw Error('offline-archive-canonical-invalid');
   const covers=new Set();
   for(const cover of solutions.solutionSets){validateCover(puzzle,cover);const key=coverKey(cover);if(covers.has(key))throw Error('offline-archive-duplicate-cover');covers.add(key);}
   totalCovers+=covers.size;ids.add(puzzle.id);
   const safeSolutions={puzzleId:row.puzzleId,gameplayScope:'archive',solutionPolicyRevision:manifest.archiveRevision,solutionSets:solutions.solutionSets};
   if(solutions.originalContentKey)safeSolutions.originalContentKey=solutions.originalContentKey;
   return {editionId:manifest.archiveEdition,puzzle,level:row.level,difficulty:row.difficulty,rewardXp:row.rewardXp,rewardSlotKey:row.rewardSlotKey,solutions:safeSolutions};
  });
  if(totalCovers!==879||Object.values(counts).some(count=>count!==200))throw Error('offline-archive-incomplete');
  return {formatVersion:1,boardCount:800,editionId:manifest.archiveEdition,solutionPolicyRevision:manifest.archiveRevision,completeCovers:879,boards,entries};
 }
 async function digest(bytes){
  if(!crypto?.subtle?.digest)return null;
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
 }
 async function verifyBank(bytes,manifest){const hash=await digest(bytes);if(hash&&hash!==manifest.bankVersion.replace(/^sha256:/,''))throw Error('offline-bank-integrity');}
 function jsonResponse(data){return new ResponseClass(JSON.stringify(data),{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=31536000, immutable'}});}
 async function request(url){
  const controller=new Abort();controllers.add(controller);let timer;
  try{
   return await Promise.race([(async()=>{
    const response=await fetcher(url,{cache:'no-store',credentials:'omit',headers:{Accept:'application/json'},signal:controller.signal});
    if(!response?.ok||response.type==='opaque')throw Error('offline-download-failed');
    const bytes=await response.arrayBuffer();
    const data=JSON.parse(new Decoder().decode(bytes));
    return {bytes,data,response:new ResponseClass(bytes,{headers:{'Content-Type':'application/json'}})};
   })(),new Promise((_,reject)=>{timer=later(()=>{controller.abort();reject(Error('offline-download-timeout'));},timeout);})]);
  }finally{cancel(timer);controllers.delete(controller);}
 }
 async function shell(){
  if(!nav.serviceWorker||!Channel)return false;
  let timer,channel;
  try{
   return await Promise.race([(async()=>{
    const registration=await nav.serviceWorker.ready,worker=nav.serviceWorker.controller||registration?.active;
    if(!worker?.postMessage)return false;
    channel=new Channel();
    return await new Promise(resolve=>{
     channel.port1.onmessage=event=>resolve(event?.data?.ready===true);
     channel.port1.onmessageerror=()=>resolve(false);
     worker.postMessage({type:'GET_OFFLINE_STATUS'},[channel.port2]);
    });
   })(),new Promise(resolve=>{timer=later(()=>resolve(false),timeout);})]);
  }catch{return false;}finally{cancel(timer);try{channel?.port1.close();channel?.port2.close();}catch{}}
 }
 async function pointer(){
  if(!storage?.open||!ResponseClass)return null;
  try{
   const response=await(await storage.open(INDEX)).match(ACTIVE);if(!response)return null;
   const value=await response.json(),manifest=manifestValue(value.manifest);
   if(value.schemaVersion!==1||typeof value.cacheName!=='string'||!value.cacheName.startsWith(PREFIX)||!(/^[a-z0-9-]+$/i).test(value.cacheName)||typeof value.updatedAt!=='string')return null;
   return {schemaVersion:1,cacheName:value.cacheName,manifest,updatedAt:value.updatedAt};
  }catch{return null;}
 }
 function loadActive(){
  if(!activeFlight)activeFlight=readActive().finally(()=>{activeFlight=null;});
  return activeFlight;
 }
 async function readActive(){
  const index=await pointer();if(!index){memo=null;return null;}
  try{
   const cache=await storage.open(index.cacheName);
   const keys=[MANIFEST,BANK,index.manifest.rollingUrl,...(index.manifest.archiveEnabled?[ARCHIVE]:[])];
   const responses=await Promise.all(keys.map(key=>cache.match(key)));
   if(responses.some(response=>!response?.ok)){memo=null;return null;}
   if(memo?.cacheName===index.cacheName&&sameManifest(memo.manifest,index.manifest))return memo;
   const manifest=manifestValue(await responses[0].json());if(!sameManifest(manifest,index.manifest))throw Error('offline-cache-binding-invalid');
   const bytes=await responses[1].arrayBuffer();await verifyBank(bytes,manifest);
   const bank=bankValue(JSON.parse(new Decoder().decode(bytes))),rolling=rollingValue(await responses[2].json());
   const archive=manifest.archiveEnabled?archiveValue(await responses[3].json(),manifest):null;
   const merged=merge(bank,rolling);
   memo={...index,bank,rolling,archive,merged,entries:new Map((archive?.entries||[]).map(entry=>[entry.puzzle.id,entry]))};
   return memo;
  }catch{memo=null;return null;}
 }
 async function refresh({checkShell=false}={}){
  const active=await loadActive();
  if(checkShell)shellReady=await shell();
  const count=await pending(),privateReady=await accountReady();
  return publish({contentReady:!!active,ready:!!active&&shellReady&&privateReady&&installed(),offline:nav.onLine===false,pending:count,updatedAt:active?.updatedAt||null});
 }
 async function cacheName(manifest){
  const value=JSON.stringify(manifest),hash=await digest(new Encoder().encode(value));
  let fallback=2166136261;for(let i=0;i<value.length;i++)fallback=Math.imul(fallback^value.charCodeAt(i),16777619);
  // A unique candidate never overwrites a live cache, including forced retries
  // of the same manifest and preparations racing in two open tabs.
  return PREFIX+(hash?.slice(0,24)||(fallback>>>0).toString(16))+'-'+now().toString(36)+'-'+(++sequence).toString(36)+'-'+Math.random().toString(36).slice(2,9);
 }
 async function cachedResource(active,key){
  if(!active)return null;const response=await(await storage.open(active.cacheName)).match(key);
  return response?{response}:null;
 }
 function prepare({force=false}={}){
  if(flight)return flight;
  flight=(async()=>{
   let candidate=null,committed=false,previous=null;
   try{
    publish({offline:nav.onLine===false,pending:await pending()});
    if(!installed())return await refresh();
    persist();
    if(nav.onLine===false)return await refresh({checkShell:true});
    if(!supported()){publish({ready:false,error:'offline-not-supported'});return await refresh();}
    previous=await loadActive();
    if(!force&&checkedManifest&&previous&&sameManifest(checkedManifest,previous.manifest)){shellReady=await shell();if(!shellReady)throw Error('offline-shell-incomplete');publish({error:null});return await refresh();}
    publish({preparing:true,error:null});
    const manifest=manifestValue((await request(MANIFEST)).data);checkedManifest=manifest;lastManifestCheck=now();
    if(previous&&sameManifest(previous.manifest,manifest)){
     shellReady=await shell();
     if(!shellReady)throw Error('offline-shell-incomplete');
     return await refresh();
    }
    candidate=await cacheName(manifest);
    const cache=await storage.open(candidate),old=previous?.manifest;
    const bankTask=(async()=>{
     const cached=old?.bankVersion===manifest.bankVersion?await cachedResource(previous,BANK):null;
     if(cached)return {response:cached.response,data:previous.bank};
     const resource=await request(BANK);await verifyBank(resource.bytes,manifest);resource.data=bankValue(resource.data);return resource;
    })();
    const rollingTask=(async()=>{
     const cached=old?.rollingUrl===manifest.rollingUrl&&old.rollingVersion===manifest.rollingVersion?await cachedResource(previous,manifest.rollingUrl):null;
     if(cached)return {response:cached.response,data:previous.rolling};
     const resource=await request(manifest.rollingUrl);resource.data=rollingValue(resource.data);return resource;
    })();
    const archiveTask=(async()=>{
     if(!manifest.archiveEnabled)return null;
     const cached=old?.archiveEnabled&&old.archiveEdition===manifest.archiveEdition&&old.archiveRevision===manifest.archiveRevision?await cachedResource(previous,ARCHIVE):null;
     if(cached)return {response:cached.response,data:previous.archive};
     const resource=await request(ARCHIVE);resource.data=archiveValue(resource.data,manifest);return resource;
    })();
    const [bank,rolling,archive]=await Promise.all([bankTask,rollingTask,archiveTask]);
    const merged=merge(bank.data,rolling.data);
    await cache.put(BANK,bank.response);
    await cache.put(manifest.rollingUrl,jsonResponse(rolling.data));
    if(archive)await cache.put(ARCHIVE,jsonResponse(archive.data));
    await cache.put(MANIFEST,jsonResponse(manifest));
    shellReady=await shell();if(!shellReady)throw Error('offline-shell-incomplete');
    const index={schemaVersion:1,cacheName:candidate,manifest,updatedAt:new Date(now()).toISOString()};
    // This single write is the commit point. A failed transfer/quota write above
    // leaves the former complete pack and its pointer untouched.
    await(await storage.open(INDEX)).put(ACTIVE,jsonResponse(index));committed=true;
    memo={...index,bank:bank.data,rolling:rolling.data,archive:archive?.data||null,merged,entries:new Map((archive?.data.entries||[]).map(entry=>[entry.puzzle.id,entry]))};
    await refresh();
    if(previous&&previous.cacheName!==candidate){try{if((await pointer())?.cacheName===candidate)await storage.delete(previous.cacheName);}catch{}}
   }catch(error){
    for(const controller of controllers)controller.abort();
    if(candidate&&!committed)try{if((await pointer())?.cacheName!==candidate)await storage.delete(candidate);}catch{}
    const label=/^offline-[a-z-]+$/.test(error?.message||'')?error.message:'offline-download-failed';
    publish({error:label});
    await refresh();
   }finally{publish({preparing:false});}
   return getState();
  })().then(()=>getState()).catch(()=>publish({preparing:false,ready:false,error:'offline-storage-unavailable'})).finally(()=>{flight=null;});
  return flight;
 }
 function listen(target,name,handler){try{target?.addEventListener?.(name,handler);}catch{}}
 function bind(){
  if(bound)return;bound=true;
  const safely=task=>Promise.resolve(task).catch(noop);
  listen(host,'online',()=>{publish({offline:false});safely(prepare({force:true}));});
  listen(host,'offline',()=>{publish({offline:true});safely(refresh({checkShell:installed()}));});
  listen(host,'appinstalled',()=>{observedInstall=true;persist();safely(prepare({force:true}));});
  listen(doc,'visibilitychange',()=>{if(doc?.visibilityState!=='hidden')safely(installed()?prepare({force:!!state.error||now()-lastManifestCheck>=60000}):refresh());});
  for(const event of ['proplet:account-changed','proplet:profile-refreshed','proplet:ready'])listen(doc,event,()=>safely(installed()?prepare():refresh()));
  listen(doc,'proplet:queue-changed',()=>safely(refresh()));
  listen(nav.serviceWorker,'controllerchange',()=>safely(installed()?prepare({force:true}):refresh()));
 }
 async function install(next={}){
  options={...options,...next};bind();persist();
  try{if(installed()&&nav.onLine!==false)return await prepare();return await refresh({checkShell:installed()});}
  catch{return publish({ready:false,error:'offline-storage-unavailable'});}
 }
 async function getPublicConfig(){try{const active=await loadActive();return active?{archiveEnabled:active.manifest.archiveEnabled===true}:null;}catch{return null;}}
 async function getArchiveCatalogue(){try{const active=await loadActive(),archive=active?.archive;if(!archive)return null;return clone({editionId:archive.editionId,solutionPolicyRevision:archive.solutionPolicyRevision,completeCovers:archive.completeCovers,boards:archive.boards});}catch{return null;}}
 async function getArchiveEntry(id){try{const entry=(await loadActive())?.entries.get(id);return entry?clone(entry):null;}catch{return null;}}
 async function getPuzzleDatabase(){try{const active=await loadActive();return active?clone(active.merged):null;}catch{return null;}}
 return {install,prepare,getState,getPublicConfig,getArchiveCatalogue,getArchiveEntry,getPuzzleDatabase};
}
window.PropletOffline={...create(),create};
})();
