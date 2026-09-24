const fs=require('fs'),assert=require('assert');
const source=fs.readFileSync('public/settings-ia-v40122.js','utf8');
const card=source.slice(source.indexOf('  function ensurePrivacyCard(){'),source.indexOf('  function syncGuestState(){'));
assert(!card.includes('settings-privacy-icon'),'privacy card no longer creates or updates decorative icon');
const index=fs.readFileSync('public/index.html','utf8');
assert(!index.includes('/welcome-feedback.js'),'retired welcome card is not loaded');
const {create}=require('../../public/app/rankings/rankings.js');
let profile={token:'test',name:'Nickname',publicRankings:null},eligible=false,opened=0;
const modal={classList:{remove:()=>opened++}};
const controller=create({getProfile:()=>profile,canShowRankingPrivacyNotice:()=>eligible,$:s=>s==='#rankingPrivacyModal'?modal:{},$$:()=>[]});
controller.maybeShowRankingPrivacyNotice();assert.equal(opened,0,'no prompt before completed level');
eligible=true;profile={};controller.maybeShowRankingPrivacyNotice();assert.equal(opened,0,'guests are not asked');
profile={token:'test',publicRankings:false};controller.maybeShowRankingPrivacyNotice();assert.equal(opened,0,'existing anonymous choice respected');
profile.publicRankings=true;controller.maybeShowRankingPrivacyNotice();assert.equal(opened,0,'existing public choice respected');
profile.publicRankings=null;controller.maybeShowRankingPrivacyNotice();assert.equal(opened,1,'eligible player is asked');
controller.maybeShowRankingPrivacyNotice();assert.equal(opened,1,'automatic prompt not repeated during session');
controller.openRankingPrivacyModal();assert.equal(opened,2,'manual settings remain available');
console.log('PASS: privacy timing, saved choices, manual settings and retired decorations.');

const vm=require('vm'),app=fs.readFileSync('public/app.js','utf8');
const eligibility=app.match(/canShowRankingPrivacyNotice:\(\)=>\{([^\n]+)\},/)[1];
let stats={totalCompleted:0,tajenkaCompleted:0},blocked=false;
const ctx={window:{},effectiveStats:()=>stats,currentScreen:'daily',document:{querySelector:()=>blocked}};
vm.createContext(ctx);
const allowed=()=>vm.runInContext('(()=>{'+eligibility+'})()',ctx);
assert.equal(allowed(),false);
stats.totalCompleted=1;assert.equal(allowed(),true);
ctx.currentScreen='game';assert.equal(allowed(),false);
ctx.currentScreen='daily';blocked=true;assert.equal(allowed(),false);
blocked=false;stats={tajenkaCompleted:1};assert.equal(allowed(),true);
console.log('PASS: real eligibility requires completed play and an unobstructed menu.');

ctx.window.PropletFirstSteps={quiet:()=>true};assert.equal(allowed(),false,'new-player session defers automatic privacy prompt');

