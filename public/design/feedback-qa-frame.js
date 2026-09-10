const params=new URLSearchParams(location.search),frame=document.querySelector('#qa');
frame.width=params.get('width')||390;frame.height=params.get('height')||844;
fetch('/?layoutQaBuild=fold13').then(r=>r.text()).then(html=>{frame.srcdoc=html.replace('<head>','<head><link rel="stylesheet" href="/design/feedback-qa.css?v=fold13"><script src="/design/feedback-qa-runtime.js?v=fold13"></script>')});
