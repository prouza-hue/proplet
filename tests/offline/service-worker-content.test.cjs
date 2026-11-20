'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../../public/sw.js'),'utf8');
const handlers={},rows=new Map(),deleted=[];
const json=data=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
const caches={
 async open(name){if(!rows.has(name))rows.set(name,new Map());const data=rows.get(name);return {match:async key=>data.get(String(key))?.clone(),put:async(key,value)=>{data.set(String(key),value.clone());}};},
 async keys(){return [...rows.keys()];},async delete(name){deleted.push(name);return rows.delete(name);},
 async match(key,options={}){const candidates=options.cacheName?[rows.get(options.cacheName)].filter(Boolean):rows.values();for(const data of candidates){const found=data.get(typeof key==='string'?key:key.url);if(found)return found.clone();}return undefined;}
};
let reject=false,network=0;
const context={console,URL,Response,caches,fetch:async()=>{network++;if(reject)throw Error('offline');return json({revision:'new'});},self:{location:new URL('https://hrajproplet.cz/sw.js'),addEventListener:(name,fn)=>(handlers[name]??=[]).push(fn),clients:{claim:async()=>{},matchAll:async()=>[]}}};
vm.createContext(context);vm.runInContext(source,context);
const constants=vm.runInContext('({shell:SHELL_CACHE,urls:SHELL,data:DATA_CACHE,index:OFFLINE_INDEX_CACHE,assets:OFFLINE_ASSET_CACHE})',context);
async function fetchEvent(cache,path='/api/rolling-content?week=2026-10-12',mode='cors'){let work;for(const fn of handlers.fetch)fn({request:{method:'GET',mode,url:new URL(path,context.self.location).href,cache},respondWith:value=>{work=value;},waitUntil:()=>{}});return work;}
async function status(){let task,result;for(const fn of handlers.message)fn({data:{type:'GET_OFFLINE_STATUS'},ports:[{postMessage:value=>{result=value;}}],waitUntil:value=>{task=value;}});await task;return result;}
(async()=>{
 const data=await caches.open(constants.data),url='https://hrajproplet.cz/api/rolling-content?week=2026-10-12';
 await data.put(url,json({revision:'old'}));
 assert.equal((await(await fetchEvent('no-store')).json()).revision,'new','fresh manifest must receive fresh same-week data');
 assert.equal(network,1);
 reject=true;
 await assert.rejects(fetchEvent('no-store'),/offline/,'a failed update cannot relabel cached old data as a new revision');
 const dictionary='/valid-words-v3328.txt',assets=await caches.open(constants.assets);
 await assets.put(dictionary,new Response('offline words'));
 const before=network;
 for(const url of [dictionary,dictionary+'?v=recognition6']){
  assert.equal(await (await fetchEvent('force-cache',url)).text(),'offline words','both dictionary URLs work offline');
 }
 assert.equal(network,before,'a cached dictionary serves both URLs without fetching');
 const oldShell=await caches.open('proplet-v-old');
 await oldShell.put('/',new Response('superseded HTML'));
 const shell=await caches.open(constants.shell);
 await shell.put('/offline-assets.json',json({schemaVersion:1,assets:[]}));
 assert.equal((await status()).ready,false,'partial shell is never advertised as offline-ready');
 for(const asset of constants.urls)await shell.put(asset,asset==='/offline-assets.json'?json({schemaVersion:1,assets:[]}):new Response('asset'));
 assert.equal((await status()).ready,true);
 const requestsBeforeLaunch=network;
 assert.equal(await (await fetchEvent('default','/','navigate')).text(),'asset');
 assert.equal(network,requestsBeforeLaunch,'the manifest start URL must render before contacting the network');
 await(await caches.open(constants.index)).put('/__proplet-offline__/active',json({cacheName:'proplet-offline-content-v1-live'}));
 assert.equal(await (await fetchEvent('default','/?open=free','navigate')).text(),'asset');
 assert.equal(network,requestsBeforeLaunch,'a prepared game deep link must open its release shell locally');
 assert.equal(await fetchEvent('default','/admin','navigate'),undefined,'admin remains online only');
 await caches.open('proplet-offline-content-v1-live');await caches.open(constants.index);await caches.open('proplet-old-release');
 let activation;for(const fn of handlers.activate)fn({waitUntil:value=>{activation=value;}});await activation;
 assert(!deleted.includes('proplet-offline-content-v1-live'));assert(!deleted.includes(constants.index));assert(deleted.includes('proplet-old-release'));
 console.log('PASS worker: fresh release delta, failed-update rejection, complete shell readiness and pack retention');
})().catch(error=>{console.error(error);process.exitCode=1;});
