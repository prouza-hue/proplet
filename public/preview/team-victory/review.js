'use strict';
const frame=document.getElementById('previewFrame'),viewport=document.getElementById('viewport'),theme=document.getElementById('theme'),motion=document.getElementById('motion');
function resize(){const width=Number(viewport.value);frame.width=width;frame.height=width===390?844:width===360?740:900;}
function load(){const query=new URLSearchParams({theme:theme.value,motion:motion.checked?'reduce':'auto'});frame.src='/preview/team-victory/app.html?'+query;document.getElementById('direct').href=frame.src;}
viewport.onchange=resize;theme.onchange=load;motion.onchange=load;
document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>frame.contentWindow.postMessage({propletPreview:true,action:b.dataset.action},location.origin));
