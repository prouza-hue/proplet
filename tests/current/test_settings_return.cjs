'use strict';
// Run the shipped Settings navigation functions. The ordinary nav handler is a
// stand-in for the router; no preferences, account data or network are involved.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('public/settings-ia-v40122.js','utf8');
const declarations=source.match(/  let returnContext=[^\r\n]+/)[0]+'\n'+source.match(/  const screenNames=[^\r\n]+/)[0]+'\n';
const navigation=source.slice(source.indexOf('  function openSettings(){'),source.indexOf('\n  const observer='));
const names=new Set(),timers=[],events={},calls=[],scrolls=[],back={textContent:'',focus(){this.focused=true;}},gear={focus(){this.focused=true;}};
const profile={classList:{contains:n=>names.has(n),add:n=>names.add(n),remove:n=>names.delete(n)}};
const context={currentScreen:'daily',profileScreen:()=>profile,settingsOpen:()=>names.has('settings-open'),q:s=>s==='#profileSettingsBack'?back:s==='#settingsHeaderBtn'?gear:null,setText:(el,t)=>{if(el&&el.textContent!==t)el.textContent=t;},ensureUi(){},syncGuestState(){},setTimeout:fn=>timers.push(fn),document:{addEventListener:(name,fn)=>events[name]=fn},window:{scrollY:0,scrollTo:options=>scrolls.push(options)},localStorage:{setItem(){throw Error('Settings navigation must not change preferences');}}};
context.nav=(screen,options)=>{calls.push({screen,options});context.currentScreen=screen;screen==='profile'?names.add('active'):names.delete('active');events['proplet:screen-changed']?.({detail:{screen}});};
vm.createContext(context);vm.runInContext(declarations+navigation,context);
function visit(screen,scroll){context.currentScreen=screen;screen==='profile'?names.add('active'):names.delete('active');context.window.scrollY=scroll;calls.length=0;scrolls.length=0;}
function flush(){while(timers.length)timers.shift()();}
function clickNav(screen){events.click({target:{closest:s=>s==='[data-nav]'?{dataset:{nav:screen}}:null}});context.nav(screen);}
for(const [screen,label] of [['daily','Dnes'],['free','Hrát'],['archive','Archiv'],['leaderboard','Pořadí'],['profile','Já']]){
 visit(screen,137);context.openSettings();flush();assert(names.has('settings-open'));assert.equal(back.textContent,'← '+label);assert(back.focused);
 calls.length=0;context.closeSettings();assert(!names.has('settings-open'));assert.equal(context.currentScreen,screen);assert.equal(scrolls.at(-1).top,137);assert(gear.focused);
 assert.equal(calls.length,screen==='profile'?0:1);if(calls.length)assert.equal(calls[0].options.replace,true,'explicit return must not push another forward route');
}
visit('free',80);context.openSettings();flush();calls.length=0;clickNav('leaderboard');flush();
assert.deepEqual(calls.map(c=>c.screen),['leaderboard'],'bottom nav must keep its chosen target, not navigate back to origin');assert(!names.has('settings-open'));
// An immediate navigation before the deferred Settings mount cancels that mount.
visit('daily',0);context.openSettings();calls.length=0;clickNav('free');flush();assert.equal(context.currentScreen,'free');assert(!names.has('settings-open'));assert.deepEqual(calls.map(c=>c.screen),['free']);
visit('leaderboard',0);context.openSettings();clickNav('profile');flush();assert.equal(context.currentScreen,'profile');assert(!names.has('settings-open'),'the Já tab is not Settings');
// Browser/back/programmatic routes clear the sub-view without redirecting.
visit('archive',70);context.openSettings();flush();calls.length=0;context.nav('daily');assert(!names.has('settings-open'));assert.deepEqual(calls.map(c=>c.screen),['daily']);
// Reopening while open does not replace the original return destination with Já.
visit('free',210);context.openSettings();flush();context.window.scrollY=0;context.openSettings();flush();context.closeSettings();assert.equal(context.currentScreen,'free');assert.equal(scrolls.at(-1).top,210);
console.log('PASS Settings origin/scroll return, preserved tab navigation, pending-open cancellation and external navigation');
