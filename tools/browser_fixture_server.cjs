// Isolated browser fixture server: static checkout, synthetic guest API, no DB.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const repo=path.resolve(__dirname,'..'),root=path.join(repo,'public');
const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
if(process.env.EXPECTED_SHA&&process.env.EXPECTED_SHA!==sha)throw Error('checkout SHA mismatch');
const fixtures=path.join(repo,'tests/fixtures/browser');
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const json=(res,code,data)=>{res.writeHead(code,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data))};
const server=http.createServer((req,res)=>{
 try{
  const u=new URL(req.url,'http://127.0.0.1');
  if(!['GET','HEAD'].includes(req.method))return json(res,503,{detail:'isolated fixture: writes disabled'});
  if(u.pathname==='/api/health')return json(res,200,{ok:true,database:false,isolatedFixture:true,sha});
  const fixture={'/api/config':'config.json','/api/tajenka':'tajenka.json'}[u.pathname];
  if(fixture)return json(res,200,JSON.parse(fs.readFileSync(path.join(fixtures,fixture),'utf8')));
  if(u.pathname.startsWith('/api/'))return json(res,503,{detail:'no fixture for this endpoint'});
  const file=path.resolve(root,'.'+(u.pathname==='/'?'/index.html':decodeURIComponent(u.pathname)));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return json(res,404,{detail:'not found'});
  res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});
  res.end(fs.readFileSync(file));
 }catch{if(!res.headersSent)json(res,400,{detail:'invalid request'});else res.end()}
});
server.listen(Number(process.env.PORT||8765),'127.0.0.1',()=>console.log(`Isolated checkout ${sha} listening on ${server.address().port}`));
