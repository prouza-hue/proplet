(()=>{
  'use strict';
  if(window.__PROPLET_COPY_DENSITY_V3327__)return;
  window.__PROPLET_COPY_DENSITY_V3327__=true;

  const $=selector=>document.querySelector(selector);
  const $$=selector=>[...document.querySelectorAll(selector)];

  function polishStaticCopy(){
    const freeSubtitle=$('#screen-free .screen-title .muted');
    if(freeSubtitle)freeSubtitle.textContent='Série roste jen Denní výzvou.';

    const rankingTitle=$('#screen-leaderboard .screen-title');
    rankingTitle?.querySelector('.muted')?.remove();

    const profileModal=$('#profileModal');
    profileModal?.setAttribute('aria-label','Hráčský účet');

    const feedback=$$('#winDifficultyFeedback [data-difficulty-rating]');
    if(feedback[0])feedback[0].textContent='Moc lehká';
    if(feedback[1])feedback[1].textContent='Akorát';
    if(feedback[2])feedback[2].textContent='Moc těžká';
  }

  function polishFreeCards(){
    if(typeof freeProgress!=='function')return;
    $$('#difficultyCards .difficulty-card').forEach(card=>{
      const diff=card.dataset.diff;
      if(!diff)return;
      const progress=freeProgress(diff);
      const eyebrow=card.querySelector('.difficulty-title .eyebrow');
      if(eyebrow){
        if(progress.resume){
          const level=Number(progress.resume?.meta?.level)||null;
          eyebrow.textContent=`ROZEHRÁNO${level?` · ÚROVEŇ ${level}`:''}`;
        }else eyebrow.remove();
      }
      const history=card.querySelector('[data-played-levels]');
      if(history)history.textContent='▦ Postup a úrovně';
    });
  }

  function ensurePlayedHeader(){
    const card=$('#playedLevelsModal .played-levels-card');
    const title=$('#playedLevelsTitle');
    const meta=$('#playedLevelsMeta');
    if(!card||!title||!meta)return null;
    card.querySelector(':scope > .eyebrow')?.remove();
    let head=card.querySelector('.played-levels-head');
    if(!head){
      head=document.createElement('div');
      head.className='played-levels-head';
      const heading=document.createElement('div');
      heading.className='played-levels-heading';
      const icon=document.createElement('span');
      icon.id='playedLevelsIcon';
      icon.className='played-levels-icon';
      const progress=document.createElement('div');
      progress.id='playedLevelsProgress';
      progress.className='played-levels-progress';
      progress.setAttribute('aria-label','Načítám postup');
      progress.style.setProperty('--progress','0%');
      progress.innerHTML='<div><strong>…</strong><small>z 200</small></div>';
      heading.append(icon,title);
      head.append(heading,progress);
      meta.before(head);
      meta.classList.add('played-levels-meta');
    }
    return head;
  }

  function polishPlayedLevels(diff){
    ensurePlayedHeader();
    const card=$('#playedLevelsModal .played-levels-card');
    const icon=$('#playedLevelsIcon');
    const progress=$('#playedLevelsProgress');
    const meta=$('#playedLevelsMeta');
    const rows=$$('#playedLevelsList .played-level-row');
    const total=typeof sortedFreeBank==='function'?sortedFreeBank(diff).length:200;
    const done=typeof freeProgress==='function'?freeProgress(diff).done:rows.filter(row=>!row.classList.contains('transferred')).length;
    const pct=total?Math.round(done/total*100):0;
    if(card)card.dataset.diff=diff;
    if(icon&&typeof difficultyIconMarkup==='function')icon.innerHTML=difficultyIconMarkup(diff,'played-levels-difficulty-icon');
    if(progress){
      progress.innerHTML=`<div><strong>${done}</strong><small>z ${total}</small></div>`;
      progress.style.setProperty('--progress',`${pct}%`);
      progress.setAttribute('aria-label',`${done} z ${total} odehraných úrovní`);
    }
    if(meta&&/^Postup\s+\d+\//.test(meta.textContent.trim()))meta.textContent='';
  }

  function polishLevelDetail(){
    const result=$('#levelDetailResult');
    if(result&&typeof levelDetailContext!=='undefined'&&levelDetailContext?.result)result.querySelector('small')?.remove();
  }

  function polishProfileSync(){
    const sync=$('#profileCard .sync-status');
    if(!sync)return;
    const detail=sync.querySelector('div>div');
    if(!detail)return;
    const text=detail.textContent.trim();
    if(text==='Postup je bezpečně v cloudu')detail.textContent='Všechny výsledky jsou aktuální';
    else if(text==='Cloud i týmové pořadí jsou aktuální')detail.textContent='Výsledky i týmové pořadí jsou aktuální';
  }

  function installWrappers(){
    if(typeof renderFree==='function'&&!renderFree.__copyDensity3327){
      const base=renderFree;
      const wrapped=function(...args){const result=base.apply(this,args);polishFreeCards();return result};
      wrapped.__copyDensity3327=true;
      renderFree=wrapped;
    }
    if(typeof openPlayedLevels==='function'&&!openPlayedLevels.__copyDensity3327){
      const base=openPlayedLevels;
      const wrapped=async function(diff,...args){
        ensurePlayedHeader();
        const result=await base.call(this,diff,...args);
        polishPlayedLevels(diff);
        return result;
      };
      wrapped.__copyDensity3327=true;
      openPlayedLevels=wrapped;
    }
    if(typeof openLevelDetail==='function'&&!openLevelDetail.__copyDensity3327){
      const base=openLevelDetail;
      const wrapped=async function(...args){
        const pending=base.apply(this,args);
        requestAnimationFrame(polishLevelDetail);
        const result=await pending;
        polishLevelDetail();
        return result;
      };
      wrapped.__copyDensity3327=true;
      openLevelDetail=wrapped;
    }
    if(typeof renderProfile==='function'&&!renderProfile.__copyDensity3327){
      const base=renderProfile;
      const wrapped=function(...args){const result=base.apply(this,args);polishProfileSync();return result};
      wrapped.__copyDensity3327=true;
      renderProfile=wrapped;
    }
    if(typeof renderFreeLeaderboardPanel==='function'&&!renderFreeLeaderboardPanel.__copyDensity3327){
      const base=renderFreeLeaderboardPanel;
      const wrapped=function(container,...args){
        const result=base.call(this,container,...args);
        if(container?.id==='levelLeaderboardBox')$('#winModal')?.classList.add('comparison-loaded');
        return result;
      };
      wrapped.__copyDensity3327=true;
      renderFreeLeaderboardPanel=wrapped;
    }
    if(typeof renderDailyGlobalLeaderboardBox==='function'&&!renderDailyGlobalLeaderboardBox.__copyDensity3327){
      const base=renderDailyGlobalLeaderboardBox;
      const wrapped=function(container,...args){
        const result=base.call(this,container,...args);
        if(container?.id==='levelLeaderboardBox')$('#winModal')?.classList.add('comparison-loaded');
        return result;
      };
      wrapped.__copyDensity3327=true;
      renderDailyGlobalLeaderboardBox=wrapped;
    }
    for(const name of ['finishGame','finishStarterGame','finishRescue','showDailyResult']){
      const fn=window[name];
      if(typeof fn!=='function'||fn.__copyDensity3327)continue;
      const wrapped=function(...args){$('#winModal')?.classList.remove('comparison-loaded');return fn.apply(this,args)};
      wrapped.__copyDensity3327=true;
      window[name]=wrapped;
    }
  }

  function apply(){
    polishStaticCopy();
    installWrappers();
    polishFreeCards();
    polishProfileSync();
  }

  let tries=0;
  const boot=()=>{
    apply();
    if(++tries<30)setTimeout(boot,150);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
