'use strict';
const assert=require('node:assert/strict');
const {create,presentation,safeUrl,install}=require('../../public/visual-playtest.js');
const previewUrl='https://proplet-git-codex-today-one-screen-pavel-prouzas-projects.vercel.app/?playtest=visual-refresh-20261027-v1';
const eligible=()=>({eligible:true,previewUrl,role:'tester',status:'invited',shownCount:0,canShowInvite:true,feedback:null});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
// Minimal DOM for the module's real emitted form, with native node identity and
// focus. Network and MutationObserver are inert; no browser or player is used.
function fixture(){
 const handlers={},frames=[];let player={id:'one',token:'private'},data=eligible(),fail=false;
 let doc;
 class Node{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.attrs={};this.events={};this.hidden=false;this.checked=false;this.value='';this._text='';this.classList={contains:()=>false};}
  setAttribute(k,v){this.attrs[k]=String(v);if(k==='id')this.id=v;if(k==='value')this.value=v;if(k==='hidden')this.hidden=true;}
  getAttribute(k){return this.attrs[k]??null;}
  removeAttribute(k){delete this.attrs[k];}
  append(node){node.remove();node.parentElement=this;this.children.push(node);}
  remove(){if(this.parentElement){this.parentElement.children=this.parentElement.children.filter(n=>n!==this);this.parentElement=null;}}
  get isConnected(){return this===doc.body||!!this.parentElement?.isConnected;}
  set innerHTML(html){this.children=[];const stack=[this];for(const part of html.match(/<[^>]+>|[^<]+/g)||[]){if(part.startsWith('</')){stack.pop();continue;}if(part.startsWith('<')){const [,tag,tail]=part.match(/^<(\w+)([^>]*)>/);const node=new Node(tag);for(const attr of tail.matchAll(/([\w-]+)(?:="([^"]*)")?/g))node.setAttribute(attr[1],attr[2]??'');stack.at(-1).append(node);if(!['input','br','img'].includes(tag))stack.push(node);}else stack.at(-1)._text+=part;}}
  get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
  set textContent(value){this._text=value;this.children=[];}
  matches(selector){if(selector.startsWith('#'))return this.id===selector.slice(1);if(selector.startsWith('.'))return (this.attrs.class||'').split(' ').includes(selector.slice(1));
   const match=selector.match(/^(\w+)?(?:\[([^=\]]+)(?:="?([^"\]]+)"?)?\])?(:checked)?$/);if(!match)return false;
   return (!match[1]||this.tagName===match[1].toUpperCase())&&(!match[2]||(match[2] in this.attrs&&(match[3]===undefined||this.attrs[match[2]]===match[3])))&&(!match[4]||this.checked);}
  querySelectorAll(selector){const out=[];for(const node of this.children){if(node.matches(selector))out.push(node);out.push(...node.querySelectorAll(selector));}return out;}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  addEventListener(name,fn){this.events[name]=fn;}
  focus(){doc.activeElement=this;}
  showModal(){this.open=true;}
  close(){this.open=false;}
  reset(){for(const node of this.querySelectorAll('input'))node.checked=false;for(const node of this.querySelectorAll('textarea'))node.value='';}
 }
 const body=new Node('body'),footer=new Node('div');body.append(footer);
 doc={body,readyState:'complete',activeElement:null,addEventListener:(name,fn)=>handlers[name]=fn,createElement:tag=>new Node(tag),querySelector:selector=>selector==='.app-footer .footer-links'?footer:body.querySelector(selector)};
 const win={document:doc,PROPLET_RUNTIME_ENV:'preview',getProfile:()=>player,addEventListener:(name,fn)=>handlers[name]=fn,requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},MutationObserver:class{observe(){}disconnect(){}},api:async(path,opts)=>{
  if(fail)throw {status:503};if(opts.method==='POST'){const payload=JSON.parse(opts.body);assert.equal(payload.action,'feedback');data={...data,status:'accepted',feedback:{rating:payload.rating,comment:payload.comment}};}return data;
 }};
 return {win,doc,footer,handlers,setFail:value=>fail=value,logout:()=>{player=null;handlers['proplet:account-changed']();},flush:async()=>{await tick();while(frames.length)frames.shift()();}};
}
async function main(){
 assert.equal(safeUrl(previewUrl),previewUrl);
 for(const bad of ['javascript:alert(1)',previewUrl+'&token=secret',previewUrl.replace('https:','http:'),previewUrl.replace('.vercel.app/','.evil.example/'),previewUrl+'#secret',previewUrl.replace('https://','https://u:p@')])assert.equal(safeUrl(bad),'');
 assert.deepEqual(presentation({eligible:false},false),{eligible:false,invite:false,feedback:false,returnLink:false});
 assert(presentation(eligible(),false).invite);assert(!presentation(eligible(),false).feedback);
 assert(presentation(eligible(),true).feedback);assert(!presentation(eligible(),true).invite);
 assert(presentation({...eligible(),status:'accepted'},false).returnLink);
 assert(presentation({...eligible(),canShowInvite:false,shownCount:1},false).returnLink,'invited players retain an explicit return path after reload without another impression');
 assert(presentation({...eligible(),role:'reviewer'},false).returnLink);
 assert(!presentation({...eligible(),role:'reviewer'},false).invite);
 assert(!presentation({...eligible(),status:'declined'},true).eligible);
 let player={id:'one',token:'private-one'},requests=[],answer=eligible(),fail=null,resolveLater;
 const changes=[];
 const controller=create({getProfile:()=>player,onChange:data=>changes.push(data),request:async(path,options)=>{
  requests.push({path,options});if(fail)throw fail;if(resolveLater)return new Promise(resolve=>resolveLater.push(resolve));return answer;
 }});
 await controller.load();assert.equal(requests[0].path,'/api/visual-playtest');assert.equal(requests[0].options.method,undefined,'GET does not reserve an impression');
 assert.equal(requests[0].options.authProfile.token,'private-one');
 const count=requests.length;
 assert.equal((await controller.act('feedback',{rating:'',comment:'Text alone'})).reason,'choice');
 assert.equal((await controller.act('feedback',{rating:'better',comment:'x'.repeat(2001)})).reason,'comment');
 assert.equal(requests.length,count,'invalid feedback sends nothing');
 answer={...eligible(),shownCount:1,canShowInvite:false,displayGranted:true};
 assert((await controller.act('shown')).data.displayGranted);assert.deepEqual(JSON.parse(requests.at(-1).options.body),{action:'shown'});
 assert.equal((await controller.act('shown')).reason,'not-offered','cannot spend a second impression on a repaint');
 answer={...eligible(),canShowInvite:false,snoozedUntil:'2026-11-04T00:00:00Z'};
 await controller.act('snooze');assert(!presentation(controller.snapshot().data,false).invite,'server owns seven-day eligibility');
 answer={...eligible(),status:'accepted',feedback:{rating:'similar',comment:'',submittedAt:'now'}};
 await controller.act('feedback',{rating:'similar',comment:''});assert.deepEqual(JSON.parse(requests.at(-1).options.body),{action:'feedback',rating:'similar',comment:''});
 assert.equal(controller.snapshot().data.feedback.rating,'similar');
 answer={...answer,feedback:{rating:'worse',comment:'<script>plain text</script>',submittedAt:'later'}};
 await controller.act('feedback',{rating:'worse',comment:' <script>plain text</script> '});
 assert.equal(controller.snapshot().data.feedback.comment,'<script>plain text</script>','editing retains the latest server answer');
 fail={status:503};assert(!(await controller.act('feedback',{rating:'better',comment:'retry me'})).ok);
 assert.equal(controller.snapshot().data.feedback.rating,'worse','failed save never claims success or replaces saved feedback');
 fail={status:401};await controller.act('feedback',{rating:'better',comment:''});assert.equal(controller.snapshot().data,null,'expired auth removes feedback UI');
 fail=null;answer=eligible();await controller.load();resolveLater=[];
 const inFlight=controller.act('accept');assert(controller.snapshot().busy);assert.equal((await controller.act('decline')).reason,'busy');
 player={id:'two',token:'private-two'};controller.sync();assert.equal(controller.snapshot().data,null);
 resolveLater[0]({...eligible(),status:'accepted'});assert.equal((await inFlight).reason,'stale');assert.equal(controller.snapshot().data,null,'old account cannot populate new account UI');
 resolveLater=null;answer=eligible();await controller.load();player={id:'two',token:'rotated'};controller.sync();assert.equal(controller.snapshot().data,null,'token rotation invalidates the request context');
 player=null;const before=requests.length;assert.equal((await controller.load()).reason,'auth');assert.equal(requests.length,before);

 // Boot integration: unselected accounts and guests never create a card, footer or dialog.
 for(const p of [null,{id:'outside',token:'private'}]){
  const handlers={},frames=[];let calls=0,created=0;
  const win={getProfile:()=>p,api:async()=>{calls++;return {eligible:false};},PROPLET_RUNTIME_ENV:'production',requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},addEventListener:(name,fn)=>handlers[name]=fn,
   document:{readyState:'complete',addEventListener:(name,fn)=>handlers[name]=fn,createElement:()=>{created++;throw Error('Ineligible UI');},querySelector:()=>null}};
  install(win);await tick();for(const frame of frames)frame();assert.equal(created,0);assert.equal(calls,p?1:0);
 }
 const f=fixture();install(f.win);await f.flush();
 const entry=f.footer.children[0];assert.equal(entry.textContent,'Zpětná vazba k vzhledu');assert.equal(f.doc.body.querySelector('dialog'),null,'no automatic form');
 entry.focus();entry.onclick();let dialog=f.doc.body.querySelector('dialog'),form=dialog.querySelector('form'),error=form.querySelector('[role=alert]');
 assert.equal(dialog.getAttribute('aria-labelledby'),dialog.querySelector('h2').id);assert.equal(f.doc.activeElement,dialog.querySelector('h2'));
 assert(form.querySelector('fieldset').querySelector('legend').textContent);assert.equal(form.querySelector('input').getAttribute('required'),'');
 await form.onsubmit({preventDefault(){}});assert.match(error.textContent,/Vyber/);assert.equal(f.doc.activeElement,form.querySelector('input'));
 form.querySelector('input[value="similar"]').checked=true;form.events.change();assert.equal(error.textContent,'','choosing an answer clears its old validation error');
 form.querySelector('textarea').value='<b>keep literal</b>';f.setFail(true);await form.onsubmit({preventDefault(){}});
 assert.match(error.textContent,/nepodařilo/);assert.equal(form.querySelector('textarea').value,'<b>keep literal</b>');assert.equal(form.hidden,false);
 f.handlers.online();await f.flush();assert.equal(f.doc.body.querySelector('dialog'),dialog);assert.equal(form.querySelector('textarea').value,'<b>keep literal</b>','failed background refresh must not erase an open draft');
 f.setFail(false);await form.onsubmit({preventDefault(){}});await f.flush();assert.equal(form.hidden,true);
 const answerNode=dialog.querySelector('.vp-answer');assert.equal(answerNode.textContent,'Podobný · <b>keep literal</b>');assert.equal(answerNode.children.length,0,'server comment is rendered as text, never HTML');
 dialog.querySelector('[data-vp-edit]').onclick();assert.equal(form.querySelector('textarea').value,'<b>keep literal</b>');assert(form.querySelector('input[value="similar"]').checked);
 dialog.querySelector('[data-vp-close]').onclick();assert.equal(dialog.open,false);assert.equal(f.doc.activeElement,entry,'closing restores the footer opener');
 entry.onclick();f.logout();await f.flush();assert.equal(f.footer.children.length,0);assert.equal(f.doc.body.querySelector('dialog'),null,'account change immediately removes the form and previous answer');
 console.log('PASS visual pilot: server-only eligibility, reservation, snooze/decline visibility, reviewer, no-token link, feedback/edit/error, auth races and ineligible no UI');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
