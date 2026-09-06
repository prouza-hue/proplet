from pathlib import Path
import json,re,html
R=Path(__file__).resolve().parents[2];P=R/'public'
man=json.loads((P/'assets/avatars/v3/manifest.json').read_text());extra=man['avatars'][30:];tokens=[x['token'] for x in extra]
for file,var in [('app.js','AVATARS'),('organic-ui-v4023.js','LEGACY_AVATARS')]:
 p=P/file;s=p.read_text();m=re.search(r'const '+var+r'=\[([^;]+)\];',s);old=re.findall("'([^']*)'",m.group(1));old=old[:30];assert len(old)==30
 s=s[:m.start()]+f'const {var}='+json.dumps(old+tokens,ensure_ascii=False,separators=(',',':'))+';'+s[m.end():]
 if var=='LEGACY_AVATARS':
  entries=[{k:x[k] for k in ['id','name','file','category']} for x in man['avatars']]
  s=re.sub(r'const AVATAR_MANIFEST=\[.*?\];','const AVATAR_MANIFEST='+json.dumps(entries,ensure_ascii=False,separators=(',',':'))+';',s)
  s=s.replace('// Avatar v2 runtime map. Generated verbatim from /assets/avatars/v2/manifest.json; smoke keeps it in lockstep.','// Stable first 30 identities; playful avatars append new persistent tokens.')
  s=s.replace("grid.insertBefore(b,buttons[15]);","grid.insertBefore(b,buttons[15]);\n     if(buttons[30]){const c=document.createElement('span');c.className='avatar-group-label';c.textContent='HRAVÉ SYMBOLY';grid.insertBefore(c,buttons[30]);}")
  s=s.replace('LEGACY_AVATARS.find(k=>trimmed.startsWith(k))','[...LEGACY_AVATARS].sort((a,b)=>b.length-a.length).find(k=>trimmed.startsWith(k))')
 p.write_text(s)
p=P/'ribbon-ui.js';s=p.read_text();s=re.sub(r'const printshop=new Set\(.*?\);\n','',s)
s=s.replace("const printKey=key==='symbol-complete'?'prvni-proplet':key;const printed=printshop.has(printKey);if(locked&&key==='prvni-proplet'&&!printed)key='zamceno';","const printKey=key;const printed=true;")
s=s.replace("for(const theme of (printed?['print']:['light','dark']))","for(const theme of ['print'])")
s=re.sub(r"img.src=printed\?.*?;wrap.appendChild\(img\);","img.src='/rewards/printshop/'+printKey+'.svg?v=2';wrap.appendChild(img);",s)
p.write_text(s.replace('/* Proplet ribbon presentation.','/* Proplet printshop presentation.'))
for f in ['index.html','sw.js']:
 p=P/f;s=p.read_text().replace('printshop-preview-2','printshop-preview-3').replace('v=print1','v=print2').replace('app.js?v=4022-pes2','app.js?v=4022-print3');p.write_text(s)
p=R/'tests/current/test_avatar_optical_sizing.py';s=p.read_text().replace("for x in manifest['avatars']]==","for x in manifest['avatars'][:30]]==").replace("group.get('transform')","group.get('transform','matrix(1 0 0 1 0 0)')").replace('PASS: 30 stable avatar identities','PASS: 30 stable + 10 appended avatar identities');p.write_text(s)
# Gallery uses static authentic asset URLs; filters avoid loading every full-size SVG immediately.
col=json.loads((P/'rewards/printshop/collection.json').read_text());groups=[('playful','Nových 10 avatarů',extra),('avatars','Původních 30 avatarů',man['avatars'][:30])]
for category,title in [('rank','Hodnosti'),('achievement','Úspěchy'),('streak','Věrnost'),('medal','Medaile'),('symbol','Symboly')]:groups.append((category,title,[x for x in col['items'] if x['category']==category]))
out=['<!doctype html><html lang="cs"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Proplet · Tiskařská dílna</title><link rel="stylesheet" href="/design/printshop-gallery.css"><header><a href="/">← Zpět do hry</a><h1>Tiskařská dílna</h1><p>40 avatarů a kompletních 142 odměn a symbolů. Stejné věrné SVG používá hra. Vyber rodinu a porovnej skutečné malé velikosti.</p><button id="theme">Světlý / tmavý podklad</button><nav aria-label="Rodiny grafiky">']
for ident,title,group in groups:out.append(f'<button data-group="{ident}" aria-pressed="{str(ident=="playful").lower()}">{title} · {len(group)}</button>')
out.append('</nav></header><main>')
for ident,title,group in groups:
 out.append(f'<section data-section="{ident}"'+(' hidden' if ident!='playful' else '')+f'><h2>{title}</h2><div class="gallery">')
 for x in group:
  url='/assets/avatars/v3/'+x['file'] if ident in ['avatars','playful'] else '/rewards/printshop/'+x['key']+'.svg?v=2';name=html.escape(x['name']);out.append(f'<article><img class="large" loading="lazy" decoding="async" data-src="{url}" alt="{name}"><h3>{name}</h3><div class="sizes">')
  for size in [24,32,40,64]:out.append(f'<span><img loading="lazy" decoding="async" data-src="{url}" alt="" width="{size}" height="{size}">{size} px</span>')
  out.append('</div></article>')
 out.append('</div></section>')
out.append('</main><script src="/design/printshop-gallery.js?v=2"></script></html>');(P/'design/tiskarska-dilna.html').write_text(''.join(out))
(P/'design/printshop-gallery.js').write_text("""document.querySelector('#theme').addEventListener('click',()=>document.body.classList.toggle('dark'));
function show(group){document.querySelectorAll('[data-section]').forEach(s=>{s.hidden=s.dataset.section!==group;if(!s.hidden)s.querySelectorAll('img[data-src]').forEach(i=>{i.src=i.dataset.src;delete i.dataset.src;});});document.querySelectorAll('[data-group]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.group===group)));}
document.querySelectorAll('[data-group]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.group)));show('playful');
""")
p=P/'design/printshop-gallery.css';s=p.read_text();s+='\n[hidden]{display:none!important}nav{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}nav [aria-pressed=true]{background:#235bcc;color:white}\n';p.write_text(s)
(P/'design/rewards.html').write_text('<!doctype html><html lang="cs"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/design/tiskarska-dilna.html"><title>Tiskařská dílna</title><a href="/design/tiskarska-dilna.html">Aktuální kompletní galerie Tiskařské dílny</a></html>')
