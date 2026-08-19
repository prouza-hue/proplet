(()=>{
  'use strict';
  const RESULT_KEY='proplet-v334-calibration-results-v2';
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const labels={medium:'Střední',hard:'Těžká'};
  let db=null,diff='medium',level=1,puzzle=null,mask=new Set(),found=new Set(),foundCells=new Map();
  let selected=[],dragging=false,startedAt=0,elapsedMs=0,timerId=null,moves=0,finished=false;

  const fmt=ms=>{const n=Math.max(0,Number(ms)||0),m=Math.floor(n/60000),s=Math.floor((n%60000)/1000),t=Math.floor((n%1000)/100);return `${m}:${String(s).padStart(2,'0')}.${t}`};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const adjacent=(a,b)=>{const ar=Math.floor(a/puzzle.cols),ac=a%puzzle.cols,br=Math.floor(b/puzzle.cols),bc=b%puzzle.cols;return Math.abs(ar-br)+Math.abs(ac-bc)===1};
  const samePath=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
  const results=()=>{try{return JSON.parse(sessionStorage.getItem(RESULT_KEY)||'[]')}catch{return []}};
  const saveResults=rows=>{try{sessionStorage.setItem(RESULT_KEY,JSON.stringify(rows.slice(-40)))}catch{}};

  function populateLevels(){
    const list=db?.puzzles?.[diff]||[];
    $('#levelSelect').innerHTML=list.map((p,i)=>`<option value="${i+1}">#${i+1}</option>`).join('');
    level=Math.min(Math.max(1,level),Math.max(1,list.length));
    $('#levelSelect').value=String(level);
  }

  function clearTimer(){if(timerId){clearInterval(timerId);timerId=null}}
  function tick(){if(!startedAt||finished)return;elapsedMs=performance.now()-startedAt;$('#timer').textContent=fmt(elapsedMs)}
  function beginClock(){if(startedAt)return;startedAt=performance.now();elapsedMs=0;timerId=setInterval(tick,100);tick()}

  function renderBoard(){
    const board=$('#board');
    board.style.gridTemplateColumns=`repeat(${puzzle.cols},minmax(0,1fr))`;
    board.innerHTML='';
    for(let i=0;i<puzzle.rows*puzzle.cols;i++){
      const cell=document.createElement('div');
      cell.className=mask.has(i)?'cell':'cell hole';
      if(mask.has(i)){
        cell.dataset.cell=String(i);
        cell.textContent=puzzle.letters[i]||'';
        cell.setAttribute('role','button');
        cell.setAttribute('aria-label',puzzle.letters[i]||'písmeno');
      }
      board.appendChild(cell);
    }
    paintBoard();
  }

  function paintBoard(){
    $$('.cell[data-cell]').forEach(cell=>{
      const idx=Number(cell.dataset.cell);
      cell.classList.toggle('selected',selected.includes(idx));
      const color=foundCells.get(idx);
      cell.classList.toggle('found',color!=null);
      if(color!=null)cell.style.setProperty('--found-hue',String(color));else cell.style.removeProperty('--found-hue');
    });
  }

  function loadPuzzle(){
    clearTimer();
    const list=db?.puzzles?.[diff]||[];
    puzzle=list[level-1]||list[0];
    if(!puzzle){$('#gameMessage').textContent='Kalibrační data nejsou dostupná.';return}
    mask=new Set(puzzle.mask||[]);found=new Set();foundCells=new Map();selected=[];dragging=false;startedAt=0;elapsedMs=0;moves=0;finished=false;
    $('#difficultyLabel').textContent=labels[diff];
    $('#levelLabel').textContent=`#${level}`;
    $('#timer').textContent='0:00.0';
    $('#progress').textContent=`0 / ${puzzle.answers.length}`;
    $('#currentWord').textContent='Připraven?';$('#currentWord').className='current-word';
    $('#gameMessage').textContent='Začni bez prohlížení desky — jde nám hlavně o skutečný čas.';
    $('#startOverlay').classList.remove('hidden');
    $('#resultCard').classList.add('hidden');
    renderBoard();
  }

  function startMeasurement(){
    if(!puzzle)return;
    $('#startOverlay').classList.add('hidden');
    $('#currentWord').textContent='Skládej…';
    $('#gameMessage').textContent='Táhni přes sousední písmena. Nalezené slovo se samo zamkne.';
    beginClock();
  }

  function selectStart(idx){
    if(finished||!startedAt||foundCells.has(idx)||!mask.has(idx))return;
    selected=[idx];dragging=true;paintBoard();updateCurrent();
  }

  function selectMove(idx){
    if(!dragging||finished||foundCells.has(idx)||!mask.has(idx)||!selected.length)return;
    const last=selected[selected.length-1];
    if(idx===last)return;
    if(selected.length>1&&idx===selected[selected.length-2]){selected.pop();paintBoard();updateCurrent();return}
    if(selected.includes(idx)||!adjacent(last,idx))return;
    selected.push(idx);paintBoard();updateCurrent();
  }

  function updateCurrent(){
    if(!selected.length){$('#currentWord').textContent='Skládej…';return}
    $('#currentWord').textContent=selected.map(i=>puzzle.letters[i]).join('');
    $('#currentWord').className='current-word';
  }

  function submitSelection(){
    if(!dragging)return;dragging=false;
    if(selected.length<2){selected=[];paintBoard();updateCurrent();return}
    moves++;
    const word=selected.map(i=>puzzle.letters[i]).join('');
    const answer=puzzle.answers.find(a=>a.word===word&&samePath(a.path,selected));
    if(answer&&!found.has(answer.word)){
      const color=(found.size*47+265)%360;
      found.add(answer.word);answer.path.forEach(i=>foundCells.set(i,color));
      $('#currentWord').textContent=`✓ ${answer.word}`;$('#currentWord').className='current-word good';
      $('#progress').textContent=`${found.size} / ${puzzle.answers.length}`;
      $('#gameMessage').textContent=found.size===puzzle.answers.length?'':'Sedí. Hledej dál.';
      selected=[];paintBoard();
      if(found.size===puzzle.answers.length)finishPuzzle();
      else setTimeout(()=>{if(!dragging&&!finished){$('#currentWord').textContent='Skládej…';$('#currentWord').className='current-word'}},550);
      return;
    }
    $('#currentWord').textContent=word||'—';$('#currentWord').className='current-word bad';
    $('#gameMessage').textContent='Tahle cesta není cílové slovo.';
    $('#board').classList.remove('shake');void $('#board').offsetWidth;$('#board').classList.add('shake');
    selected=[];paintBoard();
    setTimeout(()=>{if(!dragging&&!finished){$('#currentWord').textContent='Skládej…';$('#currentWord').className='current-word';$('#gameMessage').textContent='Zkus jinou cestu.'}},520);
  }

  function finishPuzzle(){
    finished=true;elapsedMs=performance.now()-startedAt;clearTimer();$('#timer').textContent=fmt(elapsedMs);
    const rows=results();rows.push({difficulty:diff,level,elapsedMs:Math.round(elapsedMs),moves,completedAt:new Date().toISOString()});saveResults(rows);
    $('#currentWord').textContent='Hotovo!';$('#currentWord').className='current-word good';
    $('#gameMessage').textContent='Výsledek se ukládá jen do této preview session.';
    $('#resultEyebrow').textContent=`${labels[diff].toUpperCase()} #${level}`;
    $('#resultTime').textContent=fmt(elapsedMs);
    $('#resultCopy').textContent=`${puzzle.answers.length} slov · ${moves} ${moves===1?'pokus':'pokusů'}`;
    $('#resultCard').classList.remove('hidden');renderSessionResults();
    $('#resultCard').scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  function nextPuzzle(){
    const list=db?.puzzles?.[diff]||[];
    if(level<list.length)level++;else{diff=diff==='medium'?'hard':'medium';level=1;syncTabs();populateLevels()}
    $('#levelSelect').value=String(level);loadPuzzle();window.scrollTo({top:0,behavior:'smooth'});
  }

  function syncTabs(){$$('.diff-tab').forEach(b=>b.classList.toggle('active',b.dataset.diff===diff))}

  function renderSessionResults(){
    const root=$('#sessionResults'),rows=results();
    if(!rows.length){root.innerHTML='<span class="muted">Zatím nic dokončeného.</span>';return}
    root.innerHTML=rows.slice().reverse().map(r=>`<div class="session-row"><strong>${esc(labels[r.difficulty]||r.difficulty)} #${r.level}</strong><time>${fmt(r.elapsedMs)}</time><small>${r.moves} ${r.moves===1?'pokus':'pokusů'}</small></div>`).join('');
  }

  async function copyResults(){
    const rows=results();if(!rows.length)return;
    const text=['Proplet v3.34 · kalibrační playtest',...rows.map(r=>`${labels[r.difficulty]||r.difficulty} #${r.level}: ${fmt(r.elapsedMs)} · ${r.moves} pokusů`)].join('\n');
    try{await navigator.clipboard.writeText(text);$('#copyResultsBtn').textContent='Zkopírováno ✓';setTimeout(()=>$('#copyResultsBtn').textContent='Kopírovat výsledky',1200)}catch{prompt('Zkopíruj výsledky:',text)}
  }

  function bindBoard(){
    const board=$('#board');
    board.addEventListener('pointerdown',e=>{const cell=e.target.closest('.cell[data-cell]');if(!cell)return;e.preventDefault();selectStart(Number(cell.dataset.cell))});
    board.addEventListener('pointermove',e=>{if(!dragging)return;e.preventDefault();const el=document.elementFromPoint(e.clientX,e.clientY),cell=el?.closest?.('.cell[data-cell]');if(cell)selectMove(Number(cell.dataset.cell))});
    window.addEventListener('pointerup',submitSelection);
    window.addEventListener('pointercancel',()=>{dragging=false;selected=[];paintBoard();updateCurrent()});
  }

  async function boot(){
    try{
      const r=await fetch('/calibration-v334.json',{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);db=await r.json();
    }catch(e){$('#gameMessage').textContent=`Kalibrační data se nepodařilo načíst (${e.message}). Počkej na nový preview build.`;$('#startOverlay').disabled=true;return}
    const q=new URLSearchParams(location.search),qd=q.get('difficulty');if(qd&&db.puzzles?.[qd])diff=qd;
    const ql=Number.parseInt(q.get('level')||'',10);if(Number.isFinite(ql)&&ql>0)level=ql;
    syncTabs();populateLevels();loadPuzzle();renderSessionResults();bindBoard();
    $$('.diff-tab').forEach(b=>b.onclick=()=>{diff=b.dataset.diff;level=1;syncTabs();populateLevels();loadPuzzle()});
    $('#levelSelect').onchange=()=>{level=Number($('#levelSelect').value)||1;loadPuzzle()};
    $('#startOverlay').onclick=startMeasurement;
    $('#restartBtn').onclick=loadPuzzle;
    $('#skipBtn').onclick=nextPuzzle;
    $('#nextBtn').onclick=nextPuzzle;
    $('#copyResultsBtn').onclick=copyResults;
    $('#clearResultsBtn').onclick=()=>{saveResults([]);renderSessionResults()};
  }
  boot();
})();
