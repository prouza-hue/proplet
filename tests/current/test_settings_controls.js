const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('public/app.js','utf8');
const start=source.indexOf('function renderSettings(){'),end=source.indexOf('\nfunction ',start+1);
const nodes=new Map();let writes=0;
for(const id of ['#soundToggle','#hapticToggle','#wakeLockToggle','#hapticTestBtn','#pushToggleBtn','#pushStatusText']){let text='';nodes.set(id,{attrs:{},classList:{add(){},toggle(){}},get textContent(){return text},set textContent(v){text=v;writes++},setAttribute(k,v){this.attrs[k]=v}})}
const settings={sound:true,haptics:true,wakeLock:true};
const ctx={$:id=>nodes.get(id),getSettings:()=>settings,renderThemeSettings(){},navigator:{vibrate(){},wakeLock:{request(){}}}};
vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);ctx.renderSettings();
for(const id of ['#soundToggle','#hapticToggle','#wakeLockToggle']){assert.equal(nodes.get(id).attrs.role,'switch');assert.equal(nodes.get(id).attrs['aria-checked'],'true');assert.equal(nodes.get(id).disabled,false)}
const initialWrites=writes;for(let i=0;i<1000;i++)ctx.renderSettings();assert.equal(writes,initialWrites,'repeated rendering must not rewrite text');
settings.sound=false;ctx.renderSettings();assert.equal(nodes.get('#soundToggle').attrs['aria-checked'],'false');assert.equal(nodes.get('#soundToggle').textContent,'Zvuk');
ctx.navigator={};ctx.renderSettings();for(const id of ['#hapticToggle','#wakeLockToggle']){assert.equal(nodes.get(id).disabled,true);assert.equal(nodes.get(id).attrs['aria-checked'],'false')}
const pushStart=source.indexOf('async function updatePushUI(){'),pushEnd=source.indexOf('\nasync function togglePushReminder',pushStart);
ctx.pushUiBusy=false;ctx.getProfile=()=>null;ctx.browserPushState=()=>{throw new Error('Guest must not fetch push state')};
vm.runInContext(source.slice(pushStart,pushEnd),ctx);
(async()=>{await ctx.updatePushUI();assert.equal(nodes.get('#pushToggleBtn').textContent,'Přihlásit se');assert.equal(nodes.get('#pushToggleBtn').disabled,false);console.log('PASS: switch semantics, unsupported devices, stable rendering and guest push CTA.');})().catch(e=>{console.error(e);process.exitCode=1});
