const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('public/organic-ui-v4023.js','utf8');
const code=source.slice(source.indexOf('let queued=false;'),source.lastIndexOf('})();'));
let listener,connected=false;const frames=[],scanned=[];
function element(name,parent=null){return {name,nodeType:1,isConnected:true,parentElement:parent,closest(selector){return null},contains(other){return other===this||other.parentElement===this}}}
const body=element('body'),panel=element('panel',body),child=element('child',panel);
const ctx={document:{readyState:'complete',body,documentElement:element('html')},performance:{now:()=>0},auditEnabled:false,decorationRoot:null,MutationObserver:class{constructor(fn){listener=fn}observe(){connected=true}disconnect(){connected=false}},requestAnimationFrame:fn=>frames.push(fn),keyAt:s=>s.includes('🔥')?{}:null};
for(const name of ['applyAvatars','applyBespokeProgressArt','applyRibbonContexts','applyActionIcons','iconizeCloseButtons','updateFooter','updateThemeMeta'])ctx[name]=()=>{};
ctx.replaceVisibleEmoji=()=>{assert.equal(connected,false);scanned.push(ctx.decorationRoot)};
vm.createContext(ctx);vm.runInContext(code,ctx);assert.deepEqual(scanned,[body]);
for(let i=0;i<1000;i++)listener([{type:'characterData',target:{nodeType:3,nodeValue:'00:10',parentElement:panel}}]);assert.equal(frames.length,0);
listener([{type:'childList',addedNodes:[child,panel],target:body}]);assert.equal(frames.length,1);frames.shift()();assert.deepEqual(scanned,[body,panel]);assert.equal(frames.length,0);
listener([{type:'childList',addedNodes:[{nodeType:3,nodeValue:'🔥',parentElement:child}],target:child}]);frames.shift()();assert.deepEqual(scanned,[body,panel,child]);assert.equal(connected,true);
console.log('PASS: one initial scan, updates scoped to changed roots, nested roots deduplicated, numeric text ignored.');

// Settings must retain the semantic mode when its emoji is replaced by artwork.
const settings=fs.readFileSync('public/settings-polish-v40122.js','utf8');
const helperCode=settings.slice(settings.indexOf('  function ensureSingleHelperSetting(){'),settings.indexOf('  function polishProfileCopy(){'));
let helperText='',helperWrites=0,mode={icon:'🧠',label:'Nenabízet'};
const helperValue={dataset:{},get textContent(){return helperText},set textContent(v){helperText=v;helperWrites++}};
const helperContext={q:s=>s==='#soundToggle'?{closest:()=>({})}:s==='#settingsHelperControl'?{}:s==='#settingsHelperValue'?helperValue:null,qa:()=>[],currentHelperMode:()=>mode,setText:(el,text)=>{if(el.textContent!==text)el.textContent=text}};
vm.createContext(helperContext);vm.runInContext(helperCode,helperContext);
helperContext.ensureSingleHelperSetting();helperText=' Nenabízet';
for(let i=0;i<1000;i++)helperContext.ensureSingleHelperSetting();
assert.equal(helperWrites,1,'decorated helper must not be reset to emoji');
mode={icon:'💡',label:'Nabízet'};helperContext.ensureSingleHelperSetting();assert.equal(helperWrites,2,'changing helper mode still updates its label');
console.log('PASS: helper decoration converges and mode changes remain visible.');
