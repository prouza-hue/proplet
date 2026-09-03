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
  const MAGNIFIER_THUMB_OFFSET=96;
  let magnifierState=null;

  function ensureMagnifier(){
    let root=query('#touchBoardZoom');
    if(root||!documentObj)return root;
    const stage=query('#boardStage');if(!stage)return null;
    root=documentObj.createElement('div');
    root.id='touchBoardZoom';root.className='touch-board-zoom-overlay hidden';root.setAttribute('aria-hidden','true');
    const camera=documentObj.createElement('div');camera.className='touch-board-zoom-camera';root.appendChild(camera);stage.appendChild(root);
    return root;
  }
  function cloneBoardVisual(){
    const wrap=query('#boardWrap');if(!wrap?.cloneNode)return null;
    const clone=wrap.cloneNode(true);clone.removeAttribute?.('id');clone.classList?.add('touch-board-zoom-clone');
    clone.querySelectorAll?.('[id]').forEach(el=>el.removeAttribute('id'));
    return clone;
  }
  function syncMagnifierVisual(){
    const root=ensureMagnifier(),camera=root?.querySelector?.('.touch-board-zoom-camera'),clone=cloneBoardVisual();
    if(!camera||!clone)return false;
    camera.replaceChildren(clone);return true;
  }
  function clamp(value,min,max){return Math.max(min,Math.min(max,value))}
  function cameraAxis(stageSize,baseStart,boardSize,focus,target,scale){
    const edgeMargin=20,scaledStart=scale*baseStart,scaledEnd=scale*(baseStart+boardSize),
      desired=target-scale*(baseStart+focus),ratio=boardSize?focus/boardSize:.5;
    if(ratio<=.28)return Math.max(desired,edgeMargin-scaledStart);
    if(ratio>=.72)return Math.min(desired,stageSize-edgeMargin-scaledEnd);
    return desired;
  }
  function positionMagnifier(centerIndex,pointerX,pointerY){
    const root=ensureMagnifier(),camera=root?.querySelector?.('.touch-board-zoom-camera'),
      stage=query('#boardStage'),wrap=query('#boardWrap'),cell=query(`.cell[data-index="${centerIndex}"]`);
    if(!root||!camera||!stage||!wrap)return false;
    const sr=stage.getBoundingClientRect?.(),wr=wrap.getBoundingClientRect?.(),cr=cell?.getBoundingClientRect?.();
    if(!sr?.width||!sr?.height||!wr?.width||!wr?.height)return false;
    const baseLeft=wr.left-sr.left,baseTop=wr.top-sr.top,
      fallbackX=cr?cr.left-wr.left+cr.width/2:wr.width/2,
      fallbackY=cr?cr.top-wr.top+cr.height/2:wr.height/2,
      focusX=clamp(Number.isFinite(pointerX)?pointerX-wr.left:fallbackX,0,wr.width),
      focusY=clamp(Number.isFinite(pointerY)?pointerY-wr.top:fallbackY,0,wr.height),
      pointerStageX=Number.isFinite(pointerX)?pointerX-sr.left:baseLeft+focusX,
      pointerStageY=Number.isFinite(pointerY)?pointerY-sr.top:baseTop+focusY,
      sideBias=pointerStageX>sr.width*.62?-28:pointerStageX<sr.width*.38?28:0,
      targetX=clamp(pointerStageX+sideBias,34,sr.width-34),
      targetY=clamp(pointerStageY-MAGNIFIER_THUMB_OFFSET,42,sr.height-42),
      tx=cameraAxis(sr.width,baseLeft,wr.width,focusX,targetX,MAGNIFIER_SCALE),
      ty=cameraAxis(sr.height,baseTop,wr.height,focusY,targetY,MAGNIFIER_SCALE);
    camera.style.setProperty('--touch-camera-x',`${tx}px`);
    camera.style.setProperty('--touch-camera-y',`${ty}px`);
    camera.style.setProperty('--touch-camera-scale',String(MAGNIFIER_SCALE));
    return true;
  }
  function renderMagnifier(){
    if(!magnifierState)return false;
    return syncMagnifierVisual();
  }
  function hideMagnifier(){
    magnifierState=null;
    query('#touchBoardZoom')?.classList.add('hidden');
    query('#boardStage')?.classList.remove('touch-board-zoom-active');
  }
  function showMagnifier(centerIndex,pointerX,pointerY){
    if(!magnifierEnabled()){hideMagnifier();return false}
    const root=ensureMagnifier(),stage=query('#boardStage');if(!root||!stage)return false;
    magnifierState={centerIndex,pointerX,pointerY};
    if(!syncMagnifierVisual()||!positionMagnifier(centerIndex,pointerX,pointerY)){magnifierState=null;return false}
    stage.classList.add('touch-board-zoom-active');root.classList.remove('hidden');return true;
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
