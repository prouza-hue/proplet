document.querySelector('#theme').addEventListener('click',()=>document.body.classList.toggle('dark'));
function show(group){document.querySelectorAll('[data-section]').forEach(s=>{s.hidden=s.dataset.section!==group;if(!s.hidden)s.querySelectorAll('img[data-src]').forEach(i=>{i.src=i.dataset.src;delete i.dataset.src;});});document.querySelectorAll('[data-group]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.group===group)));}
document.querySelectorAll('[data-group]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.group)));show('playful');
