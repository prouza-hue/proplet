(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PropletDatedDailySpecial=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const difficulties=new Set(['hardcore','mozkomor','mozkokalypsa']);
  const isDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)
    &&Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    &&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;
  const keyFor=(iso,difficulty)=>`daily-special:${iso}:${difficulty}`;
  const practiceKeyFor=(iso,difficulty,puzzleId)=>`daily-special-practice:${iso}:${difficulty}:${puzzleId}`;

  // Specials have their own cache and immutable identity. They never occupy daily:date.
  function create({fetchFn=fetch,storage=null,dateISO=()=>new Date().toISOString().slice(0,10),now=Date.now}={}){
    const entries=new Map(),emptyDates=new Map();
    const storageKey='proplet-daily-special-v1';
    let clock=null,pending=null,metadata=[];

    function acceptClock(row){
      if(!isDate(row?.serverToday)||!Number.isFinite(Date.parse(row?.validUntil)))throw new Error('daily-special-clock-invalid');
      if(!clock||row.serverToday>=clock.serverToday)clock={serverToday:row.serverToday,validUntil:row.validUntil};
    }
    function valid(row){
      return row?.schemaVersion===1&&isDate(row.dailyDate)&&isDate(row.serverToday)
        &&row.dailyDate<=row.serverToday&&difficulties.has(row.difficulty)
        &&row.puzzleId===row.puzzle?.id&&row.difficulty===row.puzzle?.difficulty
        &&typeof row.bankVersion==='string'&&/^[0-9a-f]{64}$/.test(row.contentHash||'')
        &&Array.isArray(row.puzzle?.letters)&&Array.isArray(row.puzzle?.answers)
        &&(row.challengeKey===keyFor(row.dailyDate,row.difficulty)
          ||(row.official===false&&row.rewardEligible===false&&row.officialChallengeKey===keyFor(row.dailyDate,row.difficulty)
            &&row.challengeKey===practiceKeyFor(row.dailyDate,row.difficulty,row.puzzleId)))
        &&(!row.mode||row.mode==='daily_special')
        &&Number.isFinite(Date.parse(row.validUntil));
    }
    function decorate(row){
      return {...row,mode:'daily_special',challengeKind:'special',officialChallengeKey:row.officialChallengeKey||keyFor(row.dailyDate,row.difficulty),practiceChallengeKey:row.practiceChallengeKey||practiceKeyFor(row.dailyDate,row.difficulty,row.puzzleId),puzzle:{...row.puzzle,meta:{...row.puzzle.meta,
        dailySpecialBinding:{dailyDate:row.dailyDate,challengeKey:row.challengeKey,officialChallengeKey:row.officialChallengeKey||keyFor(row.dailyDate,row.difficulty),contentHash:row.contentHash,bankVersion:row.bankVersion,official:row.official!==false,rewardEligible:row.rewardEligible!==false}
      }}};
    }
    function persist(){
      try{storage?.setItem(storageKey,JSON.stringify({entries:[...entries.values()].sort((a,b)=>a.dailyDate.localeCompare(b.dailyDate)).slice(-48),emptyDates:[...emptyDates.values()].slice(-14),clock,metadata}))}catch{}
    }
    function remember(row){
      if(!valid(row))throw new Error('daily-special-binding-invalid');
      const old=entries.get(row.dailyDate);
      if(old&&(old.difficulty!==row.difficulty||old.puzzleId!==row.puzzleId||old.contentHash!==row.contentHash||old.bankVersion!==row.bankVersion))throw new Error('daily-special-binding-conflict');
      acceptClock(row);
      const bound=decorate(row);entries.set(row.dailyDate,bound);emptyDates.delete(row.dailyDate);persist();
      return bound;
    }
    function accept(payload){
      // A current non-special day still supplies an authoritative Prague clock.
      if(Object.prototype.hasOwnProperty.call(payload||{},'special')){
        acceptClock(payload);
        if(Array.isArray(payload.schedule))metadata=payload.schedule;
        if(payload.special==null){
          entries.delete(payload.serverToday);
          emptyDates.set(payload.serverToday,{serverToday:payload.serverToday,validUntil:payload.validUntil});persist();return null;
        }
        return remember({...payload.special,schemaVersion:payload.special.schemaVersion??payload.schemaVersion,
          serverToday:payload.special.serverToday??payload.serverToday,validUntil:payload.special.validUntil??payload.validUntil});
      }
      return remember(payload);
    }
    try{
      const saved=JSON.parse(storage?.getItem(storageKey)||'{}');
      for(const row of saved.entries||[])if(valid(row))entries.set(row.dailyDate,decorate(row));
      for(const row of saved.emptyDates||[])if(isDate(row.serverToday)&&Number.isFinite(Date.parse(row.validUntil)))emptyDates.set(row.serverToday,row);
      if(saved.clock)acceptClock(saved.clock);
      if(Array.isArray(saved.metadata))metadata=saved.metadata;
    }catch{}
    function today(){return clock&&Date.parse(clock.validUntil)>now()?clock.serverToday:dateISO()}
    function cached(iso){return entries.get(iso)||null}
    function archive(row){return decorate({...row,official:false,rewardEligible:false,
      officialChallengeKey:keyFor(row.dailyDate,row.difficulty),challengeKey:practiceKeyFor(row.dailyDate,row.difficulty,row.puzzleId)})}
    async function refresh(){
      if(pending)return pending;
      pending=(async()=>{
        try{
          const response=await fetchFn('/api/daily-special',{cache:'no-store'});
          if(!response.ok)throw new Error(`daily-special-http-${response.status}`);
          const payload=await response.json(),row=accept(payload);
          if(row&&row.dailyDate!==row.serverToday)throw new Error('daily-special-current-binding-invalid');
          return row;
        }catch(error){
          const iso=today(),row=entries.get(iso),empty=emptyDates.get(iso);
          if(row&&row.serverToday===iso&&Date.parse(row.validUntil)>now())return row;
          if(empty&&Date.parse(empty.validUntil)>now())return null;
          throw error;
        }
      })().finally(()=>{pending=null});
      return pending;
    }
    async function historical(iso,puzzleId){
      if(!isDate(iso)||iso>today())throw new Error('daily-special-date-invalid');
      const old=cached(iso);
      if(old&&(!puzzleId||old.puzzleId===puzzleId))return iso<today()?archive(old):old;
      const query=new URLSearchParams({daily_date:iso});if(puzzleId)query.set('puzzle_id',puzzleId);
      const response=await fetchFn(`/api/daily-special?${query}`,{cache:'no-store'});
      if(!response.ok)throw new Error(`daily-special-history-http-${response.status}`);
      const row=accept(await response.json());
      if(!row||row.dailyDate!==iso||(puzzleId&&row.puzzleId!==puzzleId))throw new Error('daily-special-history-binding-invalid');
      return iso<today()?archive(row):row;
    }
    function resultState(iso,state={}){
      const descriptor=cached(iso),key=descriptor?.officialChallengeKey;
      const stored=key?state.completed?.[key]||null:null;
      const active=stored&&stored.mode==='daily_special'&&stored.puzzleId===descriptor.puzzleId
        &&(!stored.contentHash||stored.contentHash===descriptor.contentHash)?stored:null;
      const row=key?state.inProgress?.[key]:null;
      const progress=row&&row.mode==='daily_special'&&row.puzzleId===descriptor.puzzleId
        &&row.contentHash===descriptor.contentHash?row:null;
      return {descriptor,puzzle:descriptor?.puzzle||null,stored,active,progress};
    }
    return {refresh,historical,today,cached,remember,resultState,asPractice:archive,schedule:()=>[...metadata],authoritativeToday:()=>clock&&Date.parse(clock.validUntil)>now()?clock.serverToday:null};
  }
  return {create,keyFor,practiceKeyFor,isDate};
});
