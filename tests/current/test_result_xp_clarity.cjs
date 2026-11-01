const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/app.js','utf8');
let shown;
const ctx={window:{},COLORS:['red'],setWinXpDisplay:(...args)=>shown=args,getProfile:()=>({token:'test'}),countCz:n=>String(n),rankingExpandMarkup:()=>'',bindRankingExpansion(){}};
vm.createContext(ctx);
for(const [start,end] of [['function renderRunWinXp(', '\n'],['function dailyResultSnapshot(', '\nasync function showSpecialResult'],['function renderDailyGlobalLeaderboardBox(', '\nasync function loadWinDailyGlobalLeaderboard']]){
 const pos=source.indexOf(start);vm.runInContext(source.slice(pos,source.indexOf(end,pos)),ctx);
}
const record={points:200,wordDiscoveryXpAwarded:8,timingVerified:false};
const game=ctx.dailyResultSnapshot({answers:[]},'2026-11-01',record,'daily_special');
ctx.renderRunWinXp(game);assert.equal(shown[0],'+208 XP');assert.match(shown[1],/200.*8/);
const box={classList:{add(){},remove(){}},resultContext:{record,game}};
ctx.renderDailyGlobalLeaderboardBox(box,{total:1,challengeKind:'special'});
assert.match(box.innerHTML,/výpadku spojení/);assert.match(box.innerHTML,/není v časovém pořadí/);assert.doesNotMatch(box.innerHTML,/zatím není/);
ctx.renderRunWinXp(ctx.dailyResultSnapshot({answers:[]},'2026-11-01',{points:0},'daily_special'));assert.equal(shown[0],'+0 XP');
console.log('result XP and unverified ranking passed');
