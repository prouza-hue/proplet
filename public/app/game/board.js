(function installPropletGameBoard(global){
'use strict';

function create(deps={}){
  const getGame=deps.getGame||(()=>null);
  const getScreen=deps.getScreen||(()=> 'game');
  const query=deps.query||(()=>null);
  const queryAll=deps.queryAll||(()=>[]);
  const colors=deps.colors||[];
  const documentObj=deps.documentObj||(typeof document!=='undefined'?document:null);
  const getComputedStyleFn=deps.getComputedStyleFn||(typeof getComputedStyle==='function'?getComputedStyle:()=>({}));
  const requestAnimationFrameFn=deps.requestAnimationFrameFn||(fn=>fn());
  const setTimeoutFn=deps.setTimeoutFn||((fn,ms)=>setTimeout(fn,ms));
  const onPointerDown=deps.onPointerDown||(()=>{});
  const onPointerEnter=deps.onPointerEnter||(()=>{});

  function neighbours(index){
    const game=getGame(),p=game?.puzzle;if(!p)return[];
    const row=Math.floor(index/p.cols),col=index%p.cols,mask=new Set(p.mask),out=[];
    [[row-1,col],[row+1,col],[row,col-1],[row,col+1]].forEach(([rr,cc])=>{
      const j=rr*p.cols+cc;
      if(rr>=0&&rr<p.rows&&cc>=0&&cc<p.cols&&mask.has(j))out.push(j);
    });
    return out;
  }

  function drawPaths(){
    const game=getGame();if(!game)return false;
    const board=query('#board'),svg=query('#pathLayer');if(!board||!svg)return false;
    const br=board.getBoundingClientRect();if(!br.width)return false;
    svg.setAttribute('viewBox',`0 0 ${br.width} ${br.height}`);svg.innerHTML='';
    const paths=[...game.found.map(f=>({path:f.path,color:colors[f.colorIndex%colors.length],kind:'found'}))];
    if(game.starterGuidePath?.length>1)paths.push({path:game.starterGuidePath,color:'#8c80ee',kind:'guide'});
    if(game.path.length>1)paths.push({path:game.path,color:'#7d6fe7',kind:'active'});
    if(game.wrongPath?.length>1)paths.push({path:game.wrongPath,color:'#d8665d',kind:'wrong'});
    paths.forEach(({path,color,kind})=>{
      if(path.length<2)return;
      const pts=path.map(i=>{
        const cell=query(`.cell[data-index="${i}"]`),r=cell?.getBoundingClientRect();
        return r?`${r.left-br.left+r.width/2},${r.top-br.top+r.height/2}`:null;
      }).filter(Boolean).join(' ');
      if(!pts)return;
      const line=documentObj.createElementNS('http://www.w3.org/2000/svg','polyline');
      line.style.setProperty('--path-color',color);line.setAttribute('points',pts);line.setAttribute('fill','none');line.setAttribute('stroke',color);
      line.setAttribute('stroke-width',kind==='guide'?'7':'9');line.setAttribute('stroke-linecap','round');
      line.setAttribute('stroke-linejoin','round');line.setAttribute('opacity',kind==='guide'?'.28':kind==='wrong'?'.78':'.52');
      line.classList.add(`path-${kind}`);svg.appendChild(line);
    });
    return true;
  }

  function fit(){
    const game=getGame();if(!game||getScreen()!=='game')return false;
    const stage=query('#boardStage'),wrap=query('#boardWrap'),board=query('#board');if(!stage||!wrap||!board)return false;
    const p=game.puzzle,cs=getComputedStyleFn(board),colGap=parseFloat(cs.columnGap)||0,rowGap=parseFloat(cs.rowGap)||colGap,
      ss=getComputedStyleFn(stage),padX=(parseFloat(ss.paddingLeft)||0)+(parseFloat(ss.paddingRight)||0),
      padY=(parseFloat(ss.paddingTop)||0)+(parseFloat(ss.paddingBottom)||0),aw=Math.max(80,stage.clientWidth-padX),
      ah=Math.max(80,stage.clientHeight-padY),cellByW=Math.max(4,(aw-colGap*(p.cols-1))/p.cols),
      cellByH=Math.max(4,(ah-rowGap*(p.rows-1))/p.rows),cell=Math.max(4,Math.min(cellByW,cellByH)),
      targetW=cell*p.cols+colGap*(p.cols-1),targetH=cell*p.rows+rowGap*(p.rows-1);
    wrap.style.width=`${targetW}px`;wrap.style.height=`${targetH}px`;board.style.setProperty('--cell-size',`${cell}px`);
    requestAnimationFrameFn(drawPaths);return true;
  }

  function render(){
    const game=getGame(),p=game?.puzzle,board=query('#board');if(!game||!p||!board)return false;
    const mask=new Set(p.mask);
    board.style.gridTemplateColumns=`repeat(${p.cols},minmax(0,1fr))`;
    board.style.gridTemplateRows=`repeat(${p.rows},minmax(0,1fr))`;
    board.classList.toggle('dense-board',p.cols>=9);board.classList.toggle('ultra-board',p.cols>=10);board.innerHTML='';
    for(let i=0;i<p.rows*p.cols;i++){
      if(!mask.has(i)){const empty=documentObj.createElement('div');empty.className='void-cell';board.appendChild(empty);continue}
      const cell=documentObj.createElement('div');cell.className='cell';cell.dataset.index=i;cell.textContent=p.letters[i];
      const color=game.used.get(i);if(color!=null){cell.classList.add('used');cell.style.setProperty('--word-color',colors[color%colors.length])}
      if(game.mode==='tajenka'&&game.finished&&!game.used.has(i))cell.classList.add('tajenka-unused');
      if(game.lastFound?.includes(i)){cell.classList.add('just-found');cell.style.setProperty('--found-delay',`${Math.min(game.lastFound.indexOf(i)*24,72)}ms`)}
      if(game.wrongPath?.includes(i))cell.classList.add('wrong-flash');
      if(game.mode==='starter'&&game.starterGuidePath?.includes(i)&&!game.used.has(i)){
        cell.classList.add('starter-guide');cell.style.setProperty('--guide-order',String(game.starterGuidePath.indexOf(i)));
      }
      cell.addEventListener('pointerdown',onPointerDown);cell.addEventListener('pointerenter',onPointerEnter);board.appendChild(cell);
    }
    requestAnimationFrameFn(()=>{fit();drawPaths()});
    if(game.lastFound?.length)setTimeoutFn(()=>{game.lastFound=[];queryAll('.just-found').forEach(cell=>cell.classList.remove('just-found'))},520);
    return true;
  }

  return {neighbours,drawPaths,fit,render};
}

const api={create};
if(global)global.PropletGameBoard=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
