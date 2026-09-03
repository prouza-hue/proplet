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

  const MAGNIFIER_SCALE=1.8;

  function ensureMagnifier(){return query('#boardWrap')||null}
  function renderMagnifier(){return magnifierEnabled()}
  function hideMagnifier(){
    const wrap=query('#boardWrap'),stage=query('#boardStage');
    wrap?.classList.remove('touch-board-zoom');
    stage?.classList.remove('touch-board-zoom-active');
    wrap?.style?.removeProperty('--touch-zoom-x');
    wrap?.style?.removeProperty('--touch-zoom-y');
    wrap?.style?.removeProperty('--touch-zoom-scale');
  }
  function showMagnifier(centerIndex,pointerX,pointerY){
    if(!magnifierEnabled()){hideMagnifier();return false}
    const wrap=ensureMagnifier(),stage=query('#boardStage'),cell=query(`.cell[data-index="${centerIndex}"]`);
    if(!wrap||!stage)return false;
    const wr=wrap.getBoundingClientRect?.(),cr=cell?.getBoundingClientRect?.();
    if(!wr?.width||!wr?.height)return false;
    const fallbackX=cr?cr.left-wr.left+cr.width/2:wr.width/2,
      fallbackY=cr?cr.top-wr.top+cr.height/2:wr.height/2,
      rawX=Number.isFinite(pointerX)?pointerX-wr.left:fallbackX,
      rawY=Number.isFinite(pointerY)?pointerY-wr.top:fallbackY,
      anchorX=Math.max(0,Math.min(wr.width,rawX)),
      anchorY=Math.max(0,Math.min(wr.height,rawY));
    wrap.style.setProperty('--touch-zoom-x',`${anchorX}px`);
    wrap.style.setProperty('--touch-zoom-y',`${anchorY}px`);
    wrap.style.setProperty('--touch-zoom-scale',String(MAGNIFIER_SCALE));
    stage.classList.add('touch-board-zoom-active');
    wrap.classList.add('touch-board-zoom');
    return true;
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
    game.dragging=true;game.path=[index];game.lastPointer={x:event.clientX,y:event.clientY};fx('tap');updateActive();
    try{event.currentTarget.setPointerCapture(event.pointerId)}catch{}
    showMagnifier(index,event.clientX,event.clientY);
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
