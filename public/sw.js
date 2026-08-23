const SHELL_CACHE='proplet-v4.01.0-shell';
const DATA_CACHE='proplet-data-v11';
const CACHE_PREFIX='proplet-';
const SHELL=['/','/styles.css','/app.js','/theme-init.js','/runtime-meta.js','/quality-v334.css','/quality-v334.js'];

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
    if(existing?.ok)await (await caches.open(DATA_CACHE)).put('/puzzles.json',existing.clone());
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
  // v4.00.1 could show its update banner after the new worker had already
  // activated, leaving its button with no waiting worker to promote. This
  // one-time handover actively refreshes controlled windows onto the P0 fix.
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  // Do not await navigation from inside activate: an older controlled page can
  // wait for activation while activation waits for that page, deadlocking both.
  clients.forEach(client=>client.navigate(client.url).catch(()=>null));
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
    data:{url:data.url||'/?open=daily'}
  };
  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||'/?open=daily',self.location.origin).href;
  event.waitUntil((async()=>{
    const clientsList=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of clientsList){
      if('navigate' in client){try{await client.navigate(target)}catch{}}
      if('focus' in client)return client.focus();
    }
    return self.clients.openWindow(target);
  })());
});
