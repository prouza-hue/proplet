const fs=require('fs'),assert=require('assert'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
const start=src.indexOf('function isPhoneLikeDevice()');
const end=src.indexOf('function updateLandscapeGameBlocker()',start);
assert(start>=0&&end>start,'Fold viewport helpers not found');
eval(src.slice(start,end));
const active={finished:false};
// Measured real-world unfolded Fold viewport can be much smaller than nominal panel CSS resolution.
assert.equal(isTabletSizedViewport(749,654),true,'real unfolded Fold7 small viewport must be tablet-like');
assert.equal(isTabletSizedViewport(654,749),true,'unfolded Fold portrait must be tablet-like');
assert.equal(isTabletSizedViewport(750,749),true,'near-square unfolded viewport must be tablet-like');
assert.equal(isTabletSizedViewport(984,1092),true,'nominal unfolded viewport remains tablet-like');
// Cover-screen landscape stays phone-like.
assert.equal(isTabletSizedViewport(814,411),false,'folded cover landscape must not become tablet-like');
assert.equal(shouldBlockPhoneLandscape('game',active,814,411,true),true,'folded cover landscape must be guarded');
assert.equal(shouldBlockPhoneLandscape('game',active,411,814,true),false,'folded portrait must play');
// Inner screen must never be caught by the landscape guard, even when browser chrome makes w > h.
assert.equal(shouldBlockPhoneLandscape('game',active,749,654,true),false,'unfolded inner viewport must play');
assert.equal(shouldBlockPhoneLandscape('game',active,750,749,true),false,'near-square unfolded inner viewport must play');
// Desktop does not get a phone-only blocker even in a short window.
assert.equal(shouldBlockPhoneLandscape('game',active,1000,500,false),false,'desktop short window must not be guarded');
assert.equal(shouldBlockPhoneLandscape('game',{finished:true},814,411,true),false,'finished result is never blocked');
assert.equal(shouldBlockPhoneLandscape('daily',active,814,411,true),false,'menus are never blocked');
assert(src.includes("new ResizeObserver"),'board ResizeObserver missing');
assert(src.includes("navigator.devicePosture?.addEventListener?.('change'"),'device posture listener missing');
const css=fs.readFileSync(path.join(__dirname,'../public/styles.css'),'utf8');
assert(css.includes('@media (min-width:540px) and (min-height:540px)'), 'real viewport tablet breakpoint missing');
console.log('PASS: v3.21.1 Fold7 real-viewport classification, cover guard and fold reflow');
