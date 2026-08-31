const SHELL_CACHE='proplet-v4.01.39-data-consistency-shell';
const DATA_CACHE='proplet-data-v11';
const CACHE_PREFIX='proplet-';
const SHELL=['/','/styles.css','/app.js','/app/core/api-client.js','/app/core/storage.js','/app/core/result-queue.js','/theme-init.js?v=40135','/runtime-meta.js','/analytics-init.js','/quality-v334.css?v=4','/quality-v334.js?v=40132','/quality-v334-core-v40114.js?v=40132','/daily-win-menu-v40123.js?v=1'];

async function putIfOk(cacheName,request,response){
  if(!response?.ok)return response;
  const cache=await caches.open(cacheName);
  await cache.put(request,response.clone());
  return response;
}

async function precacheShell(){
  const cache=await caches.open(SHELL_CACHE);
  await Promise.all(SHELL.map(async path=>{
    try{
      const response=await fetch(path,{cache:'no-store'});
      if(response.ok)await cache.put(path,response);
    }catch{}
  }));
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
  // The page can apply the update later through the existing explicit
  // SKIP_WAITING handshake and controllerchange reload path.
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
