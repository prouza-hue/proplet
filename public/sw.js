const SHELL_CACHE='proplet-v4.02.2-resultdock1';
const DATA_CACHE='proplet-data-v11';
const CACHE_PREFIX='proplet-';
const SHELL=['/runtime-meta.js?v=1','/account-auth.js?v=nickname-layout1','/account-bonus-v3331.js?v=reminders1','/account-conversion-v3331.css?v=1','/account-conversion-v3331.js?v=reminders1','/account-team-v33210.js?v=3','/analytics-init.js','/app-onboarding.css?v=40140-s13b','/app-play.css?v=40140-s13b','/app-profile-settings.css?v=guestcta3','/auth-recovery-guard-v3326.js?v=2','/brand-wordmark-fraunces.css?v=2','/challenge-cta-v3333.css?v=5','/challenge-cta-v3333.js?v=resultdock1','/competitive-sharing-v3331.css?v=1','/competitive-sharing-v3331.js?v=analytics2','/copy-density-v3327.css?v=1','/copy-density-v3327.js?v=2','/desktop-layout-v3330.css?v=3','/difficulty-nudge.css?v=2','/game-release-polish.css?v=3','/gesture-guard-v3325.css?v=1','/onboarding-return-v3332.css?v=1','/printshop-release-polish.js?v=auditphase2-2','/push-retention-v3329.css?v=1','/push-retention-v3329.js?v=settingssimple1','/ranking-polish.css?v=5','/ranking-polish.js?v=3','/results.css?v=resultdock1','/runtime-meta.js?v=gen5preview5','/settings-ia-v40122.js?v=settingssimple1','/settings-polish-v40122.js?v=settingssimple1','/tajenka-cadence-copy.js?v=1','/tajenka-card-polish.css?v=2','/tajenka-card-polish.js?v=invitations1','/tajenka-release-fix.css?v=1','/tajenka-release-fix.js?v=invitations1','/tajenka-runtime-polish.css?v=1','/tajenka-runtime-polish.js?v=idleoffline1','/typography-readability-v1.css?v=1','/valid-word-feedback-v3330.js?v=10','/version.js?v=3','/bootstrap-hydrator.js?v=auditphase2-2','/tajenka-rules.css?v=2','/welcome-feedback.js?v=2','/welcome-feedback.css?v=1','/game.css?v=40140-s13a','/game-layout-v3330.js?v=style-recovery1','/training-layout.css?v=2','/rewards/printshop/pulmesic.svg?v=icons1','/rewards/printshop/challenge.svg?v=icons1','/rewards/printshop/calm.svg?v=icons1','/gesture-guard-v3325.js?v=fixsep8c','/brand/wordmark.svg?v=brand1','/brand/mark-16.png?v=brand1','/manifest.webmanifest?v=share20260912','/favicon.svg?v=brand1','/favicon-32.png?v=brand1','/apple-touch-icon.png?v=brand1','/icon.svg?v=brand1','/icon-192.png?v=brand1','/icon-512.png?v=brand1','/icon-maskable-192.png?v=brand1','/icon-maskable-512.png?v=brand1','/brand/mark.svg?v=brand1','/home-layout.js?v=rankspotlight1','/','/printshop-ui.css?v=fix20','/ribbon-ui.css?v=boardcontrast1','/ribbon-catalog.js?v=rankprogress1','/ribbon-ui.js?v=icons1','/organic-ui-v4023.css?v=avatarflash1','/organic-ui-v4023.js?v=avatareditor1','/styles.css?v=progresscache1','/app.js?v=resultdock1','/app/engagement/onboarding.js?v=boardintro2','/app/engagement/nudges.js?v=idleoffline1','/app/content/progression.js?v=40140-s12b2','/app/content/daily.js?v=40140-s12b2','/app/rankings/rankings.js?v=fixsep8c','/app/core/api-client.js?v=analytics2','/app/analytics.js?v=analytics2','/app/core/storage.js','/app/account/session.js','/app/account/tajenka-storage.js','/app/account/account.js?v=guestcta1','/app/game/state.js','/app/game/board.js?v=starterguide3','/app/game/input.js?v=fix20','/app/game/hints.js?v=boardintro2','/app/core/completion-pipeline.js','/app/core/result-queue.js?v=analytics2','/theme-init.js?v=resultdock1','/footer-hotfix-v40120.js?v=welcome1','/quality-v334.css?v=4','/quality-v334.js?v=calmsettings1','/quality-v334-core-v40114.js?v=calmsettings1','/rank-spotlight.css?v=2','/engagement-polish.css?v=5','/content-release.js?v=reminders1','/content-release.css?v=gen5preview5'];

async function putIfOk(cacheName,request,response){
  if(!response?.ok)return response;
  const cache=await caches.open(cacheName);
  await cache.put(request,response.clone());
  return response;
}

