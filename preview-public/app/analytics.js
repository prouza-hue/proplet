(function installProductAnalytics(global) {
  'use strict';

  const DEFAULT_ENDPOINT = '/api/product-event';
  const BATCH_ENDPOINT = '/api/product-events';
  const MAX_BATCH_SIZE = 20;
  const MAX_EVENTS_PER_FLUSH = 100;

  function create(options = {}) {
    const request = typeof options.request === 'function' ? options.request : null;
    const isDisabled = typeof options.isDisabled === 'function' ? options.isDisabled : () => false;
    // true sends, false discards, null/undefined waits for policy initialization.
    const shouldSend = typeof options.shouldSend === 'function' ? options.shouldSend : () => true;
    const endpoint = String(options.endpoint || DEFAULT_ENDPOINT);
    const storage = options.storage;
    const now = options.now || (() => Date.now());
    const getScope = options.getScope || (() => 'guest');
    const key = scope => `proplet-events-v2:${scope}`;
    const read = scope => {try{return JSON.parse(storage.getItem(key(scope)) || '[]').filter(e=>now()-e.at<7*86400000)}catch{return []}};
    const save = (scope,rows) => {try{storage.setItem(key(scope),JSON.stringify(rows))}catch{}};
    const pendingRows = scope => {
      const rows=read(scope), permitted=rows.filter(row=>shouldSend(row.event)!==false);
      if(permitted.length!==rows.length)save(scope,permitted);
      return permitted;
    };
    let pendingFlush = null;
    let flushTimer = null;
    const schedule = options.setTimeout || global.setTimeout.bind(global);
    const cancel = options.clearTimeout || global.clearTimeout.bind(global);
    function scheduleFlush(){
      if(flushTimer===null)flushTimer=schedule(()=>{flushTimer=null;flush();},1000);
    }
    let retryAt = 0;
    let deferredWithoutStorage = [];
    function adoptGuest(anonymousId, playerId) {
      if(!storage)return;
      const from=`a:${anonymousId}`,to=`p:${playerId}`,rows=read(from);
      save(to,[...read(to),...rows]);save(from,[]);
    }
    function flush(){
      if(flushTimer!==null){cancel(flushTimer);flushTimer=null;}
      if(!request || isDisabled() || now()<retryAt)return Promise.resolve();
      if(!storage){
        const ready=[],waiting=[];
        for(const row of deferredWithoutStorage){
          const decision=shouldSend(row.event);
          if(decision===true)ready.push(row);else if(decision!==false)waiting.push(row);
        }
        deferredWithoutStorage=waiting;
        return Promise.all(ready.map(row=>{
          try{return Promise.resolve(request(row.endpoint,{method:'POST',body:JSON.stringify({event_type:row.event})})).catch(()=>{})}catch{return Promise.resolve()}
        }));
      }
      if(pendingFlush)return pendingFlush;
      const scope=getScope(),authProfile=options.getProfile?.() || null;
      pendingFlush=(async()=>{
        // Re-read after each request: track() can append while this flush is in flight.
        // Bound the drain and remember IDs so failed storage writes cannot cause a loop.
        const attempted=new Set();
        while(attempted.size<MAX_EVENTS_PER_FLUSH){
          const row=pendingRows(scope).find(e=>!attempted.has(e.id)&&shouldSend(e.event)===true);
          if(!row)break;
          const target=row.endpoint||endpoint;
          const headerKey=JSON.stringify(row.headers||{});
          const batch=[];
          const compatible=target===DEFAULT_ENDPOINT
            ?pendingRows(scope).filter(e=>!attempted.has(e.id)&&shouldSend(e.event)===true&&(e.endpoint||endpoint)===target&&JSON.stringify(e.headers||{})===headerKey)
            :[row];
          const batchIds=new Set();
          for(const event of compatible){
            if(batchIds.has(event.id))continue;
            batchIds.add(event.id);batch.push(event);
            if(batch.length===MAX_BATCH_SIZE)break;
          }
          batch.forEach(event=>attempted.add(event.id));
          try{
            if(target===DEFAULT_ENDPOINT&&batch.length>1){
              await request(BATCH_ENDPOINT,{method:'POST',authProfile,headers:{...row.headers},body:JSON.stringify({events:batch.map(event=>({id:event.id,event_type:event.event,created_at:new Date(event.at).toISOString()}))})});
            }else{
              await request(target,{method:'POST',body:JSON.stringify({event_type:row.event}),authProfile,
                headers:{...row.headers,'X-Proplet-Event-ID':row.id,'X-Proplet-Event-Time':new Date(row.at).toISOString()}});
            }
            const completed=new Set(batch.map(event=>event.id));
            save(scope,read(scope).filter(e=>!completed.has(e.id)));
          }catch(error){
            // A permanently rejected event must not block all later events.
            if(error?.status===400){const rejected=new Set(batch.map(event=>event.id));save(scope,read(scope).filter(e=>!rejected.has(e.id)));continue;}
            retryAt=now()+Math.max(60000,Number(error?.retryAfterMs)||0);break;
          }
        }
      })().finally(()=>{pendingFlush=null;});
      return pendingFlush;
    }

    function track(eventType, _properties, targetEndpoint=endpoint) {
      if (!request || isDisabled() || shouldSend(eventType)===false) return;
      if(storage){
        const scope=getScope(),rows=read(scope);
        rows.push({id:global.crypto.randomUUID(),event:eventType,endpoint:targetEndpoint,at:now(),headers:options.getHeaders?.(eventType,_properties) || {}});
        save(scope,rows);scheduleFlush();return;
      }
      deferredWithoutStorage.push({event:eventType,endpoint:targetEndpoint});flush();
    }

    return {track,flush,adoptGuest,trackChallenge:(event,properties)=>track(event,properties,'/api/challenge-event')};
  }

  const api = {create, DEFAULT_ENDPOINT, BATCH_ENDPOINT};
  if (global) global.PropletAnalytics = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : globalThis);
