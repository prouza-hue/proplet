'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const handlers={};
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../../public/sw.js'),'utf8'),{
  URL,console,setTimeout,clearTimeout,
  self:{location:{origin:'https://preview.example'},addEventListener:(kind,callback)=>{handlers[kind]=callback}},
});
for(const pathname of ['/admin','/admin/','/admin.html','/admin.js?v=workspace1','/admin.css?v=workspace1','/admin/api.js','/admin/players.js','/api/admin/users']){
  let intercepted=false;
  handlers.fetch({request:{method:'GET',url:'https://preview.example'+pathname,mode:pathname.includes('.js')?'cors':'navigate'},respondWith(){intercepted=true}});
  assert.equal(intercepted,false,`Authenticated workspace must bypass gameplay cache: ${pathname}`);
}
console.log('PASS admin shell, modules and API bypass gameplay service-worker caches');
