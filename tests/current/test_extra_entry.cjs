const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/app.js','utf8');
const hidden=new Set(['hidden']),modal=new Set();
const button={textContent:'Hraj Extra',disabled:false,classList:{contains:x=>hidden.has(x),toggle:(x,on)=>on?hidden.add(x):hidden.delete(x)}};
let special,day='2026-10-21',starts=0,release;
const c={currentGame:{finished:true,mode:'daily',dailyDate:day},pragueDateISO:()=>day,dailySpecialResultState:()=>special,
 $:id=>id==='#winExtraBtn'?button:{classList:{add:x=>modal.add(x),remove:x=>modal.delete(x)}},
 startSpecial:async()=>{starts++;await new Promise(r=>release=r);c.currentGame={mode:'daily_special'}}};
vm.createContext(c);vm.runInContext(source.slice(source.indexOf('function winExtraAvailable('),source.indexOf('function updateWinAccountCta(')),c);
const available=()=>({descriptor:{dailyDate:day,rewardEligible:true},puzzle:{id:'special'},active:null});
(async()=>{
 for(const state of [{},available(),{...available(),progress:{found:[1]}},{...available(),active:{}},{...available(),descriptor:{dailyDate:day,rewardEligible:false}}]){
  special=state;c.renderWinExtraAction();assert.equal(hidden.has('hidden'),!(state.puzzle&&!state.active&&state.descriptor.rewardEligible));
 }
 special=available();for(const mode of ['daily_special','free','starter','tajenka','rescue']){c.currentGame.mode=mode;c.renderWinExtraAction();assert(hidden.has('hidden'))}
 c.currentGame={finished:true,mode:'daily',dailyDate:day};day='2026-10-22';c.renderWinExtraAction();assert(hidden.has('hidden'),'midnight invalidates yesterday result CTA');await c.playExtraFromWin();assert.equal(starts,0);
 day='2026-10-21';special=available();c.renderWinExtraAction();assert(!hidden.has('hidden'));
 const work=c.playExtraFromWin();await c.playExtraFromWin();assert.equal(starts,1,'double tap starts only once');assert(button.disabled);release();await work;assert(!button.disabled);assert(hidden.has('hidden'));assert(modal.has('hidden'));
 // Existing browse action remains in the HTML and keeps its original handler.
 assert.match(fs.readFileSync('public/index.html','utf8'),/id="winPrimaryBtn"/);assert(source.includes("$('#winPrimaryBtn').onclick=closeWinAndContinue"));
 console.log('PASS daily-to-Extra eligibility, resume, completed/practice/other modes, midnight and double tap');
})().catch(e=>{console.error(e);process.exitCode=1});
