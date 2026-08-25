#!/usr/bin/env node
'use strict';

const fs=require('fs');
const vm=require('vm');
const path=require('path');
const app=fs.readFileSync(path.join(__dirname,'..','public','app.js'),'utf8');

function functionSource(name){
  const start=app.indexOf(`function ${name}(`);if(start<0)throw new Error(`Missing ${name}`);
  const brace=app.indexOf('{',start);let depth=0;
  for(let i=brace;i<app.length;i++){if(app[i]==='{')depth++;if(app[i]==='}'&&--depth===0)return app.slice(start,i+1)}
  throw new Error(`Unclosed ${name}`);
}

let requests=0;
const locks=[];
const context={
  navigator:{wakeLock:{request:async type=>{if(type!=='screen')throw new Error('wrong lock type');requests++;const listeners={};const lock={released:false,addEventListener:(name,fn)=>{listeners[name]=fn},release:async()=>{lock.released=true;listeners.release?.()}};locks.push(lock);return lock}}},
  document:{visibilityState:'visible'},
  currentScreen:'game',
  currentGame:{finished:false},
  wakeEnabled:true,
  getSettings(){return {wakeLock:context.wakeEnabled}},
};
vm.createContext(context);
const asyncSource=name=>functionSource(name).replace(/^function /,'async function ');
vm.runInContext(`var gameWakeLock=null;${asyncSource('acquireGameWakeLock')}\n${asyncSource('releaseGameWakeLock')}\n${functionSource('syncGameWakeLock')}`,context);

(async()=>{
  if(!await vm.runInContext('acquireGameWakeLock()',context))throw new Error('active game did not acquire wake lock');
  await vm.runInContext('acquireGameWakeLock()',context);
  if(requests!==1)throw new Error('wake lock requested twice');
  await vm.runInContext('releaseGameWakeLock()',context);
  if(!locks[0].released)throw new Error('wake lock not released');
  context.wakeEnabled=false;
  if(await vm.runInContext('acquireGameWakeLock()',context))throw new Error('disabled preference acquired wake lock');
  context.wakeEnabled=true;context.document.visibilityState='hidden';
  if(await vm.runInContext('acquireGameWakeLock()',context))throw new Error('hidden document acquired wake lock');
  console.log('PASS: wake lock follows active gameplay, visibility and player preference.');
})().catch(error=>{console.error(error);process.exit(1)});
