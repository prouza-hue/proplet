'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');

// Characterize all existing Google entry points before changing their presentation.
async function characterizeGoogleRoutes(){
  const auth=fs.readFileSync('public/account-auth.js','utf8');
  const app=fs.readFileSync('public/app.js','utf8');
  const first=fs.readFileSync('public/app/engagement/first-steps.js','utf8');
  const location={href:'',assign(path){this.href=path}};
  const ctx={location,trackProductEvent(){}};
  vm.createContext(ctx);
  for(const id of ['googleLoginBtn']){
    const handler=auth.match(new RegExp("\\$\\('#"+id+"'\\).*?(\\(\\)=>\\{location\\.href='[^']+'\\})"));
    assert(handler,'Google action missing: '+id);
    location.href='';vm.runInContext('('+handler[1]+')()',ctx);
    assert.equal(location.href,'/api/auth/google/start',id+' keeps the same-origin OAuth route');
  }
  assert(auth.includes("$('#linkGoogleBtn')?.addEventListener('click',openGoogleLink)"),'linking requires explicit password confirmation');
  const guard=app.slice(app.indexOf('function openProgressGuardGoogle(){'),app.indexOf('function openProgressGuardAccount(){'));
  vm.runInContext(guard,ctx);location.href='';ctx.openProgressGuardGoogle();
  assert.equal(location.href,'/api/auth/google/start');
  const flow=first.slice(first.indexOf('  async function beginAuth(method){'),first.indexOf('  function dismissAuth(){'));
  const button={disabled:false};
  Object.assign(ctx,{authBusy:false,restoreGameFlow(){},game:()=>null,ensureFlow(){},state:()=>({firstBoardId:'fixture-board'}),write:()=>true,sessionStorage:{},RETURN:'fixture',once(){},$:()=>button,productAnalytics:()=>({flush:async()=>{}})});
  vm.runInContext(flow,ctx);location.href='';await ctx.beginAuth('google');
  assert.equal(location.href,'/api/auth/google/start');assert.equal(button.disabled,true,'duplicate-tap guard stays active');
  console.log('PASS all four Google entry points retain same-origin OAuth and onboarding tap guard');
}

