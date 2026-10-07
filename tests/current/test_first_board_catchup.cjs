'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}};
const calls=[],events=[],flow='04570e08-1811-411f-a138-acac4c6c90a4';
const result={key:'first-board-v1',variant:'control_e001',bucket:3,identityBucket:53,allocationPolicy:'catchup_20261004',boardId:'g4-e-001',assignedAt:'2026-10-04T10:00:00Z',firstStepsRunId:flow,assignmentRecorded:true};
const ctx={window:{},document:{readyState:'loading',addEventListener(){}},localStorage:memory(),sessionStorage:memory(),getAnonymousId:()=> 'synthetic-guest-identity',getProfile:()=>null,trackProductEvent:(...e)=>events.push(e)};
ctx.api=async(path,opts)=>{calls.push({path,opts});return result};
ctx.localStorage.setItem('proplet-first-steps-v1:synthetic-guest-identity',JSON.stringify({enrolled:true,firstStepsRunId:flow,onboardingVersion:'board-v3-short',clientRelease:'candidate'}));
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('public/app/engagement/first-steps.js','utf8').replace('const facade={','global.__assignmentTest={firstBoardAssignment,experimentBucket};const facade={'),ctx);
(async()=>{
 const a=await ctx.window.__assignmentTest.firstBoardAssignment();
 assert.equal(a.variant,'control_e001');assert.equal(a.identityBucket,53);assert.equal(a.bucket,3);
 assert.equal(calls.length,1);assert.equal(calls[0].path,'/api/first-board/assignment');
 assert.equal(JSON.parse(calls[0].opts.body).first_steps_run_id,flow);
 assert.equal(calls[0].opts.headers['X-Proplet-Onboarding'],'board-v3-short');
 const h=ctx.window.PropletFirstSteps.eventHeaders();
 assert.equal(h['X-Proplet-Experiment-Policy'],'catchup_20261004');assert.equal(h['X-Proplet-Experiment-Identity-Bucket'],'53');
 assert.equal(h['X-Proplet-Experiment-Bucket'],'3');assert.equal(h['X-Proplet-First-Steps-Run'],flow);
 assert.equal((await ctx.window.__assignmentTest.firstBoardAssignment()).variant,'control_e001');assert.equal(calls.length,1,'sticky local assignment does not allocate twice');
 assert.equal(events.length,0,'assigned is server-owned, never duplicated on client');
 // The rollout works in cached clients; the server still owns assignment telemetry.
 ctx.localStorage.setItem('proplet-first-steps-v1:synthetic-guest-identity',JSON.stringify({enrolled:true,firstStepsRunId:flow,onboardingVersion:'board-v3-short'}));
 ctx.api=async()=>({...result,variant:'challenger_e009',bucket:53,identityBucket:3,allocationPolicy:'challenger_rollout_20261007',boardId:'g4-e-009'});
 const selected=await ctx.window.__assignmentTest.firstBoardAssignment();
 assert.equal(selected.boardId,'g4-e-009');assert.equal(selected.identityBucket,3);
 assert.equal(ctx.window.PropletFirstSteps.eventHeaders()['X-Proplet-Experiment-Policy'],'challenger_rollout_20261007');
 // Pre-existing hash assignment is not reallocated during the catch-up day.
 ctx.localStorage.setItem('proplet-first-steps-v1:synthetic-guest-identity',JSON.stringify({enrolled:true,firstBoardId:'g4-e-009',firstBoardExperiment:{key:'first-board-v1',variant:'challenger_e009',bucket:58,boardId:'g4-e-009'}}));
 assert.equal((await ctx.window.__assignmentTest.firstBoardAssignment()).variant,'challenger_e009');assert.equal(calls.length,1);
 // Existing account/historical first game is outside fresh allocation.
 ctx.localStorage.setItem('proplet-first-steps-v1:synthetic-guest-identity',JSON.stringify({firstBoardId:'g4-e-001'}));
 assert.equal(await ctx.window.__assignmentTest.firstBoardAssignment(),null);
 ctx.localStorage.setItem('proplet-first-steps-v1:synthetic-guest-identity','{}');ctx.getProfile=()=>({token:'test'});
 assert.equal(await ctx.window.__assignmentTest.firstBoardAssignment(),null);ctx.getProfile=()=>null;
 ctx.api=async()=>{throw Error('unavailable')};
 await assert.rejects(()=>ctx.window.__assignmentTest.firstBoardAssignment(),/unavailable/);
 assert.equal(ctx.window.PropletFirstSteps.firstBoardExperiment(),null,'failed request never invents a hash assignment');
 ctx.api=async()=>({...result,bucket:53});
 await assert.rejects(()=>ctx.window.__assignmentTest.firstBoardAssignment(),/přiřadit/);
 console.log('PASS catch-up client: server allocation, sticky existing assignments, provenance, no duplicates, no silent fallback');
})().catch(e=>{console.error(e);process.exitCode=1});
