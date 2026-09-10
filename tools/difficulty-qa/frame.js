const width=Number(new URLSearchParams(location.search).get('width'))||390;document.querySelector('#qa').style.width=width+'px';

fetch('/?iconsQa=fix19',{cache:'no-store'}).then(r=>r.text()).then(html=>document.querySelector('#qa').srcdoc=html);
