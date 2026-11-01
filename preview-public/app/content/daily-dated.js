(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PropletDatedDaily=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function create({fetchFn=fetch,storage=null,dateISO,now=Date.now}={}){
    const entries=new Map(),history=new Map();
    let clock=null,pending=null;
    const storageKey='proplet-dated-daily-v1';
    function valid(row){return row?.schemaVersion===1&&/^\d{4}-\d{2}-\d{2}$/.test(row.dailyDate||'')&&row.dailyDate<=row.serverToday&&row.puzzleId===row.puzzle?.id&&typeof row.bankVersion==='string'&&/^[0-9a-f]{64}$/.test(row.contentHash||'')&&Array.isArray(row.puzzle?.letters)&&Array.isArray(row.puzzle?.answers)&&row.challengeKey===`daily:${row.dailyDate}`}
    function acceptClock(row){if(!clock||row.serverToday>=clock.serverToday)clock={serverToday:row.serverToday,validUntil:row.validUntil}}
    try{for(const row of JSON.parse(storage?.getItem(storageKey)||'[]')){
      if(valid(row)){if(row.official===false)history.set(`${row.dailyDate}:${row.puzzleId}`,row);else entries.set(row.dailyDate,row);acceptClock(row)}
    }}catch{}
    function remember(row){
      if(!valid(row))throw new Error('daily-binding-invalid');
      if(row.official===false){history.set(`${row.dailyDate}:${row.puzzleId}`,row)}else{
        const old=entries.get(row.dailyDate);
        if(old&&(old.puzzleId!==row.puzzleId||old.contentHash!==row.contentHash||old.bankVersion!==row.bankVersion))throw new Error('daily-binding-conflict');
        entries.set(row.dailyDate,row);
      }
      acceptClock(row);
      try{storage?.setItem(storageKey,JSON.stringify([...entries.values(),...history.values()].sort((a,b)=>a.dailyDate.localeCompare(b.dailyDate)).slice(-150)))}catch{}
      return row;
    }
    function today(){return clock&&Date.parse(clock.validUntil)>now()?clock.serverToday:dateISO()}
    function cached(iso){return entries.get(iso)||null}
    async function refresh(){
      if(pending)return pending;
      pending=(async()=>{
        try{
          const response=await fetchFn('/api/daily',{cache:'no-store'});
          if(!response.ok)throw new Error(`daily-http-${response.status}`);
          const row=await response.json();if(row.dailyDate!==row.serverToday)throw new Error('daily-current-binding-invalid');
          return remember(row);
        }catch(error){
          const row=entries.get(today());
          if(row&&row.dailyDate===row.serverToday&&Date.parse(row.validUntil)>now())return row;
          throw error;
        }
      })().finally(()=>{pending=null});
      return pending;
    }
    async function historical(iso,puzzleId){
      const old=entries.get(iso),alternate=history.get(`${iso}:${puzzleId}`);
      if(old&&(!puzzleId||old.puzzleId===puzzleId))return old;
      if(alternate)return alternate;
      const query=new URLSearchParams({daily_date:iso});if(puzzleId)query.set('puzzle_id',puzzleId);
      const response=await fetchFn(`/api/daily?${query}`,{cache:'no-store'});
      if(!response.ok)throw new Error(`daily-history-http-${response.status}`);
      const row=await response.json();if(row.dailyDate!==iso||(puzzleId&&row.puzzleId!==puzzleId))throw new Error('daily-history-binding-invalid');
      return remember(row);
    }
    return {refresh,historical,today,cached,remember};
  }
  return {create};
});
