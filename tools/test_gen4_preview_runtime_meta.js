'use strict';

const fs=require('fs');
const vm=require('vm');
const path=require('path');

const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'public/runtime-meta.js'),'utf8');
const appSource=fs.readFileSync(path.join(root,'public/app.js'),'utf8');

function load(hostname){
  const window={addEventListener:()=>{}};
  const document={readyState:'loading',querySelector:()=>null,body:{appendChild:()=>{}},createElement:()=>({dataset:{}})};
  const location={hostname,origin:`https://${hostname}`,href:`https://${hostname}/`};
  vm.runInNewContext(source,{window,document,location,localStorage:{getItem:()=>null}});
  return window.PROPLET_RUNTIME_META;
}

const branch='proplet-git-agent-v3340-medium-ca-024677-pavel-prouzas-projects.vercel.app';
const preview=load(branch);
const production=load('hrajproplet.cz');
if(preview.version!=='4.00.9'||preview.gen4CandidatePreview!==true)throw new Error('Preview runtime metadata mismatch');
if(production.version!=='4.00.9'||production.gen4CandidatePreview!==false)throw new Error('Production runtime metadata mismatch');
if(appSource.includes("fetch('/api/health'"))throw new Error('Puzzle boot still waits for the health endpoint');
console.log('Gen4 preview runtime metadata verified without a production boot round-trip.');
