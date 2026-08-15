#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const app=fs.readFileSync(path.join(__dirname,'..','public','app.js'),'utf8');
function source(name){const start=app.indexOf(`function ${name}(`);if(start<0)throw new Error(name);const next=app.indexOf('\nfunction ',start+10);return app.slice(start,next<0?app.length:next)}
const store=new Map();
const ctx={ACCOUNT_NUDGE_KEY:'nudge',ACCOUNT_NUDGE_THRESHOLDS:[1,4,10],localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},state:{completed:{}},getProfile:()=>null,currentGame:{mode:'free',justCompleted:true}}; ctx.getState=()=>ctx.state;
vm.createContext(ctx);
for(const name of ['accountNudgeState','saveAccountNudgeState','completedGameCount','dueAccountNudgeStage','shouldOfferAccountNudge'])vm.runInContext(source(name),ctx);
function setCount(n){ctx.state={completed:Object.fromEntries(Array.from({length:n},(_,i)=>['k'+i,{mode:i%2?'daily':'free'}]))}}
function eq(a,b,msg){if(a!==b)throw new Error(`${msg}: ${a} != ${b}`)}
setCount(0);eq(vm.runInContext('dueAccountNudgeStage()',ctx),0,'nothing before first completion');
setCount(1);eq(vm.runInContext('dueAccountNudgeStage()',ctx),1,'first nudge');
store.set('nudge',JSON.stringify({shown:[1]}));setCount(3);eq(vm.runInContext('dueAccountNudgeStage()',ctx),0,'no second nudge before four');
setCount(4);eq(vm.runInContext('dueAccountNudgeStage()',ctx),2,'second nudge at four');
store.set('nudge',JSON.stringify({shown:[1,2]}));setCount(9);eq(vm.runInContext('dueAccountNudgeStage()',ctx),0,'no third before ten');
setCount(10);eq(vm.runInContext('dueAccountNudgeStage()',ctx),3,'third nudge at ten');
store.set('nudge',JSON.stringify({shownAt:'2026-01-01'}));setCount(4);eq(vm.runInContext('dueAccountNudgeStage()',ctx),2,'legacy one-shot counts as first nudge');
console.log('PASS: account nudges are due at completions 1, 4 and 10 with legacy migration.');
