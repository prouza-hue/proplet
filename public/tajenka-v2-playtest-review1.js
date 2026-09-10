(()=>{
'use strict';
const DATA_URL='/tajenka-v2-data-review1.json';
const STORE='proplet-tajenka-v2-playability-review1-37-v1';
const EXPECTED_BOARDS=37;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const categoryLabels={observation:'Pozorování',dry_humor:'Suchý humor',fact:'Fakt',czech:'Čeština',language:'Jazyk',proverb:'Rčení',quote:'Citát'};
const ratingLabels={ok:'Sedí',easy:'Moc lehká',hard:'Moc těžká',bad:'Špatná'};
let db=null,boards=[],pos=0,puzzle=null,mask=new Set(),found=new Set(),foundCells=new Map(),selected=[],dragging=false,startedAt=0,elapsed=0,timerId=null,moves=0,wrong=0,finished=false,revealed=false,phraseTokens=[];
const norm=s=>String(s||'').toLocaleUpperCase('cs-CZ');
const fmt=ms=>{const n=Math.max(0,Number(ms)||0),m=Math.floor(n/60000),s=Math.floor((n%60000)/1000),t=Math.floor((n%1000)/100);return `${m}:${String(s).padStart(2,'0')}.${t}`};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const playtestNo=index=>index+1;
const loadStore=()=>{try{const x=JSON.parse(localStorage.getItem(STORE)||'{}');return x&&typeof x==='object'?x:{}}catch{return {}}};
const saveStore=o=>{try{localStorage.setItem(STORE,JSON.stringify(o))}catch{}};
const getRow=id=>loadStore()[id]||null;
const upsert=(id,patch)=>{const s=loadStore();s[id]={...(s[id]||{}),...patch};saveStore(s);renderSession()};
const clearTimer=()=>{if(timerId){clearInterval(timerId);timerId=null}};
const tick=()=>{if(startedAt&&!finished){elapsed=performance.now()-startedAt;$('#timer').textContent=fmt(elapsed)}};
const adjacent=(a,b)=>{const ar=Math.floor(a/6),ac=a%6,br=Math.floor(b/6),bc=b%6;return Math.abs(ar-br)+Math.abs(ac-bc)===1};
const samePath=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
function buildPhraseTokens(){
  const parts=puzzle.displayText.match(/[\p{L}\p{N}]+|[^\p{L}\p{N}]+/gu)||[puzzle.displayText];
  const tokens=parts.map((text,i)=>({text,index:i,isWord:/^[\p{L}\p{N}]+$/u.test(text),revealWith:null}));
  const words=tokens.filter(t=>t.isWord);
  for(const a of puzzle.answers){const t=words.find(x=>!x.revealWith&&norm(x.text)===norm(a.word));if(t)t.revealWith=norm(a.word)}
  for(const c of (puzzle.companions||[])){
    const want=(c.text.match(/[\p{L}\p{N}]+/gu)||[]).map(norm);if(!want.length)continue;
    for(let i=0;i<=words.length-want.length;i++){
      const slice=words.slice(i,i+want.length);if(slice.some(x=>x.revealWith))continue;
      if(slice.every((x,j)=>norm(x.text)===want[j])){slice.forEach(x=>x.revealWith=norm(c.revealWith));break}
    }
  }
  phraseTokens=tokens;
}
function renderPhrase(force=false){
  $('#phrase').innerHTML=phraseTokens.map(t=>{
    if(!t.isWord)return `<span>${esc(t.text)}</span>`;
    const show=force||revealed||found.has(t.revealWith);
    if(show)return `<span class="revealed">${esc(t.text)}</span>`;
    return `<span class="hidden-word" title="${[...t.text].length} znaků">${'·'.repeat(Math.max(1,[...t.text].length))}</span>`;
  }).join('');
}
function renderBoard(){
  const root=$('#board');root.innerHTML='';
  for(let i=0;i<36;i++){
    const c=document.createElement('div');c.className=mask.has(i)?'cell':'cell hole';
    if(mask.has(i)){c.dataset.cell=i;c.textContent=puzzle.letters[i]||'';c.setAttribute('role','button')}
    root.appendChild(c)
  }
  paint();
}
function paint(){
  $$('.cell[data-cell]').forEach(c=>{const i=Number(c.dataset.cell),h=foundCells.get(i);c.classList.toggle('selected',selected.includes(i));c.classList.toggle('found',h!=null);if(h!=null)c.style.setProperty('--found-hue',h);else c.style.removeProperty('--found-hue')})
}
function debug(){
  const m=puzzle.meta||{};const vals=[['Původní kandidát',`#${puzzle.candidateNo}`],['Písmena',m.targetLetters],['Decoye',m.decoyCells],['Otvory',m.holes],['Kontakty',m.crossWordEdges],['Páry slov',m.crossWordPairs],['Score',m.qualityScore],['Alt. full path',m.alternativeFullPaths],['Anchory',puzzle.answers.length],['Izolované buňky',m.isolatedActiveCells??0]];
  $('#debugGrid').innerHTML=vals.map(([a,b])=>`<div><small>${esc(a)}</small><strong>${esc(b)}</strong></div>`).join('');
}
function loadBoard(index){
  clearTimer();pos=Math.min(Math.max(0,index),boards.length-1);puzzle=boards[pos];mask=new Set(puzzle.mask||[]);found=new Set();foundCells=new Map();selected=[];dragging=false;startedAt=0;elapsed=0;moves=0;wrong=0;finished=false;revealed=false;buildPhraseTokens();
  $('#boardLabel').textContent=`#${playtestNo(pos)}`;$('#categoryLabel').textContent=categoryLabels[puzzle.category]||puzzle.category;$('#timer').textContent='0:00.0';$('#foundLabel').textContent=`0 / ${puzzle.answers.length}`;$('#currentWord').textContent='Připraven?';$('#currentWord').className='current';$('#message').textContent='Táhni pouze nahoru, dolů, vlevo nebo vpravo.';$('#startOverlay').classList.remove('hidden');$('#review').classList.add('hidden');
  const old=getRow(puzzle.id);$('#note').value=old?.note||'';$$('.rate').forEach(b=>b.classList.toggle('active',b.dataset.rating===old?.rating));
  renderPhrase();renderBoard();debug();$('#boardSelect').value=String(pos);try{history.replaceState(null,'',`?board=${playtestNo(pos)}`)}catch{}
}
function start(){if(!puzzle)return;$('#startOverlay').classList.add('hidden');startedAt=performance.now();timerId=setInterval(tick,100);tick();$('#currentWord').textContent='Skládej…';$('#message').textContent='Nalezené slovo se zamkne a odhalí svou část tajenky.'}
function selectStart(i){if(finished||!startedAt||foundCells.has(i)||!mask.has(i))return;selected=[i];dragging=true;paint();updateCurrent()}
function selectMove(i){if(!dragging||finished||foundCells.has(i)||!mask.has(i)||!selected.length)return;const last=selected.at(-1);if(i===last)return;if(selected.length>1&&i===selected.at(-2)){selected.pop();paint();updateCurrent();return}if(selected.includes(i)||!adjacent(last,i))return;selected.push(i);paint();updateCurrent()}
function updateCurrent(){const t=selected.map(i=>puzzle.letters[i]).join('');$('#currentWord').textContent=t||'Skládej…';$('#currentWord').className='current'}
function submit(){
  if(!dragging)return;dragging=false;if(selected.length<2){selected=[];paint();updateCurrent();return}
  moves++;const word=selected.map(i=>puzzle.letters[i]).join('');const answer=puzzle.answers.find(a=>norm(a.word)===norm(word)&&samePath(a.path,selected));
  if(answer&&!found.has(norm(answer.word))){const hue=(found.size*41+133)%360;found.add(norm(answer.word));answer.path.forEach(i=>foundCells.set(i,hue));$('#foundLabel').textContent=`${found.size} / ${puzzle.answers.length}`;$('#currentWord').textContent=`✓ ${answer.word}`;$('#currentWord').className='current good';selected=[];paint();renderPhrase();if(found.size===puzzle.answers.length)finish();else setTimeout(()=>{if(!dragging&&!finished){$('#currentWord').textContent='Skládej…';$('#currentWord').className='current'}},380);return}
  wrong++;$('#currentWord').textContent=word||'—';$('#currentWord').className='current bad';$('#message').textContent='Tahle cesta není cílové slovo.';$('#board').classList.remove('shake');void $('#board').offsetWidth;$('#board').classList.add('shake');selected=[];paint();setTimeout(()=>{if(!dragging&&!finished){$('#currentWord').textContent='Skládej…';$('#currentWord').className='current';$('#message').textContent='Zkus jinou cestu.'}},420)
}
function finish(){
  finished=true;elapsed=performance.now()-startedAt;clearTimer();$('#timer').textContent=fmt(elapsed);renderPhrase(true);$('#currentWord').textContent='Tajenka odhalena';$('#currentWord').className='current good';$('#message').textContent='Teď ohodnoť hlavně samotnou desku: tok hledání, falešné odbočky a pocit z řešení.';$('#finalPhrase').textContent=puzzle.displayText;$('#finishStats').textContent=`${fmt(elapsed)} · ${moves} tahů · ${wrong} chybných cest · ${puzzle.answers.length} anchorů`;const src=puzzle.source;$('#source').innerHTML=src?.url?`Zdroj: <a href="${esc(src.url)}" target="_blank" rel="noreferrer">${esc(src.label||'ověření')}</a>`:'';$('#review').classList.remove('hidden');upsert(puzzle.id,{playtestNo:playtestNo(pos),candidateNo:puzzle.candidateNo,category:puzzle.category,elapsedMs:Math.round(elapsed),moves,wrong,completedAt:new Date().toISOString(),completed:true});$('#review').scrollIntoView({behavior:'smooth',block:'nearest'})
}
function revealSolution(){if(!puzzle)return;revealed=true;renderPhrase(true);puzzle.answers.forEach((a,k)=>a.path.forEach(i=>foundCells.set(i,(k*41+133)%360)));paint();$('#message').textContent='Řešení zobrazeno. Tento pokus se nepočítá jako dokončený.'}
function next(){loadBoard((pos+1)%boards.length);window.scrollTo({top:0,behavior:'smooth'})}
function nextUnrated(){const s=loadStore();for(let off=1;off<=boards.length;off++){const i=(pos+off)%boards.length;if(!s[boards[i].id]?.rating){loadBoard(i);window.scrollTo({top:0,behavior:'smooth'});return}}}
function setRating(r){$$('.rate').forEach(b=>b.classList.toggle('active',b.dataset.rating===r));upsert(puzzle.id,{playtestNo:playtestNo(pos),candidateNo:puzzle.candidateNo,category:puzzle.category,rating:r,note:$('#note').value.trim(),reviewedAt:new Date().toISOString()});$('#savedState').textContent='Uloženo.';setTimeout(()=>$('#savedState').textContent='Hodnocení se ukládá automaticky.',900)}
function saveNote(){const active=$('.rate.active')?.dataset.rating;upsert(puzzle.id,{playtestNo:playtestNo(pos),candidateNo:puzzle.candidateNo,category:puzzle.category,rating:active||getRow(puzzle.id)?.rating||null,note:$('#note').value.trim()})}
function renderSession(){
  if(!boards.length)return;const s=loadStore(),rows=boards.map((b,i)=>({b,i,r:s[b.id]})).filter(x=>x.r);const reviewed=rows.filter(x=>x.r.rating);const completed=rows.filter(x=>x.r.completed);$('#overall').textContent=`${reviewed.length} / ${boards.length}`;$('#completionPill').textContent=`${completed.length} dokončeno`;const counts={ok:0,easy:0,hard:0,bad:0};reviewed.forEach(x=>counts[x.r.rating]=(counts[x.r.rating]||0)+1);$('#summaryChips').innerHTML=Object.keys(counts).map(k=>`<span class="summary-chip">${ratingLabels[k]}: ${counts[k]}</span>`).join('');$('#results').innerHTML=rows.length?rows.map(({b,i,r})=>`<div class="row"><strong>#${playtestNo(i)}</strong><span>${esc((b.displayText||'').slice(0,62))}</span><time>${r.elapsedMs?fmt(r.elapsedMs):'—'}</time><span class="rating-badge rating-${esc(r.rating||'')}">${esc(r.rating?ratingLabels[r.rating]:'bez hodnocení')}</span></div>`).join(''):'<span style="color:var(--muted);font-size:12px">Zatím nic.</span>';populateSelect()
}
function populateSelect(){const s=loadStore(),current=String(pos);$('#boardSelect').innerHTML=boards.map((b,i)=>`<option value="${i}">#${playtestNo(i)} · ${esc(categoryLabels[b.category]||b.category)}${s[b.id]?.rating?' ✓':''}</option>`).join('');$('#boardSelect').value=current}
async function copyReport(){const s=loadStore();const rows=boards.map((b,i)=>({b,i,r:s[b.id]})).filter(x=>x.r?.rating||x.r?.completed);if(!rows.length)return;const text=['Proplet · Tajenka v2 · clean playtest 37',...rows.map(({b,i,r})=>`#${playtestNo(i)} ${r.rating?ratingLabels[r.rating]:'bez hodnocení'} · ${r.elapsedMs?fmt(r.elapsedMs):'—'} · ${r.moves??'—'} tahů · ${r.wrong??'—'} chyb${r.note?` · ${r.note}`:''}`)].join('\n');try{await navigator.clipboard.writeText(text);$('#copy').textContent='Zkopírováno ✓';setTimeout(()=>$('#copy').textContent='Kopírovat report',1200)}catch{prompt('Zkopíruj report:',text)}}
function bind(){const board=$('#board');board.addEventListener('pointerdown',e=>{const c=e.target.closest('.cell[data-cell]');if(!c)return;e.preventDefault();selectStart(Number(c.dataset.cell))});board.addEventListener('pointermove',e=>{if(!dragging)return;e.preventDefault();const el=document.elementFromPoint(e.clientX,e.clientY),c=el?.closest?.('.cell[data-cell]');if(c)selectMove(Number(c.dataset.cell))});window.addEventListener('pointerup',submit,{passive:true});window.addEventListener('pointercancel',()=>{dragging=false;selected=[];paint();updateCurrent()},{passive:true});$('#startOverlay').onclick=start;$('#restart').onclick=()=>loadBoard(pos);$('#skip').onclick=next;$('#reveal').onclick=revealSolution;$('#nextUnrated').onclick=nextUnrated;$('#boardSelect').onchange=()=>loadBoard(Number($('#boardSelect').value)||0);$$('.rate').forEach(b=>b.onclick=()=>setRating(b.dataset.rating));$('#note').addEventListener('change',saveNote);$('#saveNext').onclick=()=>{saveNote();nextUnrated()};$('#copy').onclick=copyReport;$('#clear').onclick=()=>{if(confirm('Opravdu smazat celý nový lokální Tajenka v2 playtest?')){localStorage.removeItem(STORE);renderSession();loadBoard(pos)}}}
async function boot(){try{const r=await fetch(DATA_URL,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);db=await r.json();boards=db.boards||[];if(boards.length!==EXPECTED_BOARDS)throw new Error(`čekám ${EXPECTED_BOARDS} desek, mám ${boards.length}`);if(boards.some(b=>(b.meta?.isolatedActiveCells??0)!==0))throw new Error('banka obsahuje desku s izolovanou aktivní buňkou')}catch(e){$('#message').textContent=`Data se nepodařilo načíst: ${e.message}`;$('#startOverlay').disabled=true;return}populateSelect();bind();const q=Number(new URLSearchParams(location.search).get('board'));const qp=Number.isFinite(q)&&q>=1&&q<=boards.length?q-1:-1;const s=loadStore();let initial=qp>=0?qp:boards.findIndex(b=>!s[b.id]?.rating);if(initial<0)initial=0;loadBoard(initial);renderSession()}
boot();
})();
