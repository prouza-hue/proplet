'use strict';
// Vercel: exit 0 skips a build; exit 1 builds. Unknown inputs always build.
// Compare against the last deployment, not just HEAD^, so batched runtime changes survive.
const {execFileSync}=require('node:child_process');
function decide(env=process.env,cwd=process.cwd()){
  if(env.PROPLET_FORCE_BUILD==='1'||env.VERCEL_ENV!=='production')return {build:true,reason:'explicit preview or forced build'};
  const base=env.VERCEL_GIT_PREVIOUS_SHA,head=env.VERCEL_GIT_COMMIT_SHA;
  if(!/^[a-f0-9]{40}$/i.test(base||'')||!/^[a-f0-9]{40}$/i.test(head||'')||base===head)return {build:true,reason:'first deployment or explicit redeploy'};
  try{
    const paths=execFileSync('git',['diff','--name-only','--no-renames','-z',base,head,'--'],{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).split('\0').filter(Boolean);
    const nonRuntime=p=>/^(docs\/|tests\/|\.github\/|release-evidence\/)/.test(p)||['AGENTS.md','README.md'].includes(p);
    return paths.length&&paths.every(nonRuntime)?{build:false,reason:'documentation, tests or CI only'}:{build:true,reason:'runtime change or uncertain diff'};
  }catch{return {build:true,reason:'Git comparison unavailable'};}
}
module.exports={decide};
if(require.main===module){const result=decide();console.log(`${result.build?'BUILD':'SKIP'}: ${result.reason}`);process.exitCode=result.build?1:0;}
