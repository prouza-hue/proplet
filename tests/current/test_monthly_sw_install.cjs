'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/sw.js','utf8');
function worker(fail=false){
 const pending=new Set(),puts=new Map(),fetches=new Map(),deleted=[],old=new Map([['previous-good',{}]]);
 const cache={async put(key){assert(!pending.has(key),'concurrent cache.put for same key');pending.add(key);await new Promise(setImmediate);puts.set(key,(puts.get(key)||0)+1);pending.delete(key);}};
 const context={URL,Promise,Set,Map,console,Response,self:{location:{origin:'https://preview.example'},addEventListener(){}},caches:{open:async()=>cache,delete:async key=>{deleted.push(key);return true;}},fetch:async key=>{fetches.set(key,(fetches.get(key)||0)+1);return {ok:!fail||key!=='/runtime-meta.js?v=41000',status:503};}};
 vm.runInNewContext(source+'\nglobalThis.installShell=precacheShell;globalThis.shell=SHELL;globalThis.candidate=SHELL_CACHE;',context);
 return {context,puts,fetches,deleted,old};
}
(async()=>{
 const good=worker();assert.equal(new Set(good.context.shell).size,good.context.shell.length,'declared shell contains no duplicate URLs');
 good.context.shell.push(good.context.shell[0]);
 await good.context.installShell();
 assert.equal(good.puts.size,new Set(good.context.shell).size);
 assert([...good.puts.values()].every(n=>n===1)&&[...good.fetches.values()].every(n=>n===1),'duplicates are fetched/written once even if introduced dynamically');
 const bad=worker(true);await assert.rejects(bad.context.installShell(),/shell-precache-503/);
 assert.deepEqual(bad.deleted,[bad.context.candidate]);assert(bad.old.has('previous-good'),'failed install preserves previous complete release');
 console.log('PASS service-worker shell: unique URLs, no parallel duplicate writes, failed asset aborts only candidate cache');
})().catch(error=>{console.error(error);process.exitCode=1;});
