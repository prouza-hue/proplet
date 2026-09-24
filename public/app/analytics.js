(function installProductAnalytics(global) {
  'use strict';

  const DEFAULT_ENDPOINT = '/api/product-event';
  const MAX_EVENTS_PER_FLUSH = 100;

  function create(options = {}) {
    const request = typeof options.request === 'function' ? options.request : null;
    const isDisabled = typeof options.isDisabled === 'function' ? options.isDisabled : () => false;
    const endpoint = String(options.endpoint || DEFAULT_ENDPOINT);
    const storage = options.storage;
    const now = options.now || (() => Date.now());
    const getScope = options.getScope || (() => 'guest');
    const key = scope => `proplet-events-v2:${scope}`;
    const read = scope => {try{return JSON.parse(storage.getItem(key(scope)) || '[]').filter(e=>now()-e.at<7*86400000)}catch{return []}};
    const save = (scope,rows) => {try{storage.setItem(key(scope),JSON.stringify(rows))}catch{}};
    let pendingFlush = null;
    let retryAt = 0;
    function adoptGuest(anonymousId, playerId) {
      if(!storage)return;
      const from=`a:${anonymousId}`,to=`p:${playerId}`,rows=read(from);
      save(to,[...read(to),...rows]);save(from,[]);
    }
    function flush(){
      if(!storage || !request || isDisabled() || now()<retryAt)return Promise.resolve();
      if(pendingFlush)return pendingFlush;
      const scope=getScope(),authProfile=options.getProfile?.() || null;
      pendingFlush=(async()=>{
        // Re-read after each request: track() can append while this flush is in flight.
        // Bound the drain and remember IDs so failed storage writes cannot cause a loop.
        const attempted=new Set();
        while(attempted.size<MAX_EVENTS_PER_FLUSH){
          const row=read(scope).find(e=>!attempted.has(e.id));
          if(!row)break;
          attempted.add(row.id);
          try{
            await request(row.endpoint||endpoint,{method:'POST',body:JSON.stringify({event_type:row.event}),authProfile,
              headers:{...row.headers,'X-Proplet-Event-ID':row.id,'X-Proplet-Event-Time':new Date(row.at).toISOString()}});
            save(scope,read(scope).filter(e=>e.id!==row.id));
          }catch(error){
            // A permanently rejected event must not block all later events.
            if(error?.status===400){save(scope,read(scope).filter(e=>e.id!==row.id));continue;}
            retryAt=now()+Math.max(60000,Number(error?.retryAfterMs)||0);break;
          }
        }
      })().finally(()=>{pendingFlush=null;});
      return pendingFlush;
    }

    function track(eventType, _properties, targetEndpoint=endpoint) {
      if (!request || isDisabled()) return;
      if(storage){
        const scope=getScope(),rows=read(scope);
        rows.push({id:global.crypto.randomUUID(),event:eventType,endpoint:targetEndpoint,at:now(),headers:options.getHeaders?.(eventType,_properties) || {}});
        save(scope,rows);flush();return;
      }
      try {
        const pending = request(targetEndpoint, {
          method: 'POST',
          body: JSON.stringify({event_type: eventType}),
        });
        Promise.resolve(pending).catch(() => {});
      } catch (_) {}
    }

    return {track,flush,adoptGuest,trackChallenge:(event,properties)=>track(event,properties,'/api/challenge-event')};
  }

  const api = {create, DEFAULT_ENDPOINT};
  if (global) global.PropletAnalytics = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : globalThis);
