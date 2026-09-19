/* Build Output API: static files only, no production server imports or functions. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),cp=require('node:child_process');
const E=require('./engine.js'),root=path.resolve(__dirname,'../..'),out=path.join(root,'.vercel/output'),dest=path.join(out,'static');
if(process.env.VERCEL_ENV==='production'||process.env.VERCEL_GIT_COMMIT_REF==='main')throw new Error('Preview build refuses production and main');
const read=p=>fs.readFileSync(path.join(root,p),'utf8'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const baseline='e58aadab5889d43ecceb83333eb49fb9238e384b',asOf='2026-09-19';
const originalApp=read('public/app.js'),originalIndex=read('public/index.html');
const gitHash=s=>crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob '+Buffer.byteLength(s)+'\0'),Buffer.from(s)])).digest('hex');
assert.equal(gitHash(originalApp),'914b8f9c781129e421152233aa75838203293345','Application baseline changed');
assert.equal(gitHash(originalIndex),'aafd6fef7dd9359d276e78efdd60b9e72844a628','HTML baseline changed');
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(dest,{recursive:true});
fs.cpSync(path.join(root,'public'),dest,{recursive:true,filter:source=>!/(^|\/)(admin[^/]*|sw\.js|manifest\.webmanifest)$/.test(source)});
const sourceText=read('public/puzzles.json'),source=JSON.parse(sourceText),data=JSON.parse(sourceText),rolling=JSON.parse(read('data/rolling_content_v1.json'));
const report={previewOnly:true,baseline,asOf,builtAt:new Date().toISOString(),backend:'none',databaseReads:false,databaseWrites:false,sourceSha256:hash(sourceText),intro:{},counts:{},checks:[],introSelection:'Lowest difficultyScore among the first 25 released Gen5 boards; provisional preview selection, not final editorial approval.'};
for(const [diff,list] of Object.entries(data.free)){
 const current=list.filter(p=>!p.meta?.availableFrom||p.meta.availableFrom<=asOf),seen=new Set(current.map(p=>p.id));
 for(const p of rolling.puzzles?.[diff]||[])if(p.meta?.availableFrom&&p.meta.availableFrom<=asOf&&!seen.has(p.id)){current.push(p);seen.add(p.id)}
 data.free[diff]=E.canonicalBank(current,diff);
 report.counts[diff]={total:current.length,gen5:current.filter(E.isGen5).length};
 if(E.SUPPORTED.includes(diff)){
  const modern=data.free[diff].filter(E.isGen5);assert(modern.length>0,'Released Gen5 content missing');
  const intro=modern.slice(0,25).sort((a,b)=>(Number(a.meta?.difficultyScore)||0)-(Number(b.meta?.difficultyScore)||0)||Number(a.meta.level)-Number(b.meta.level)).slice(0,5);
  report.intro[diff]=intro.map(p=>p.id);
  report['introDetails_'+diff]=intro.map(p=>({id:p.id,level:p.meta.level,rows:p.rows,cols:p.cols,words:p.answers.map(a=>a.word),score:p.meta.difficultyScore}));
  for(const p of current){assert(p.answers?.length&&p.letters?.length===p.rows*p.cols,'Incomplete actual puzzle');const mask=new Set(p.mask);const used=new Set();for(const a of p.answers){assert.equal(a.path.map(i=>p.letters[i]).join(''),a.word);for(const i of a.path){assert(mask.has(i));assert(!used.has(i));used.add(i)}}assert.equal(used.size,mask.size)}
  report.checks.push(diff+': all released board payloads and answer paths verified');
  for(const newcomer of [false,true]){
   const done=newcomer?[]:data.free[diff].filter(p=>!E.isGen5(p)).slice(0,36).map(p=>p.id),plan=E.buildPlan({bank:current,difficulty:diff,completedIds:done,newcomer,introIds:report.intro[diff]});
   assert.equal(new Set(plan.ids).size,current.length-done.length);assert.equal(plan.ids.length,current.length-done.length);
   assert.equal(E.isGen5(current.find(p=>p.id===plan.ids[newcomer?1:0])),true);
   const completed=new Set(done);for(const id of plan.ids){const p=E.next({bank:current,difficulty:diff,completedIds:completed,mode:'varied',plan}).puzzle;assert.equal(p.id,id);completed.add(id)}
   assert.equal(E.next({bank:current,difficulty:diff,completedIds:completed,mode:'varied',plan}).puzzle,null);
   const restored=JSON.parse(JSON.stringify(plan));assert.deepEqual(restored,plan);
   const first=plan.ids[0],resume=plan.ids[4];assert.equal(E.next({bank:current,difficulty:diff,completedIds:done,mode:'varied',plan,resumeId:resume}).puzzle.id,resume);
   assert.notEqual(E.next({bank:current,difficulty:diff,completedIds:[...done,first],mode:'varied',plan}).puzzle.id,first);
   report.checks.push(diff+': '+(newcomer?'newcomer':'existing')+' complete traversal, resume, stable serialization and skip-completed PASS');
  }
 }
}
data.freeLevelCounts=Object.fromEntries(Object.entries(data.free).map(([d,b])=>[d,b.length]));
data.contentStatus={asOf,latestBatch:null,nextRelease:null,availableFreeCounts:data.freeLevelCounts};
const put=(p,s)=>{const target=path.join(dest,p);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,s)};
put('puzzles.json',JSON.stringify(data));fs.rmSync(path.join(dest,'puzzles-bootstrap.json'),{force:true});
put('order-engine.js',read('tools/order-preview/engine.js'));put('order-prelude.js',read('tools/order-preview/prelude.js'));put('order-preview.css',read('tools/order-preview/style.css'));
put('order-manifest.js','window.PROPLET_ORDER_MANIFEST='+JSON.stringify(report)+';\n');put('order-manifest.json',JSON.stringify(report,null,2));
const boot='installEngagementModules();installContentModules();boot()';assert.equal(originalApp.split(boot).length,2,'Boot integration point changed');
put('app.js',originalApp.replace(boot,'installOrderPreview();installEngagementModules();installContentModules();boot()')+'\n'+read('tools/order-preview/runtime.js'));
let html=originalIndex.replace('<head>','<head>\n<meta name="robots" content="noindex,nofollow,noarchive">\n<script src="/order-prelude.js"></script>\n<script src="/order-engine.js"></script>\n<script src="/order-manifest.js"></script>');
html=html.replace(/<link\b[^>]*rel="(?:canonical|manifest)"[^>]*>/g,'').replace('</head>','<link rel="stylesheet" href="/order-preview.css">\n</head>').replace('<title>Proplet – rozpleť si hlavu.</title>','<title>Proplet · pestré pořadí · preview</title>');
put('index.html',html);put('robots.txt','User-agent: *\nDisallow: /\n');
const runtime=read('public/runtime-meta.js').replace("const canonicalOrigin='https://hrajproplet.cz';","const canonicalOrigin=location.origin;");put('runtime-meta.js',runtime);
const csp="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; worker-src 'none'; manifest-src 'none'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'none'";
const config={version:3,routes:[{src:'/(.*)',headers:{'Content-Security-Policy':csp,'X-Robots-Tag':'noindex, nofollow, noarchive','Cache-Control':'no-store','X-Proplet-Preview':'isolated-order-v1','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'},continue:true},{src:'/api(?:/.*)?',status:403,dest:'/preview-api-disabled.json'},{src:'/sw.js',status:404},{handle:'filesystem'},{src:'/(.*)',status:404,dest:'/404.html'}]};
put('preview-api-disabled.json',JSON.stringify({detail:'No API or database exists in this isolated preview',previewOnly:true}));put('404.html','<!doctype html><meta charset="utf-8"><title>Proplet preview</title><p>Tato stránka není součástí testovacího preview.</p><a href="/">Zpět do hry</a>');
fs.writeFileSync(path.join(out,'config.json'),JSON.stringify(config));
for(const p of ['app.js','order-prelude.js','order-engine.js','order-manifest.js'])cp.execFileSync(process.execPath,['--check',path.join(dest,p)],{stdio:'inherit'});
assert(!fs.existsSync(path.join(out,'functions')));assert.equal(read('public/puzzles.json'),sourceText,'Source bank must be immutable');assert.equal(read('public/app.js'),originalApp);
console.log('ISOLATED ORDER PREVIEW BUILD PASS '+JSON.stringify({counts:report.counts,checks:report.checks,sourceSha256:report.sourceSha256}));