async function precacheShell(){
  const cache=await caches.open(SHELL_CACHE);
  const results=await Promise.allSettled(SHELL.map(async path=>{
    // Every listed shell asset is required. Reject installation on any failure
    // so the previous worker and its complete offline cache remain active.
    const response=await fetch(path,{cache:'no-store'});
    if(!response.ok)throw new Error(`shell-precache-${response.status}: ${path}`);
    await cache.put(path,response);
  }));
  const failed=results.find(result=>result.status==='rejected');
  if(failed){
    // Wait for every writer before deleting this candidate; late writes must
    // not recreate a partial shell. Never touch the previous release here.
    await caches.delete(SHELL_CACHE);
    throw failed.reason;
  }
}

async function preserveExistingPuzzleDatabase(){
  try{
    const existing=await caches.match('/puzzles.json',{ignoreSearch:true});
    if(existing?.ok){const data=await existing.clone().json();if(Number(data?.contentGeneration)===4&&Number(data?.dailyGeneration)===4)await (await caches.open(DATA_CACHE)).put('/puzzles.json',existing.clone())}
  }catch{}
}

self.addEventListener('install',e=>{
  e.waitUntil(Promise.all([precacheShell(),preserveExistingPuzzleDatabase()]).then(()=>self.skipWaiting()));
});
self.addEventListener('message',e=>{if(e.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil((async()=>{
  const keep=new Set([SHELL_CACHE,DATA_CACHE]);
  await caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(CACHE_PREFIX)&&!keep.has(k)).map(k=>caches.delete(k))));
  await self.clients.claim();
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  // Activation must not reboot a game or discard its in-memory/local state.
  // Each page applies the update automatically when its own game and
  // dialogs are closed; background/offline pages wait until they return.
  clients.forEach(client=>client.postMessage({type:'PROPLET_SW_UPDATED',shell:SHELL_CACHE}));
})()));

async function networkFirst(request,cacheName,fallback){
  try{return await putIfOk(cacheName,request,await fetch(request))}
  catch{
    const cached=await caches.match(request,{ignoreSearch:request.mode==='navigate'});
    if(cached)return cached;
    if(fallback)return (await caches.match(fallback))||Response.error();
    return Response.error();
  }
}

async function cacheFirst(request){
  const cached=await caches.match(request);
  if(cached)return cached;
  return putIfOk(SHELL_CACHE,request,await fetch(request));
}

async function staleWhileRevalidate(event){
  const cached=await caches.match(event.request);
  const refresh=fetch(event.request,{cache:'no-store'}).then(r=>putIfOk(DATA_CACHE,event.request,r));
  if(cached){event.waitUntil(refresh.catch(()=>{}));return cached}
  return refresh;
}

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.origin!==self.location.origin)return;
  if(u.pathname.startsWith('/_vercel/'))return;
  if(u.pathname==='/api/rolling-content'){
    e.respondWith(staleWhileRevalidate(e).catch(async()=>await caches.match(e.request)||Response.error()));
    return;
  }
  if(u.pathname==='/puzzles.json'){
    e.respondWith(networkFirst(e.request,DATA_CACHE));
    return;
  }
  if(u.pathname.startsWith('/api/'))return;
  if(e.request.mode==='navigate'){
    e.respondWith(networkFirst(e.request,SHELL_CACHE,'/'));
    return;
  }
  e.respondWith(cacheFirst(e.request).catch(async()=>await caches.match(e.request)||Response.error()));
});

self.addEventListener('push',event=>{
  let data={};
  try{data=event.data?.json?.()||{}}catch{try{data={body:event.data?.text?.()||''}}catch{}}
  const title=data.title||'☀️ Nový Proplet je tady';
  const options={
    body:data.body||'Dnešní výzva čeká.',
    icon:'/icon.svg',
    badge:'/icon.svg',
    tag:data.tag||'proplet-daily',
    renotify:false,
    data:{url:data.url||'/?open=daily',deliveryId:data.deliveryId||null}
  };
  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||'/?open=daily',self.location.origin).href;
  const deliveryId=event.notification.data?.deliveryId;
  const trackOpen=deliveryId
    ?fetch(`https://hrajproplet.cz/api/push/open?delivery_id=${encodeURIComponent(deliveryId)}`,{method:'POST',mode:'no-cors',keepalive:true}).catch(()=>null)
    :Promise.resolve(null);
  const openTarget=(async()=>{
    const clientsList=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of clientsList){
      if('navigate' in client){try{await client.navigate(target)}catch{}}
      if('focus' in client)return client.focus();
    }
    return self.clients.openWindow(target);
  })();
  event.waitUntil(Promise.all([trackOpen,openTarget]));
});
