const params=new URLSearchParams(location.search),frame=document.querySelector('#qa');
frame.width=params.get('width')||390;frame.height=params.get('height')||844;
fetch('/').then(r=>r.text()).then(html=>{frame.srcdoc=html.replace('<head>','<head><script src="/design/feedback-qa-runtime.js?v=10"></script>')});
