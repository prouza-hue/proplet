'use strict';
// Exercise the real auth presentation functions with native-control identities.
// All account/email operations below are local stubs, never network requests.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const nodes=[];let document;
class Element{
 constructor(tag='div',id=''){this.tagName=tag.toUpperCase();this.id=id;this.children=[];this.className='';this.attrs={};this.value='';this.hidden=false;this.open=false;this.type='';this._text='';nodes.push(this);this.classList={contains:n=>this.className.split(/\s+/).includes(n),toggle:(n,on)=>{this.className=this.className.split(/\s+/).filter(x=>x&&x!==n).concat(on?[n]:[]).join(' ');}};}
 get childNodes(){return this.children;}
 get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
 set textContent(t){this._text=t;for(const c of this.children)c.parentElement=null;this.children=[];}
 get nextElementSibling(){const siblings=this.parentElement?.children||[];return siblings[siblings.indexOf(this)+1]||null;}
 remove(){if(this.parentElement){const list=this.parentElement.children;list.splice(list.indexOf(this),1);this.parentElement=null;}}
 append(...items){for(const item of items){item.remove();item.parentElement=this;this.children.push(item);}}
 prepend(item){item.remove();item.parentElement=this;this.children.unshift(item);}
 before(item){const parent=this.parentElement;item.remove();item.parentElement=parent;parent.children.splice(parent.children.indexOf(this),0,item);}
 after(item){const parent=this.parentElement;item.remove();item.parentElement=parent;parent.children.splice(parent.children.indexOf(this)+1,0,item);}
 setAttribute(k,v){this.attrs[k]=String(v);}
 getAttribute(k){return this.attrs[k]??null;}
 matches(s){return s.startsWith('.')?this.classList.contains(s.slice(1)):this.tagName===s.toUpperCase();}
 closest(s){for(let e=this;e;e=e.parentElement)if(e.matches(s))return e;return null;}
 querySelector(s){for(const child of this.children){if(child.matches(s))return child;const found=child.querySelector(s);if(found)return found;}return null;}
 contains(other){for(let e=other;e;e=e.parentElement)if(e===this)return true;return false;}
 focus(){document.activeElement=this;}
 click(){this.onclick?.();}
}
const el=(tag,id,parent)=>{const e=new Element(tag,id);if(parent)parent.append(e);return e;};
const modal=el('div','profileModal'),card=el('div','',modal),tabs=el('div','',card),login=el('button','profileModeLogin',tabs),create=el('button','profileModeCreate',tabs);
const title=el('h2','profileModalTitle',card),desc=el('p','profileModalDesc',card),nameLabel=el('label','',card),name=el('input','playerNameInput',nameLabel);
// Native headings report tabIndex=-1 even without a tabindex attribute; that
// default alone does not make them programmatically focusable.
title.tabIndex=-1;
title.focus=()=>{if(title.getAttribute('tabindex')==='-1')document.activeElement=title;};
const labelText=new Element();labelText.nodeType=3;labelText.textContent='Jméno';nameLabel.prepend(labelText);
const passwordLabel=el('label','',card),password=el('input','playerPasswordInput',passwordLabel),eye=el('button','profilePasswordToggle',card);
const legacy=el('button','legacyTeamLoginToggle',card),chooser=el('div','leagueChooser',card),error=el('div','profileFormError',card),extras=el('div','accountAuthExtras',card),recovery=el('div','recoveryEmailField',extras),details=el('details','recoveryEmailDetails',recovery),email=el('input','recoveryEmailInput',details),forgot=el('button','forgotPasswordBtn',extras),save=el('button','saveProfileBtn',card);
name.value='existing-player@example.test';name.maxLength=254;password.value='kept-private-value';password.type='password';email.value='recovery@example.test';details.open=true;
const $=s=>s.startsWith('#')?nodes.find(n=>n.id===s.slice(1))||null:null;
document={activeElement:null,createElement:tag=>new Element(tag)};
const observers=[];let selected='login',nativeCalls=[],profile=null;
const ctx={$,document,Node:{TEXT_NODE:3},window:{},MutationObserver:class{constructor(cb){this.cb=cb;observers.push(this);}observe(target){this.target=target;}},isCreateMode:()=>selected==='create',positionGoogleFirst:()=>true,setText:(e,t)=>{if(e&&e.textContent!==t)e.textContent=t;},save,profile:()=>profile,validEmail:s=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s),call:async(path,options)=>nativeCalls.push([path,options]),toast:()=>{}};
vm.createContext(ctx);
const auth=fs.readFileSync('public/account-auth.js','utf8'),presentation=fs.readFileSync('public/account-conversion-v3331.js','utf8');
vm.runInContext(auth.slice(auth.indexOf('function positionLoginFields(){'),auth.indexOf('function captureAvatars(')),ctx);
vm.runInContext(presentation.slice(presentation.indexOf('  function polishAuthModal(){'),presentation.indexOf('  function patchFunctions(){')),ctx);
eye.onclick=()=>{password.type=password.type==='password'?'text':'password';};const originalEye=eye.onclick;
legacy.onclick=()=>nativeCalls.push('legacy');login.onclick=()=>mode('login');create.onclick=()=>mode('create');const originalLogin=login.onclick,originalCreate=create.onclick;
function mode(value){selected=value;login.classList.toggle('active',value==='login');create.classList.toggle('active',value==='create');ctx.syncLoginMode();ctx.polishAuthModal();}
ctx.positionLoginFields();mode('login');
assert.equal(password.parentElement.className,'auth-password-control');assert.equal(passwordLabel.getAttribute('for'),password.id);assert.equal(eye.onclick,originalEye);
assert.equal(forgot.parentElement.id,'authPasswordField');assert.equal(legacy.parentElement.id,'authLegacyOptions');
assert.equal($('#authLegacyOptions').nextElementSibling,tabs);assert.equal(modal.getAttribute('aria-labelledby'),title.id);assert.equal(error.getAttribute('role'),'alert');
assert.equal(title.getAttribute('tabindex'),'-1','heading needs an explicit tabindex despite its native -1 property');
assert.equal(password.placeholder,'Heslo','login does not repeat the signup password rule');
eye.click();observers.find(o=>o.target===password).cb();assert.equal(password.type,'text');assert.equal(eye.getAttribute('aria-label'),'Skrýt heslo');assert.equal(eye.getAttribute('aria-pressed'),'true');
create.focus();create.click();assert.equal(document.activeElement,title,'hidden active mode link must not retain keyboard focus');
assert.equal(title.textContent,'Uložit postup');assert.equal((desc.textContent.match(/500 XP/g)||[]).length,1);assert(!save.textContent.includes('500'));assert(!create.textContent.includes('500'));
assert.equal(password.placeholder,'alespoň 8 znaků');
assert(recovery.classList.contains('hidden')===false);assert(forgot.classList.contains('hidden'));assert($('#authLegacyOptions').classList.contains('hidden'));assert(details.open,'mode changes preserve disclosure state');
assert.equal(name.value,'existing-player@example.test');assert.equal(password.value,'kept-private-value');assert.equal(email.value,'recovery@example.test');assert.equal(name.maxLength,254,'presentation leaves length guard to its canonical owner');assert.equal(name.getAttribute('autocomplete'),'nickname');
login.focus();login.click();assert.equal(document.activeElement,title);assert.equal(desc.hidden,true);assert.equal(name.getAttribute('autocomplete'),'username');assert.equal(login.onclick,originalLogin);assert.equal(create.onclick,originalCreate);legacy.click();assert.deepEqual(nativeCalls,['legacy']);
// Repeated polish cannot replace nodes or clear native state/handlers.
const count=nodes.length;for(let i=0;i<25;i++){ctx.positionLoginFields();ctx.polishAuthModal();}assert.equal(nodes.length,count);assert.equal(password.value,'kept-private-value');
// Enter at the heading (no mobile keyboard), retain ongoing field focus and
// return to the invoking control only when another modal has not taken over.
ctx.authWasOpen=false;ctx.authReturnFocus=null;let anotherModal=false;
document.querySelector=()=>anotherModal?{}:modal.classList.contains('hidden')?null:modal;
vm.runInContext(presentation.slice(presentation.indexOf('  function syncAuthFocus(){'),presentation.indexOf('  let bootScheduled=')),ctx);
const origin={isConnected:true,focus(){document.activeElement=this;}};
modal.classList.toggle('hidden',true);ctx.syncAuthFocus();document.activeElement=origin;
modal.classList.toggle('hidden',false);ctx.syncAuthFocus();assert.equal(document.activeElement,title);
password.focus();ctx.syncAuthFocus();assert.equal(document.activeElement,password,'render updates cannot steal focus while typing');
modal.classList.toggle('hidden',true);ctx.syncAuthFocus();assert.equal(document.activeElement,origin);
modal.classList.toggle('hidden',false);ctx.syncAuthFocus();modal.classList.toggle('hidden',true);anotherModal=true;document.activeElement=email;ctx.syncAuthFocus();assert.equal(document.activeElement,email,'recovery modal keeps its selected focus');
anotherModal=false;modal.classList.toggle('hidden',false);
// Optional email validation must reveal a collapsed invalid field before submit.
const handler=auth.slice(auth.indexOf(' save.onclick=async function(e){'),auth.indexOf(" $('#forgotPasswordBtn').onclick="));
ctx.original=()=>{nativeCalls.push('register');profile={id:'new-fixture-account'};};vm.runInContext(handler,ctx);
(async()=>{
 mode('create');nativeCalls=[];email.value='invalid';details.open=false;await save.onclick();assert(details.open);assert.equal(document.activeElement,email);assert.equal(nativeCalls.length,0);
 email.value='';await save.onclick();assert.deepEqual(nativeCalls,['register'],'empty optional email does not initiate email verification');
 profile=null;nativeCalls=[];email.value='recovery@example.test';await save.onclick();assert.equal(nativeCalls[0],'register');assert.equal(nativeCalls[1][0],'/api/account/email/start');assert.equal(nativeCalls[1][1].body.email,email.value);
 modal.classList.toggle('first-steps-auth',true);ctx.polishAuthModal();assert(modal.classList.contains('first-steps-auth'),'manual onboarding mode remains owned by first steps');
 console.log('PASS auth presentation: canonical controls, mode focus, preserved values, single bonus and optional email validation');
})().catch(e=>{console.error(e);process.exitCode=1;});
