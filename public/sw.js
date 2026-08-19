const CACHE='proplet-v3.32.6-auth-recovery-r1';
const CORE=['/','/index.html','/styles.css','/app.js','/theme-init.js','/runtime-meta.js','/version.js','/home-layout.css','/home-layout.js','/ranking-polish.css','/ranking-polish.js','/account-auth.css','/account-auth.js','/auth-recovery-guard-v3326.js','/google-g.svg','/today-brand.css','/onboarding-fit.css','/game-layout-v3323.css','/game-layout-v3323.js','/difficulty-nudge.css','/difficulty-nudge.js','/win-actions-v3324.css','/gesture-guard-v3325.css','/gesture-guard-v3325.js','/puzzles.json','/manifest.webmanifest','/icon.svg','/icon-192.png','/icon-512.png','/apple-touch-icon.png','/favicon.svg','/favicon-32.png','/share-card.png','/difficulty/easy.svg','/difficulty/medium.svg','/difficulty/hard.svg','/difficulty/hardcore.svg','/privacy.html','/terms.html','/legal.css'];

self.addEventListener('install',e=>{
  // Nevoláme skipWaiting automaticky: hráč dostane v appce viditelnou nabídku aktualizace.
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)));
});
self.addEventListener('message',e=>{if(e.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil(Promise.all([
  self.clients.claim(),
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
])));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.pathname==='/api/rolling-content'||u.pathname==='/puzzles.json'){
    // /api/rolling-content carries a Monday week= cache key; a new content week therefore cannot be shadowed by last week's response.
    // Herní banka je velká a mění se jen s releasem. Start aplikace proto nikdy
    // neblokujeme sítí: použijeme cache a čerstvou kopii obnovíme na pozadí.
    e.respondWith(caches.match(e.request).then(cached=>{
      const refresh=fetch(e.request,{cache:'no-store'}).then(r=>{
        if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}
        return r;
      });
      if(cached){e.waitUntil(refresh.catch(()=>{}));return cached;}
      return refresh;
    }).catch(()=>fetch(e.request,{cache:'no-store'})));
    return;
  }
  if(u.pathname.startsWith('/api/'))return; // Ostatní API se nikdy necachuje.
  e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{
    const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r;
  }).catch(()=>caches.match(e.request)));
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
