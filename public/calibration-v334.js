(()=>{
  'use strict';
  const RESULT_KEY='proplet-v334-calibration-results-v3';
  const NAME_KEY='proplet-v334-calibration-tester-v3';
  const $=selector=>document.querySelector(selector);
  const $$=selector=>[...document.querySelectorAll(selector)];
  const labels={medium:'Střední',hard:'Těžká'};
  const order=['medium','hard'];
  let db=null,diff='medium',level=1,puzzle=null,mask=new Set(),found=new Set(),foundCells=new Map();
  let selected=[],dragging=false,startedAt=0,elapsedMs=0,timerId=null,moves=0,finished=false;

  const fmt=ms=>{const n=Math.max(0,Number(ms)||0),m=Math.floor(n/60000),s=Math.floor((n%60000)/1000),t=Math.floor((n%1000)/100);return `${m}:${String(s).padStart(2,'0')}.${t}`};
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const resultId=(difficulty,itemLevel)=>`${db?.fixtureId||'v3'}:${difficulty}:${itemLevel}`;
  const adjacent=(a,b)=>{const ar=Math.floor(a/puzzle.cols),ac=a%puzzle.cols,br=Math.floor(b/puzzle.cols),bc=b%puzzle.cols;return Math.abs(ar-br)+Math.abs(ac-bc)===1};
  const samePath=(a,b)=>a.length===b.length&&a.every((value,index)=>value===b[index]);
  const results=()=>{try{const value=JSON.parse(localStorage.getItem(RESULT_KEY)||'[]');return Array.isArray(value)?value:[]}catch{return []}};
  const saveResults=rows=>{try{localStorage.setItem(RESULT_KEY,JSON.stringify(rows.slice(-20)))}catch{}};
  const testerName=()=>$('#testerName')?.value.trim()||'';
  const saveName=()=>{try{localStorage.setItem(NAME_KEY,testerName())}catch{}};
  const completedIds=()=>new Set(results().map(row=>row.id));
  const totalCount=()=>order.reduce((sum,key)=>sum+(db?.puzzles?.[key]?.length||0),0);

  function canonicalRows(){
    const rows=results();
    return order.flatMap(difficulty=>(db?.puzzles?.[difficulty]||[]).map((_,index)=>rows.find(row=>row.id===resultId(difficulty,index+1))).filter(Boolean));
  }

  function firstUnfinished(){
    const done=completedIds();
    for(const difficulty of order){
      const list=db?.puzzles?.[difficulty]||[];
      for(let index=0;index<list.length;index++)if(!done.has(resultId(difficulty,index+1)))return {diff:difficulty,level:index+1};
    }
    return null;
  }

  function nextAfter(difficulty,itemLevel){
    const list=db?.puzzles?.[difficulty]||[];
    if(itemLevel<list.length)return {diff:difficulty,level:itemLevel+1};
    if(difficulty==='medium'&&(db?.puzzles?.hard?.length||0))return {diff:'hard',level:1};
    return null;
  }

  function populateLevels(){
    const list=db?.puzzles?.[diff]||[];
    const done=completedIds();
    $('#levelSelect').innerHTML=list.map((item,index)=>{
      const number=index+1,suffix=done.has(resultId(diff,number))?' ✓':'';
      return `<option value="${number}">#${number}${suffix}</option>`;
    }).join('');
    level=Math.min(Math.max(1,level),Math.max(1,list.length));
    $('#levelSelect').value=String(level);
  }

  function renderOverallProgress(){
    const done=completedIds().size;
    $('#overallProgress').textContent=`${Math.min(done,totalCount())} / ${totalCount()}`;
  }

  function clearTimer(){if(timerId){clearInterval(timerId);timerId=null}}
  function tick(){if(!startedAt||finished)return;elapsedMs=performance.now()-startedAt;$('#timer').textContent=fmt(elapsedMs)}
  function beginClock(){if(startedAt)return;startedAt=performance.now();elapsedMs=0;timerId=setInterval(tick,100);tick()}

  function renderBoard(){
    const board=$('#board');
    board.style.gridTemplateColumns=`repeat(${puzzle.cols},minmax(0,1fr))`;
    board.innerHTML='';
    for(let index=0;index<puzzle.rows*puzzle.cols;index++){
      const cell=document.createElement('div');
      cell.className=mask.has(index)?'cell':'cell hole';
      if(mask.has(index)){
        cell.dataset.cell=String(index);
        cell.textContent=puzzle.letters[index]||'';
        cell.setAttribute('role','button');
        cell.setAttribute('aria-label',puzzle.letters[index]||'písmeno');
      }
      board.appendChild(cell);
    }
    paintBoard();
  }

  function paintBoard(){
    $$('.cell[data-cell]').forEach(cell=>{
      const index=Number(cell.dataset.cell),color=foundCells.get(index);
      cell.classList.toggle('selected',selected.includes(index));
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
    const previous=results().find(row=>row.id===resultId(diff,level));
    $('#gameMessage').textContent=previous?`Tuhle úroveň už máš uloženou (${fmt(previous.elapsedMs)}). Nový pokus ji nahradí.`:'Deska se odkryje až se stopkami.';
    $('#startOverlay').classList.remove('hidden');
    $('#resultCard').classList.add('hidden');
    renderBoard();renderOverallProgress();
  }

  function startMeasurement(){
    if(!puzzle)return;
    saveName();
    $('#startOverlay').classList.add('hidden');
    $('#currentWord').textContent='Skládej…';
    $('#gameMessage').textContent='Táhni přes sousední písmena. Nalezené slovo se samo zamkne.';
    beginClock();
  }

  function selectStart(index){
    if(finished||!startedAt||foundCells.has(index)||!mask.has(index))return;
    selected=[index];dragging=true;paintBoard();updateCurrent();
  }

  function selectMove(index){
    if(!dragging||finished||foundCells.has(index)||!mask.has(index)||!selected.length)return;
    const last=selected[selected.length-1];
    if(index===last)return;
    if(selected.length>1&&index===selected[selected.length-2]){selected.pop();paintBoard();updateCurrent();return}
    if(selected.includes(index)||!adjacent(last,index))return;
    selected.push(index);paintBoard();updateCurrent();
  }

  function updateCurrent(){
    if(!selected.length){$('#currentWord').textContent='Skládej…';return}
    $('#currentWord').textContent=selected.map(index=>puzzle.letters[index]).join('');
    $('#currentWord').className='current-word';
  }

  function submitSelection(){
    if(!dragging)return;dragging=false;
    if(selected.length<2){selected=[];paintBoard();updateCurrent();return}
    moves++;
    const word=selected.map(index=>puzzle.letters[index]).join('');
    const answer=puzzle.answers.find(item=>item.word===word&&samePath(item.path,selected));
    if(answer&&!found.has(answer.word)){
      const color=(found.size*47+265)%360;
      found.add(answer.word);answer.path.forEach(index=>foundCells.set(index,color));
      $('#currentWord').textContent=`✓ ${answer.word}`;$('#currentWord').className='current-word good';
      $('#progress').textContent=`${found.size} / ${puzzle.answers.length}`;
      $('#gameMessage').textContent=found.size===puzzle.answers.length?'':'Sedí. Hledej dál.';
      selected=[];paintBoard();
      if(found.size===puzzle.answers.length)finishPuzzle();
      else setTimeout(()=>{if(!dragging&&!finished){$('#currentWord').textContent='Skládej…';$('#currentWord').className='current-word'}},420);
      return;
    }
    $('#currentWord').textContent=word||'—';$('#currentWord').className='current-word bad';
    $('#gameMessage').textContent='Tahle cesta není cílové slovo.';
    $('#board').classList.remove('shake');void $('#board').offsetWidth;$('#board').classList.add('shake');
    selected=[];paintBoard();
    setTimeout(()=>{if(!dragging&&!finished){$('#currentWord').textContent='Skládej…';$('#currentWord').className='current-word';$('#gameMessage').textContent='Zkus jinou cestu.'}},420);
  }

  function finishPuzzle(){
    finished=true;elapsedMs=performance.now()-startedAt;clearTimer();$('#timer').textContent=fmt(elapsedMs);
    const row={id:resultId(diff,level),fixtureId:db.fixtureId,difficulty:diff,level,elapsedMs:Math.round(elapsedMs),moves,completedAt:new Date().toISOString()};
    const rows=results().filter(item=>item.id!==row.id);rows.push(row);saveResults(rows);
    $('#currentWord').textContent='Hotovo!';$('#currentWord').className='current-word good';
    $('#gameMessage').textContent='Uloženo v tomto prohlížeči. Můžeš se vrátit později.';
    $('#resultEyebrow').textContent=`${labels[diff].toUpperCase()} #${level}`;
    $('#resultTime').textContent=fmt(elapsedMs);
    $('#resultCopy').textContent=`${puzzle.answers.length} slov · ${moves} ${moves===1?'pokus':'pokusů'}`;
    $('#nextBtn').textContent=nextAfter(diff,level)?'Další úroveň →':'Hotovo — kopírovat výsledky';
    $('#resultCard').classList.remove('hidden');populateLevels();renderSessionResults();renderOverallProgress();
    $('#resultCard').scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  function nextPuzzle(){
    const next=nextAfter(diff,level);
    if(!next){copyResults();return}
    diff=next.diff;level=next.level;syncTabs();populateLevels();loadPuzzle();window.scrollTo({top:0,behavior:'smooth'});
  }

  function syncTabs(){$$('.diff-tab').forEach(button=>button.classList.toggle('active',button.dataset.diff===diff))}

  function renderSessionResults(){
    const root=$('#sessionResults'),rows=canonicalRows();
    if(!rows.length){root.innerHTML='<span class="muted">Zatím nic dokončeného.</span>';return}
    root.innerHTML=rows.map(row=>`<div class="session-row"><strong>${esc(labels[row.difficulty]||row.difficulty)} #${row.level}</strong><time>${fmt(row.elapsedMs)}</time><small>${row.moves} ${row.moves===1?'pokus':'pokusů'}</small></div>`).join('');
  }

  async function copyResults(){
    const rows=canonicalRows();if(!rows.length)return;
    saveName();
    const suffix=testerName()?` - ${testerName()}`:'';
    const text=[`Proplet v3.34 · kalibrační playtest V3${suffix}`,`Fixture: ${db.fixtureId}`,...rows.map(row=>`${labels[row.difficulty]||row.difficulty} #${row.level}: ${fmt(row.elapsedMs)} · ${row.moves} pokusů`)].join('\n');
    try{await navigator.clipboard.writeText(text);$('#copyResultsBtn').textContent='Zkopírováno ✓';setTimeout(()=>$('#copyResultsBtn').textContent='Kopírovat výsledky',1200)}catch{prompt('Zkopíruj výsledky:',text)}
  }

  function bindBoard(){
    const board=$('#board');
    board.addEventListener('pointerdown',event=>{const cell=event.target.closest('.cell[data-cell]');if(!cell)return;event.preventDefault();selectStart(Number(cell.dataset.cell))});
    board.addEventListener('pointermove',event=>{if(!dragging)return;event.preventDefault();const element=document.elementFromPoint(event.clientX,event.clientY),cell=element?.closest?.('.cell[data-cell]');if(cell)selectMove(Number(cell.dataset.cell))});
    window.addEventListener('pointerup',submitSelection,{passive:true});
    window.addEventListener('pointercancel',()=>{dragging=false;selected=[];paintBoard();updateCurrent()},{passive:true});
  }

  async function boot(){
    try{
      const response=await fetch('/calibration-v334.json',{cache:'no-store'});if(!response.ok)throw new Error(`HTTP ${response.status}`);db=await response.json();
      if(db.version!==3)throw new Error('preview ještě nemá V3 fixture');
    }catch(error){$('#gameMessage').textContent=`Kalibrační data se nepodařilo načíst (${error.message}). Počkej na nový preview build.`;$('#startOverlay').disabled=true;return}
    try{$('#testerName').value=localStorage.getItem(NAME_KEY)||''}catch{}
    const query=new URLSearchParams(location.search),queryDiff=query.get('difficulty'),queryLevel=Number.parseInt(query.get('level')||'',10);
    if(queryDiff&&db.puzzles?.[queryDiff])diff=queryDiff;
    if(Number.isFinite(queryLevel)&&queryLevel>0)level=queryLevel;
    if(!queryDiff&&!queryLevel){const next=firstUnfinished();if(next){diff=next.diff;level=next.level}}
    syncTabs();populateLevels();loadPuzzle();renderSessionResults();renderOverallProgress();bindBoard();
    $$('.diff-tab').forEach(button=>button.onclick=()=>{diff=button.dataset.diff;level=1;syncTabs();populateLevels();loadPuzzle()});
    $('#levelSelect').onchange=()=>{level=Number($('#levelSelect').value)||1;loadPuzzle()};
    $('#testerName').addEventListener('change',saveName);
    $('#startOverlay').onclick=startMeasurement;
    $('#restartBtn').onclick=loadPuzzle;
    $('#skipBtn').onclick=nextPuzzle;
    $('#nextBtn').onclick=nextPuzzle;
    $('#copyResultsBtn').onclick=copyResults;
    $('#clearResultsBtn').onclick=()=>{if(confirm('Opravdu smazat všechna lokálně uložená měření V3?')){saveResults([]);populateLevels();renderSessionResults();renderOverallProgress()}};
  }
  boot();
})();
