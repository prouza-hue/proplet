#!/usr/bin/env node
'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'../..');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const accountPath=path.join(root,'public/app/account/account.js');
const account=fs.existsSync(accountPath)?fs.readFileSync(accountPath,'utf8'):'';
const runtime=`${app}\n${account}`;

function has(source,pattern,label){assert(pattern.test(source),label)}

// Characterize the user-visible profile/team contract before ownership moves.
[
  'Postup je zatím jen tady',
  'Účet je v cloudu',
  'Tým je volitelný',
  'Vše synchronizováno',
  'Vyplň jméno a heslo.',
  'Heslo musí mít alespoň 8 znaků.',
  'Vyber tým.',
  'Pojmenuj nový tým.',
  'PIN musí mít alespoň 4 znaky.',
  'Tým založen ✓',
  'Dříve získané týmové XP zůstanou týmu.',
  'Historické XP zůstaly na místě.',
].forEach(copy=>assert(runtime.includes(copy),`profile/team copy drifted: ${copy}`));

has(runtime,/\/api\/team-membership['"`]/,'team membership endpoint missing');
has(runtime,/\/api\/team-membership\/leave/,'team leave endpoint missing');
has(runtime,/\/api\/team-settings/,'team settings endpoint missing');
has(runtime,/\/api\/family-league\/settings/,'team league settings endpoint missing');
has(runtime,/\/api\/team-pin/,'team PIN endpoint missing');
has(runtime,/\/api\/avatar/,'avatar endpoint missing');
has(runtime,/updateAccountProfile\(\{familyCode:\s*(?:r|result)\.familyCode,\s*leagueName:\s*(?:r|result)\.leagueName\}\)/,'team join profile mutation drifted');
has(runtime,/updateAccountProfile\(\{familyCode:\s*null,\s*leagueName:\s*null\}\)/,'team leave profile mutation drifted');
has(runtime,/googleusercontent\.com/,'Google avatar host restriction missing');
has(runtime,/referrerpolicy="no-referrer"/,'Google avatar referrer policy missing');
has(runtime,/syncQueue\(\{announce:true\}\)/,'manual profile sync action missing');
has(runtime,/getQueue\(\)\.length&&!confirm\('Některé výsledky ještě čekají na synchronizaci\./,'logout pending-queue guard drifted');

if(!account){
  has(app,/function renderProfile\(\{focusRoadmap=false\}=\{\}\)/,'legacy profile renderer missing');
  has(app,/function openTeamMembershipModal\(\)/,'legacy team modal owner missing');
  has(app,/async function saveTeamMembership\(\)/,'legacy team mutation owner missing');
  console.log('PASS: Sprint 12A.2 legacy profile/team UI ownership characterized');
  process.exit(0);
}

has(account,/function create\(deps/,'account UI factory missing');
['renderProfile','openTeamMembershipModal','saveTeamMembership','openFamilyLeagueModal','leaveCurrentTeam']
  .forEach(name=>has(account,new RegExp(`\\b${name},`),`account UI public surface missing ${name}`));
has(app,/window\.PropletAccountUI[\s\S]*factory\.create\(/,'app does not compose the account UI owner');
has(app,/function renderProfile\([^)]*\)\{return accountUI\(\)\.renderProfile/,'app profile compatibility adapter missing');
has(app,/function openTeamMembershipModal\(\)\{return accountUI\(\)\.openTeamMembershipModal/,'app team modal compatibility adapter missing');
has(app,/function saveTeamMembership\(\)\{return accountUI\(\)\.saveTeamMembership/,'app team mutation compatibility adapter missing');
const accountPos=indexOfAsset('/app/account/account.js');
const appPos=indexOfAsset('/app.js');
assert(accountPos>=0&&accountPos<appPos,'account UI owner must load before app.js');

function indexOfAsset(asset){return fs.readFileSync(path.join(root,'public/index.html'),'utf8').indexOf(asset)}
assert(fs.readFileSync(path.join(root,'public/sw.js'),'utf8').includes('/app/account/account.js'),'account UI owner missing from PWA shell');

(async()=>{
  const factory=require(accountPath);
  const nodes=new Map();
  const node=id=>{
    if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:'',dataset:{},classList:{toggle(){},add(){},remove(){}}});
    return nodes.get(id);
  };
  const calls=[];
  let profile={id:'p1',token:'token',familyCode:null};
  let confirmResult=false;
  const controller=factory.create({
    $:selector=>node(selector),
    api:async(endpoint,options)=>{calls.push(['api',endpoint,JSON.parse(options.body)]);return {familyCode:'RODINA',leagueName:'Rodina'}},
    getProfile:()=>profile,
    updateAccountProfile:patch=>calls.push(['update',patch]),
    showToast:message=>calls.push(['toast',message]),
    renderProfile:()=>calls.push(['render','profile']),
    renderLeaderboard:()=>calls.push(['render','leaderboard']),
    renderDaily:()=>calls.push(['render','daily']),
    confirm:()=>confirmResult,
  });
  assert.strictEqual(controller.normalizeLeagueCode(' tým žluť '),'TÝMŽLUŤ');
  assert.strictEqual(controller.safeGoogleAvatarUrl('https://lh3.googleusercontent.com/a/photo'),'https://lh3.googleusercontent.com/a/photo');
  assert.strictEqual(controller.safeGoogleAvatarUrl('https://googleusercontent.com.evil.invalid/a'),'');

  controller.setTeamMembershipMode('join');
  node('#teamMembershipSelect').value=' rodina ';
  node('#teamMembershipJoinPin').value='1234';
  await controller.saveTeamMembership();
  assert.deepStrictEqual(calls.slice(0,2),[
    ['api','/api/team-membership',{mode:'join',family_code:'RODINA',league_name:null,league_pin:'1234'}],
    ['update',{familyCode:'RODINA',leagueName:'Rodina'}],
  ],'team membership API/profile mutation order drifted');
  assert.deepStrictEqual(calls.slice(2).map(call=>call[0]==='render'?call[1]:call[0]),['toast','profile','leaderboard','daily'],'team membership UI side-effect order drifted');

  calls.length=0;
  profile={...profile,familyCode:'RODINA',leagueName:'Rodina'};
  await controller.leaveCurrentTeam();
  assert.deepStrictEqual(calls,[],'cancelled team leave must have no side effects');
  confirmResult=true;
  await controller.leaveCurrentTeam();
  assert.deepStrictEqual(calls.slice(0,2),[
    ['api','/api/team-membership/leave',{}],
    ['update',{familyCode:null,leagueName:null}],
  ],'team leave API/profile mutation order drifted');

  console.log('PASS: Sprint 12A.2 account module owns profile/team UI contracts');
})().catch(error=>{console.error(error);process.exit(1)});
