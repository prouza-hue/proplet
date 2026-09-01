(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PropletDaily=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function create(deps={}){
    const $=deps.$||(()=>null);
    const documentObj=deps.documentObj||((typeof document!=='undefined')?document:null);
    const MutationObserverCtor=deps.MutationObserverCtor||((typeof MutationObserver!=='undefined')?MutationObserver:null);
    const setTimeoutFn=deps.setTimeoutFn||setTimeout;
    let installed=false,menuObserver=null;

    function renderDaily(){
      const date=deps.pragueDateISO(),daily=deps.dailyResultState(date),p=daily.puzzle,stats=deps.effectiveStats(),done=daily.active,upgrade=daily.legacy;
      $('#dailyDate').textContent=deps.formatDateCZ(date);
      $('#dailyMeta').textContent=`${deps.DIFF[p.difficulty].label} · ${deps.countCz(p.meta.cells,'políčko','políčka','políček')} · ${deps.countCz(p.answers.length,'slovo','slova','slov')}`;
      deps.renderDailyWeekRhythm(date);
      $('#playDailyBtn').textContent=done?'Zobrazit dnešní výsledek':upgrade?'Zahrát novou dnešní výzvu':'Hrát dnešní výzvu';
      $('#shareDailyBtn').classList.toggle('hidden',!done);
      deps.renderLevelCard(stats);
      const sync=$('#dailySyncStatus');
      if(!done&&!upgrade){sync.classList.add('hidden')}else{
        sync.classList.remove('hidden');
        const profile=deps.getProfile(),queued=deps.getQueue().some(r=>r.challengeKey===`daily:${date}`),syncState=deps.getSyncState();
        if(upgrade)sync.textContent='✨ Dnešní výzva má novou desku. Zahraj ji pro dnešní i týdenní pořadí; dalších 100 XP se nepřidá.';
        else if(!profile?.token)sync.textContent='📱 Výsledek je uložený jen v tomto zařízení';
        else if(queued)sync.textContent=syncState.status==='error'?`⚠️ Čeká na synchronizaci: ${syncState.error||'zkus to znovu'}`:'☁️ Výsledek čeká na synchronizaci';
        else sync.textContent=profile.familyCode?'✓ Výsledek je v cloudu i týmovém pořadí':'✓ Výsledek je bezpečně v cloudu';
      }
      deps.renderRescueCard();
      deps.renderQuickPlay();
      deps.renderTajenkaEntry();
      deps.afterRender?.();
      return {date,daily};
    }

    function startDaily(options={}){
      $('#starterDailyNudge')?.classList.add('hidden');
      $('.daily-hero')?.classList.remove('starter-next');
      const date=deps.pragueDateISO(),daily=deps.dailyResultState(date);
      if(daily.active){deps.showDailyResult(date,daily.active);return}
      deps.startGame(daily.puzzle,'daily',date,options);
      if(options.starterHardDirect)setTimeoutFn(()=>deps.showToast('🔥 Dnešní výzva je Těžká. Kdyby ses zasekl, Nápověda je dole po ruce.'),180);
    }

    function bindWinMenu(){
      const button=documentObj?.querySelector?.('#winMenuBtn');
      if(!button)return false;
      const normalize=()=>{if((button.textContent||'').trim()==='← Dnes')button.textContent='← Menu'};
      normalize();
      if(MutationObserverCtor){menuObserver=new MutationObserverCtor(normalize);menuObserver.observe(button,{childList:true,subtree:true,characterData:true})}
      return true;
    }

    function install(){
      if(installed)return false;
      installed=true;
      if(documentObj?.readyState==='loading')documentObj.addEventListener?.('DOMContentLoaded',bindWinMenu,{once:true});
      else bindWinMenu();
      return true;
    }

    return {renderDaily,startDaily,install};
  }

  return {create};
});
