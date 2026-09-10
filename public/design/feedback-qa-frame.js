const params=new URLSearchParams(location.search),frame=document.querySelector('#qa');
frame.width=params.get('width')||390;frame.height=params.get('height')||844;
fetch('/?layoutQaBuild=fix16').then(r=>r.text()).then(html=>{frame.srcdoc=html.replace('<head>','<head><link rel="stylesheet" href="/design/feedback-qa.css?v=fix16"><script src="/design/feedback-qa-runtime.js?v=fix16"></script>')});
