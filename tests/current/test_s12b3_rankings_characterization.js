#!/usr/bin/env node
'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const root=path.resolve(__dirname,'../..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const app=read('public/app.js');
const polish=read('public/ranking-polish.js');
const bonus=read('public/account-bonus-v3331.js');
const modulePath=path.join(root,'public/app/rankings/rankings.js');

function extractFunction(source,name){
  const start=source.indexOf(`function ${name}(`);
  assert(start>=0,`missing function ${name}`);
  const open=source.indexOf('{',start);
  let depth=0,quote=null,escaped=false,lineComment=false,blockComment=false;
  for(let index=open;index<source.length;index++){
    const ch=source[index],next=source[index+1];
    if(lineComment){if(ch==='\n')lineComment=false;continue}
    if(blockComment){if(ch==='*'&&next==='/'){blockComment=false;index++}continue}
    if(quote){if(escaped){escaped=false;continue}if(ch==='\\'){escaped=true;continue}if(ch===quote)quote=null;continue}
    if(ch==='/'&&next==='/'){lineComment=true;index++;continue}
    if(ch==='/'&&next==='*'){blockComment=true;index++;continue}
    if(ch==='\''||ch==='"'||ch==='`'){quote=ch;continue}
    if(ch==='{')depth++;
    if(ch==='}'&&--depth===0)return source.slice(start,index+1);
  }
  throw new Error(`unterminated function ${name}`);
}

function legacyRenderer(){
  const nodes=new Map([
    ['#xpLeaderboardList',{innerHTML:''}],
    ['#dailyLeaderboardList',{innerHTML:''}],
  ]);
  const sandbox={
    console,
    $:selector=>nodes.get(selector)||null,
    esc:value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])),
    countCz:(count,one,few,many)=>`${count} ${count===1?one:(count>=2&&count<=4?few:many)}`,
    levelFor:points=>({current:{icon:points>=1000?'🧠':'🔰',name:points>=1000?'Myslitel':'Nováček'}}),
    fmtTime:ms=>`${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}`,
  };
  sandbox.globalThis=sandbox;
  vm.createContext(sandbox);
  const functions=['rankingRows','rankingRankBadge','renderXpRanking','renderDailyRanking']
    .map(name=>extractFunction(app,name)).join('\n');
  vm.runInContext(`
    let rankingXpScope='players';
    let rankingXpPeriod='today';
    let rankingDailyScope='players';
    ${functions}
    this.__rankings={
      xp:(data,scope='players',period='today')=>{rankingXpScope=scope;rankingXpPeriod=period;renderXpRanking(data);return $('#xpLeaderboardList').innerHTML},
      daily:(data,scope='players')=>{rankingDailyScope=scope;renderDailyRanking(data);return $('#dailyLeaderboardList').innerHTML},
      rows:rankingRows,
      badge:rankingRankBadge,
    };
  `,sandbox);
  return sandbox.__rankings;
}

const rankings=legacyRenderer();
const payload={
  players:[{
    rank:1,name:'Pavel <hráč>',avatar:'🦊',isMine:true,xp:1234,lifetimePoints:1500,
    badgeCount:2,teamName:'Propletači',cleanSolve:true,hintsUsed:0,moves:7,elapsedMs:83000,
  }],
  teams:[{
    rank:2,name:'Tým & spol.',isMine:true,xp:4321,memberCount:4,players:3,score:98.5,
  }],
};

assert.deepStrictEqual(Array.from(rankings.rows(payload,'players')),payload.players,'player scope no longer selects players');
assert.deepStrictEqual(Array.from(rankings.rows(payload,'teams')),payload.teams,'team scope no longer selects teams');
assert.strictEqual(rankings.badge(1),'🥇');
assert.strictEqual(rankings.badge(2),'🥈');
assert.strictEqual(rankings.badge(3),'🥉');
assert.strictEqual(rankings.badge(4),'4.');

for(const [period,label] of [['today','dnes'],['week','tento týden'],['all','celkem']]){
  const html=rankings.xp(payload,'players',period);
  assert(html.includes('🥇'),'XP player medal drifted');
  assert(html.includes('Pavel &lt;hráč&gt;'),'XP player name is no longer escaped');
  assert(html.includes('ranking-you">Ty'),'current-player marker drifted');
  assert(html.includes('🧠 Myslitel'),'XP rank chip drifted');
  assert(html.includes('🏅 2'),'badge count drifted');
  assert(html.includes('👥 Propletači'),'player team label drifted');
  assert(html.includes('1 234 XP')||html.includes('1 234 XP')||html.includes('1234 XP'),'XP value drifted');
  assert(html.includes(`<small>${label}</small>`),`XP period label drifted for ${period}`);
}

const xpTeam=rankings.xp(payload,'teams','week');
assert(xpTeam.includes('🥈'),'XP team rank drifted');
assert(xpTeam.includes('👥 Tým &amp; spol.'),'XP team name is no longer escaped');
assert(xpTeam.includes('4 členové'),'XP team member count drifted');
assert(xpTeam.includes('<small>tento týden</small>'),'XP team period drifted');

const dailyPlayer=rankings.daily(payload,'players');
assert(dailyPlayer.includes('✨ Čistě · 7 tahů'),'Daily player quality/moves drifted');
assert(dailyPlayer.includes('1:23'),'Daily player time drifted');
assert(dailyPlayer.includes('<small>dnešní výzva</small>'),'Daily player score label drifted');
const hintedDaily={players:[{...payload.players[0],cleanSolve:false,hintsUsed:2,moves:1}],teams:[]};
assert(rankings.daily(hintedDaily,'players').includes('💡 2× · 1 tah'),'Daily hint quality drifted');
const noHintDaily={players:[{...payload.players[0],cleanSolve:false,hintsUsed:0,moves:3}],teams:[]};
assert(rankings.daily(noHintDaily,'players').includes('Bez nápovědy · 3 tahy'),'Daily no-hint quality drifted');

