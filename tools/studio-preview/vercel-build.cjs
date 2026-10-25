/* Hosting-only branch: compile the real application and local fixture adapter.
 * No Python runtime, database access, functions, crons or production deployment. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
if(process.env.VERCEL_ENV==='production')throw Error('Studio review must only be deployed as Preview');
const repo=path.resolve(__dirname,'../..');
const staged=fs.mkdtempSync(path.join(os.tmpdir(),'proplet-studio-vercel-'));
const generated=path.join(staged,'static');
execFileSync(process.execPath,[path.join(__dirname,'build.cjs'),generated],{cwd:repo,stdio:'inherit'});
execFileSync(process.execPath,[path.join(__dirname,'verify.cjs'),generated],{cwd:repo,stdio:'inherit'});
const destination=path.join(repo,'.studio-preview');
if(fs.existsSync(destination))throw Error('Use a fresh build directory; refusing to mix preview outputs');
fs.cpSync(generated,destination,{recursive:true});
fs.writeFileSync(path.join(destination,'preview-hosting.json'),JSON.stringify({kind:'isolated-studio-preview',database:false,functions:false,productionWrites:false,sourceSha:JSON.parse(fs.readFileSync(path.join(destination,'studio-fixtures/build-info.json'))).sourceSha})+'\n');
console.log('Static Studio preview ready; no backend functions or database bindings.');
