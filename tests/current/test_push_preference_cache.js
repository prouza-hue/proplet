#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {createCachedLoader} = require('../../public/app/core/api-client.js');

async function main(){
  let now=1000;
  let calls=0;
  let release;
  const firstLoad=new Promise(resolve=>{release=resolve});
  const cache=createCachedLoader({
    ttlMs:300000,
    now:()=>now,
    load:async()=>{calls++;if(calls===1)return firstLoad;return {enabled:calls};},
  });

  const a=cache.get();
  const b=cache.get();
  release({enabled:true});
  assert.deepStrictEqual(await a,{enabled:true});
  assert.deepStrictEqual(await b,{enabled:true});
  assert.strictEqual(calls,1,'concurrent profile renders must share one preferences request');

  assert.deepStrictEqual(await cache.get(),{enabled:true});
  assert.strictEqual(calls,1,'fresh preference state must use the five-minute cache');

  now+=300001;
  assert.deepStrictEqual(await cache.get(),{enabled:2});
  assert.strictEqual(calls,2,'expired preference state must refresh');

  cache.invalidate();
  assert.deepStrictEqual(await cache.get(),{enabled:3});
  assert.strictEqual(calls,3,'subscription mutations must invalidate cached state');

  assert.deepStrictEqual(await cache.get({force:true}),{enabled:4});
  assert.strictEqual(calls,4,'explicit user toggles must force a current read');
  console.log('PASS: push preference reads are coalesced, cached and invalidatable');
}

main().catch(error=>{console.error(error);process.exit(1)});
