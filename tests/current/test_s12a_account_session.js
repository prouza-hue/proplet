#!/usr/bin/env node
'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'../..');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const accountAuth=fs.readFileSync(path.join(root,'public/account-auth.js'),'utf8');
const accountTeam=fs.readFileSync(path.join(root,'public/account-team-v33210.js'),'utf8');
const recoveryGuard=fs.readFileSync(path.join(root,'public/auth-recovery-guard-v3326.js'),'utf8');
const themeInit=fs.readFileSync(path.join(root,'public/theme-init.js'),'utf8');
const homeLayout=fs.readFileSync(path.join(root,'public/home-layout.js'),'utf8');
const index=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'public/sw.js'),'utf8');
const sessionPath=path.join(root,'public/app/account/session.js');
const accountUiPath=path.join(root,'public/app/account/account.js');
const accountUi=fs.existsSync(accountUiPath)?fs.readFileSync(accountUiPath,'utf8'):'';
const accountRuntime=`${app}\n${accountUi}`;

function has(source,pattern,label){assert(pattern.test(source),label)}

// Stable product contracts shared by both the legacy and extracted runtimes.
has(app,/Heslo musí mít alespoň 8 znaků\./,'password validation copy drifted');
has(app,/Vyplň jméno a heslo\./,'missing account form validation drifted');
has(accountRuntime,/Vyber tým\./,'team selection validation drifted');
has(accountRuntime,/PIN musí mít alespoň 4 znaky\./,'team PIN validation drifted');
has(accountRuntime,/Tým založen ✓/,'team creation success copy drifted');
has(accountRuntime,/Historické XP zůstaly na místě|Historické XP zůstanou na místě|Historické XP zůstanou týmu|Historické XP zůstávají týmu|Historické XP zůstávají na místě|Historické XP zůstaly týmu|Historické XP zůstaly v týmu|Historické XP zůstávají v týmu|Dříve získané týmové XP zůstanou týmu/,'team leave historical-XP copy drifted');
has(app,/api\('\/api\/anonymous\/claim'/,'anonymous claim missing after password auth');
has(app,/await syncQueue\(\{announce:true\}\)/,'post-auth synchronization missing');
has(accountAuth,/\/api\/auth\/google\/complete/,'Google completion route missing');
has(accountAuth,/\/api\/account\/email\/verify/,'email verification route missing');
has(accountAuth,/\/api\/auth\/recovery\/reset/,'recovery reset route missing');
has(accountAuth,/sessionStorage\.setItem\('proplet-recovery-context'/,'recovery context persistence missing');

if(!fs.existsSync(sessionPath)){
  // Characterize the exact pre-refactor ownership and callback ordering.
  has(app,/function getProfile\(\).*localStorage\.getItem\(PROFILE_KEY\)/,'legacy profile reader missing');
  has(app,/function saveProfile\(p\).*localStorage\.setItem\(PROFILE_KEY,JSON\.stringify\(p\)\)/,'legacy profile writer missing');
  has(app,/function adoptGuestData\(profileId\)/,'legacy guest adoption missing');
  has(app,/const endpoint=accountMode==='create'\?'\/api\/player':'\/api\/login'/,'legacy password auth routes changed');
  has(app,/const hadNoProfile=!getProfile\(\);if\(hadNoProfile\)adoptGuestData\(profile\.id\)/,'password auth adoption order changed');
  has(accountAuth,/const had=!profile\(\);if\(had&&typeof adoptGuestData==='function'\)adoptGuestData\(p\.id\)/,'callback adoption guard changed');
  has(recoveryGuard,/window\.fetch=async function/,'recovery profile persistence wrapper missing');
  has(recoveryGuard,/localStorage\.setItem\(PROFILE_KEY,JSON\.stringify\(\{\.\.\.current,\.\.\.incoming\}\)\)/,'recovery profile pre-persistence changed');
  has(accountTeam,/window\.fetch=\(input,init\)=>/,'login integrity wrapper missing');
  has(accountTeam,/url\.pathname='\/api\/login-integrity'/,'dedupe-aware login rewrite missing');
  console.log('PASS: Sprint 12A.1 legacy account/session ownership and auth ordering characterized');
  process.exit(0);
}

const account=require(sessionPath);
assert.strictEqual(typeof account.create,'function','account session factory missing');

function memoryStorage(initial={}){
  const data=new Map(Object.entries(initial));
  return {
    getItem:key=>data.has(String(key))?data.get(String(key)):null,
    setItem:(key,value)=>data.set(String(key),String(value)),
    removeItem:key=>data.delete(String(key)),
  };
}

const storage=memoryStorage();
const adopted=[];
const changed=[];
const session=account.create({
  storage,
  profileKey:'profile',
  adoptGuestData:id=>adopted.push(id),
  onChange:(next,previous)=>changed.push({next,previous}),
});

assert.strictEqual(session.get(),null);
assert.deepStrictEqual(session.authHeaders(),{});
const first={id:'p1',name:'Pavel',token:'token-1',familyCode:null};
session.accept(first);
assert.deepStrictEqual(session.get(),first);
assert.deepStrictEqual(adopted,['p1'],'first account acceptance must adopt guest data');
assert.deepStrictEqual(session.authHeaders(),{Authorization:'Bearer token-1'});
assert.strictEqual(session.matches(first),true,'active account snapshot should match');
session.update({familyCode:'TEAM',leagueName:'Tým'});
assert.strictEqual(session.get().familyCode,'TEAM');
assert.strictEqual(session.get().token,'token-1');
session.clear();
assert.strictEqual(session.get(),null);

// OAuth/email/recovery persist their fresh token before acceptProfile. The first
// authoritative callback must adopt guest data exactly once before persistence.
session.persistResponseProfile({id:'p2',name:'Callback',token:'token-2'});
session.accept({id:'p2',name:'Callback',token:'token-2',avatar:'🙂'});
assert.deepStrictEqual(adopted,['p1','p2'],'first callback profile must adopt guest data exactly once');
session.persistResponseProfile({id:'p3',name:'Other',token:'token-3'});
assert.deepStrictEqual(session.get(),{id:'p3',name:'Other',token:'token-3'},'identity switch must not inherit fields from the previous account');
assert.deepStrictEqual(adopted,['p1','p2'],'switching an existing account must not adopt guest data');
assert.strictEqual(session.matches({id:'p2',token:'token-2'}),false,'stale account snapshot must be rejected after an identity switch');
assert(changed.length>=4,'account change notifications missing');

storage.setItem('profile','{broken');
assert.strictEqual(session.get(),null,'corrupt profile fallback changed');

has(app,/function accountSession\(/,'account session adapter missing');
has(app,/function accountProfileMatches\(/,'account identity race guard missing');
has(app,/function acceptAccountProfile\(/,'shared account acceptance adapter missing');
has(app,/'\/api\/login-integrity'/,'app does not call the integrity login route explicitly');
has(accountAuth,/acceptAccountProfile/,'OAuth/email/recovery does not share account acceptance');
has(accountTeam,/if\(!window\.PROPLET_ACCOUNT_SESSION_ACTIVE\)\{\s*window\.fetch=/s,'account-team mixed-cache fallback is not gated by the active account seam');
has(recoveryGuard,/if\(!window\.PROPLET_ACCOUNT_CALLBACK_PERSISTENCE_ACTIVE\)\{[\s\S]*window\.fetch=/,'recovery mixed-cache fallback is not gated by explicit callback persistence');
has(accountAuth,/PROPLET_ACCOUNT_CALLBACK_PERSISTENCE_ACTIVE=true/,'account callback ownership marker missing');
has(accountAuth,/PROFILE_RESPONSE_ENDPOINTS\.has\(path\)[\s\S]*persistAccountResponseProfile\(d\.profile\)/,'callback response persistence is not explicit');
const accountAuthAssetPos=themeInit.indexOf("await loadScript('/account-auth.js?v=7'");
const recoveryGuardAssetPos=themeInit.indexOf("loadScript('/auth-recovery-guard-v3326.js?v=2'");
assert(accountAuthAssetPos>=0&&recoveryGuardAssetPos>accountAuthAssetPos,'account callback owner must load before its compatibility guard');
assert(themeInit.includes("loadScript('/account-team-v33210.js?v=3'"),'account-team cache boundary was not advanced');
assert(index.includes('/theme-init.js?v=40140-s12b3')&&sw.includes('/theme-init.js?v=40140-s12b3'),'theme-init cache boundary was not advanced');
assert(themeInit.includes("loadScript('/home-layout.js?v=40140-s12b2'"),'home layout cache boundary was not advanced');
has(homeLayout,/function rankingSessionScope\(\)/,'home ranking cache is not account-session scoped');
has(homeLayout,/rankingCacheScope===scope/,'home ranking reuses responses across account sessions');
has(homeLayout,/if\(rankingSessionScope\(\)!==scope\)return/,'stale anonymous ranking response can overwrite authenticated UI');

const passwordAcceptPos=app.indexOf('acceptAccountProfile({id:profile.id');
const anonymousClaimPos=app.indexOf("api('/api/anonymous/claim'",passwordAcceptPos);
const passwordSyncPos=app.indexOf('await syncQueue({announce:true})',anonymousClaimPos);
assert(passwordAcceptPos>=0&&anonymousClaimPos>passwordAcceptPos&&passwordSyncPos>anonymousClaimPos,'password auth adoption/claim/sync order changed');
has(accountRuntime,/team-membership['"`][\s\S]*updateAccountProfile\(\{familyCode:\s*(?:r|result)\.familyCode,\s*leagueName:\s*(?:r|result)\.leagueName\}\)/,'team join does not use account-session mutation');
has(accountRuntime,/team-membership\/leave['"`][\s\S]*updateAccountProfile\(\{familyCode:\s*null,\s*leagueName:\s*null\}\)/,'team leave does not use account-session mutation');
has(app,/async function logoutPlayer\([\s\S]*clearAccountProfile\(\)/,'logout does not clear the account session');
has(app,/async function deleteAccount\([\s\S]*clearAccountProfile\(\)/,'account deletion does not clear the account session');

const modulePos=index.indexOf('/app/account/session.js');
const tajenkaModulePos=index.indexOf('/app/account/tajenka-storage.js');
const accountUiModulePos=index.indexOf('/app/account/account.js');
const appPos=index.indexOf('/app.js');
assert(modulePos>=0&&modulePos<appPos,'account session must load before app.js');
assert(tajenkaModulePos>modulePos&&tajenkaModulePos<appPos,'account-scoped Tajenka storage must load before app.js');
assert(accountUiModulePos>tajenkaModulePos&&accountUiModulePos<appPos,'account UI owner must load before app.js');
assert(sw.includes('/app/account/session.js'),'account session missing from PWA shell');
assert(sw.includes('/app/account/tajenka-storage.js'),'account-scoped Tajenka storage missing from PWA shell');
assert(sw.includes('/app/account/account.js'),'account UI owner missing from PWA shell');
console.log('PASS: Sprint 12A.1 account session owns profile persistence and auth acceptance contracts');
