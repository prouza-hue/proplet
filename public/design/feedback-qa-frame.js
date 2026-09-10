const params=new URLSearchParams(location.search),frame=document.querySelector('#qa');
frame.width=params.get('width')||390;frame.height=params.get('height')||844;
fetch('/?layoutQaBuild=fold12').then(r=>r.text()).then(html=>{frame.srcdoc=html.replace('<head>','<head><script src="/design/feedback-qa-runtime.js?v=fold12"></script>')});
