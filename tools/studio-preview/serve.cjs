'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(process.argv[2]||path.join(__dirname,'../../../studio-preview-public'));
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.txt':'text/plain','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1');
 if(!['GET','HEAD'].includes(req.method)||url.pathname.startsWith('/api/')){res.writeHead(403,{'content-type':'application/json'});return res.end('{"detail":"Isolated static preview: API disabled"}')}
 const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end('Not found')}
 res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-store','x-robots-tag':'noindex, nofollow, noarchive'});res.end(req.method==='HEAD'?undefined:fs.readFileSync(file));
}catch{res.writeHead(400);res.end('Invalid request')}});
server.listen(Number(process.env.PORT||8892),'127.0.0.1',()=>console.log('Studio preview http://127.0.0.1:'+server.address().port+' from '+root));
