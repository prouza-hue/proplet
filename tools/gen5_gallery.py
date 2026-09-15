#!/usr/bin/env python3
"""Render an entirely offline, private Gen5 playtest beside a pilot checkpoint."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LAB = ROOT / 'lab-output' / 'gen5'

HTML = r'''<!doctype html>
<html lang="cs"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Proplet · zkouška Gen5</title>
<style>
:root{color-scheme:light;--bg:#f5f0e5;--panel:#fffdf7;--ink:#203039;--muted:#687572;--line:#d9d8ce;--tile:#dce8df;--accent:#286d5f;--button:#244fb2;--selected:#f5d46b}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.45 system-ui,sans-serif}button,select{font:inherit}button{cursor:pointer}button:focus-visible,select:focus-visible{outline:3px solid #c58b11;outline-offset:3px}main{max-width:1140px;margin:auto;padding:28px 22px}header{display:flex;gap:20px;align-items:center;justify-content:space-between}h1{font-size:clamp(25px,4vw,38px);margin:0;letter-spacing:-1px}p{margin:8px 0}header p{color:var(--muted)}.notice{border-left:4px solid #ad8540;padding:10px 14px;margin:22px 0;background:var(--panel);border-radius:5px}.selectors{display:flex;gap:12px;flex-wrap:wrap;margin:20px 0}.selectors label{display:grid;gap:5px;font-size:14px;font-weight:700;min-width:180px}select,button.action{border:1px solid var(--line);border-radius:12px;background:var(--panel);color:var(--ink);padding:12px 16px}select{min-height:48px}.layout{display:grid;grid-template-columns:minmax(280px,650px) minmax(240px,1fr);gap:24px;align-items:start}.board-panel{padding:18px;background:var(--panel);border:1px solid var(--line);border-radius:24px}.grid{display:grid;gap:5px;touch-action:none;user-select:none;-webkit-user-select:none}.cell{min-width:0;padding:0;aspect-ratio:1;background:var(--tile);color:var(--ink);border:2px solid #8da99b;border-radius:14%;font-size:clamp(13px,2.6vw,29px);font-weight:800;text-shadow:0 1px #ffffff50;box-shadow:0 2px 0 #172d2628;touch-action:none}.cell.blank{visibility:hidden;pointer-events:none}.cell.found{background:var(--found);color:#fff;border-color:var(--found);text-shadow:none}.cell.selected{background:var(--selected);border-color:#987418;color:#243024;box-shadow:0 0 0 2px #b98918}.cell.revealed{background:var(--found);color:#fff;border-color:var(--found)}.side{display:grid;gap:16px}.card{padding:20px;background:var(--panel);border:1px solid var(--line);border-radius:20px}.card h2{font-size:17px;margin:0 0 10px}.chips{display:flex;flex-wrap:wrap;gap:7px;min-height:32px}.chip{padding:5px 11px;background:var(--tile);border-radius:9px;font-weight:750}.chip.word{background:var(--found);color:#fff}.selected-word{min-height:38px;font-size:25px;font-weight:800;color:var(--accent);overflow-wrap:anywhere}.status{min-height:48px;color:var(--muted);font-size:15px}.actions{display:flex;gap:10px;flex-wrap:wrap}.actions button{flex:1}button.primary{background:var(--button);border-color:var(--button);color:white}button:hover{filter:brightness(.95)}.help{font-size:14px;color:var(--muted)}.toggle{display:flex;gap:10px;align-items:center;font-weight:650;cursor:pointer}.toggle input{width:20px;height:20px;accent-color:var(--accent)}.details{font-size:13px;color:var(--muted);overflow-wrap:anywhere}.progress{float:right;color:var(--accent)}[hidden]{display:none!important}
@media(prefers-color-scheme:dark){:root{color-scheme:dark;--bg:#1e2831;--panel:#293440;--ink:#f6f1e4;--muted:#b0c0bd;--line:#4c5962;--tile:#405951;--accent:#96dbc6;--button:#3564ce}.cell{border-color:#829f94}.notice{background:#30383a}}
@media(max-width:740px){main{padding:18px 12px}.layout{grid-template-columns:1fr;gap:14px}.board-panel{padding:10px;border-radius:18px}.side{gap:12px}.card{padding:16px}.selectors{margin:16px 0}.selectors label{min-width:0;flex:1}.cell{font-size:clamp(14px,4vw,26px)}.notice{font-size:14px}header{align-items:start}.help{font-size:13px}}
</style>
<main><header><div><h1>Proplet · zkouška Gen5</h1><p>Nové desky k vyzkoušení, svým tempem.</p></div></header>
<p class="notice"><strong>Soukromý experiment.</strong> Obtížnost ještě ladíme. Výsledky ani XP se neukládají a nic se neposílá na server.</p>
<div class="selectors"><label>Obtížnost<select id="difficulty"></select></label><label>Deska<select id="board-choice"></select></label></div>
<div class="layout"><section class="board-panel" aria-label="Hrací deska"><div id="grid" class="grid"></div></section>
<aside class="side"><section class="card"><h2>Čas hraní <span class="progress" id="timer">00:00</span></h2><p class="help" id="timer-note">Od prvního písmene. Při skrytí stránky se čas pozastaví.</p></section><section class="card"><h2>Zbývá <span class="progress" id="progress"></span></h2><div class="chips" id="remaining"></div><h2 style="margin-top:18px">Nalezeno</h2><div class="chips" id="found"></div></section>
<section class="card"><h2>Skládáš</h2><div id="selection" class="selected-word">—</div><p id="status" class="status" role="status" aria-live="polite">Spoj sousední písmena tahem nebo postupným klepáním.</p><div class="actions"><button class="action" id="clear">Zrušit výběr</button><button class="action primary" id="reset">Znovu</button></div></section>
<section class="card"><label class="toggle"><input type="checkbox" id="reveal">Ukázat řešení</label><p class="help">Hledají se připravená slova uvedených délek. Každé políčko patří právě jednomu slovu. Pohyb vede vodorovně a svisle.</p><p class="help">Zpětným tahem se vrátíš o písmeno. Klávesnicí lze políčka vybrat přes Tab a Enter.</p><div id="details" class="details"></div></section></aside></div></main>
<script id="pilot-data" type="application/json">__PILOT__</script>
<script>
'use strict';
const puzzles=JSON.parse(document.getElementById('pilot-data').textContent);
const $=id=>document.getElementById(id);
const names={easy:'Snadná',medium:'Střední',hard:'Těžká',hardcore:'Mozkožrout',mozkomor:'Mozkomor'};
const colors=['#a84f38','#28796c','#325fa9','#896529','#835194','#436a31','#a54064','#346d83','#766040','#5954a1','#52684b'];
let board,selected=[],found=new Set(),activePointer=null,dragMoved=false,pointerStart=null;
let elapsed=0,clockStart=null,clockEnabled=false,solutionSeen=false;
function clockPause(){if(clockStart!==null){elapsed+=performance.now()-clockStart;clockStart=null;}}
function clockResume(){if(clockEnabled&&!document.hidden&&clockStart===null)clockStart=performance.now();}
function clockPaint(){const seconds=Math.floor((elapsed+(clockStart===null?0:performance.now()-clockStart))/1000);$('timer').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');}
setInterval(clockPaint,1000);
document.addEventListener('visibilitychange',()=>{if(document.hidden)clockPause();else clockResume();clockPaint();});
const normalize=w=>w.normalize('NFC').toLocaleUpperCase('cs');
const adjacent=(a,b)=>Math.abs(Math.floor(a/board.cols)-Math.floor(b/board.cols))+Math.abs(a%board.cols-b%board.cols)===1;
const owner=i=>board.answers.findIndex(a=>a.path.includes(i));
function option(parent,value,label){const o=document.createElement('option');o.value=value;o.textContent=label;parent.append(o);}
for(const d of Object.keys(names))if(puzzles.some(b=>b.difficulty===d))option($('difficulty'),d,names[d]);
function loadDifficulty(){
  $('board-choice').replaceChildren();
  puzzles.forEach((b,i)=>{if(b.difficulty===$('difficulty').value)option($('board-choice'),String(i),'Deska '+($('board-choice').options.length+1));});
  loadBoard();
}
function loadBoard(){
  elapsed=0;clockStart=null;clockEnabled=false;solutionSeen=false;clockPaint();$('timer-note').textContent='Od prvního písmene. Při skrytí stránky se čas pozastaví.';
  board=puzzles[Number($('board-choice').value)];selected=[];found=new Set();activePointer=null;$('reveal').checked=false;
  const grid=$('grid');grid.replaceChildren();grid.style.gridTemplateColumns=`repeat(${board.cols},minmax(0,1fr))`;
  board.letters.forEach((letter,i)=>{const b=document.createElement('button');b.type='button';b.className='cell';b.dataset.cell=i;b.textContent=letter;b.setAttribute('aria-label',`${letter}, řádek ${Math.floor(i/board.cols)+1}, sloupec ${i%board.cols+1}`);if(!board.mask.includes(i)){b.classList.add('blank');b.disabled=true;b.setAttribute('aria-hidden','true');}grid.append(b);});
  $('details').textContent=board.id;
  status('Spoj sousední písmena tahem nebo postupným klepáním.');paint();
}
function status(text){$('status').textContent=text;}
function paint(){
  const reveal=$('reveal').checked;
  for(const cell of $('grid').children){const i=Number(cell.dataset.cell),o=owner(i);cell.classList.toggle('selected',selected.includes(i));cell.classList.toggle('found',found.has(o));cell.classList.toggle('revealed',reveal&&o>=0);if(o>=0)cell.style.setProperty('--found',colors[o%colors.length]);cell.setAttribute('aria-pressed',String(selected.includes(i)));}
  $('selection').textContent=selected.map(i=>board.letters[i]).join('')||'—';
  $('remaining').replaceChildren();$('found').replaceChildren();
  const outstanding=board.answers.filter((_,i)=>!found.has(i)).map(a=>a.word.length).sort((a,b)=>a-b);
  for(const n of outstanding){const e=document.createElement('span');e.className='chip';e.textContent=n;$('remaining').append(e);}
  board.answers.forEach((a,i)=>{if(found.has(i)||reveal){const e=document.createElement('span');e.className='chip word';e.style.setProperty('--found',colors[i%colors.length]);e.textContent=normalize(a.word);$('found').append(e);}});
  if(!$('found').children.length)$('found').textContent='Zatím nic';
  if(!outstanding.length)$('remaining').textContent='Všechno nalezeno';
  $('progress').textContent=`${found.size}/${board.answers.length}`;
}
function addCell(i){
  if(!board.mask.includes(i)||found.has(owner(i))||$('reveal').checked)return;
  clockEnabled=true;clockResume();
  if(selected.length>1&&selected[selected.length-2]===i){selected.pop();paint();return;}
  if(selected.includes(i))return;
  if(selected.length&&!adjacent(selected[selected.length-1],i))return;
  selected.push(i);paint();
}
function submit(clearInvalid){
  const word=normalize(selected.map(i=>board.letters[i]).join(''));
  const target=board.answers.findIndex(a=>normalize(a.word)===word&&a.path.length===selected.length&&a.path.every((cell,i)=>cell===selected[i]));
  if(target>=0&&!found.has(target)){found.add(target);selected=[];if(found.size===board.answers.length){clockPause();clockEnabled=false;clockPaint();}status(found.size===board.answers.length?'Hotovo! Jak na tebe tahle deska působila?':`Nalezeno: ${word}.`);paint();}
  else if(clearInvalid&&selected.length>1){status('Tato cesta nepatří do řešení. Zkus jinou.');selected=[];paint();}
}
const cellFromPoint=e=>{const el=document.elementFromPoint(e.clientX,e.clientY);return el&&el.closest('#grid .cell:not(.blank)');};
$('grid').addEventListener('pointerdown',e=>{if(e.button!==0||activePointer!==null)return;const cell=cellFromPoint(e);if(!cell)return;e.preventDefault();activePointer=e.pointerId;dragMoved=false;pointerStart=Number(cell.dataset.cell);$('grid').setPointerCapture(e.pointerId);addCell(pointerStart);});
$('grid').addEventListener('pointermove',e=>{if(activePointer!==e.pointerId)return;const cell=cellFromPoint(e);if(!cell)return;const i=Number(cell.dataset.cell);if(i!==pointerStart)dragMoved=true;addCell(i);});
$('grid').addEventListener('pointerup',e=>{if(activePointer!==e.pointerId)return;activePointer=null;submit(dragMoved);});
$('grid').addEventListener('pointercancel',()=>{activePointer=null;selected=[];paint();});
$('grid').addEventListener('click',e=>{if(e.detail!==0)return;const cell=e.target.closest('.cell:not(.blank)');if(cell){addCell(Number(cell.dataset.cell));submit(false);}});
$('difficulty').addEventListener('change',loadDifficulty);$('board-choice').addEventListener('change',loadBoard);
$('clear').addEventListener('click',()=>{selected=[];paint();status('Výběr zrušen.');});
$('reset').addEventListener('click',loadBoard);
$('reveal').addEventListener('change',()=>{selected=[];if($('reveal').checked){solutionSeen=true;clockPause();clockEnabled=false;$('timer-note').textContent='Řešení bylo odhaleno — čas není srovnatelný se samostatným hraním.';}status($('reveal').checked?'Prohlížíš řešení. Vypnutím se můžeš vrátit ke hraní.':'Pokračuj ve hledání.');clockPaint();paint();});
loadDifficulty();
</script></html>'''


def render(path):
    path = Path(path).resolve()
    root = LAB.resolve()
    if not path.is_relative_to(root) or path.parent == root or path.name != 'pilot.json':
        raise ValueError('Input must be pilot.json inside a run directory under lab-output/gen5.')
    state = json.loads(path.read_text(encoding='utf-8'))
    boards = state.get('puzzles', [])
    if state.get('kind') != 'gen5-pilot' or not boards:
        raise ValueError('A nonempty Gen5 pilot checkpoint is required.')
    # Embedding JSON is data, never HTML or executable script, even with hostile input.
    data = json.dumps(boards, ensure_ascii=False).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')
    output = path.parent / 'index.html'
    output.write_text(HTML.replace('__PILOT__', data), encoding='utf-8', newline='\n')
    return output


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pilot', type=Path)
    args = parser.parse_args()
    print(render(args.pilot))
