#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'public/styles.css'),'utf8');

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
  throw new Error('Mozkomor must stay exclusive to Hrát and never appear in Dnes quick play');
if(app.includes("key!=='mozkomor'||unlock.unlocked"))
  throw new Error('Unlocked Mozkomor must not leak into Dnes quick play');
if(!app.includes("scopedStorageKey(MOZKOMOR_UNLOCK_KEY)"))
  throw new Error('Unlock persistence must be player-scoped');
if(!html.includes('Zvětší okolí písmen u nejtěžších úrovní.'))
  throw new Error('Magnifier settings copy does not cover Mozkomor');
if(!css.includes('Mozkomor locked endgame')||!css.includes('.mozkomor-locked'))
  throw new Error('Missing locked endgame styling');
if(!css.includes('right:92px;top:17px'))
  throw new Error('ENDGAME badge must stay clear of the progress/lock circle');
console.log('Mozkomor v4.01.29 client contract: OK');
