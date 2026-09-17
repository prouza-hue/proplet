const fs=require('fs'),vm=require('vm'),assert=require('assert');
(async()=>{
const app=fs.readFileSync('public/app.js','utf8'),auth=fs.readFileSync('public/account-auth.js','utf8');
const helper=app.slice(app.indexOf('function showDailyAfterRegistration(){'),app.indexOf('async function saveNewProfile(){'));
let destination='',hidden=[];
const game={saved:true};
const ctx={profileModalFromWin:true,profileModalFromNudge:true,pendingPostWinAction:'continue',accountNudgeStage:2,currentGame:game,$:id=>({classList:{add:()=>hidden.push(id)}}),nav:(screen)=>destination=screen};
vm.createContext(ctx);vm.runInContext(helper,ctx);ctx.showDailyAfterRegistration();
assert.equal(destination,'daily');assert.equal(ctx.pendingPostWinAction,null);assert.equal(ctx.currentGame,game);assert(hidden.includes('#winModal'));
assert(app.includes("if(authAction==='create'){showDailyAfterRegistration();"));
const callback=auth.slice(auth.indexOf('async function handleAuthReturn(){'),auth.indexOf('function init(){'));
let linked=false,fail=false;
Object.assign(ctx,{URLSearchParams,location:{search:'?auth=google'},ensureModals(){},supabaseFragment:()=>({accessToken:'test'}),call:async()=>{if(fail)throw Error('failed');return {profile:{},linked}},acceptProfile(){},cleanAuthUrl(){},toast(){}});
vm.runInContext(callback,ctx);
destination='';await ctx.handleAuthReturn();assert.equal(destination,'daily');
linked=true;destination='';await ctx.handleAuthReturn();assert.equal(destination,'','linking existing account does not navigate');
linked=false;fail=true;await ctx.handleAuthReturn();assert.equal(destination,'','failed authentication does not navigate');
console.log('PASS: registration and Google return lead to Today, linking and failures stay put, game preserved.');
})().catch(e=>{console.error(e);process.exit(1)});