const dailyTeam=rankings.daily(payload,'teams');
assert(dailyTeam.includes('3 výkony v dnešním skóre · 4 členové'),'Daily team contribution copy drifted');
assert(dailyTeam.includes('98,5')||dailyTeam.includes('98.5'),'Daily team score drifted');
assert(dailyTeam.includes('<small>/ 100</small>'),'Daily team score scale drifted');

assert(rankings.xp({players:[],teams:[]},'players','today').includes('Hráči zatím nemají XP v tomto období.'),'empty XP player state drifted');
assert(rankings.xp({players:[],teams:[]},'teams','today').includes('Týmy zatím nemají XP v tomto období.'),'empty XP team state drifted');
assert(rankings.daily({players:[],teams:[]},'players').includes('Dnešní startovní rošt je zatím prázdný.'),'empty Daily state drifted');

// Both ranking reads are deliberately concurrent. Daily is always today's Prague date;
// XP period is the selected today/week/all state, independent of player/team scope.
assert(app.includes('const [xpResult,dailyResult]=await Promise.allSettled(['),'ranking reads are no longer concurrent');
assert(app.includes('api(`/api/rankings/xp?period=${rankingXpPeriod}`)'),'XP period API contract drifted');
assert(app.includes('api(`/api/rankings/daily?daily_date=${pragueDateISO()}`)'),'Daily date API contract drifted');
assert(app.includes("$('#dailyTeamMethod')?.classList.toggle('hidden',rankingDailyScope!=='teams')"),'Daily team-method visibility drifted');

const selectorOwners=[
  ['.ranking-scope-tab','rankingXpScope=b.dataset.rankingXpScope'],
  ['.ranking-period-tab','rankingXpPeriod=b.dataset.rankingPeriod'],
  ['.ranking-daily-tab','rankingDailyScope=b.dataset.rankingDailyScope'],
];
for(const [selector,mutation] of selectorOwners){
  assert.strictEqual((app.match(new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'))||[]).length>=2,true,`${selector} controls missing`);
  assert.strictEqual((app.match(new RegExp(mutation.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'))||[]).length,1,`${selector} has more than one state owner`);
}
assert(!polish.includes("querySelectorAll('.ranking-scope-tab')"),'ranking polish owns ranking tab lifecycle');
assert(!polish.includes("querySelectorAll('.ranking-period-tab')"),'ranking polish owns period tab lifecycle');
assert(!polish.includes("querySelectorAll('.ranking-daily-tab')"),'ranking polish owns Daily tab lifecycle');
assert(!/MutationObserver/.test(`${app.slice(app.indexOf('async function renderLeaderboard'),app.indexOf('async function renderGlobalLeague'))}\n${polish}`),'rankings introduced an observer lifecycle');

// Inventory guards: today the all-time slice and account reward are stacked monkey patches.
// The extracted owner must absorb the visual slice and keep one stable adapter for the reward layer.
assert(polish.includes('renderXpRanking=function(data)'),'all-time top-10 behavior is no longer applied');
assert(polish.includes("if(rankingXpPeriod!=='all')return baseRenderXpRanking(data)"),'all-time patch now affects today/week');
assert(polish.includes('const sliced=totalXpSlice(rows)'),'all-time top-10/self slice drifted');
assert(bonus.includes('const originalRenderXpRanking=renderXpRanking'),'account reward compatibility layer disappeared');

if(fs.existsSync(modulePath)){
  const source=read('public/app/rankings/rankings.js');
  const owner=require(modulePath);
  assert.strictEqual(typeof owner.create,'function','rankings owner must export create(deps)');
  assert(/function renderLeaderboard\([^)]*\)\{return rankingsOrchestration\(\)\.renderLeaderboard/.test(app),'app renderLeaderboard is not a thin owner adapter');
  assert(!polish.includes('renderXpRanking=function'),'ranking polish still monkey-patches the extracted renderer');
  assert(!source.includes('setTimeout(boot,100)'),'rankings owner introduced a retry loop');

  const listeners=[];
  const buttons={
    '.ranking-scope-tab':[{dataset:{rankingXpScope:'players'}},{dataset:{rankingXpScope:'teams'}}],
    '.ranking-period-tab':[{dataset:{rankingPeriod:'today'}},{dataset:{rankingPeriod:'week'}},{dataset:{rankingPeriod:'all'}}],
    '.ranking-daily-tab':[{dataset:{rankingDailyScope:'players'}},{dataset:{rankingDailyScope:'teams'}}],
  };
  Object.values(buttons).flat().forEach((button,index)=>{
    button.classList={toggle(){}};
    button.addEventListener=type=>listeners.push(`${index}:${type}`);
  });
  const controller=owner.create({
    $$:selector=>buttons[selector]||[],
    $:()=>null,
    api:async()=>({players:[],teams:[]}),
    pragueDateISO:()=> '2026-09-01',
  });
  assert.strictEqual(controller.install(),true);
  assert.strictEqual(controller.install(),false,'duplicate rankings install was not rejected');
  assert.strictEqual(new Set(listeners).size,listeners.length,'duplicate rankings install added listeners');
}

console.log('PASS: Sprint 12B.3 Daily/XP player, team, period and lifecycle behavior is characterized');
