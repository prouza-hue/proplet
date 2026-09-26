'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('public/app.js','utf8');
for(const version of ['board-v3-short','board-v2']){
 let active=version,clock=1;const rows=[];
 const c={window:{PropletFirstSteps:{analyticsVersion:()=>active}},newAttemptId:()=> '00000000-0000-4000-8000-000000000001',performance:{now:()=>clock++},APP_PREVIEW_RELEASE:'release-captured',currentGame:null,getProfile:()=>null,URLSearchParams,location:{search:'?tutorial=1'}};
 c.trackProductEvent=(event,props)=>rows.push({event,headers:c.analyticsHeaders(event,props)});
 vm.createContext(c);vm.runInContext(app.slice(app.indexOf('function createStarterTrace()'),app.indexOf('function freshStarterVisit()')),c);vm.runInContext(app.slice(app.indexOf('function analyticsHeaders('),app.indexOf('function productAnalytics()')),c);
 const t=c.createStarterTrace();assert(Object.isFrozen(t.provenance));
 for(const phase of ['requested','data_ready','ready','interaction','first_correct','completed']){
  if(phase==='completed'){active=null;c.APP_PREVIEW_RELEASE='later-release';}
  c.trackStarterPhase(t,phase);c.trackStarterPhase(t,phase);
 }
 assert.equal(rows.length,6);assert(rows.every(r=>r.headers['X-Proplet-Onboarding']===version&&r.headers['X-Proplet-Client-Release']==='release-captured'&&r.headers['X-Proplet-Starter-Run']===t.id&&r.headers['X-Proplet-Test']==='1'));
 for(const [phase,reason] of [['left','navigation'],['hidden','visibility'],['cancelled','superseded'],['failed','render']]){c.trackStarterPhase(t,phase,reason);assert.equal(rows.at(-1).headers['X-Proplet-Starter-Reason'],reason);assert.equal(rows.at(-1).headers['X-Proplet-Onboarding'],version);}
}
console.log('PASS actual starter trace/header integration: immutable v3/v2 provenance, once per phase, test flag, reasons');
