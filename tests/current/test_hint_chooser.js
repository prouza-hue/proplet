'use strict';
const assert=require('node:assert/strict');
const {create,openModal,closeModal}=require('../../public/app/game/hints.js');

const answers=[{word:'VLAK',path:[0,1,2,3],turns:0},{word:'MOST',path:[4,5,6,7],turns:1}];
function game(mode='free'){return {mode,puzzle:{answers},found:[],hints:0,maxHintLevel:0,cleanSolve:true}}
for(const level of [1,2,3]){
  const g=game(),events=[];const controller=create({getGame:()=>g});
  const plan=controller.applyState(level,undefined,{onScored:p=>events.push(p.level)});
  assert.equal(plan.level,level);assert.equal(g.hints,1);assert.equal(g.maxHintLevel,level);assert.equal(g.cleanSolve,false);
  assert.deepEqual(events,[level]);assert.equal(plan.pick.a.word,'VLAK');
}
{
 const g=game('starter'),events=[];const c=create({getGame:()=>g});
 c.applyState(3,undefined,{onStarter:p=>events.push(p.level),onScored:()=>assert.fail('Training must stay unscored')});
 assert.equal(g.starterHintUsed,true);assert.equal(g.hints,0);assert.equal(g.cleanSolve,true);assert.equal(g.maxHintLevel,0);assert.deepEqual(events,[3]);
 g.found=[{answerIndex:0}];assert.equal(c.pickTarget().a.word,'MOST');
}
{
 const g=game('tajenka');const c=create({getGame:()=>g});
 c.applyState(3,undefined,{onScored:()=>assert.fail('Tajenka must not get a normal-game penalty')});
 assert.equal(g.hints,1);assert.equal(g.maxHintLevel,0);assert.equal(g.cleanSolve,true);
 assert.equal(c.choices('tajenka')[0][0],'Významová stopa');
 assert.equal(c.choices('default')[0][0],'Lehká');
 const copy=c.choices('default');copy[0][0]='mutated';assert.equal(c.choices('default')[0][0],'Lehká');
}
{
 const g=game(),c=create({getGame:()=>g,supportMode:()=> 'beginner'});
 assert.equal(c.applyState(1).complimentary,true);assert.equal(g.cleanSolve,false);
 assert.equal(c.applyState(1).complimentary,false);g.isReplay=true;g.hints=0;assert.equal(c.applyState(1).complimentary,false);
}
{
 const g=game(),c=create({getGame:()=>g});g.found=[{answerIndex:0},{answerIndex:1}];
 assert.equal(c.pickTarget(),null);assert.equal(c.applyState(1),null);assert.equal(g.hints,0);
}

// A minimal DOM double exercises focus ownership without starting a puzzle or a timer.
function modalFixture(){
 const doc={activeElement:null,querySelector:()=>opener};const listeners=[];const tokens=new Set(['hidden']);
 const button=()=>({hidden:false,disabled:false,isConnected:true,focus(){doc.activeElement=this}});
 const opener=button(),close=button(),title={textContent:''};doc.activeElement=opener;
 const choices=[1,2,3].map(level=>{
  const nodes={strong:{textContent:''},small:{textContent:''},'.hint-art':{src:'',getAttribute(){return this.src},setAttribute(_,value){this.src=value}}};
  return Object.assign(button(),{level,querySelector:key=>nodes[key],nodes});
 });
 const modal={ownerDocument:doc,dataset:{},attributes:{},
  classList:{contains:t=>tokens.has(t),remove:t=>tokens.delete(t),add:t=>tokens.add(t),toggle(t,v){v?tokens.add(t):tokens.delete(t)}},
  addEventListener:(_,fn)=>listeners.push(fn),setAttribute(k,v){this.attributes[k]=v},
  querySelector(key){return key==='#closeHintModal'?close:key==='#hintTitle'?title:null},
  querySelectorAll(key){return key==='[data-hint-level]'?choices:[close,...choices]},contains(node){return [close,...choices].includes(node)}
 };
 close.click=()=>closeModal(modal);
 return {modal,doc,opener,close,choices,title,listeners,tokens};
}
{
 const f=modalFixture();openModal(f.modal);
 assert.equal(f.doc.activeElement,f.close);assert.equal(f.tokens.has('hidden'),false);
 assert.equal(f.modal.attributes['aria-labelledby'],'hintTitle');assert.equal(f.title.textContent,'Kolik pomoci chceš?');
 assert.deepEqual(f.choices.map(b=>b.nodes.strong.textContent),['Lehká','Silnější','Odhalit']);
 assert.ok(f.choices.every(b=>b.nodes['.hint-art'].src.endsWith('-v1.webp')));
 const key=(value,shift=false)=>{let prevented=false,stopped=false;f.listeners[0]({key:value,shiftKey:shift,preventDefault(){prevented=true},stopPropagation(){stopped=true}});return {prevented,stopped}};
 assert.equal(key('Tab',true).prevented,true);assert.equal(f.doc.activeElement,f.choices[2]);
 assert.equal(key('Tab').prevented,true);assert.equal(f.doc.activeElement,f.close);
 f.doc.activeElement=f.choices[0];assert.equal(key('Tab').prevented,false);
 assert.deepEqual(key('Escape'),{prevented:true,stopped:true});assert.equal(f.tokens.has('hidden'),true);assert.equal(f.doc.activeElement,f.opener);
 openModal(f.modal,{mode:'tajenka'});assert.equal(f.choices[0].nodes.strong.textContent,'Významová stopa');assert.equal(f.title.textContent,'Jak moc napovědět?');closeModal(f.modal);
 openModal(f.modal,{mode:'starter'});assert.equal(f.tokens.has('starter-hint'),true);assert.equal(f.title.textContent,'Zkus malé postrčení');closeModal(f.modal);
 openModal(f.modal);assert.equal(f.tokens.has('starter-hint'),false);assert.equal(f.listeners.length,1);closeModal(f.modal);
}
console.log('Hint chooser: scoring, training, Tajenka, targeting, copies, keyboard trap, Escape, focus return PASS');
