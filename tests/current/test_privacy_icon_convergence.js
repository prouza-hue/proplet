const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('public/settings-ia-v40122.js','utf8');
const code=source.slice(source.indexOf('  function ensurePrivacyCard(){'),source.indexOf('  function syncGuestState(){'));
let writes=0,value='',publicMode=false;
const icon={dataset:{},get textContent(){return value},set textContent(v){value=v;writes++}};
const card={},screen={};const context={profileScreen:()=>screen,profile:()=>({token:'test'}),privacyState:()=>({icon:publicMode?'👀':'🎭',title:'',copy:''}),q:(selector)=>selector==='#settingsPrivacyCard'?card:selector==='.settings-privacy-icon'?icon:null,setText:(el,text)=>{if(el&&el.textContent!==text)el.textContent=text}};
vm.createContext(context);vm.runInContext(code,context);
context.ensurePrivacyCard();assert.equal(writes,1);
value=''; // artwork replaces emoji and contains no text
for(let i=0;i<1000;i++)context.ensurePrivacyCard();assert.equal(writes,1,'must preserve decorated icon');
publicMode=true;context.ensurePrivacyCard();assert.equal(writes,2,'real privacy change updates icon');
value='';context.ensurePrivacyCard();assert.equal(writes,2);
console.log('PASS: artwork survives 1000 refreshes; privacy changes still update icon.');
