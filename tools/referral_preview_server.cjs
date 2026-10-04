'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const publicRoot=path.resolve(__dirname,'../public');
const config=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../vercel.json'),'utf8'));
const headers=config.routes[0].headers;
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.ico':'image/x-icon'};
http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
 if(/^\/api(?:\/|$)/.test(pathname)||pathname==='/sw.js'){res.writeHead(410,{...headers,'Content-Type':'application/json'});res.end('{"preview":true,"backend":false}');return}
 const target=path.resolve(publicRoot,'.'+(pathname==='/'?'/index.html':pathname));
 if(!target.startsWith(publicRoot+path.sep)){res.writeHead(404,headers);res.end();return}
 try{const data=fs.readFileSync(target);res.writeHead(200,{...headers,'Content-Type':mime[path.extname(target)]||'application/octet-stream'});res.end(data)}catch{res.writeHead(404,headers);res.end()}
}).listen(4173,'127.0.0.1',()=>console.log('Static Proplet preview on 4173; no backend or database'));
