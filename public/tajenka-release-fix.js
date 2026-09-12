(()=>{
  'use strict';
  if(window.__PROPLET_TAJENKA_RELEASE_FIX_V2__)return;
  window.__PROPLET_TAJENKA_RELEASE_FIX_V2__=true;

  const q=(selector,root=document)=>root?.querySelector?.(selector)||null;
  const TAJENKA_BOARD_URL='https://iopyhluayfszskyqqpuc.supabase.co/functions/v1/proplet-tajenka-leaderboard';
  let freeObserver=null;
  let dailyObserver=null;
  let queued=false;

  function esc(value){
    return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  function countCzLocal(n,one,few,many){return `${n} ${n===1?one:(n>=2&&n<=4?few:many)}`}
  function fmtTimeLocal(ms){
    const total=Math.max(0,Math.floor(Number(ms||0)/1000));
    return `${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`;
  }
  function profileToken(){
    try{return getProfile?.()?.token||null}catch{return null}
  }
  function currentPhrase(){
    try{return String(tajenkaPuzzle?.tajenka?.phrase||'').trim()}catch{return ''}
  }
  function currentSourceMarkup(){
    let puzzle=null;try{puzzle=tajenkaPuzzle}catch{}
    const source=puzzle?.source;if(!source?.url||!/^https:\/\//i.test(String(source.url)))return '';
    const href=esc(String(source.url)),label=esc(source.label||'zdroj');
    if(source.author){
      const byline=[source.author,source.work].filter(Boolean).map(esc).join(' · ');
      return `<span>${byline}</span><a href="${href}" target="_blank" rel="noopener noreferrer">Zdroj ↗</a>`;
    }
    return `<span>Zdroj:</span><a href="${href}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`;
  }
  function syncTajenkaSourceLine(modal){
    let line=q('.tajenka-result-source',modal),markup=currentSourceMarkup();
    if(!markup){line?.remove();return}
    if(!line){line=document.createElement('div');line.className='tajenka-result-source';const text=q('#winText',modal);text?.insertAdjacentElement('afterend',line)}
    line.innerHTML=markup;
  }
  function sentenceCasePhrase(value){
    const text=String(value??'').trim();
    const letters=text.replace(/[^\p{L}]/gu,'');
    if(!letters||letters!==letters.toLocaleUpperCase('cs-CZ'))return text;
    const lower=text.toLocaleLowerCase('cs-CZ');
    return lower.replace(/\p{L}/u,ch=>ch.toLocaleUpperCase('cs-CZ'));
  }

  function legacyCardSignature(source){
    const completed=source.classList.contains('completed');
    const copy=source.querySelector('.tajenka-entry-copy');
    return `${completed?'1':'0'}|${(copy?.textContent||'').replace(/\s+/g,' ').trim()}`;
  }
  function exactCardSignature(source){
    return `${source.className}|${source.innerHTML}`;
  }
  function bindClonedCardActions(clone,source){
    const play=clone.querySelector('#tajenkaPreviewBtn');
    if(play){
      play.removeAttribute('id');
      play.dataset.tajenkaClonePlay='1';
      play.onclick=event=>{event.preventDefault();source.querySelector('#tajenkaPreviewBtn')?.click()};
    }
    const recap=clone.querySelector('[data-tajenka-recap]');
    if(recap)recap.onclick=event=>{event.preventDefault();source.querySelector('[data-tajenka-recap]')?.click()};
    const share=clone.querySelector('[data-tajenka-share]');
    if(share)share.onclick=event=>{event.preventDefault();source.querySelector('[data-tajenka-share]')?.click()};
  }
  function syncExactTajenkaPlayCard(){
    const source=q('#tajenkaPreviewCard'),screen=q('#screen-free');
    if(!screen)return;
    let current=q('#tajenkaPlayCard');
    if(!source||source.classList.contains('hidden')){current?.classList.add('hidden');return}
    const exactSignature=exactCardSignature(source);
    if(!current||current.dataset.exactCloneSignature!==exactSignature){
      const clone=source.cloneNode(true);
      clone.id='tajenkaPlayCard';
      clone.classList.add('tajenka-play-card');
      clone.classList.remove('hidden');
      clone.dataset.signature=legacyCardSignature(source);
      clone.dataset.exactCloneSignature=exactSignature;
      clone.querySelectorAll('[id]').forEach(el=>{if(el!==clone)el.removeAttribute('id')});
      bindClonedCardActions(clone,source);
      if(current)current.replaceWith(clone);else screen.appendChild(clone);
      current=clone;
    }
    current.classList.remove('hidden');
    if(screen.lastElementChild!==current)screen.appendChild(current);
  }

  function rowMarkup(rows){
    if(typeof rankingExpandedRows==='function')return rankingExpandedRows(rows||[]);
    return (rows||[]).map(row=>`<div class="mini-leader-row result-player-row ${row.isMine?'me':''}"><b class="result-player-rank">${Number(row.rank)||'—'}.</b><span class="result-player-avatar" data-player-avatar="${esc(row.avatar||'🎭')}">${esc(row.avatar||'🎭')}</span><span class="result-player-copy"><strong>${row.isMine?'Ty':esc(row.name||'Anonymní propletač')}</strong><small>${row.cleanSolve?'Čistě':`Nápověda ${Number(row.hintsUsed)||0}×`} · ${countCzLocal(Number(row.moves)||0,'tah','tahy','tahů')}</small></span><em class="result-player-time">${fmtTimeLocal(row.elapsedMs)}</em></div>`).join('');
  }
  function fitLongRankingNames(root){
    root?.querySelectorAll?.('.result-player-copy>strong').forEach(name=>{
      const length=[...(name.textContent||'').trim()].length;
      name.classList.toggle('ranking-name-long',length>16);
      name.classList.toggle('ranking-name-very-long',length>24);
    });
  }
  function expansionMarkup(data){
    if(typeof rankingExpandMarkup==='function')return rankingExpandMarkup({total:data?.total,myRank:data?.myRank});
    const total=Number(data?.total||0);if(total<=1)return '';
    const rank=Number(data?.myRank||0);
    return `<details class="ranking-expand"><summary>Zobrazit pořadí · ${countCzLocal(total,'hráč','hráči','hráčů')}</summary><p class="ranking-expanded-position">${rank?`Tvoje pozice: ${rank}. z ${total}.`:'Celkové pořadí hráčů.'}</p><div class="ranking-expanded-rows"></div><button type="button" class="secondary-btn ranking-more">Načíst pořadí</button></details>`;
  }
  async function fetchTajenkaPage(puzzleId,offset=null){
    const headers={},token=profileToken();
    if(token)headers.Authorization=`Bearer ${token}`;
    const suffix=offset===null?'':`&offset=${Math.max(0,Number(offset)||0)}`;
    const response=await fetch(`${TAJENKA_BOARD_URL}?puzzle_id=${encodeURIComponent(puzzleId)}${suffix}`,{method:'GET',headers,cache:'no-store',mode:'cors'});
    let data=null;try{data=await response.json()}catch{}
    if(!response.ok)throw new Error(data?.detail||`HTTP ${response.status}`);
    return data||{};
  }
  function bindTajenkaExpansion(container,data,puzzleId){
    const details=q('.ranking-expand',container);if(!details)return;
    const rows=q('.ranking-expanded-rows',details),more=q('.ranking-more',details);
    if(!rows||!more)return;
    let firstOffset=Math.max(0,(Number(data?.myRank)||1)-26);
    let loadedStart=firstOffset,nextOffset=null,loading=false,loaded=false;
    const before=document.createElement('button');
    before.type='button';before.className='secondary-btn ranking-before hidden';before.textContent='Předchozí hráči';rows.before(before);

    const applyPage=(page,{prepend=false,replace=false}={})=>{
      const html=rowMarkup(page?.rows||[]);
      if(replace)rows.innerHTML=html;
      else if(prepend)rows.insertAdjacentHTML('afterbegin',html);
      else rows.insertAdjacentHTML('beforeend',html);
      fitLongRankingNames(rows);
      nextOffset=page?.nextOffset??null;
      more.classList.toggle('hidden',nextOffset===null);
      more.textContent=nextOffset===null?'Celé pořadí načteno':'Další hráči';
      before.classList.toggle('hidden',loadedStart<=0);
    };
    const loadAt=async(offset,{prepend=false,replace=false}={})=>{
      if(loading)return;
      loading=true;more.disabled=true;before.disabled=true;
      const oldText=more.textContent;more.textContent='Načítám…';
      try{
        const page=await fetchTajenkaPage(puzzleId,offset);
        if(!details.isConnected)return;
        applyPage(page,{prepend,replace});
        if(prepend)loadedStart=Math.max(0,offset);
        loaded=true;
        requestAnimationFrame(()=>{if(details.open)(rows.querySelector('.me')||rows.firstElementChild)?.scrollIntoView({block:'center',behavior:'instant'})});
      }catch(error){
        if(!loaded)rows.innerHTML=`<div class="leaderboard-empty"><strong>Pořadí se teď nepodařilo načíst.</strong><small>${esc(error?.message||'Zkus to prosím znovu.')}</small></div>`;
        more.textContent=oldText;
      }finally{loading=false;more.disabled=false;before.disabled=false}
    };
    details.addEventListener('toggle',()=>{if(details.open&&!loaded)loadAt(firstOffset,{replace:true})});
    more.onclick=()=>{if(nextOffset!==null)loadAt(nextOffset)};
    before.onclick=()=>{if(loadedStart>0)loadAt(Math.max(0,loadedStart-50),{prepend:true})};
  }

  function renderTajenkaLikeDaily(box,data,puzzleId){
    const total=Number(data?.total||0),rank=Number(data?.myRank||0),rows=Array.isArray(data?.rows)?data.rows:[];
    box.classList.remove('free-level-board','hidden');
    box.classList.add('daily-global-board');
    if(!rank){
      const message=profileToken()?'Tvůj výsledek zatím není v pořadí této Tajenky.':'Ulož si postup a po synchronizaci uvidíš své přesné místo.';
      box.innerHTML=`<div class="daily-world-head"><strong>Pořadí Tajenky</strong><span>${countCzLocal(total,'hráč','hráči','hráčů')}</span></div><div class="leaderboard-empty"><strong>${total?'Tajenka už má první výsledky.':'Zatím čekáš na prvního soupeře.'}</strong><small>${message}</small></div>${expansionMarkup(data)}`;
      bindTajenkaExpansion(box,data,puzzleId);
      return;
    }
    const topLine=total===1?'První hráč této Tajenky.':`Patříš mezi nejlepších ${Number(data?.topPercent)||1} % hráčů této Tajenky.`;
    box.innerHTML=`<div class="daily-world-summary"><div><strong>${rank}.</strong><span>místo</span></div><p>${topLine}</p></div><div class="daily-world-neighbours">${rowMarkup(rows)}</div>${expansionMarkup(data)}<small class="daily-world-privacy">Jméno se ukáže jen po souhlasu · ostatní mají anonymní přezdívku.</small>`;
    fitLongRankingNames(box);
    bindTajenkaExpansion(box,data,puzzleId);
  }

  async function loadTajenkaLeaderboard(puzzleId,box){
    if(!box||!puzzleId)return;
    try{
      if(profileToken()&&typeof syncQueue==='function'){try{await syncQueue({announce:false})}catch{}}
      const data=await fetchTajenkaPage(puzzleId);
      if(!q('#winModal')?.classList.contains('tajenka-daily-result'))return;
      renderTajenkaLikeDaily(box,data,puzzleId);
      q('#winModal')?.classList.add('comparison-loaded');
    }catch(error){
      if(!q('#winModal')?.classList.contains('tajenka-daily-result'))return;
      box.innerHTML=`<div class="leaderboard-empty"><strong>Pořadí se teď nepodařilo načíst.</strong><small>${esc(error?.message||'Zkus to prosím znovu.')}</small></div>`;
    }
  }

  function foundWords(result){
    const found=Array.isArray(result?.found)?result.found:[];
    return found.filter(item=>item?.word).map(item=>({word:String(item.word),colorIndex:Number(item.colorIndex)||0}));
  }
  function resultLine(result){
    const elapsed=Number(result?.elapsedMs)||0,moves=Math.max(0,Number(result?.moves)||0);
    return `${fmtTimeLocal(elapsed)} · ${countCzLocal(moves,'tah','tahy','tahů')} · Tajenka`;
  }
  function cleanLabel(result){
    const hints=Math.max(0,Number(result?.hints??result?.hintsUsed)||0);
    return hints===0?'✨ Čistě · bez nápovědy':`💡 ${countCzLocal(hints,'nápověda','nápovědy','nápověd')}`;
  }
  function prepareTajenkaDailyResult(result,puzzleId){
    const modal=q('#winModal'),board=q('#levelLeaderboardBox',modal);if(!modal||!board)return;
    modal.classList.remove('tajenka-result-mode');
    modal.classList.add('tajenka-daily-result');
    const phraseFromDom=(q('#tajenkaWinPhrase strong',modal)?.textContent||'').trim();
    const phrase=sentenceCasePhrase(phraseFromDom||currentPhrase()||'Tajenka');
    const title=q('#winTitle',modal);if(title){title.textContent=phrase;title.classList.remove('hidden')}
    q('#winPraise',modal)?.classList.add('hidden');
    q('#tajenkaWinPhrase',modal)?.classList.add('hidden');
    const text=q('#winText',modal);if(text)text.textContent=resultLine(result);syncTajenkaSourceLine(modal);
    const chips=q('.win-summary-chips',modal);chips?.classList.remove('hidden');
    const xp=q('#winXp',modal);if(xp){xp.textContent='+200 XP';xp.classList.remove('hidden')}
    const clean=q('#winClean',modal);if(clean){clean.textContent=cleanLabel(result);clean.classList.remove('hidden');clean.classList.toggle('hinted',Math.max(0,Number(result?.hints??result?.hintsUsed)||0)>0)}
    const primary=q('#winPrimaryBtn',modal);if(primary){primary.textContent='Zpět';primary.classList.remove('hidden')}
    const details=q('#winDetails',modal),words=q('#winWords',modal),items=foundWords(result);
    if(words){
      words.innerHTML=items.map(item=>{
        let color='';try{if(typeof COLORS!=='undefined'&&COLORS.length)color=COLORS[item.colorIndex%COLORS.length]}catch{}
        const style=color?` style="--word-color:${esc(color)};background:color-mix(in srgb,${esc(color)} 55%,white)"`:'';
        return `<span class="win-word"${style}>${esc(item.word)}</span>`;
      }).join('');
    }
    details?.classList.toggle('hidden',items.length===0);
    board.classList.remove('hidden','free-level-board');
    board.classList.add('daily-global-board');
    board.innerHTML='<div class="leaderboard-empty"><strong>Načítám pořadí…</strong></div>';
    if(puzzleId)loadTajenkaLeaderboard(puzzleId,board);
  }
  function resetTajenkaDailyResult(){
    const modal=q('#winModal');
    modal?.classList.remove('tajenka-daily-result');q('.tajenka-result-source',modal)?.remove();
  }

  function wrapAsync(name,after){
    const current=globalThis[name];if(typeof current!=='function'||current.__tajenkaReleaseFix)return;
    const wrapped=async function(){const args=[...arguments],result=await current.apply(this,args);try{await after(...args)}catch(error){console.warn('Tajenka release fix failed',error)}return result};
    wrapped.__tajenkaReleaseFix=true;globalThis[name]=wrapped;
  }
  function wrapRender(name,after){
    const current=globalThis[name];if(typeof current!=='function'||current.__tajenkaReleaseFix)return;
    const wrapped=function(){const args=[...arguments],result=current.apply(this,args);try{after(...args)}catch(error){console.warn('Tajenka release fix failed',error)}return result};
    wrapped.__tajenkaReleaseFix=true;globalThis[name]=wrapped;
  }
  function wrapBefore(name,before){
    const current=globalThis[name];if(typeof current!=='function'||current.__tajenkaReleaseFixBefore)return;
    const wrapped=function(){try{before()}catch{}return current.apply(this,arguments)};
    wrapped.__tajenkaReleaseFixBefore=true;globalThis[name]=wrapped;
  }

  function refresh(){
    queued=false;
    syncExactTajenkaPlayCard();
    if(window.__propletHomeLayoutInstalled&&typeof window.__PROPLET_REVEAL_CURRENT_UI==='function'){
      requestAnimationFrame(()=>requestAnimationFrame(()=>window.__PROPLET_REVEAL_CURRENT_UI()));
    }
  }
  function queueRefresh(){if(queued)return;queued=true;queueMicrotask(refresh)}
  function install(){
    wrapBefore('finishGame',resetTajenkaDailyResult);
    wrapAsync('finishTajenkaGame',g=>prepareTajenkaDailyResult({elapsedMs:g?.elapsedMs,moves:g?.moves,hints:g?.hints,found:g?.found},g?.puzzle?.id||null));
    wrapRender('showTajenkaRecap',completion=>prepareTajenkaDailyResult(completion||{},completion?.puzzleId||null));
    refresh();
    const free=q('#screen-free');if(free&&!freeObserver){freeObserver=new MutationObserver(queueRefresh);freeObserver.observe(free,{childList:true,subtree:true})}
    const daily=q('#screen-daily');if(daily&&!dailyObserver){dailyObserver=new MutationObserver(queueRefresh);dailyObserver.observe(daily,{childList:true,subtree:true})}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.addEventListener('load',install,{once:true});
  setTimeout(install,300);
  setTimeout(install,1200);
})();