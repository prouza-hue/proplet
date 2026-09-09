(function installBoardQaRuntime(){
'use strict';
const params=new URLSearchParams(location.search),state=params.get('boardQaState');
if(!state)return;
const difficulty=params.get('boardQaDifficulty')==='hardcore'?'hardcore':'easy';

function waitForGame(attempt=0){
 if(typeof puzzleDB==='undefined'||!Array.isArray(puzzleDB?.free?.[difficulty])||typeof startGame!=='function'){
  if(attempt<120)setTimeout(()=>waitForGame(attempt+1),50);else document.documentElement.dataset.boardQaReady='error';
  return;
 }
 const bank=puzzleDB.free[difficulty],id=difficulty==='easy'?'g4-e-001':'g4-x-001';
 const puzzle=bank.find(row=>row.id===id)||bank.find(row=>Number(row.meta?.level)===1)||bank[0];
 startGame(puzzle,'free',null);stopTimer();currentGame.pausedAt=performance.now();
 currentGame.path=[];currentGame.wrongPath=[];currentGame.found=[];currentGame.used=new Map();currentGame.lastFound=[];currentGame.finished=false;
 const addAnswer=(answerIndex,fresh=false)=>{const answer=puzzle.answers[answerIndex],colorIndex=currentGame.found.length%COLORS.length;currentGame.found.push({answerIndex,word:answer.word,colorIndex,path:[...answer.path]});answer.path.forEach(index=>currentGame.used.set(index,colorIndex));if(fresh)currentGame.lastFound=[...answer.path]};
 const wrongPath=()=>{const answers=new Set(puzzle.answers.map(answer=>answer.path.join(','))),mask=new Set(puzzle.mask),neighbours=index=>{const row=Math.floor(index/puzzle.cols),col=index%puzzle.cols;return[[row-1,col],[row+1,col],[row,col-1],[row,col+1]].filter(([r,c])=>r>=0&&r<puzzle.rows&&c>=0&&c<puzzle.cols).map(([r,c])=>r*puzzle.cols+c).filter(indexValue=>mask.has(indexValue))};const visit=path=>{if(path.length===4&&!answers.has(path.join(',')))return path;for(const next of neighbours(path.at(-1)))if(!path.includes(next)){const found=visit([...path,next]);if(found)return found}return null};for(const start of puzzle.mask){const found=visit([start]);if(found)return found}return[]};
 if(state==='active')currentGame.path=[...puzzle.answers[0].path];
 else if(state==='wrong')currentGame.wrongPath=wrongPath();
 else if(state==='correct')addAnswer(0,true);
 else if(state==='completed'){puzzle.answers.forEach((_,index)=>addAnswer(index));currentGame.finished=true}
 else if(state==='progress')puzzle.answers.slice(0,4).forEach((_,index)=>addAnswer(index));
 renderGameBoard();renderGameHUD();updateGameFeel();
 if(state==='active')updateActive();
 else if(state==='hint')applySmartHint(3);
 else if(state==='wrong'){const word=currentGame.wrongPath.map(index=>puzzle.letters[index]).join('');message(`„${word}“ do tohohle Propletu nezapadá.`,'bad')}
 else if(state==='correct')message(`✓ ${puzzle.answers[0].word}`,'good');
 else if(state==='completed')message('Celá plocha zapadla na své místo.','good');
 document.querySelectorAll('.modal:not(.hidden)').forEach(modal=>modal.classList.add('hidden'));
 const timer=document.querySelector('#timer');if(timer)timer.textContent='00:00';
 document.documentElement.classList.add('board-qa-mode');
 requestAnimationFrame(()=>requestAnimationFrame(()=>{fitGameBoard();drawPaths();document.documentElement.dataset.boardQaReady='1'}));
}
window.addEventListener('load',()=>setTimeout(waitForGame,900),{once:true});
})();
