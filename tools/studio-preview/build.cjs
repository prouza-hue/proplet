'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const repo=path.resolve(__dirname,'../..'),source=path.join(repo,'public'),out=path.resolve(process.argv[2]||path.join(repo,'../studio-preview-public'));
if(out===repo||out.startsWith(repo+path.sep))throw Error('Generated preview must be outside checkout');
fs.mkdirSync(out,{recursive:true});
const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
const excluded=new Set(['design','review-evidence']);const files=[];
function copy(dir,prefix=''){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const rel=prefix+entry.name;if(!prefix&&excluded.has(entry.name))continue;
  if(entry.isDirectory()){copy(path.join(dir,entry.name),rel+'/');continue}
  if(/(^admin\.|^calibration-|\.zip$|\.map$)/.test(rel))continue;
  const target=path.join(out,rel);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(dir,entry.name),target);files.push(rel);
 }
}
copy(source);
const csp="default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; object-src 'none'; frame-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'";
let html=fs.readFileSync(path.join(source,'index.html'),'utf8');
html=html.replace('<head>','<head>\n<meta http-equiv="Content-Security-Policy" content="'+csp+'">\n<script src="/studio-fixtures/guard.js"></script>\n<script src="/studio-fixtures/monthly-v2-fixture.js"></script>\n<script src="/studio-fixtures/adapter.js"></script>\n<link rel="stylesheet" href="/studio-fixtures/controls.css">\n<script defer src="/studio-fixtures/controls.js"></script>');
// Metadata links describe production in the real app, but this is an isolated copy.
html=html.replace(/<meta[^>]+(?:og:url|og:image|twitter:image)[^>]+>/g,'').replace(/<link rel="canonical"[^>]+>/g,'');
html=html.replace(/<title>[^<]+<\/title>/,'<title>Proplet — Studio Edition, izolovaný náhled</title>');
fs.writeFileSync(path.join(out,'index.html'),html);
let runtime=fs.readFileSync(path.join(source,'runtime-meta.js'),'utf8');
runtime=runtime.replace("const canonicalOrigin='https://hrajproplet.cz';","const canonicalOrigin=location.origin;").replace(/const previewHost=[^;]+;/,'const previewHost=true;');
fs.writeFileSync(path.join(out,'runtime-meta.js'),runtime);
fs.mkdirSync(path.join(out,'studio-fixtures'),{recursive:true});
for(const file of ['guard.js','monthly-v2-fixture.js','adapter.js','controls.js','controls.css'])fs.copyFileSync(path.join(__dirname,file),path.join(out,'studio-fixtures',file));
fs.copyFileSync(path.join(repo,'tests/fixtures/browser/tajenka.json'),path.join(out,'studio-fixtures/tajenka.json'));
fs.writeFileSync(path.join(out,'robots.txt'),'User-agent: *\nDisallow: /\n');
// Original gameplay bytes must remain exact, including any future source additions.
const gameplay=['app.js','game.css','game-release-polish.css','ribbon-ui.css','app/game/board.js','app/game/input.js','app/game/hints.js','app/game/state.js','app/game/fair-play.js'];
const hashes=gameplay.map(file=>{const bytes=fs.readFileSync(path.join(source,file)),generated=fs.readFileSync(path.join(out,file));if(!bytes.equals(generated))throw Error('Gameplay modified in preview: '+file);return {file,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}});
const manifest={builtAt:new Date().toISOString(),sourceSha:sha,output:out,files:files.length,gameplay:hashes,fixturesOnly:true};
fs.writeFileSync(path.join(out,'studio-fixtures/build-info.json'),JSON.stringify({...manifest,output:undefined},null,2));
console.log(JSON.stringify(manifest,null,2));
