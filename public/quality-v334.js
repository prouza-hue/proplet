(()=>{
const RESCUE_LIMIT_MS=60_000;
const RESCUE_LIMIT_SECONDS=60;
const q=s=>document.querySelector(s);

function installRescue60s(){
  if(window.__PROPLET_RESCUE_60S__)return;
  window.__PROPLET_RESCUE_60S__=true;

  if(typeof fmtCountdown==='function'){
    fmtCountdown=function(ms){
      const total=Math.max(0,Math.ceil(ms/1000));
      const min=Math.floor(total/60),sec=total%60;
      return `${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    };
  }

  if(typeof localRescueStatus==='function'){
    localRescueStatus=function(){
      const st=getState(),today=pragueDateISO(),missed=isoShift(today,-1),before=isoShift(today,-2),daily=Object.values(st.completed).filter(r=>r.mode==='daily'&&r.dailyDate).map(r=>r.dailyDate),passed=Object.entries(st.rescues||{}).filter(([,r])=>r?.status==='passed').map(([d])=>d),effective=[...new Set([...daily,...passed])],existing=st.rescues?.[missed],prior=streakEndingOn(effective,before);
      if(existing?.status==='started'){
        const elapsed=Math.max(0,Number(existing.elapsedMs)||0);
        if(elapsed>=RESCUE_LIMIT_MS){
          st.rescues[missed]={...existing,status:'failed',elapsedMs:elapsed};saveState(st);
          return {eligible:false,state:'failed',missedDate:missed,priorStreak:prior};
        }
        return {eligible:true,state:'started',missedDate:missed,priorStreak:prior,puzzleId:existing.puzzleId,timeLimitMs:RESCUE_LIMIT_MS,secondsRemaining:Math.max(0,(RESCUE_LIMIT_MS-elapsed)/1000)};
      }
      if(existing)return {eligible:false,state:existing.status,missedDate:missed,priorStreak:prior,puzzleId:existing.puzzleId};
      const eligible=!effective.includes(missed)&&effective.includes(before)&&prior>0;
      return {eligible,state:eligible?'available':'none',missedDate:eligible?missed:null,priorStreak:eligible?prior:0};
    };
  }

  if(typeof renderRescueCard==='function'){
    const baseRenderRescueCard=renderRescueCard;
    renderRescueCard=function(...args){
      const out=baseRenderRescueCard(...args);
      try{if(rescueStatus?.state==='available')q('#rescueBtn').textContent=`Zachránit sérii · ${RESCUE_LIMIT_SECONDS} s`;}catch{}
      return out;
    };
  }

  openRescueOffer=function(){
    const rs=rescueStatus;if(!rs||(rs.state!=='available'&&rs.state!=='started'))return;
    q('#rescueOfferTitle').textContent=rs.state==='started'?'Záchrana už běží!':'Chceš zachránit sérii?';
    q('#rescueOfferText').textContent=rs.state==='started'?`Zbývá ti asi ${countCz(Math.ceil(rs.secondsRemaining||0),'sekunda','sekundy','sekund')}. Čas běží jen během aktivního hraní.`:`Máš ${countCz(rs.priorStreak,'den','dny','dní')} v řadě. Když zvládneš rychlý Proplet do ${RESCUE_LIMIT_SECONDS} sekund, série pokračuje. Když ne, předchozí série končí.`;
    q('#confirmRescueBtn').textContent=rs.state==='started'?'Pokračovat teď 🔥':'Ano, jdu do toho 🔥';
    q('#rescueOfferModal').classList.remove('hidden');
  };

  beginRescue=async function(){
    q('#rescueOfferModal').classList.add('hidden');
    let rs=rescueStatus||localRescueStatus();
    const profile=getProfile();
    try{
      if(rs?.state==='started'){
        try{rs=profile?.token?await api('/api/rescue-status'):localRescueStatus()}catch{}
      }
      if(rs.state!=='started'){
        if(profile?.token)rs=await api('/api/rescue/start',{method:'POST',body:'{}'});
        else{
          const st=getState(),id=localRescuePuzzleId(rs.missedDate);
          st.rescues=st.rescues||{};
          st.rescues[rs.missedDate]={status:'started',puzzleId:id,elapsedMs:0};saveState(st);
          rs={...rs,state:'started',puzzleId:id,timeLimitMs:RESCUE_LIMIT_MS,secondsRemaining:RESCUE_LIMIT_SECONDS};
        }
      }
      if(Number(rs.timeLimitMs||0)<RESCUE_LIMIT_MS){
        const oldLimit=Math.max(0,Number(rs.timeLimitMs)||30_000),oldRemaining=Math.max(0,Number(rs.secondsRemaining)||0),elapsed=Math.max(0,oldLimit-oldRemaining*1000);
        rs={...rs,timeLimitMs:RESCUE_LIMIT_MS,secondsRemaining:Math.max(0,(RESCUE_LIMIT_MS-elapsed)/1000)};
      }
      rescueStatus=rs;
      const puzzle=rescuePuzzleById(rs.puzzleId);if(!puzzle)throw new Error('Záchranná úloha se nenašla');
      const remaining=Math.max(1000,Math.round((rs.secondsRemaining??RESCUE_LIMIT_SECONDS)*1000));
      startGame(puzzle,'rescue',rs.missedDate,{limitMs:remaining,rescueTotalLimitMs:RESCUE_LIMIT_MS});
    }catch(e){showToast(`Záchrana nejde spustit: ${e.message}`);refreshRescueStatus()}
  };

  finishRescue=async function(passed){
    const g=currentGame;if(!g||g.mode!=='rescue'||g.rescueFinished)return;
    g.rescueFinished=true;g.finished=true;stopTimer();releaseGameWakeLock();
    const elapsed=Math.max(0,Math.round(gameElapsed(g))),profile=getProfile();let ok=passed;
    try{
      if(profile?.token){
        const r=await api('/api/rescue/finish',{method:'POST',body:JSON.stringify({puzzle_id:g.puzzle.id,completed:!!passed,elapsed_ms:Math.min(120000,elapsed)})});
        ok=!!r.ok;if(r.stats)saveProfile({...profile,stats:r.stats});
      }else{
        const st=getState(),missed=g.dailyDate;st.rescues=st.rescues||{};
        st.rescues[missed]={...(st.rescues[missed]||{}),status:passed&&elapsed<=RESCUE_LIMIT_MS?'passed':'failed',puzzleId:g.puzzle.id,elapsedMs:elapsed,completedAt:new Date().toISOString()};saveState(st);
        ok=passed&&elapsed<=RESCUE_LIMIT_MS;
      }
    }catch(e){ok=false;showToast(`Záchranu se nepodařilo potvrdit: ${e.message}`)}
    q('#winModal').classList.remove('hidden');q('#winAccountBtn')?.classList.add('hidden');q('#winBadge').textContent=ok?'🔥':'💨';q('#winTitle').textContent=ok?'Série zachráněna!':'Série tentokrát padla';q('#winPraise').textContent=ok?'Minuta stačila. Série může dýchat dál.':'Nevadí. I série občas potřebuje nový začátek.';q('#winPraise').classList.remove('hidden');q('#winText').textContent=ok?`Hotovo za ${fmtTime(elapsed)}. Tvoje série pokračuje.`:'Pokus je vyčerpaný. Dnešní výzva může odstartovat novou sérii.';q('#winXp').textContent=ok?'Série pokračuje · bez XP':'Nový začátek';q('#winClean').classList.add('hidden');q('#winWords').innerHTML=ok?g.found.map(f=>`<span class="win-word" style="--word-color:${COLORS[f.colorIndex%COLORS.length]};background:color-mix(in srgb,${COLORS[f.colorIndex%COLORS.length]} 55%,white)">${f.word}</span>`).join(''):'';q('#newBadgeBox').classList.add('hidden');q('#winReplayBtn').classList.add('hidden');q('#winShareBtn').classList.add('hidden');q('#winMenuBtn').classList.add('hidden');q('#winPrimaryBtn').textContent='Zpět na dnešek';renderWinFeedback();if(ok){confetti();fx('win')}else fx('wrong');await refreshRescueStatus();renderProfile();
  };

  const bindRescueButtons=()=>{
    const rescueBtn=q('#rescueBtn'),confirmBtn=q('#confirmRescueBtn');
    if(rescueBtn)rescueBtn.onclick=openRescueOffer;
    if(confirmBtn)confirmBtn.onclick=beginRescue;
    try{if(rescueStatus?.state==='available'&&rescueBtn)rescueBtn.textContent=`Zachránit sérii · ${RESCUE_LIMIT_SECONDS} s`;}catch{}
  };
  bindRescueButtons();
  [50,200,600,1400].forEach(ms=>setTimeout(bindRescueButtons,ms));
  setTimeout(()=>{try{refreshRescueStatus()}catch{}},250);
}

installRescue60s();

const core=document.createElement('script');
core.src='/quality-v334-core-v40114.js?v=3';
core.async=false;
core.onerror=()=>console.error('Proplet quality core se nepodařilo načíst.');
document.head.appendChild(core);
})();
