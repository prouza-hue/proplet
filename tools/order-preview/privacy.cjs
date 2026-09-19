/* Preview finalization: don't load marketing or hosted analytics entry points. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../.vercel/output/static'),file=path.join(root,'index.html');
let html=fs.readFileSync(file,'utf8');
const entries=['/analytics-init.js','/_vercel/insights/script.js','/_vercel/speed-insights/script.js','/app/marketing.js'];
for(const entry of entries){let removed=0;html=html.replace(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>\s*<\/script>/g,(tag,src)=>{if(src.split('?')[0]!==entry)return tag;removed++;return ''});assert.equal(removed,1,'Expected marketing/analytics entry: '+entry)}
html=html.replace(/<button\b[^>]*data-marketing-settings[^>]*>[\s\S]*?<\/button>/g,'');
fs.writeFileSync(file,html);
const manifestPath=path.join(root,'order-manifest.json'),manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
manifest.previewCommit=process.env.VERCEL_GIT_COMMIT_SHA||process.env.GITHUB_SHA||null;
manifest.marketingEntryPointsRemoved=entries;
manifest.introSelection='Provisional intro from first 25 released Gen5 boards: measured difficultyScore when present, otherwise original published order. Not final editorial approval.';
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2));fs.writeFileSync(path.join(root,'order-manifest.js'),'window.PROPLET_ORDER_MANIFEST='+JSON.stringify(manifest)+';\n');
console.log('PREVIEW PRIVACY PASS: no marketing, consent banner or hosted analytics entry points');
