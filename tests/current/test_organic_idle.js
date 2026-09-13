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
