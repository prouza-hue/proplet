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
has(runtime,/updateAccountProfile\(\{familyCode:r\.familyCode,leagueName:r\.leagueName\}\)/,'team join profile mutation drifted');
has(runtime,/updateAccountProfile\(\{familyCode:null,leagueName:null\}\)/,'team leave profile mutation drifted');
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
has(account,/return \{[\s\S]*renderProfile[\s\S]*openTeamMembershipModal[\s\S]*saveTeamMembership[\s\S]*openFamilyLeagueModal[\s\S]*leaveCurrentTeam[\s\S]*\}/,'account UI public surface incomplete');
has(app,/PropletAccountUI\.create\(/,'app does not compose the account UI owner');
has(app,/function renderProfile\([^)]*\)\{return accountUI\(\)\.renderProfile/,'app profile compatibility adapter missing');
has(app,/function openTeamMembershipModal\(\)\{return accountUI\(\)\.openTeamMembershipModal/,'app team modal compatibility adapter missing');
has(app,/function saveTeamMembership\(\)\{return accountUI\(\)\.saveTeamMembership/,'app team mutation compatibility adapter missing');

console.log('PASS: Sprint 12A.2 account module owns profile/team UI contracts');
