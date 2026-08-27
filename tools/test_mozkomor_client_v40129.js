#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'public/styles.css'),'utf8');
const home=fs.readFileSync(path.join(root,'public/home-layout.js'),'utf8');
const theme=fs.readFileSync(path.join(root,'public/theme-init.js'),'utf8');
const sw=fs.readFileSync(path.join(root,'public/sw.js'),'utf8');
const puzzles=JSON.parse(fs.readFileSync(path.join(root,'public/puzzles.json'),'utf8'));

const must=[
  "mozkomor:{label:'Mozkomor'",
  "const MOZKOMOR_UNLOCK_BASE=200",
  "function mozkomorUnlockState()",
  "key==='mozkomor'&&!unlock.unlocked",
  "Mozkomor se odemkne po dokončení všech Mozkožroutů",
  "['hard','hardcore','mozkomor']",
  "MOZKOMOR_PREVIEW_UNLOCK",
  "freeCompleted?.mozkomor",
];
for(const token of must){
  if(!app.includes(token))throw new Error('Missing Mozkomor client contract: '+token);
}
if(!app.includes("Object.entries(DIFF).filter(([key])=>key!=='mozkomor')"))
  throw new Error('Base quick play must exclude Mozkomor');
if(app.includes("key!=='mozkomor'||unlock.unlocked"))
  throw new Error('Unlocked Mozkomor must not leak into base quick play');
if(!home.includes("Object.entries(DIFF).filter(([key])=>key!=='mozkomor')"))
  throw new Error('Dnes home renderer must exclude Mozkomor tiles');
if(!home.includes("r.difficulty!=='mozkomor'"))
  throw new Error('Dnes resume card must exclude Mozkomor sessions');
if(!theme.includes("/home-layout.js?v=12"))
  throw new Error('Dnes home renderer cache bust must be v12');
if(!sw.includes("proplet-v4.01.29-shell-mozkomor-rc2")||!sw.includes("/home-layout.js?v=12"))
  throw new Error('Mozkomor RC service worker must rotate and precache the fixed Dnes renderer');
if((puzzles.free?.mozkomor||[]).length!==100)
  throw new Error('Preview public puzzle bank must contain exactly 100 Mozkomor boards');
if(!app.includes("scopedStorageKey(MOZKOMOR_UNLOCK_KEY)"))
  throw new Error('Unlock persistence must be player-scoped');
if(!app.includes('data-play-free="mozkomor" role="button" tabindex="0" aria-label="Hrát Mozkomor"'))
  throw new Error('Unlocked Mozkomor card must be directly playable from Hrát');
if(!html.includes('Zvětší okolí písmen u nejtěžších úrovní.'))
  throw new Error('Magnifier settings copy does not cover Mozkomor');
if(!css.includes('Mozkomor locked endgame')||!css.includes('.mozkomor-locked'))
  throw new Error('Missing locked endgame styling');
if(!css.includes('right:92px;top:17px'))
  throw new Error('ENDGAME badge must stay clear of the progress/lock circle');
if(!css.includes('pointer-events:none'))
  throw new Error('ENDGAME badge must never intercept Mozkomor clicks');
console.log('Mozkomor v4.01.29 client contract: OK');
