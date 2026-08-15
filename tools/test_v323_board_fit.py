#!/usr/bin/env python3
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
css=(ROOT/'public/styles.css').read_text(); app=(ROOT/'public/app.js').read_text()
for token in ['gridTemplateRows=`repeat(${p.rows},minmax(0,1fr))`','gridTemplateColumns=`repeat(${p.cols},minmax(0,1fr))`','targetH=cell*p.rows+rowGap*(p.rows-1)','wrap.style.height=`${targetH}px`']:
    assert token in app
html=f'''<!doctype html><html><head><style>{css}</style></head><body><div id="stage" class="board-stage" style="width:520px;height:470px;padding:4px"><div id="wrap" class="board-wrap"><div id="board" class="board dense-board ultra-board"></div></div></div></body></html>'''
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox']); page=b.new_page(viewport={'width':700,'height':620}); page.set_content(html)
 page.evaluate('''()=>{const board=document.querySelector('#board');board.style.gridTemplateColumns='repeat(10,minmax(0,1fr))';board.style.gridTemplateRows='repeat(10,minmax(0,1fr))';for(let i=0;i<100;i++){const c=document.createElement('div');c.className='cell';c.textContent='Ž';c.style.fontSize='42px';c.style.lineHeight='1.45';board.appendChild(c)}const stage=document.querySelector('#stage'),wrap=document.querySelector('#wrap'),cs=getComputedStyle(board),cg=parseFloat(cs.columnGap)||0,rg=parseFloat(cs.rowGap)||cg,ss=getComputedStyle(stage),px=(parseFloat(ss.paddingLeft)||0)+(parseFloat(ss.paddingRight)||0),py=(parseFloat(ss.paddingTop)||0)+(parseFloat(ss.paddingBottom)||0),aw=stage.clientWidth-px,ah=stage.clientHeight-py,cell=Math.min((aw-cg*9)/10,(ah-rg*9)/10);wrap.style.width=`${cell*10+cg*9}px`;wrap.style.height=`${cell*10+rg*9}px`}''')
 g=page.evaluate('''()=>{const b=document.querySelector('#board').getBoundingClientRect(),cells=[...document.querySelectorAll('.cell')].map(x=>x.getBoundingClientRect());return {bb:b.bottom,br:b.right,mb:Math.max(...cells.map(r=>r.bottom)),mr:Math.max(...cells.map(r=>r.right))}}''')
 assert g['mb']<=g['bb']+.6 and g['mr']<=g['br']+.6,g
 b.close()
print('PASS: v3.23 retains exact 10x10 2D fit under exaggerated font/display scaling')
