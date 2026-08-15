#!/usr/bin/env node
'use strict';

const assert=require('node:assert/strict');
const {WIN_PRAISE,CLEAN_PRAISE,stableTextIndex,completionPraise}=require('../public/app.js');

assert.deepEqual(Object.keys(WIN_PRAISE),['easy','medium','hard','hardcore']);
assert.ok(WIN_PRAISE.easy.length>=5);
assert.ok(WIN_PRAISE.medium.length>=6);
assert.ok(WIN_PRAISE.hard.length>=8);
assert.ok(WIN_PRAISE.hardcore.length>=10);
assert.equal(stableTextIndex('stejny-pokus',10),stableTextIndex('stejny-pokus',10));

const saved={attemptId:'fixed-attempt',puzzleId:'g2-x-010',completedAt:'2026-08-13T12:00:00+02:00',cleanSolve:false};
assert.deepEqual(completionPraise('hardcore',saved),completionPraise('hardcore',saved));

const clean=completionPraise('hardcore',{...saved,cleanSolve:true});
const normal=completionPraise('hardcore',saved);
assert.ok(clean.line.length>normal.line.length);
assert.ok(CLEAN_PRAISE.hardcore.some(text=>clean.line.endsWith(text)));

console.log('win praise: OK');
