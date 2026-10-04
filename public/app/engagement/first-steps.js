(function(global){
  'use strict';
  const VERSION='board-v3-short',KEY='proplet-first-steps-v1',RETURN='proplet-first-steps-auth-v1',QUIET='proplet-first-steps-quiet-v1';
  const FIRST_BOARD_EXPERIMENT={key:'first-board-v1',variants:{control_e001:'g4-e-001',challenger_e009:'g4-e-009'}};
  const TRAINING={id:'starter-v1',difficulty:'easy',rows:3,cols:3,mask:[0,1,2,3,4,5,6,7,8],letters:['P','E','S','L','Č','A','E','S','J'],lengths:[3,3,3],answers:[{word:'PES',path:[0,1,2],turns:0},{word:'LES',path:[3,6,7],turns:1},{word:'ČAJ',path:[4,5,8],turns:1}],meta:{cells:9,starterVersion:3,pathStyle:'curated-starter',rewardXp:10,contentGeneration:1}};
  // The starter reward keeps its existing once-per-player identity. Free puzzle IDs/content never change.
  const enabled=()=>global.PROPLET_FIRST_STEPS_ENABLED!==false&&!global.PROPLET_RUNTIME_META?.gen4CandidatePreview&&!global.PROPLET_RUNTIME_META?.gen5CandidatePreview;
  const $=s=>document.querySelector(s),game=()=>typeof currentGame==='undefined'?null:currentGame;
  const profile=()=>typeof getProfile==='function'?getProfile():null;
  const read=(storage,key)=>{try{return JSON.parse(storage.getItem(key)||'null')}catch{return null}};
  const write=(storage,key,value)=>{try{storage.setItem(key,JSON.stringify(value));return true}catch{return false}};
  const stateKey=()=>KEY+':'+(typeof getAnonymousId==='function'?getAnonymousId():'guest');
  const intent=()=>{const r=read(sessionStorage,RETURN);return r?.at>Date.now()-30*60*1000&&(!r.owner||r.owner===profile()?.id)?r:null};
  const state=()=>{
    const r=intent();if(r?.flow)return r.flow;
    const stored=read(localStorage,stateKey());return stored&&(!stored.owner||stored.owner===profile()?.id)?stored:{};
  };
  const update=patch=>{
    const next={...state(),...patch},r=intent();
    if(r)write(sessionStorage,RETURN,{...r,flow:next});
    return write(localStorage,stateKey(),next);
  };
  const event=(name,properties={})=>{try{trackProductEvent(name,properties)}catch{}};
  function once(name,properties={}){
    if(state().events?.includes(name))return;
    update({events:[...(state().events||[]),name]});event(name,properties);
  }
  function ensureFlow(){
    if(state().firstStepsRunId)return;
    update({firstStepsRunId:typeof newAttemptId==='function'?newAttemptId():global.crypto.randomUUID(),clientRelease:typeof APP_PREVIEW_RELEASE==='string'?APP_PREVIEW_RELEASE:'legacy',onboardingVersion:VERSION,isTest:new URLSearchParams(location.search).get('tutorial')==='1'});
  }
  function experimentBucket(identity){
    let hash=2166136261;
    for(const char of `${FIRST_BOARD_EXPERIMENT.key}:${identity}`){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619)}
    return (hash>>>0)%100;
  }
  function validAssignment(value){return value?.key===FIRST_BOARD_EXPERIMENT.key&&Object.hasOwn(FIRST_BOARD_EXPERIMENT.variants,value.variant)&&FIRST_BOARD_EXPERIMENT.variants[value.variant]===value.boardId&&Number.isInteger(value.bucket)&&value.bucket>=0&&value.bucket<100&&(value.bucket<50)===(value.variant==='control_e001')}
  async function firstBoardAssignment(){
    const existing=state().firstBoardExperiment;if(validAssignment(existing))return existing;
    // Existing accounts and already-started historical first games stay outside this experiment.
    if(profile()?.token||state().firstBoardId)return null;
    const assignment=await api('/api/first-board/assignment',{method:'POST',headers:eventHeaders(),body:JSON.stringify({first_steps_run_id:state().firstStepsRunId})});
    if(!validAssignment(assignment)||!assignment.assignmentRecorded||!assignment.firstStepsRunId)throw Error('První hru se nepodařilo přiřadit. Zkus to znovu.');
    // Server allocation and assigned telemetry are atomic. Do not double-send assigned on the client.
    if(!update({firstStepsRunId:assignment.firstStepsRunId,firstBoardExperiment:assignment,firstBoardId:assignment.boardId,events:[...(state().events||[]),'first_board_experiment_assigned']}))throw Error('První hru se nepodařilo uložit na zařízení. Zkus to znovu.');return assignment;
  }
  function experimentProperties(assignment=state().firstBoardExperiment){return validAssignment(assignment)?{experimentKey:assignment.key,experimentVariant:assignment.variant,experimentBucket:assignment.bucket,puzzleId:assignment.boardId,experimentAllocationPolicy:assignment.allocationPolicy||'hash50_v1',experimentIdentityBucket:assignment.identityBucket??assignment.bucket}:{} }
  function eventHeaders(properties={}){
    const s=state();if(!s.firstStepsRunId)return {};
    const experiment=experimentProperties(s.firstBoardExperiment);
    return {'X-Proplet-First-Steps-Run':s.firstStepsRunId,'X-Proplet-Onboarding':s.onboardingVersion,'X-Proplet-Client-Release':s.clientRelease,...(s.isTest?{'X-Proplet-Test':'1'}:{}),...(experiment.experimentKey?{'X-Proplet-Experiment':experiment.experimentKey,'X-Proplet-Experiment-Variant':experiment.experimentVariant,'X-Proplet-Experiment-Bucket':String(experiment.experimentBucket),'X-Proplet-Experiment-Policy':experiment.experimentAllocationPolicy,'X-Proplet-Experiment-Identity-Bucket':String(experiment.experimentIdentityBucket)}:{}),...(properties.reason?{'X-Proplet-First-Steps-Reason':properties.reason}:{}),...(properties.outcome?{'X-Proplet-First-Steps-Outcome':properties.outcome}:{})};
  }
  function authHeaders(){return intent()?{...eventHeaders(),'X-Proplet-Creation-Source':'first_steps_v1'}:{}}
  function captureAccount(owner){
    const r=intent();if(!r)return;
    // Pin the complete flow before profile adoption rotates the guest identity.
    write(sessionStorage,RETURN,{...r,owner,flow:{...r.flow,owner}});
  }
  function authOutcome(outcome,reason){if(intent())once('first_steps_v1_auth_'+outcome,{outcome,reason});}
  const short=g=>enabled()&&g?.mode==='starter'&&g.puzzle?.meta?.starterVersion===3;
  let appReady=false,resolveReady,authBusy=false,firstLaunch=false;
  const ready=new Promise(resolve=>{resolveReady=resolve});
  function trainingPuzzle(fallback){
    if(!enabled())return fallback;
    write(sessionStorage,QUIET,true);update({enrolled:true});
    return JSON.parse(JSON.stringify(TRAINING));
  }
  function nextAnswer(g){return g.puzzle.answers.findIndex((_,i)=>!g.found.some(f=>f.answerIndex===i))}
  function guidance(g){
    if(!short(g))return false;
    const n=nextAnswer(g);if(n<0)return true;
    if(g.firstStepsWord!==n){g.firstStepsWord=n;g.firstStepsWrongBaseline=g.wrongAttempts;}
    const helped=g.firstStepsHelp?.includes(n);
    g.starterGuidePath=helped||n===0?[...g.puzzle.answers[n].path]:n===1?g.puzzle.answers[n].path.slice(0,2):[];
    const titles=['Najdi PES','Slova můžou zatáčet','Teď najdi ČAJ'];
    const copy=['Táhni z P přes E až na S. Můžeš i postupně klepat.','Najdi LES. Začni na L a zahni za roh.','Poslední tři písmena spoj sám. Zaplníš celou desku.'];
    renderStarterCoach(n+1,titles[n],helped?'Zkus zvýrazněnou cestu. Pomoc je v pořádku.':copy[n]);
    $('#starterCoachStep').textContent=`${n+1} / 3`;
    $('#screen-game').classList.add('first-steps-training');
    $('#gameDifficulty').textContent='Trénink · 3×3';
    hideStarterHintNudge();renderGameBoard();renderGameHUD();updateGameFeel();return true;
  }
  function assist(g,force=false){
    if(!short(g)||g.finished||g.dragging||g.pausedAt!=null||document.hidden||openTransientModal())return false;
    const n=nextAnswer(g);if(n<0)return false;
    if(g.firstStepsHelp?.includes(n))return true;
    const wrong=g.wrongAttempts-(g.firstStepsWrongBaseline||0);
    if(!force&&wrong<2&&performance.now()-(g.lastProgressAt||g.start)<8000)return true;
    g.firstStepsHelp=[...(g.firstStepsHelp||[]),n];g.starterHintUsed=true;
    event('first_steps_v1_assisted');guidance(g);return true;
  }
  function firstPending(){const s=state();return enabled()&&s.enrolled&&!s.finished&&!profile()?.token}
  function cleanSummary(){
    $('#winModal').classList.add('first-steps-win');
    ['#levelLeaderboardBox','#winAccountBtn','#winFeedback','#newBadgeBox','#winDetails','#winShareBtn','#winReplayBtn','#winMenuBtn','#starterHardActions','#winPraise'].forEach(s=>$(s)?.classList.add('hidden'));
    $('#winTimingNotice').hidden=true;
  }
  async function startFirst(){
    if(firstLaunch)return;firstLaunch=true;
    const button=$('#winPrimaryBtn');button.disabled=true;button.textContent='Načítám první hru…';
    try{
      if(global.PropletSharing?.resumeInvitation?.())return;
      ensureFlow();const assignment=await firstBoardAssignment();
      const boardId=assignment?.boardId||state().firstBoardId||'g4-e-001';
      const p=puzzleDB?.free?.easy?.find(p=>p.id===boardId);
      if(!p)throw Error('První hru se nepodařilo načíst. Zkus to znovu.');
      update({firstBoardId:p.id});
      if(assignment)once('first_board_experiment_assigned',experimentProperties(assignment));
      await startGame(p,'free',null,{firstSteps:true});
      if(game()?.mode==='free'&&game()?.puzzle.id===p.id)$('#winModal').classList.add('hidden');
    }catch(e){showToast(e.message)}finally{firstLaunch=false;button.disabled=false;button.textContent='Hrát dál';}
  }
  function trainingWin(g){
    if(!short(g))return;
    cleanSummary();$('#firstStepsAccount')?.classList.add('hidden');
    $('#winTitle').textContent='Trénink v kapse, odznak čeká!';$('#winBadge').textContent='✓';
    if(!$('#firstStepsTrainingReward')){
      const reward=document.createElement('figure');reward.id='firstStepsTrainingReward';
      reward.innerHTML='<img src="/rewards/printshop/prvni-proplet.svg?v=3" width="168" height="168" alt="" aria-hidden="true"><figcaption><strong>První Proplet</strong><p>Vyřeš první Proplet a odznak je tvůj.</p></figcaption>';
      $('#winTitle').insertAdjacentElement('afterend',reward);
    }
    $('#winText').textContent='';
    $('#winPrimaryBtn').classList.remove('hidden');$('#winPrimaryBtn').textContent='Hrát dál';
    $('#winPrimaryBtn').onclick=startFirst;
  }
  function ensureAccount(){
    if($('#firstStepsAccount'))return;
    const section=document.createElement('section');section.id='firstStepsAccount';section.className='first-steps-account hidden';
    section.innerHTML='<p id="firstStepsSaveCopy">Vytvoř si účet a pokračuj se svým postupem i na jiném zařízení.</p><button id="firstStepsGoogle" class="google-auth-btn first-steps-google" type="button"><img src="/google-g.svg" alt="" aria-hidden="true"><strong>Pokračovat přes Google</strong></button><button id="firstStepsManual" class="text-btn first-steps-manual" type="button">Jiný způsob vytvoření účtu</button><p id="firstStepsSyncStatus" class="first-steps-note" role="status" aria-live="polite"></p><button id="firstStepsRetry" type="button" class="secondary-btn hidden">Zkusit uložit znovu</button><button id="firstStepsContinue" class="text-btn first-steps-continue" type="button">Hrát dál bez účtu</button><small id="firstStepsLocalNote" class="first-steps-note">Zatím máš postup uložený na tomto zařízení.</small>';
    $('#winModal .win-summary').insertAdjacentElement('afterend',section);
    $('#firstStepsGoogle').onclick=()=>beginAuth('google');$('#firstStepsManual').onclick=()=>beginAuth('manual');
    $('#firstStepsContinue').onclick=continuePlaying;$('#firstStepsRetry').onclick=()=>resumeAfterAuth();
  }
  function accountWin(){
    ensureAccount();cleanSummary();$('#winModal').classList.remove('starter-win','hidden');$('#winPrimaryBtn').classList.add('hidden');
    $('#winBadge').textContent='✦';$('#winTitle').textContent='První výhra je tvoje.';$('#winClean').classList.add('hidden');
    const summary=state().summary;
    if(summary){$('#winText').textContent=`${summary.words} nalezených slov`;$('#winXp').textContent=`+${summary.xp} XP`;}
    $('#firstStepsAccount').classList.remove('hidden');
    const signed=!!profile()?.token;
    $('#firstStepsGoogle').classList.toggle('hidden',signed);$('#firstStepsManual').classList.toggle('hidden',signed);
    $('#firstStepsContinue').textContent=signed?'Hrát další Proplet':'Hrát dál bez účtu';
    $('#firstStepsContinue').classList.toggle('primary-btn',signed);
    $('#firstStepsContinue').classList.toggle('big',signed);
    global.PropletInAppBrowserHelp?.mount($('#firstStepsGoogle'),{id:'firstStepsBrowserNote',hidden:signed});
    $('#firstStepsLocalNote').classList.toggle('hidden',signed);
    $('#firstStepsRetry').classList.add('hidden');$('#firstStepsSyncStatus').textContent='';
    $('#firstStepsSaveCopy').textContent=signed?'Účet je připravený. Kontroluji uložení výsledku…':'Vytvoř si účet a pokračuj se svým postupem i na jiném zařízení.';
  }
  function returnIntent(){const r=intent();return r?.boardId===r?.flow?.firstBoardId?r:null}
  async function beginAuth(method){
    if(authBusy)return;
    ensureFlow();const intent={at:Date.now(),boardId:state().firstBoardId,method,flow:state()};
    if(!write(sessionStorage,RETURN,intent)){showToast('Pro návrat k výsledku potřebujeme úložiště prohlížeče. Zkus jiný způsob přihlášení.');return;}
    once(method==='google'?'first_steps_v1_google':'first_steps_v1_manual');
    if(method==='google'){
      authBusy=true;$('#firstStepsGoogle').disabled=true;
      // Use the existing same-origin OAuth route. Never transfer tokens or progress through the URL.
      if(typeof productAnalytics==='function')await productAnalytics()?.flush();
      location.assign('/api/auth/google/start');return;
    }
    $('#winModal').classList.add('hidden');openProfileModal('create');
    $('#profileModal').classList.add('first-steps-auth');
  }
  function dismissAuth(){
    if(!enabled()||returnIntent()?.method!=='manual'||profile()?.token)return;
    authOutcome('cancelled','dismissed');$('#profileModal').classList.remove('first-steps-auth');sessionStorage.removeItem(RETURN);authBusy=false;accountWin();
  }
  function resumeAfterAuth(){
    if(!enabled()||!returnIntent()||!profile()?.token)return false;
    if(authBusy)return true;
    write(sessionStorage,RETURN,{...returnIntent(),owner:profile().id});
    authBusy=true;
    (async()=>{
      if(!appReady)await ready;
      accountWin();$('#profileModal').classList.add('hidden');$('#profileModal').classList.remove('first-steps-auth');
      const owner=profile()?.id;let result;
      try{result=await syncQueue({announce:false})}catch(e){result={ok:false,error:e.message}}
      if(profile()?.id!==owner)return;
      update({owner});
      const preview=!!result?.preview;
      let confirmed=false;
      if(result?.ok&&!preview){try{const remote=await api('/api/progress');const keys=new Set((remote.completed||[]).map(r=>r.challengeKey));confirmed=keys.has('starter:starter-v1')&&keys.has(`free:${state().firstBoardId}`)}catch{}}
      if(profile()?.id!==owner)return;
      const saved=confirmed&&!!result?.ok&&!preview&&!result?.left&&!result?.quarantined&&!getQueue().length;
      if(!saved&&!preview)once('first_steps_v1_save_failed',{outcome:'failed',reason:!navigator.onLine?'offline':result?.quarantined?'quarantined':'sync'});
      $('#firstStepsSaveCopy').textContent=preview?'Přihlášeno. V náhledu zůstává hraní na tomto zařízení.':saved?'Postup je uložený v účtu. Můžeš hrát dál.':'Účet je připravený. Výsledek ještě čeká na uložení.';
      $('#firstStepsSyncStatus').textContent=preview?'Výsledky z preview se do ostré hry neposílají.':saved?'✓ Uloženo':result?.deferred?'Další pokus bude možný za chvíli. Místní výsledek zůstává zachovaný.':navigator.onLine?'Zkus to znovu. Místní výsledek zůstává zachovaný.':'Jsi offline. Místní výsledek zůstává zachovaný.';
      $('#firstStepsRetry').classList.toggle('hidden',preview||saved);
      if(saved&&!state().savedRecorded){update({savedRecorded:true});once('first_steps_v1_saved');}
      if(saved||preview){const flow=state();write(localStorage,stateKey(),flow);sessionStorage.removeItem(RETURN);}
    })().finally(()=>{authBusy=false});
    return true;
  }
  function continuePlaying(){
    once('first_steps_v1_continue');
    update({finished:true});sessionStorage.removeItem(RETURN);$('#winModal').classList.add('hidden');
    $('#winModal').classList.remove('first-steps-win');$('#firstStepsAccount')?.classList.add('hidden');
    startFree('easy');
  }
  function isFirstGame(g){return enabled()&&state().enrolled&&!state().finished&&g?.mode==='free'&&g.puzzle?.id===state().firstBoardId&&!g.isReplay}
  function afterStart(g){
    // Legacy presentation wrappers may not return startGame's promise. Close
    // the training result only when the requested board actually starts.
    if(isFirstGame(g)){$('#winModal').classList.add('hidden');once('first_board_experiment_started',experimentProperties())}
    $('#screen-game').classList.toggle('first-steps-training',short(g));
    $('#winModal').classList.remove('first-steps-win');$('#firstStepsAccount')?.classList.add('hidden');
    $('#winPrimaryBtn').onclick=closeWinAndContinue;
    if(short(g))guidance(g);
  }
  function finish(g){
    if(short(g)){trainingWin(g);return;}
    if(!isFirstGame(g))return;
    ensureFlow();update({summary:{words:g.found.length,xp:g.winBaseXpAwarded||0}});once('first_board_experiment_completed',experimentProperties());accountWin();once('first_steps_v1_offer');
  }
  function cancelledAuthReturn(outcome='cancelled'){
    if(!enabled()||!returnIntent()||profile()?.token)return false;
    authOutcome(outcome,outcome==='cancelled'?'provider_cancel':'request');const flow=state();write(localStorage,stateKey(),flow);sessionStorage.removeItem(RETURN);authBusy=false;
    (async()=>{if(!appReady)await ready;accountWin();$('#firstStepsSyncStatus').textContent='Přihlášení se nedokončilo. Zkus to znovu nebo hraj dál.';})();
    return true;
  }
  function install(){
    if(!enabled())return;
    registerGameCompletionHook({id:'first-steps-v1',priority:1000,after:({game:g})=>finish(g)});
    ['#closeProfileModal','#skipProfileBtn'].forEach(s=>$(s)?.addEventListener('click',()=>queueMicrotask(dismissAuth)));
    $('#profileModal')?.addEventListener('click',e=>{if(e.target===$('#profileModal'))queueMicrotask(dismissAuth)});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')queueMicrotask(dismissAuth)});
    document.addEventListener('proplet:ready',()=>{
      appReady=true;resolveReady();
      if(returnIntent()&&!new URLSearchParams(location.search).has('auth')){
        if(profile()?.token)resumeAfterAuth();else{authBusy=false;accountWin();}
      }
    },{once:true});
    global.addEventListener('pageshow',e=>{if(!e.persisted)return;authBusy=false;const button=$('#firstStepsGoogle');if(button)button.disabled=false;if(returnIntent()?.method==='google'&&!profile()?.token)cancelledAuthReturn();});
  }
  const facade={eventHeaders,authHeaders,captureAccount,authOutcome,enabled,trainingPuzzle,guidance,assist,afterStart,resumeAfterAuth,cancelledAuthReturn,firstPending,isFirstGame,
    firstBoardExperiment:()=>state().firstBoardExperiment||null,
    quiet:()=>enabled()&&read(sessionStorage,QUIET)===true,
    analyticsVersion:()=>enabled()&&(state().enrolled||(typeof freshStarterVisit==='function'&&freshStarterVisit()))?VERSION:null,
    };
  global.PropletFirstSteps=facade;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window);
