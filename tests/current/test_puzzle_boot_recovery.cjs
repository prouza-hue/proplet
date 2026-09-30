'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/app.js','utf8');
const start=source.indexOf('async function loadPuzzleDatabaseWithRecovery(');
assert(start>=0,'boot needs bounded recovery for a transient database failure');
const code=source.slice(start,source.indexOf('function showPuzzleBootError()',start));
async function scenario(load){
 const reports=[];
 const ctx={loadPuzzleDatabase:load,reportClientError:(...args)=>reports.push(args),setTimeout:(fn,ms)=>setTimeout(fn,ms===500?0:ms===15000?10:ms),clearTimeout,Error,Promise};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 return {value:await ctx.loadPuzzleDatabaseWithRecovery(),reports};
}
(async()=>{
 let calls=0;
 const recovered=await scenario(async()=>{if(++calls===1)throw new TypeError('Failed to fetch');return {version:11}});
 assert.equal(calls,2);assert.equal(recovered.value.version,11);
 assert.equal(recovered.reports[0][0],'puzzle_boot_retry');
 calls=0;await assert.rejects(scenario(async()=>{calls++;throw Error('puzzle-db-http-503')}),/puzzle-db-http-503/);assert.equal(calls,2);
 calls=0;await scenario(async()=>{calls++;return {version:11}});assert.equal(calls,1);
 calls=0;await assert.rejects(scenario(()=>{calls++;return new Promise(()=>{})}),/puzzle-db-timeout/);assert.equal(calls,2);
 const boot=source.slice(source.indexOf('async function boot(){'));
 assert(!boot.includes("$('body').innerHTML="),'failed boot must preserve consent, styles and DOM');
 assert(boot.includes('showPuzzleBootError()'));
 const html=fs.readFileSync('public/index.html','utf8');
 assert(html.indexOf('/marketing-consent.css')<html.indexOf('</head>'),'consent styles belong in the document head');
 console.log('PASS boot: transient recovery, bounded permanent failure, healthy single fetch, preserved consent');
})().catch(error=>{console.error(error);process.exitCode=1});
