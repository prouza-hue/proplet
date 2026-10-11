'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const calls=[],native=(input,init)=>{calls.push({input,init});return Promise.resolve({ok:true})};
const c={location:{href:'https://hrajproplet.cz/?tutorial=1',origin:'https://hrajproplet.cz',search:'?tutorial=1'},URL,URLSearchParams,Headers};
c.window={fetch:native,PROPLET_RUNTIME_META:{version:'9.99.9'}};vm.createContext(c);vm.runInContext(fs.readFileSync('public/app/client-diagnostics.js','utf8'),c);
c.APP_PREVIEW_RELEASE='proplet-v4.05.2-dailygen6-20261008-usage1';
c.window.fetch('/api/client-error',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer synthetic'}});
let h=calls[0].init.headers;assert.equal(h.get('X-Proplet-Client-Release'),c.APP_PREVIEW_RELEASE);assert.equal(h.get('X-Proplet-Version'),'4.05.2');assert.equal(h.get('X-Proplet-Test'),'1');assert.equal(h.get('Authorization'),'Bearer synthetic');
for(const url of ['https://other.test/api/client-error','/api/me','/api/client-error-other']){const init={headers:{'X-Custom':'unchanged'}};c.window.fetch(url,init);assert.equal(calls.at(-1).init,init,'unrelated requests remain untouched')}
delete c.APP_PREVIEW_RELEASE;c.window.fetch('/api/client-error',{headers:{'Content-Type':'application/json'}});assert.equal(calls.at(-1).init.headers.get('X-Proplet-Client-Release'),null,'missing producer is not inferred from runtime-meta');
const fetch=c.window.fetch;vm.runInContext(fs.readFileSync('public/app/client-diagnostics.js','utf8'),c);assert.equal(c.window.fetch,fetch,'adapter installs only once');
console.log('PASS narrowly scoped diagnostic adapter preserves actual producer, test/auth headers and unrelated requests');
