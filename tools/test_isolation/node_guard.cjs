'use strict';
// Accident prevention for trusted offline tests, not an OS/hostile-code sandbox.
const net=require('node:net'),dns=require('node:dns'),dgram=require('node:dgram');
const child=require('node:child_process');
const marker=Symbol.for('proplet.current-test-network-guard');
if(!globalThis[marker]){
 globalThis[marker]=true;
 const local=host=>host===undefined||host===null||['localhost','localhost.','::1'].includes(String(host).toLowerCase())||/^127(?:\.\d{1,3}){3}$/.test(String(host))||/^::ffff:127(?:\.\d{1,3}){3}$/i.test(String(host));
 const error=()=>Object.assign(new Error('Current test gate blocks external network; use mocked transport or an explicit live-smoke tool.'),{code:'ERR_TEST_EXTERNAL_NETWORK'});
 const check=host=>{if(!local(host))throw error();};
 const connect=net.Socket.prototype.connect;
 net.Socket.prototype.connect=function(...args){
  const values=Array.isArray(args[0])?args[0]:args;
  const options=typeof values[0]==='object'?values[0]:null;
  if(options){if(!options.path)check(options.host);}
  else if(typeof values[0]==='number'||/^\d+$/.test(String(values[0])))check(typeof values[1]==='string'?values[1]:undefined);
  // Non-numeric strings are local pipe/socket paths, not network destinations.
  return connect.apply(this,args);
 };
 const lookup=dns.lookup;
 dns.lookup=function(host,...args){
  const callback=args.at(-1);
  if(!local(host)){if(typeof callback==='function'){process.nextTick(callback,error());return;}throw error();}
  if(typeof callback==='function')args[args.length-1]=(err,address,...rest)=>{if(err)return callback(err);try{for(const item of Array.isArray(address)?address:[address])check(typeof item==='object'?item.address:item);}catch(e){return callback(e);}callback(null,address,...rest);};
  return lookup.call(this,host,...args);
 };
 const promises=dns.promises,lookupPromise=promises.lookup.bind(promises);
 promises.lookup=async(host,...args)=>{check(host);const result=await lookupPromise(host,...args);for(const item of Array.isArray(result)?result:[result])check(item.address);return result;};
 // DNS resolve/reverse sends packets to configured resolvers even for localhost.
 // The gate only needs local lookup; mocks can replace these functions in tests.
 for(const owner of [dns,dns.Resolver.prototype])for(const key of Object.getOwnPropertyNames(owner))if(key==='resolve'||key==='reverse'||key.startsWith('resolve')){
  if(typeof owner[key]==='function')owner[key]=function(...args){const callback=args.at(-1);if(typeof callback==='function'){process.nextTick(callback,error());return;}throw error();};
 }
 for(const owner of [promises,promises.Resolver.prototype])for(const key of Object.getOwnPropertyNames(owner))if(key==='resolve'||key==='reverse'||key.startsWith('resolve'))if(typeof owner[key]==='function')owner[key]=async()=>{throw error();};
 const udpConnect=dgram.Socket.prototype.connect,send=dgram.Socket.prototype.send;
 dgram.Socket.prototype.connect=function(port,address,...args){check(typeof address==='string'?address:undefined);return udpConnect.call(this,port,address,...args);};
 dgram.Socket.prototype.send=function(...args){
  // send(msg,port,address,cb) or send(msg,offset,length,port,address,cb).
  const address=typeof args[1]==='number'&&typeof args[2]==='number'&&typeof args[3]==='number'?args[4]:args[2];
  if(typeof address==='string')check(address);
  return send.apply(this,args);
 };
 const required={};for(const key of ['PROPLET_TEST_ISOLATED','NODE_OPTIONS','PYTHONPATH'])if(process.env[key]!==undefined)required[key]=process.env[key];
 for(const name of ['spawn','spawnSync','execFile','execFileSync','fork']){
  const original=child[name];
  child[name]=function(...args){
   const index=Array.isArray(args[1])?2:1;
   if(args[index]&&typeof args[index]==='object'&&typeof args[index]!=='function'&&args[index].env)args[index]={...args[index],env:{...args[index].env,...required}};
   return original.apply(this,args);
  };
 }
 require('node:module').syncBuiltinESMExports();
}
