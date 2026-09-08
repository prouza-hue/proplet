#!/usr/bin/env node
'use strict';

const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const source=fs.readFileSync('public/app.js','utf8');
const tutorial=source.slice(source.indexOf('function tutorialAdj('),source.indexOf('\n\nasync function openPlayedLevels'));

class ClassList{
  constructor(){this.names=new Set()}
  toggle(name,on){on?this.names.add(name):this.names.delete(name)}
  add(name){this.names.add(name)}
  remove(name){this.names.delete(name)}
  contains(name){return this.names.has(name)}
}
class Target{
  constructor(dataset={}){this.dataset=dataset;this.classList=new ClassList();this.listeners={}}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn)}
  fire(type,event){this['on'+type]?.(event);for(const fn of this.listeners[type]||[])fn(event)}
  closest(selector){return selector==='.tutorial-cell'?this:null}
}
const cells=Array.from({length:9},(_,i)=>new Target({tidx:String(i)}));
const board=new Target();
board.querySelectorAll=()=>cells;
board.contains=c=>cells.includes(c);
const success={textContent:''},card={classList:new ClassList()},next={textContent:''};
const documentTarget=new Target();
documentTarget.elementFromPoint=()=>documentTarget.pointCell;
const selectors={'#tutorialBoard':board,'#tutorialSuccess':success,'.onboarding-card':card,'#onboardNextBtn':next};
const context={
  console,AbortController,
  document:documentTarget,
  window:{PropletEngagementOnboarding:require('../public/app/engagement/onboarding.js')},
  tutorialState:{dragging:false,path:[],done:false},unbindTutorialPointerEvents:()=>{},
  onboardingMandatory:false,onboardingTutorialTracked:false,
  trackProductEvent(){},fx(){},
  $:selector=>selectors[selector],$$:selector=>selector==='.tutorial-cell'?cells:[],
};
vm.createContext(context);
vm.runInContext(tutorial+'\nbindTutorial();',context);
const pointer=(id=1)=>({pointerId:id,isPrimary:true,clientX:0,clientY:0,preventDefault(){}});
const tap=i=>{cells[i].fire('pointerdown',pointer());documentTarget.fire('pointerup',pointer())};

cells[5].fire('pointerdown',pointer());
documentTarget.pointCell=cells[8];
board.fire('pointermove',pointer());
assert(cells[5].classList.contains('active')&&cells[8].classList.contains('active'),'wrong drag should be visible before release');
documentTarget.fire('pointerup',pointer());
assert(cells.every(c=>!c.classList.contains('active')),'document-level release must clear a wrong K→C drag');

tap(0);tap(1);tap(4);
assert(cells[0].classList.contains('done')&&cells[1].classList.contains('done')&&cells[4].classList.contains('done'),'PES must remain retryable after a wrong path');
assert.strictEqual(next.textContent,'Jo, chápu');
console.log('tutorial pointer recovery: ok');
