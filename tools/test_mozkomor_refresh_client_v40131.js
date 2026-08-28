#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'public/sw.js'),'utf8');
const copyDensity=fs.readFileSync(path.join(root,'public/copy-density-v3327.js'),'utf8');
const css=fs.readFileSync(path.join(root,'public/styles.css'),'utf8');
const theme=fs.readFileSync(path.join(root,'public/theme-init.js'),'utf8');
const playtest=JSON.parse(fs.readFileSync(path.join(root,'public/mozkomor-refresh-playtest.json'),'utf8'));

const must=[
  "MOZKOMOR_QA_PARAM==='refresh'",
  ':mozkomor-human-refresh-v40131',
  '🧪 PLAYTEST · REFRESH 10',
  "key==='mozkomor'&&!done&&!isRefresh?'🌑 ODEMČENO · ENDGAME':progressLabel",
  "isRefresh?'mozkomor-refresh':''",
  'Bez XP · kalibrační sada',
  "playtestProfile==='mozkomor-human-refresh-v40131'",
  "fetch('/mozkomor-refresh-playtest.json',{cache:'no-store'})",
  "playtest?.kind!=='mozkomor-human-refresh-playtest'",
  'points:refreshPlaytest?0:',
  'if(refreshPlaytest)g.finishTelemetryPromise=Promise.resolve()',
  "$('#winShareBtn').classList.toggle('hidden',!!g.postStarterWarmup||refreshPlaytest)",
  "$('#winFeedback')?.classList.toggle('hidden',refreshPlaytest)",
];
for(const token of must){
  if(!app.includes(token))throw new Error('Missing refresh preview isolation: '+token);
}
if(app.includes('mozkomor-masochist')||app.includes('MOZKOMOR_MASOCHIST_PREVIEW'))
  throw new Error('Obsolete masochist preview contract remains in the client');
if(!sw.includes("proplet-v4.01.31-shell-mozkomor-refresh"))
  throw new Error('Refresh preview must rotate the service-worker shell cache');
if(!html.includes('/app.js?v=mozkomor-refresh-v40131')||!sw.includes('/app.js?v=mozkomor-refresh-v40131'))
  throw new Error('Refresh preview must load and precache the same cache-busted client');
if(!copyDensity.includes("MOZKOMOR_REFRESH_PREVIEW&&diff==='mozkomor'")||!copyDensity.includes("eyebrow.textContent='🧪 PLAYTEST · REFRESH 10'"))
  throw new Error('Copy-density polish must preserve the refresh playtest label');
if(!theme.includes("/copy-density-v3327.js?v=3"))
  throw new Error('Refresh preview must cache-bust the copy-density integration fix');
if(!css.includes('.difficulty-card[data-diff="mozkomor"].mozkomor-refresh:before{display:none}'))
  throw new Error('Refresh preview must suppress the generic ENDGAME pseudo-label');
if(!app.includes('if(puzzleDB){renderDaily();maybeOfferRescue()}'))
  throw new Error('Startup rescue refresh must wait for the puzzle database');
if(playtest.kind!=='mozkomor-human-refresh-playtest'||playtest.puzzles?.length!==10)
  throw new Error('Refresh public payload must contain exactly ten isolated boards');
console.log('Mozkomor v4.01.31 refresh client contract: OK');
