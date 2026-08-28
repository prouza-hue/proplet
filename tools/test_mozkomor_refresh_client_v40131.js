#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const sw=fs.readFileSync(path.join(root,'public/sw.js'),'utf8');
const playtest=JSON.parse(fs.readFileSync(path.join(root,'public/mozkomor-refresh-playtest.json'),'utf8'));

const must=[
  "MOZKOMOR_QA_PARAM==='refresh'",
  ':mozkomor-human-refresh-v40131',
  '🧪 PLAYTEST · REFRESH 10',
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
if(playtest.kind!=='mozkomor-human-refresh-playtest'||playtest.puzzles?.length!==10)
  throw new Error('Refresh public payload must contain exactly ten isolated boards');
console.log('Mozkomor v4.01.31 refresh client contract: OK');
