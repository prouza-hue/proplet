'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const input=require('../../public/app/game/input.js');
const app=fs.readFileSync('public/app.js','utf8');
const factory=app.slice(app.indexOf('function gameInput(){'),app.indexOf('function gameHints(){'));
const seed=fs.readFileSync('public/valid-words-v3328.txt','utf8');
async function run(word,early,signedIn){
 const storage=new Map(),messages=[];
 const noop=()=>{};
 const puzzles=JSON.parse(fs.readFileSync('data/puzzles.json','utf8'));
 const puzzle=word==='STOP'?puzzles.free.medium[16]:puzzles.free.hardcore[120];
 const route={STOP:[13,21,29,28],KVĚT:[46,47,57,58],RÁMUS:[41,42,32,33,23]}[word];
 assert.equal(route.map(i=>puzzle.letters[i]).join(''),word);
 const game={mode:'free',puzzle,found:[],path:[...route],dragging:true};
 const ctx={currentGame:game,gameInputController:null,gameSession:()=>null,pNeighbours:()=>[],updateActive:noop,ensureAudio:noop,fx:noop,hideGameUndo:noop,clearHintTrace:noop,$:()=>null,COLORS:[],esc:x=>x,getSettings:()=>({magnifier:false}),navigator:{},window:{PropletGameInput:input,addEventListener:noop},document:{addEventListener:noop,querySelector:()=>null,createElement:()=>({setAttribute:noop,remove:noop}),head:{appendChild:noop},body:{appendChild:noop}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},setTimeout:noop,getProfile:()=>signedIn?{id:'test',token:'fixture'}:null,api:async(url,opts)=>{if(opts){const claim=JSON.parse(opts.body);assert.deepEqual(claim.path,route);assert.equal(claim.word,word);}return {newlyGranted:!!opts,awardedPoints:opts?1:0,totalDiscoveryXp:opts?1:0};},message:s=>messages.push(s),fetch:async()=>({ok:true,text:async()=>seed}),samePath:()=>false,submitPath:()=>{game.path=[];},currentWord:()=>word};
 vm.createContext(ctx);vm.runInContext(factory,ctx);
 if(early)vm.runInContext('gameInput()',ctx);
 vm.runInContext(fs.readFileSync('public/valid-word-feedback-v3330.js','utf8'),ctx);
 vm.runInContext('gameInput().pointerUp()',ctx);
 await new Promise(setImmediate);
 assert.equal(game.wordDiscoveryXpAwarded,1,`${word}, early controller=${early}`);
 assert(messages.some(s=>s.includes('platné')&&s.includes('+1 XP')));
 game.dragging=true;game.path=[...route];vm.runInContext('gameInput().pointerUp()',ctx);
 await new Promise(setImmediate);assert.equal(game.wordDiscoveryXpAwarded,1,'duplicate cannot earn again');
}
(async()=>{for(const word of ['STOP','KVĚT','RÁMUS'])for(const early of [true,false])for(const signedIn of [false,true])await run(word,early,signedIn);console.log('PASS real input → delayed recognition wrapper → local XP, both load orders and duplicates');})();
