(function installPropletGameInput(global){
'use strict';

function create(deps={}){
  const getGame=deps.getGame||(()=>null);
  const neighbours=deps.neighbours||(()=>[]);
  const updateActive=deps.updateActive||(()=>{});
  const ensureAudio=deps.ensureAudio||(()=>{});
  const fx=deps.fx||(()=>{});
  const hideUndo=deps.hideUndo||(()=>{});
  const clearHints=deps.clearHints||(()=>{});
  const submit=deps.submit||(()=>{});
  const firstInput=deps.firstInput||(()=>{});
  const reportInput=outcome=>{try{firstInput(outcome)}catch{}};
  const query=deps.query||(()=>null);
  const documentObj=deps.documentObj||(typeof document!=='undefined'?document:null);
  const windowObj=deps.windowObj||(typeof window!=='undefined'?window:{});
  const navigatorObj=deps.navigatorObj||(typeof navigator!=='undefined'?navigator:{});
  const colors=deps.colors||[];
  const escapeHtml=deps.escapeHtml||(value=>String(value??''));
  const getSettings=deps.getSettings||(()=>({magnifier:true}));
  const feedback=deps.feedback||(()=>{});
  const shortStarter=game=>game?.mode==='starter'&&game.puzzle?.meta?.starterVersion===3;
  const activeAnswer=game=>game.puzzle.answers.find((_,i)=>!game.found.some(f=>f.answerIndex===i));
  function resetStarter(outcome='cancelled'){
    const game=getGame();if(!shortStarter(game))return false;
    if(outcome&&(game.starterPointer||game.path?.length))reportInput(outcome);
    game.starterPointer=null;game.dragging=false;game.lastPointer=null;game.path=[];
    hideMagnifier();updateActive();return true;
  }
  function beginDrag(game){
    const pointer=game.starterPointer;if(!pointer||pointer.drag)return;
    pointer.drag=true;game.path=[pointer.index];updateActive();
  }

  function magnifierDeviceSupported(){
    const touchCapable=(navigatorObj.maxTouchPoints||0)>0||windowObj.matchMedia?.('(any-pointer: coarse)')?.matches===true;
    const width=windowObj.visualViewport?.width||windowObj.innerWidth||9999;
    return touchCapable&&width<=1280;
  }

  function magnifierAvailable(game=getGame()){return !!game&&!game.finished&&['hard','hardcore','mozkomor','mozkokalypsa'].includes(game.puzzle?.difficulty)&&magnifierDeviceSupported()}
  function magnifierEnabled(game=getGame()){return magnifierAvailable(game)&&getSettings().magnifier!==false}

  function ensureMagnifier(){
    let dock=query('#magnifierDock');
    if(!dock&&documentObj){
      const parent=query('.current-word');if(!parent)return null;
      dock=documentObj.createElement('div');dock.id='magnifierDock';dock.setAttribute('aria-hidden','true');parent.appendChild(dock);
    }
    let el=query('#touchMagnifier');if(el){if(dock&&el.parentNode!==dock)dock.appendChild(el);return el}
    if(!documentObj||!dock)return null;
    el=documentObj.createElement('div');el.id='touchMagnifier';el.className='touch-magnifier hidden';
    el.setAttribute('aria-hidden','true');el.innerHTML='<div class="touch-magnifier-grid"></div>';dock.appendChild(el);return el;
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
    const el=ensureMagnifier();if(!el)return false;
    renderMagnifier(centerIndex);
    el.classList.remove('hidden');return true;
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
    if(!game||game.finished||game.pausedAt!=null||game.wrongPath?.length)return false;
    if(shortStarter(game)){
      if(game.starterPointer||event.isPrimary===false||(event.button!=null&&event.button!==0))return false;
      if(game.used.has(index)){reportInput('invalid');resetStarter(null);feedback('Začni znovu prvním písmenem hledaného slova.');return false;}
      const answer=activeAnswer(game),previous=[...game.path];
      const next=index===answer?.path[0]?[index]:[...previous,index];
      const valid=!!answer&&next.every((cell,i)=>cell===answer.path[i])&&(!previous.length||index===answer.path[0]||neighbours(previous.at(-1)).includes(index));
      game.starterPointer={id:event.pointerId,index,x:event.clientX,y:event.clientY,drag:false,valid};
      game.path=valid?next:[index];
    }else{if(game.used.has(index))return false;game.path=[index];}
    clearHints();
    if(game.undoSnapshot)hideUndo();
    game.dragging=true;game.lastPointer={x:event.clientX,y:event.clientY};fx('tap');updateActive();showMagnifier(index);
    try{event.currentTarget.setPointerCapture(event.pointerId)}catch{}
    return true;
  }
  function pointerEnter(event){
    const game=getGame(),index=+event.currentTarget.dataset.index;
    if(!game?.dragging)return false;
    if(game.starterPointer){if(event.pointerId!=null&&event.pointerId!==game.starterPointer.id)return false;if(index!==game.starterPointer.index)beginDrag(game);}
    return extendPath(index);
  }
  function pointerMove(event){
    const game=getGame();if(!game?.dragging)return false;
    const pointer=game.starterPointer;
    if(pointer){
      if(event.pointerId!=null&&event.pointerId!==pointer.id)return false;
      if(!pointer.drag&&Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y)<8)return true;
      beginDrag(game);
    }
    const events=typeof event.getCoalescedEvents==='function'?event.getCoalescedEvents():[event];
    for(const item of events)samplePointer(item.clientX,item.clientY);
    return true;
  }
  function pointerUp(event){
    hideMagnifier();const game=getGame();if(!game?.dragging)return false;
    const pointer=game.starterPointer;
    if(pointer&&event?.pointerId!=null&&event.pointerId!==pointer.id)return false;
    game.dragging=false;game.lastPointer=null;game.starterPointer=null;
    if(shortStarter(game)&&pointer&&!pointer.drag){
      if(!pointer.valid){reportInput('invalid');resetStarter(null);feedback('Začni znovu prvním písmenem hledaného slova.');return true;}
      const answer=activeAnswer(game);
      if(!answer||game.path.length!==answer.path.length)return true;
    }
    submit();return true;
  }
  function pointerCancel(event){const game=getGame();if(!shortStarter(game)){hideMagnifier();return false;}if(game.starterPointer&&event?.pointerId!=null&&event.pointerId!==game.starterPointer.id)return false;return resetStarter();}

  return {magnifierDeviceSupported,magnifierAvailable,magnifierEnabled,ensureMagnifier,renderMagnifier,showMagnifier,hideMagnifier,currentWord,extendPath,samplePointer,pointerDown,pointerEnter,pointerMove,pointerUp,pointerCancel,resetStarter};
}

const api={create};
if(global)global.PropletGameInput=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
