const fs=require('fs');
const vm=require('vm');
const path=require('path');

const events=[];
const storage=new Map();
const buttons={
  '#playDailyBtn':{},
  '#shareDailyBtn':{},
  '#winShareBtn':{},
  '#levelDetailShareBtn':{},
};
const classList={add(){},remove(){}};
const context={
  URL,URLSearchParams,Date,JSON,Math,Number,String,Object,Array,Promise,
  console,
  window:null,
  location:new URL('https://hrajproplet.cz/?open=daily&via=share-daily'),
  history:{state:null,replaceState(_state,_title,url){context.location=new URL(url,'https://hrajproplet.cz/')}},
  sessionStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
  navigator:{share:async()=>{}},
  document:{
    body:{classList},
    querySelector:selector=>buttons[selector]||null,
  },
  setTimeout:fn=>{fn();return 1},
  clearTimeout(){},
  api:async(_path,options)=>{events.push(JSON.parse(options.body).event_type);return {ok:true}},
  puzzleDB:{},
  DIFF:{easy:{label:'Snadná'}},
  SHARE_URL:'https://hrajproplet.cz/',
  currentGame:null,
  levelDetailContext:null,
  winDailyGlobalData:null,
  startGame(puzzle,mode,dailyDate){context.currentGame={puzzle,mode,dailyDate,finished:false}},
  async finishGame(){context.currentGame.finished=true},
  performPostWinAction(){},
  startStarter(){},
  startDaily(){context.startGame({id:'g4-d-test',difficulty:'easy',answers:[]},'daily','2026-08-25')},
  shareDaily(){},
  pragueDateISO:()=> '2026-08-25',
  dailyResultState:()=>({puzzle:{id:'g4-d-test',difficulty:'easy',answers:[]},active:{elapsedMs:65000,moves:9,hintsUsed:0}}),
  effectiveStats:()=>({currentStreak:3}),
  fmtTime:()=> '01:05',
  formatDateCZ:()=> '25. srpna',
  countCz:(n)=>String(n),
  showToast(){},
  sortedFreeBank:()=>[],
  archivedFreePuzzle:async()=>null,
  getState:()=>({completed:{}}),
  localLevelResult:()=>null,
  startFree(){},
  nav(){},
  ONBOARD_KEY:'onboarded',
  $:selector=>buttons[selector]||{classList,textContent:'',dataset:{}},
};
context.window=context;
vm.createContext(context);
const source=fs.readFileSync(path.join(__dirname,'..','public','competitive-sharing-v3331.js'),'utf8');
vm.runInContext(source,context);

if(!events.includes('shared_daily_opened'))throw new Error('shared Daily open was not tracked');
buttons['#playDailyBtn'].onclick();
if(!events.includes('shared_daily_started'))throw new Error('shared Daily start was not tracked');
context.finishGame().then(async()=>{
  if(!events.includes('shared_daily_completed'))throw new Error('shared Daily completion was not tracked');
  context.currentGame={puzzle:{id:'g4-d-test',difficulty:'easy',answers:[]},mode:'daily',dailyDate:'2026-08-25',elapsedMs:65000,moves:9,hints:0,finished:true};
  await buttons['#shareDailyBtn'].onclick();
  for(const event of ['daily_share_clicked','daily_share_native_completed','daily_share_created'])if(!events.includes(event))throw new Error(`${event} was not tracked`);
  console.log('PASS: shared Daily outbound and inbound runtime funnel is complete.');
}).catch(error=>{console.error(error);process.exitCode=1});
