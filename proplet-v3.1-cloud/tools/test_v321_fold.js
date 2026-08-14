const fs=require('fs'),assert=require('assert');
const src=fs.readFileSync(require('path').join(__dirname,'../public/app.js'),'utf8');
const start=src.indexOf('function isTabletSizedViewport(w,h)');
const end=src.indexOf('function updateLandscapeGameBlocker()',start);
assert(start>=0&&end>start,'Fold/tablet viewport functions not found');
// Avoid browser-only default expressions by evaluating with small stubs.
global.isHandheldLikeDevice=()=>true;
eval(src.slice(start,end));
const active={finished:false};
assert.equal(isTabletSizedViewport(749,654),true);
assert.equal(isTabletSizedViewport(654,749),true);
assert.equal(isTabletSizedViewport(984,1092),true);
assert.equal(shouldBlockPhoneLandscape('game',active,749,654,true),false,'unfolded Fold landscape must behave like tablet');
assert.equal(shouldBlockPhoneLandscape('game',active,814,411,true),true,'folded cover landscape must remain guarded');
assert.equal(shouldBlockPhoneLandscape('game',active,411,814,true),false,'phone portrait must play');
assert.equal(shouldBlockPhoneLandscape('game',{finished:true},814,411,true),false,'finished result is never blocked');
assert.equal(shouldBlockPhoneLandscape('daily',active,814,411,true),false,'menus are never blocked');
console.log('PASS: v3.21 Fold7 unfolded tablet layout and folded-phone landscape guard');
