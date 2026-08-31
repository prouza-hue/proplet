(function installPropletGameInput(global){
'use strict';

function create(deps={}){
  const getGame=deps.getGame||(()=>null);
  const neighbours=deps.neighbours||(()=>[]);
  const updateActive=deps.updateActive||(()=>{});
  const ensureAudio=deps.ensureAudio||(()=>{});
  const fx=deps.fx||(()=>{});
  const hideUndo=deps.hideUndo||(()=>{});
  const submit=deps.submit||(()=>{});
  const query=deps.query||(()=>null);
  const documentObj=deps.documentObj||(typeof document!=='undefined'?document:null);
  const windowObj=deps.windowObj||(typeof window!=='undefined'?window:{});
  const navigatorObj=deps.navigatorObj||(typeof navigator!=='undefined'?navigator:{});
  const colors=deps.colors||[];
  const escapeHtml=deps.escapeHtml||(value=>String(value??''));
  const getSettings=deps.getSettings||(()=>({magnifier:true}));

  function magnifierDeviceSupported(){
    const coarse=windowObj.matchMedia?.('(pointer: coarse)')?.matches===true,
      touchCapable=(navigatorObj.maxTouchPoints||0)>0,
      shortSide=Math.min(windowObj.visualViewport?.width||windowObj.innerWidth||9999,windowObj.visualViewport?.height||windowObj.innerHeight||9999);
    return coarse&&touchCapable&&shortSide<=600;
  }
  function magnifierAvailable(game=getGame()){return !!game&&!game.finished&&['hard','hardcore','mozkomor'].includes(game.puzzle?.difficulty)&&magnifierDeviceSupported()}
  function magnifierEnabled(game=getGame()){return magnifierAvailable(game)&&getSettings().magnifier!==false}

  function ensureMagnifier(){
    let el=query('#touchMagnifier');if(el)return el;
    if(!documentObj)return null;
    el=documentObj.createElement('div');el.id='touchMagnifier';el.className='touch-magnifier hidden';
    el.setAttribute('aria-hidden','true');el.innerHTML='<div class="touch-magnifier-grid"></div>';documentObj.body.appendChild(el);return el;
  }
  function renderMagnifier(centerIndex){
    const game=getGame();if(!game||centerIndex==null)return false;
    const p=game.puzzle,mask=new Set(p.mask),row=Math.floor(centerIndex/p.cols),col=centerIndex%p.cols,
      root=ensureMagnifier(),grid=root?.querySelector('.touch-magnifier-grid'),cells=[],backIndex=game.path.length>1?game.path.at(-2):null;
    if(!grid)return false;
    for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
      if(Math.abs(dr)+Math.abs(dc)>1){cells.push('<span class="touch-mag-cell void"></span>');continue}
      const rr=row+dr,cc=col+dc,j=rr*p.cols+cc;
      if(rr<0||rr>=p.rows||cc<0||cc>=p.cols||!mask.has(j)){cells.push('<span class="touch-mag-cell void"></span>');continue}
      const cls=['touch-mag-cell'],isCenter=j===centerIndex,isBack=j===backIndex,isBlocked=!isCenter&&!isBack&&(game.used.has(j)||game.path.includes(j));
      if(isCenter)cls.push('focus','active');else if(isBack)cls.push('backtrack');else if(isBlocked)cls.push('blocked');else cls.push('candidate');
      const color=game.used.get(j),style=color!=null?` style="--word-color:${colors[color%colors.length]}"`:'';
      cells.push(`<span class="${cls.join(' ')}"${style}>${escapeHtml(p.letters[j])}</span>`);
    }
    grid.innerHTML=cells.join('');return true;
  }
  function hideMagnifier(){const el=query('#touchMagnifier');el?.classList.add('hidden')}
  function showMagnifier(centerIndex){
    if(!magnifierEnabled()){hideMagnifier();return false}
    const el=ensureMagnifier(),board=query('#board');if(!el)return false;
    const boardTop=board?.getBoundingClientRect?.().top??220,magHeight=144,gap=12,top=Math.max(8,Math.floor(boardTop-magHeight-gap));
    el.style.setProperty('--magnifier-top',`${top}px`);renderMagnifier(centerIndex);el.classList.remove('hidden');return true;
  }

  function currentWord(){const game=getGame();return game?.path?.map(i=>game.puzzle.letters[i]).join('')||''}
  function extendPath(index){
    const game=getGame();if(!game)return false;
    const path=game.path,last=path.at(-1);if(index===last)return false;
    if(path.length>1&&index===path.at(-2)){path.pop();updateActive();renderMagnifier(path.at(-1));return true}
    if(game.used.has(index)||path.includes(index)||!neighbours(last).includes(index))return false;
    path.push(index);fx('step');updateActive();renderMagnifier(index);return true;
  }
  function samplePointer(x,y){
    const game=getGame();if(!game?.dragging)return false;
    const prev=game.lastPointer||{x,y},dx=x-prev.x,dy=y-prev.y,dist=Math.hypot(dx,dy),steps=Math.max(1,Math.ceil(dist/6));
    for(let n=1;n<=steps;n++){
      const px=prev.x+dx*n/steps,py=prev.y+dy*n/steps,el=documentObj?.elementFromPoint?.(px,py)?.closest?.('.cell');
      if(el)extendPath(+el.dataset.index);
    }
    game.lastPointer={x,y};return true;
  }
  function pointerDown(event){
    event.preventDefault();ensureAudio();
    const game=getGame(),index=+event.currentTarget.dataset.index;
    if(!game||game.finished||game.used.has(index)||game.wrongPath?.length)return false;
    if(game.undoSnapshot)hideUndo();
    game.dragging=true;game.path=[index];game.lastPointer={x:event.clientX,y:event.clientY};fx('tap');updateActive();showMagnifier(index);
    try{event.currentTarget.setPointerCapture(event.pointerId)}catch{}
    return true;
  }
  function pointerEnter(event){const game=getGame();return game?.dragging?extendPath(+event.currentTarget.dataset.index):false}
  function pointerMove(event){
    if(!getGame()?.dragging)return false;
    const events=typeof event.getCoalescedEvents==='function'?event.getCoalescedEvents():[event];
    for(const item of events)samplePointer(item.clientX,item.clientY);
    return true;
  }
  function pointerUp(){
    hideMagnifier();const game=getGame();if(!game?.dragging)return false;
    game.dragging=false;game.lastPointer=null;submit();return true;
  }

  return {magnifierDeviceSupported,magnifierAvailable,magnifierEnabled,ensureMagnifier,renderMagnifier,showMagnifier,hideMagnifier,currentWord,extendPath,samplePointer,pointerDown,pointerEnter,pointerMove,pointerUp};
}

const api={create};
if(global)global.PropletGameInput=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
