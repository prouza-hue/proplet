const assert=require('node:assert/strict');
const {calculate,markup,bind}=require('../../public/app/account/statistics.js');
const rows={};let n=0;
function add(overrides={}){const id=String(++n);rows[id]={mode:'free',difficulty:'easy',puzzleId:`g4-e-${id}`,elapsedMs:30000,completedAt:'2026-10-11T10:00:00Z',...overrides};return rows[id]}
for(const difficulty of ['easy','medium','hard','hardcore','mozkomor','mozkokalypsa'])add({difficulty});
add({puzzleId:'old-e-1',contentGeneration:1}); // Different historical board, same slot, really played.
add({puzzleId:'g4-e-1'}); // Same board accidentally present twice.
add({mode:'starter'});add({mode:'rescue'});add({mode:'tajenka'});add({difficulty:'unknown'});
add({mode:'daily',dailyDate:'2026-10-10',elapsedMs:8000});
add({mode:'daily',dailyDate:'2026-10-10',elapsedMs:1000,completedAt:'2026-10-01T10:00:00Z'});
for(const invalid of [0,-10,NaN,Infinity,'1000',null])add({difficulty:'hard',elapsedMs:invalid});
add({difficulty:'hard',elapsedMs:1000,timingVerified:false});
add({difficulty:'hard',elapsedMs:1000,timingUnverified:true});
add({difficulty:'hard',elapsedMs:1000,mergedAttempts:true});
add({difficulty:'medium',elapsedMs:2000,timingVerified:true,timingUnverified:true});
add({difficulty:'mozkomor',elapsedMs:5000,calmMode:true,hintsUsed:2});
const result=calculate(rows);
assert.equal(result.free.easy.completed,2,'distinct old boards count; duplicate and non-game rows do not');
assert.equal(result.free.easy.fastestMs,30000,'Daily cannot win a free record');
assert.equal(result.daily.easy.completed,1,'one Daily per date despite replaced puzzles');
assert.equal(result.daily.easy.fastestMs,8000);
assert.equal(result.free.hard.completed,10,'bad times do not erase completion');
assert.equal(result.free.hard.fastestMs,30000,'bad times never become records');
assert.equal(result.free.medium.fastestMs,2000,'server verification supersedes stale local unverified flag');
assert.equal(result.free.mozkomor.fastestMs,5000,'personal records may include calm/hints');
assert.equal(result.free.mozkokalypsa.completed,1);
assert.equal(calculate().free.easy.fastestMs,null,'empty record is absent, never 0:00');
assert.equal(calculate().daily.mozkomor.completed,0);
console.log('PASS profile statistics: six difficulties, archive/replay deduplication, Daily isolation, timing eligibility and empty history');

// The compact summary must not claim loaded counts while account hydration is
// pending. The same public renderer serves guests and authenticated profiles.
const summary=html=>html.slice(html.indexOf('<div class="profile-stat-summary">'),html.indexOf('<details class="profile-stats-details"'));
const pending=markup({data:result,ready:false,dailyChallengeCompleted:27,longestStreak:19});
assert.equal((summary(pending).match(/<strong>—<\/strong>/g)||[]).length,3);
assert(!summary(pending).includes('27')&&!summary(pending).includes('19'),'pending summary cannot expose stale account numbers');
assert(!pending.includes('class="profile-stats-details" open'),'breakdown starts collapsed');
const expanded=markup({data:result,ready:true,mode:'daily',expanded:true,dailyChallengeCompleted:27,longestStreak:19});
assert(summary(expanded).includes('<strong>18</strong>'),'free summary counts actual distinct boards');
assert(summary(expanded).includes('<strong>27</strong>'),'canonical combined Daily count is retained');
assert(summary(expanded).includes('<strong>19</strong>'));
assert(expanded.includes('class="profile-stats-details" open'),'caller can preserve disclosure across repaint');
assert(expanded.includes('data-stat-mode="daily" aria-pressed="true"'));
const guest=markup({data:calculate(),ready:true});
assert.equal((summary(guest).match(/<strong>0<\/strong>/g)||[]).length,3,'empty local history is zero, not a loading state');
assert(guest.includes('Nejrychleji: —')&&!guest.includes('Nejrychleji: 0:00'));

const buttons=['free','daily'].map(mode=>({dataset:{statMode:mode},attrs:{},addEventListener(event,fn){assert.equal(event,'click');this.click=fn;},setAttribute(name,value){this.attrs[name]=value;}}));
const panel={innerHTML:''},details={open:true};let selected=null;
const ledger={querySelectorAll:()=>buttons,querySelector:s=>s==='.profile-ledger-panel'?panel:details};
bind(ledger,{data:result,ready:true},mode=>selected=mode);buttons[1].click();
assert.equal(selected,'daily');assert.equal(buttons[1].attrs['aria-pressed'],'true');assert.equal(buttons[0].attrs['aria-pressed'],'false');
assert(panel.innerHTML.includes('Nejrychleji: 0:08'));assert(details.open,'switching mode must not collapse the selected breakdown');
buttons[0].click();assert.equal(selected,'free');assert(panel.innerHTML.includes('Nejrychleji: 0:30'));
console.log('PASS profile rendering: pending/guest summary, canonical totals, expanded mode and interactive breakdown');
