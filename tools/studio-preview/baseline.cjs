/* Materialize the original public runtime at one exact Git commit, then add the same isolated fixture harness. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const repo=path.resolve(__dirname,'../..'),out=path.resolve(process.argv[2]||path.join(repo,'../studio-baseline-public'));
const ref=process.argv[3]||'9f8ae24bc4dc121e7e554f7aac370fada8c8b16d';
if(!/^[0-9a-f]{40}$/.test(ref))throw Error('Baseline requires exact full SHA');
if(out===repo||out.startsWith(repo+path.sep))throw Error('Baseline must be outside checkout');
const git=args=>execFileSync('git',args,{cwd:repo,maxBuffer:256*1024*1024});
const lines=git(['ls-tree','-r',ref,'--','public']).toString('utf8').trim().split('\n');
const rows=lines.map(line=>{const m=line.match(/^\d+ blob ([a-f0-9]+)\tpublic\/(.+)$/);return m?{sha:m[1],file:m[2]}:null}).filter(Boolean).filter(x=>!(/^(design|review-evidence)\//.test(x.file)||/(^admin\.|^calibration-|\.zip$|\.map$)/.test(x.file)));
const blob=b=>crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex');
const pending=[];fs.mkdirSync(out,{recursive:true});
function save(row,bytes){if(blob(bytes)!==row.sha)throw Error('Git blob mismatch '+row.file);const target=path.join(out,row.file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);}
for(const row of rows){const source=path.join(repo,'public',row.file);if(fs.existsSync(source)){const b=fs.readFileSync(source);if(blob(b)===row.sha){save(row,b);continue}}pending.push(row)}
if(pending.length){const output=execFileSync('git',['cat-file','--batch'],{cwd:repo,input:pending.map(x=>x.sha).join('\n')+'\n',maxBuffer:256*1024*1024});let cursor=0;for(const row of pending){const end=output.indexOf(10,cursor),header=output.subarray(cursor,end).toString('ascii').split(' '),size=Number(header[2]);if(header[0]!==row.sha||header[1]!=='blob'||!Number.isInteger(size))throw Error('Invalid Git batch');cursor=end+1;save(row,output.subarray(cursor,cursor+size));cursor+=size+1;}}
const csp="default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; object-src 'none'; frame-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'";
let html=fs.readFileSync(path.join(out,'index.html'),'utf8');
html=html.replace('<head>','<head>\n<meta http-equiv="Content-Security-Policy" content="'+csp+'">\n<script src="/studio-fixtures/guard.js"></script>\n<script src="/studio-fixtures/adapter.js"></script>\n<link rel="stylesheet" href="/studio-fixtures/controls.css">\n<script defer src="/studio-fixtures/controls.js"></script>');
html=html.replace(/<meta[^>]+(?:og:url|og:image|twitter:image)[^>]+>/g,'').replace(/<link rel="canonical"[^>]+>/g,'').replace(/<title>[^<]+<\/title>/,'<title>Proplet — původní aplikace, izolované srovnání</title>');
if(/studio-edition\.css|studio-shell\.js/.test(html))throw Error('Baseline must not load Studio changes');
fs.writeFileSync(path.join(out,'index.html'),html);
let runtime=fs.readFileSync(path.join(out,'runtime-meta.js'),'utf8');runtime=runtime.replace("const canonicalOrigin='https://hrajproplet.cz';","const canonicalOrigin=location.origin;").replace(/const previewHost=[^;]+;/,'const previewHost=true;');fs.writeFileSync(path.join(out,'runtime-meta.js'),runtime);
fs.mkdirSync(path.join(out,'studio-fixtures'),{recursive:true});for(const file of ['guard.js','adapter.js','controls.js','controls.css'])fs.copyFileSync(path.join(__dirname,file),path.join(out,'studio-fixtures',file));
fs.copyFileSync(path.join(repo,'tests/fixtures/browser/tajenka.json'),path.join(out,'studio-fixtures/tajenka.json'));
fs.writeFileSync(path.join(out,'robots.txt'),'User-agent: *\nDisallow: /\n');
const modified=['index.html','runtime-meta.js','robots.txt'],checked=rows.filter(x=>!modified.includes(x.file));
for(const row of checked)if(blob(fs.readFileSync(path.join(out,row.file)))!==row.sha)throw Error('Final baseline mismatch '+row.file);
const report={sourceSha:ref,builtAt:new Date().toISOString(),baseline:true,exactPublicBlobs:checked.length,harnessOnlyModifications:modified,fixtureScripts:['guard.js','adapter.js','controls.js','controls.css'],unmodifiedGameFiles:['app.js','game.css','ribbon-ui.css','app/game/board.js','app/game/input.js','app/game/hints.js','app/game/state.js','app/game/fair-play.js']};
fs.writeFileSync(path.join(out,'studio-fixtures/build-info.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,output:out},null,2));
