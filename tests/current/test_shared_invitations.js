const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../public/competitive-sharing-v3331.js'),'utf8');
function setup(url='https://hrajproplet.cz/',onboarded=true){
  const nodes=new Map(),store=new Map(),sent=[],events=[],hooks=[],timers=[];
  function node(id){if(nodes.has(id))return nodes.get(id);const classes=new Set();const n={id,textContent:'',innerHTML:'',className:'',classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)},appendChild(c){nodes.set('#'+c.id,c)},parentNode:{insertBefore(c){nodes.set('#'+c.id,c)}},remove(){nodes.delete(id)}};nodes.set(id,n);return n}
  ['#winShareBtn','#levelDetailShareBtn','#shareDailyBtn','#playDailyBtn','#gameModeLabel','.game-title','#levelLeaderboardBox','#winPrimaryBtn','#winMenuBtn'].forEach(node);
  const daily={id:'daily-1',difficulty:'easy',answers:[]},free={id:'free-12',difficulty:'easy',meta:{level:12}},tajenka={id:'tajenka-1',difficulty:'easy',week:1,tajenka:{phrase:'SECRET ANSWER'}};
  const c={URL,URLSearchParams,console,window:null,location:new URL(url),history:{state:null,replaceState(a,b,u){c.location=new URL(u,c.location)}},
    document:{body:{classList:node('body').classList},querySelector:s=>nodes.get(s)||null,createElement:()=>node('temporary-'+nodes.size)},
    navigator:{share:async value=>sent.push(value),clipboard:{writeText:async value=>sent.push(value)}},
    localStorage:{getItem:()=>onboarded?'1':null},sessionStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
    setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout(){},
    api:async(url,options)=>{if(options){events.push(JSON.parse(options.body).event_type);return {ok:true}}const q=new URL(url,'https://hrajproplet.cz').searchParams;if(q.get('puzzle_id')==='missing')throw Error('404');return {puzzle:q.get('kind')==='daily'?daily:tajenka}},
    registerGameCompletionHook:hook=>{hooks.push(hook);return true},registerGameSessionHook:()=>true,
    puzzleDB:{},DIFF:{easy:{label:'Snadná'}},SHARE_URL:'https://hrajproplet.cz/',currentGame:null,levelDetailContext:null,winDailyGlobalData:null,
    startGame(puzzle,mode,dailyDate){c.currentGame={puzzle,mode,dailyDate,finished:false};},finishGame(){c.currentGame.finished=true},
    performPostWinAction(){},startStarter(){c.starterStarted=true},startDaily(){c.startGame(daily,'daily','2026-09-12')},shareDaily(){throw Error('Legacy share fallback')},
    pragueDateISO:()=> '2026-09-12',dailyResultState:()=>({puzzle:daily,active:{elapsedMs:65000,moves:9,hintsUsed:2}}),
    fmtTime:ms=>`${String(Math.floor(ms/60000)).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}`,
    formatDateCZ:s=>s,countCz:(n,a,b,d)=>`${n} ${n===1?a:n>=2&&n<=4?b:d}`,showToast:t=>{c.toast=t},
    sortedFreeBank:()=>[free],archivedFreePuzzle:async()=>null,getState:()=>({completed:{}}),localLevelResult:()=>({elapsedMs:65000,moves:9,hintsUsed:2}),startFree(){},nav:s=>{c.screen=s},ONBOARD_KEY:'onboarded',$:node};
  c.window=c;vm.createContext(c);vm.runInContext(source,c);
  return {c,nodes,sent,events,hooks,daily,free,tajenka,timers};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
  const a=setup();
  a.c.currentGame={mode:'daily',dailyDate:'2026-09-01',puzzle:{id:'old'},finished:true,elapsedMs:99000,moves:3,hints:0};
  await a.nodes.get('#shareDailyBtn').onclick();
  assert.equal(new URL(a.sent[0].url).searchParams.get('date'),'2026-09-12');
  assert.equal(new URL(a.sent[0].url).searchParams.get('play'),'daily-1');
  assert.match(a.sent[0].text,/2 nápovědy/);assert.doesNotMatch(a.sent[0].text,/tah|🔥|🌍/);
  a.c.currentGame={mode:'daily',dailyDate:'2026-09-10',puzzle:a.daily,finished:true,elapsedMs:65000,moves:9};
  await a.nodes.get('#winShareBtn').onclick();
  assert.equal(new URL(a.sent[1].url).searchParams.get('date'),'2026-09-10');
  assert.equal(new URL(a.sent[1].url).searchParams.get('h'),'2');
  a.c.currentGame={mode:'free',puzzle:a.free,finished:true,elapsedMs:65000,moves:9,hints:2};
  await a.nodes.get('#winShareBtn').onclick();const freeShare=a.sent.at(-1);
  a.c.levelDetailContext={puzzleId:a.free.id};await a.nodes.get('#levelDetailShareBtn').onclick();
  assert.deepEqual(a.sent.at(-1),freeShare);
  await a.c.PropletSharing.shareTajenka(a.tajenka,{elapsedMs:65000,hints:0});
  const tajenkaShare=a.sent.at(-1);assert.doesNotMatch(JSON.stringify(tajenkaShare),/SECRET ANSWER/);
  assert.match(tajenkaShare.text,/Odhalíš ji taky\?/);assert.equal(new URL(tajenkaShare.url).searchParams.get('play'),'tajenka-1');
  a.c.navigator.share=undefined;await a.c.PropletSharing.shareTajenka(a.tajenka,{elapsedMs:65000,hints:0});
  assert.equal(a.sent.at(-1),tajenkaShare.text+'\n'+tajenkaShare.url);
  a.c.navigator.share=async()=>{throw {name:'AbortError'}};await a.nodes.get('#shareDailyBtn').onclick();assert(a.events.includes('daily_share_cancelled'));
  const incoming='https://hrajproplet.cz/?play=daily-1&kind=daily&date=2026-09-10&t=65099&h=0&m=9';
  for(const onboarded of [true,false]){
    const b=setup(incoming,onboarded);await tick();if(!onboarded){assert.equal(b.c.currentGame,null);b.c.startStarter()}
    assert.equal(b.c.currentGame.mode,'daily');assert.equal(b.c.currentGame.dailyDate,'2026-09-10');assert.equal(b.c.currentGame.puzzle.id,'daily-1');
    assert.match(b.nodes.get('#gameModeLabel').textContent,/2026-09-10/);assert(!b.c.location.search.includes('play='));
    const game=b.c.currentGame;Object.assign(game,{finished:true,elapsedMs:65999,moves:9,hints:0});
    const event={game,data:{}};for(const hook of b.hooks)hook.before(event);for(const hook of b.hooks)hook.after(event);
    assert.match(b.nodes.get('#sharedChallengeResult').innerHTML,/Plichta/);
  }
  const t=setup(tajenkaShare.url);await tick();assert.equal(t.c.currentGame.mode,'tajenka');assert.equal(t.c.currentGame.puzzle.id,'tajenka-1');
  const invalid=setup(incoming.replace('play=daily-1','play=missing'),false);await tick();assert.equal(invalid.c.currentGame,null);assert.match(invalid.c.toast,/není dostupná/);
  console.log('PASS: invitation text, hint fidelity, spoiler safety, clipboard, cancellation, exact Daily/Tajenka routing, onboarding and visible-time comparison');
})().catch(e=>{console.error(e);process.exitCode=1});