function testContextualHelp(){
  const helper=fs.readFileSync('public/app/account/in-app-browser-help.js','utf8');
  const android='Mozilla/5.0 (Linux; Android 16; SM-F966B) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36';
  const ios='Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
  const agents={instagram:android+' Instagram 399.1.0.38.91 Android',facebook:android+' [FBAN/FB4A;FBAV/530.0.0.0]',iosInstagram:ios+' Instagram 399.0.0.0',iosFacebook:ios+' [FBAN/FBIOS;FBAV/530.0.0.0]'};
  const nodes=new Set();let insertions=0;
  function element(tag){
    const classes=new Set();const node={tagName:tag.toUpperCase(),id:'',parentElement:null,children:[],ownerDocument:document,innerHTML:'',className:'',open:false,
      classList:{toggle(name,on){on?classes.add(name):classes.delete(name)},contains(name){return classes.has(name)}},
      get nextElementSibling(){const children=this.parentElement?.children||[];return children[children.indexOf(this)+1]||null},
      appendChild(child){child.remove();this.children.push(child);child.parentElement=this},
      remove(){if(this.parentElement)this.parentElement.children.splice(this.parentElement.children.indexOf(this),1);this.parentElement=null},
      insertAdjacentElement(position,child){assert.equal(position,'afterend');child.remove();const children=this.parentElement.children;children.splice(children.indexOf(this)+1,0,child);child.parentElement=this.parentElement;insertions++}
    };nodes.add(node);return node;
  }
  const document={createElement:element,getElementById:id=>[...nodes].find(node=>node.id===id&&node.parentElement)||null};
  const window={document,navigator:{userAgent:agents.instagram}};
  const module={exports:{}};vm.runInNewContext(helper,{window,module});const api=module.exports;
  assert.equal(nodes.size,0,'loading helper must never insert a first-screen banner');
  for(const ua of [android,ios+' Version/18.6 Safari/604.1',android+'; wv',android+' OtherInstagram 1.0',android+' [FBAN/Orca;FBAV/530.0.0]'])assert.equal(api.context(ua),null,'ordinary browser or unrelated webview must not be labelled IG/FB');
  assert.equal(api.context(agents.instagram).app,'Instagram');assert.equal(api.context(agents.facebook).app,'Facebook');
  assert.equal(api.context(agents.iosInstagram).browser,'Safari');assert.equal(api.context(agents.iosFacebook).browser,'Safari');
  const modal=element('section'),button=element('button');button.id='googleLoginBtn';modal.appendChild(button);
  let clicks=0;button.onclick=()=>clicks++;
  const note=api.mount(button);assert.equal(button.nextElementSibling,note);assert.equal(note.tagName,'DETAILS');assert.equal(note.open,false,'help starts collapsed');
  assert.match(note.innerHTML,/Snazší přihlášení přes Google/);assert.match(note.innerHTML,/Otevřít v prohlížeči/);assert.match(note.innerHTML,/Chrome/);
  assert.match(note.innerHTML,/Rozpracovaná hra a postup bez účtu se automaticky nepřenesou/);assert.match(note.innerHTML,/přezdívkou a heslem tady/);
  assert.match(note.innerHTML,/V běžném prohlížeči se pak přihlas stejnou přezdívkou a heslem/,'handoff guidance must keep the saved account identity');
  assert.match(note.innerHTML,/Google můžeš propojit až ve svém uloženém účtu/,'Google signup in another browser must not imply automatic linking of the saved account');
  assert(!note.innerHTML.includes('<a ')&&!note.innerHTML.includes('<button'),'help cannot create a fake external-browser or URL-copy action');
  const originalInsertions=insertions;for(let i=0;i<100;i++)assert.equal(api.mount(button),note);assert.equal(insertions,originalInsertions,'repeated UI polish must converge');
  note.open=true;const slot=element('section');modal.appendChild(slot);slot.appendChild(button);api.mount(button);
  assert.equal(note.parentElement,slot);assert.equal(button.nextElementSibling,note);assert.equal(note.open,true,'moving Google action preserves its help state');
  api.mount(button,{hidden:true});assert(note.classList.contains('hidden'),'signed-in onboarding can hide help with its Google action');
  api.mount(button,{hidden:false});assert(!note.classList.contains('hidden'));button.onclick();assert.equal(clicks,1,'optional guidance does not replace auth action');
  window.navigator.userAgent=android;assert.equal(api.mount(button),null);assert.equal(document.getElementById(note.id),null);
  assert.equal(api.mount(button,{userAgent:agents.iosFacebook}).innerHTML.includes('Safari'),true,'isolated fixture can explicitly supply its sample UA');
  const auth=fs.readFileSync('public/account-auth.js','utf8'),conversion=fs.readFileSync('public/account-conversion-v3331.js','utf8'),first=fs.readFileSync('public/app/engagement/first-steps.js','utf8');
  for(const id of ['googleLoginBtn','progressGuardGoogleBtn','linkGoogleBtn'])assert(auth.includes("mount($('#"+id+"'))"),'help is mounted in '+id+' owner');
  assert(first.includes("mount($('#firstStepsGoogle'),{id:'firstStepsBrowserNote',hidden:signed})"));
  assert(conversion.includes('PropletInAppBrowserHelp?.mount(button)'),'moving profile button remounts help');
  const copyNodes=new Map(['#profileModalTitle','#profileModalDesc','#saveProfileBtn','#googleManualDivider span','#googlePrimaryBlock .google-primary-head span','#googlePrimaryBlock .google-primary-note','#googlePrimaryBlock .google-primary-head small'].map(id=>[id,{textContent:'',hidden:false,attrs:{},getAttribute(k){return this.attrs[k]??null;},setAttribute(k,v){this.attrs[k]=String(v);}}]));
  const copyContext={window:{PropletInAppBrowserHelp:api},$:id=>copyNodes.get(id),positionGoogleFirst:()=>true,isCreateMode:()=>false,setText:(node,text)=>{if(node)node.textContent=text}};
  vm.createContext(copyContext);vm.runInContext(conversion.slice(conversion.indexOf('  function polishAuthModal(){'),conversion.indexOf('  function patchFunctions(){')),copyContext);
  window.navigator.userAgent=agents.instagram;copyContext.polishAuthModal();
  assert.equal(copyNodes.get('#profileModalTitle').textContent,'Přihlásit se');
  assert.equal(copyNodes.get('#profileModalDesc').textContent,'','login does not repeat provider instructions');
  assert.equal(copyNodes.get('#profileModalDesc').hidden,true);
  window.navigator.userAgent=android;copyContext.polishAuthModal();
  assert.equal(copyNodes.get('#profileModalDesc').hidden,true,'ordinary browsers use the same compact login; IAB help remains contextual');
  assert(!conversion.includes('pár vteřin')&&!conversion.includes('NEJRYCHLEJŠÍ'),'no speed promise or provider eyebrow is mounted');
  const index=fs.readFileSync('public/index.html','utf8'),sw=fs.readFileSync('public/sw.js','utf8');
  assert(index.indexOf('/app/account/in-app-browser-help.js?v=1')<index.indexOf('/app/engagement/first-steps.js?'),'helper loads before onboarding');
  for(const asset of ['/app/account/in-app-browser-help.js?v=1','/in-app-browser-help.css?v=1'])assert(index.includes(asset)&&sw.includes(asset),'new helper asset available in runtime and offline shell');
  console.log('PASS precise app detection, collapsed contextual instructions, progress warning, preserved actions and convergent repositioning');
}

(async()=>{await characterizeGoogleRoutes();testContextualHelp()})().catch(error=>{console.error(error);process.exitCode=1});
