const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../../public/app.js'),'utf8');
function extract(start,end){const from=source.indexOf(start),to=source.indexOf(end,from);assert.ok(from>=0&&to>from);return source.slice(from,to);}
async function navigation(modalId,owner){
  const handlers={},background={inert:true},body={style:{overflow:'hidden'}};
  let closed=null,hidden=false,pushed=0;
  const close=key=>()=>{closed=key;hidden=true;background.inert=false;body.style.overflow='';};
  const context={window:{addEventListener:(event,fn)=>handlers[event]=fn,PropletContentRelease:{close:close('content')},PropletRefreshRelease:{close:close('refresh')}},
    ROUTE_SCREENS:new Set(['daily','free','game']),history:{state:{proplet:true,screen:'daily'},replaceState(){},pushState(){pushed++;}},
    location:{href:'https://hrajproplet.cz/'},applyScreen(){},currentScreen:'daily',openTransientModal:()=>({id:modalId,classList:{add(){hidden=true}}})};
  vm.createContext(context);vm.runInContext(extract('function initNavigation(){','function transientModals(){')+'\ninitNavigation();',context);
  await handlers.popstate({state:{proplet:true,screen:'free'}});
  assert.equal(closed,owner,modalId+' must use its owner close handler');assert.equal(hidden,true);assert.equal(background.inert,false);assert.equal(body.style.overflow,'');assert.equal(pushed,1);
}
async function resume(){
  const target={id:'g6-refresh-hard-019',difficulty:'hard',meta:{level:319}},other={id:'g6-refresh-hard-001',difficulty:'hard',meta:{level:301}};
  const saved={completed:{},inProgress:{['free:'+target.id]:{puzzleId:target.id,mode:'free',difficulty:'hard',savedAt:200,elapsedMs:12345,found:[{word:'TEST',answerIndex:0}]},'free:missing':{puzzleId:'missing',mode:'free',difficulty:'hard',savedAt:300}}};
  const before=JSON.stringify(saved);let started=null,syncCalls=0;
  const context={getState:()=>saved,allowAccountGameStart:()=>true,freeOrder:()=>({enabled:()=>true,ready:()=>true,sync:async()=>{syncCalls++;}}),getProfile:()=>({token:'fixture'}),navigator:{onLine:true},showToast:message=>{throw new Error(message)},startGame:(puzzle,mode,date)=>{started={puzzle,mode,date}}};
  vm.createContext(context);
  vm.runInContext(extract('function resumableFreePuzzle(diff,list){','async function archivedFreePuzzle(')+extract('async function startFree(diff){','function showStarterDailyNudge(){'),context);
  assert.equal(context.resumableFreePuzzle('hard',[other,target]).id,target.id);
  context.freeProgress=diff=>({resume:context.resumableFreePuzzle(diff,[other,target]),nextUnsolved:other,list:[other,target]});
  await context.startFree('hard');assert.equal(syncCalls,1);assert.equal(started.puzzle.id,target.id);assert.equal(started.puzzle.meta.level,319);assert.equal(started.mode,'free');assert.equal(started.date,null);assert.equal(JSON.stringify(saved),before,'resume selection must preserve saved words and elapsed time');
  // A completed saved board must no longer override the next candidate.
  saved.completed['free:'+target.id]={puzzleId:target.id};assert.equal(context.resumableFreePuzzle('hard',[other,target]),null);
}
(async()=>{await navigation('mk100LaunchPreview','content');await navigation('freeRefreshAnnouncement','refresh');await resume();console.log('PASS: Android Back restores modal ownership; hard 319 resumes ahead of varied next board without altering progress.');})().catch(error=>{console.error(error);process.exitCode=1;});
