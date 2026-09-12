'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/app/engagement/onboarding.js','utf8');
const model=source.slice(source.indexOf('  function completeTutorial()'),source.indexOf('  function installReturningPlayer()'));
function setup(seen=false){
 const store=new Map(seen?[['onboard','done']]:[]),games=[],events=[];
 const ctx={window:{},document:{querySelector:()=>({classList:{add:()=>{}}})},ONBOARD_KEY:'onboard',HELPER_ONBOARD_KEY:'helper',localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},
  puzzleDB:{starter:{id:'training'}},currentScreen:'daily',currentGame:null,localSupportMode:()=>null,validSupportMode:()=>false,getProfile:()=>null,rememberSupportMode:()=>{},startGame:(...args)=>games.push(args),trackProductEvent:e=>events.push(e)};
 vm.createContext(ctx);vm.runInContext(model,ctx);ctx.installModel();return {ctx,store,games,events};
}
const fresh=setup();fresh.ctx.openOnboarding();assert.equal(fresh.games.length,1);assert.equal(fresh.games[0][1],'starter');assert.equal(fresh.store.get('onboard'),undefined,'starting is not completing');
fresh.ctx.completeTutorial();assert.equal(fresh.store.get('onboard'),'done');assert(fresh.events.includes('onboarding_completed'));
const known=setup(true);known.ctx.openOnboarding();assert.equal(known.games.length,0);known.ctx.openOnboarding(true);assert.equal(known.games.length,1,'explicit replay still works');
const playing=setup();playing.ctx.currentScreen='game';playing.ctx.currentGame={mode:'daily'};playing.ctx.openOnboarding();assert.equal(playing.games.length,0,'late boot must not replace an active invitation');
const app=fs.readFileSync('public/app.js','utf8');
assert(!app.includes("'Poslední je AUTOBUS."),'last word stays undisclosed');
assert(app.includes('Jiná slova se nepočítají.'));
console.log('PASS direct training, deferred completion, returning-player skip, explicit replay and active-game protection');
