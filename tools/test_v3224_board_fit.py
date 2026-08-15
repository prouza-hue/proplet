#!/usr/bin/env python3
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
css=(ROOT/'public/styles.css').read_text()
app=(ROOT/'public/app.js').read_text()
server=(ROOT/'server.py').read_text()
assert "const APP_VERSION='3.22.4'" in app
assert 'gridTemplateRows=`repeat(${p.rows},minmax(0,1fr))`' in app
assert 'gridTemplateColumns=`repeat(${p.cols},minmax(0,1fr))`' in app
assert 'targetH=cell*p.rows+rowGap*(p.rows-1)' in app
assert 'wrap.style.height=`${targetH}px`' in app
assert '"boardFit2DHotfix": True' in server
assert '"foldWebPwaLayoutUnified": True' in server
html=f'''<!doctype html><html><head><style>{css}</style></head><body>
<div id="stage" class="board-stage" style="width:520px;height:470px;padding:4px">
 <div id="wrap" class="board-wrap"><div id="board" class="board dense-board ultra-board"></div></div>
</div></body></html>'''
with sync_playwright() as p:
    b=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page=b.new_page(viewport={'width':700,'height':620})
    page.set_content(html)
    # 10x10 board, exaggerated text metrics to mimic Android font/display scaling.
    page.evaluate('''() => {
      const board=document.querySelector('#board');
      board.style.gridTemplateColumns='repeat(10,minmax(0,1fr))';
      board.style.gridTemplateRows='repeat(10,minmax(0,1fr))';
      for(let i=0;i<100;i++){
        const c=document.createElement('div'); c.className='cell'; c.textContent='Ž';
        c.style.fontSize='42px'; c.style.lineHeight='1.45'; board.appendChild(c);
      }
      const stage=document.querySelector('#stage'),wrap=document.querySelector('#wrap');
      const cs=getComputedStyle(board), colGap=parseFloat(cs.columnGap)||0,rowGap=parseFloat(cs.rowGap)||colGap;
      const ss=getComputedStyle(stage),padX=(parseFloat(ss.paddingLeft)||0)+(parseFloat(ss.paddingRight)||0),padY=(parseFloat(ss.paddingTop)||0)+(parseFloat(ss.paddingBottom)||0);
      const aw=stage.clientWidth-padX, ah=stage.clientHeight-padY;
      const cell=Math.min((aw-colGap*9)/10,(ah-rowGap*9)/10);
      wrap.style.width=`${cell*10+colGap*9}px`; wrap.style.height=`${cell*10+rowGap*9}px`;
    }''')
    page.wait_for_timeout(50)
    g=page.evaluate('''() => {
      const s=document.querySelector('#stage').getBoundingClientRect();
      const w=document.querySelector('#wrap').getBoundingClientRect();
      const b=document.querySelector('#board').getBoundingClientRect();
      const cells=[...document.querySelectorAll('.cell')].map(x=>x.getBoundingClientRect());
      return {stage:{x:s.x,y:s.y,w:s.width,h:s.height},wrap:{x:w.x,y:w.y,w:w.width,h:w.height},board:{x:b.x,y:b.y,w:b.width,h:b.height},maxBottom:Math.max(...cells.map(r=>r.bottom)),maxRight:Math.max(...cells.map(r=>r.right)),boardBottom:b.bottom,boardRight:b.right};
    }''')
    assert g['maxBottom'] <= g['boardBottom'] + .6, g
    assert g['maxRight'] <= g['boardRight'] + .6, g
    assert g['board']['h'] <= g['stage']['h'] + .6, g
    assert abs(g['board']['h']-g['wrap']['h']) <= .6, g
    b.close()
print('PASS: v3.22.4 preserves exact 2D board fit with exaggerated text metrics')
