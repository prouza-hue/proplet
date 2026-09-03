(function organicPropletUI(){
'use strict';
const ICONS={
  close:'<path d="M6 6l12 12M18 6L6 18"/>',
  trophy:'<path d="M8 4h8v4a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5v1a4 4 0 0 0 4 4M16 6h3v1a4 4 0 0 1-4 4M12 12v4M8 20h8M9 16h6"/>',
  user:'<circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.5-4 2.7-6 6.5-6s6 2 6.5 6"/>',
  bulb:'<path d="M9 18h6M10 22h4"/><path d="M8.2 14.5A6 6 0 1 1 15.8 14.5c-.9.8-1.3 1.6-1.3 2.5h-5c0-.9-.4-1.7-1.3-2.5Z"/>',
  refresh:'<path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M18.7 9A7 7 0 0 0 6 6.7L4 9M5.3 15A7 7 0 0 0 18 17.3l2-2.3"/>',
  heart:'<path d="M20.8 5.8a5 5 0 0 0-7.1 0L12 7.5l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21l8.8-8.1a5 5 0 0 0 0-7.1Z"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  phone:'<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  lifebuoy:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="m5.6 5.6 4.3 4.3m4.2 4.2 4.3 4.3m0-12.8-4.3 4.3m-4.2 4.2-4.3 4.3"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M5 21h14"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  vibration:'<path d="M8 6h8v12H8zM4 8v8M20 8v8M2 10v4M22 10v4"/>',
  play:'<path d="m8 5 11 7-11 7V5Z"/>',
  cloud:'<path d="M7 18h10a4 4 0 0 0 .6-8A6 6 0 0 0 6.2 8.5 4.5 4.5 0 0 0 7 18Z"/>',
  flag:'<path d="M5 21V4m0 1h10l-2 3 2 3H5"/>',
  eye:'<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  flame:'<path d="M12 22c4 0 7-3 7-7 0-5-4-7-5-11-3 2-5 5-4 8-2-1-3-3-3-5-2 2-3 5-2 8 1 4 3 7 7 7Z"/>',
  leaf:'<path d="M20 4C12 4 5 8 5 15c0 3 2 5 5 5 7 0 10-8 10-16Z"/><path d="M5 20c3-5 6-8 11-11"/>',
  backpack:'<path d="M8 7V5a4 4 0 0 1 8 0v2M6 8h12l1 13H5L6 8Z"/><path d="M9 13h6"/>',
  brain:'<path d="M9 5a3 3 0 0 0-5 2 3 3 0 0 0 1 5 3 3 0 0 0 4 5v2M15 5a3 3 0 0 1 5 2 3 3 0 0 1-1 5 3 3 0 0 1-4 5v2M9 5c1 1 1 2 0 3m6-3c-1 1-1 2 0 3M9 12c1-1 2-1 3 0m3 0c-1-1-2-1-3 0M12 3v18"/>',
  puzzle:'<path d="M8 3h5v4a2 2 0 1 0 4 0V3h4v6h-4a2 2 0 1 0 0 4h4v8h-8v-4a2 2 0 1 0-4 0v4H3v-8h4a2 2 0 1 0 0-4H3V3h5Z"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  shield:'<path d="M12 3 20 6v5c0 5-3 8-8 10-5-2-8-5-8-10V6l8-3Z"/><path d="m9 12 2 2 4-4"/>',
  calm:'<circle cx="12" cy="12" r="8"/><path d="M8 10c1.5-1 2.5-1 4 0s2.5 1 4 0M8 14c1.5-1 2.5-1 4 0s2.5 1 4 0"/>',
  sword:'<path d="m14 4 6-2-2 6-9 9-3-3 8-10ZM5 15l4 4M3 21l4-4"/>',
  sun:'<circle cx="12" cy="12" r="3.5"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"/>',
  users:'<path d="M16 20v-1.5c0-2.5-2-4.5-4.5-4.5h-3C6 14 4 16 4 18.5V20"/><circle cx="10" cy="7.5" r="3"/><path d="M17 10a2.7 2.7 0 1 0-1-5.2M18 14c1.7.7 2.8 2.3 2.8 4.2V20"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  eyeOff:'<path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A11 11 0 0 1 12 5c6.5 0 10 7 10 7a16 16 0 0 1-3 3.8M6.6 6.6C3.6 8.4 2 12 2 12s3.5 7 10 7c1.2 0 2.3-.2 3.3-.6"/>',
  tool:'<path d="M14.7 6.3a4 4 0 0 0-5-5l2.4 2.4-3.4 3.4-2.4-2.4a4 4 0 0 0 5 5L18 16.4a2 2 0 1 0 2.8-2.8l-6.1-7.3Z"/>',
  circle:'<circle cx="12" cy="12" r="7"/>'
};
const MAP=new Map([
 ['🏆','trophy'],['⚙️','tool'],['⚙','tool'],['👤','user'],['💡','bulb'],['🔄','refresh'],['❤️','heart'],['❤','heart'],
 ['🔔','bell'],['📲','phone'],['🛟','lifebuoy'],['⬇️','download'],['⬇','download'],['🔍','search'],['📳','vibration'],['▶️','play'],['▶','play'],
 ['☁️','cloud'],['☁','cloud'],['⚑','flag'],['👁️','eye'],['👁','eye'],['🔥','flame'],['🌱','leaf'],['🎒','backpack'],['🧠','brain'],
 ['🧩','puzzle'],['🎯','target'],['🛡️','shield'],['🛡','shield'],['🫧','calm'],['⚔️','sword'],['⚔','sword'],['☀️','sun'],['☀','sun'],
 ['👥','users'],['✓','check'],['🛠️','tool'],['🛠','tool'],['💻','tool'],['🏁','flag'],['🔦','bulb'],['🧭','target'],['🎓','user'],
 ['🐣','leaf'],['🧒','user'],['🤯','brain'],['✨','circle'],['✦','circle'],['🙂','user'],['🥇','trophy'],['🥈','trophy'],['🥉','trophy']
]);
function svgIcon(name){
 const span=document.createElement('span');span.className='ui-icon';span.setAttribute('aria-hidden','true');
 span.innerHTML='<svg viewBox="0 0 24 24" focusable="false">'+(ICONS[name]||ICONS.circle)+'</svg>';return span;
}
function initials(name){
 const clean=(name||'').trim().replace(/\s+/g,' ');if(!clean)return 'HR';
 const parts=clean.split(' ').filter(Boolean);
 const out=parts.length>1?parts[0][0]+parts[parts.length-1][0]:parts[0].slice(0,2);
 return out.toLocaleUpperCase('cs-CZ');
}
function setInitials(el,name){
 if(!el)return;const val=initials(name);if(el.textContent!==val)el.textContent=val;el.dataset.initialsAvatar='1';el.setAttribute('aria-label',name?('Avatar '+name):'Avatar hráče');
}
function applyInitials(){
 const chip=document.getElementById('profileChipAvatar'),chipName=document.getElementById('profileChipText')?.textContent;
 setInitials(chip,chipName||'Hráč');
 document.querySelectorAll('.profile-avatar-big').forEach(el=>setInitials(el,el.closest('.profile-card,.profile-summary')?.querySelector('.profile-name')?.textContent||chipName||'Hráč'));
 const preview=document.getElementById('rankingPrivacyPreviewAvatar');if(preview)setInitials(preview,document.getElementById('rankingPrivacyPreviewName')?.textContent||chipName||'Hráč');
 document.querySelectorAll('.home-ranking-row,.leader-row,.leaderboard-row,.ranking-row').forEach(row=>{
   const av=row.querySelector('.home-ranking-avatar,.leader-avatar,.leaderboard-avatar,.ranking-avatar,[class*="ranking-avatar"]');
   const name=row.querySelector('strong,.leader-name,.ranking-name')?.textContent;if(av&&name)setInitials(av,name.replace(/\bTy\b/g,'').trim());
 });
}
function iconizeCloseButtons(){
 document.querySelectorAll('.modal-close,.release-notes-v3331-close').forEach(btn=>{
   if(btn.querySelector('.ui-icon'))return;btn.replaceChildren(svgIcon('close'));btn.classList.add('ui-icon-only');
 });
}
const pictographic=/\p{Extended_Pictographic}/u;
function keyAt(text){
 for(const [key,name] of MAP){const i=text.indexOf(key);if(i>=0)return {key,name,i};}
 const m=text.match(pictographic);return m?{key:m[0],name:'circle',i:m.index}:null;
}
function replaceEmojiTextNode(node){
 let text=node.nodeValue||'';const hit=keyAt(text);if(!hit)return false;
 const frag=document.createDocumentFragment();let cursor=0;
 while(cursor<text.length){
   const segment=text.slice(cursor);const h=keyAt(segment);
   if(!h){if(segment)frag.append(document.createTextNode(segment));break}
   if(h.i)frag.append(document.createTextNode(segment.slice(0,h.i)));
   frag.append(svgIcon(h.name));cursor+=h.i+h.key.length;
 }
 node.parentNode?.replaceChild(frag,node);return true;
}
function replaceVisibleEmoji(root=document.body){
 if(!root)return;
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){
   const p=node.parentElement;if(!p||p.closest('script,style,svg,textarea,option'))return NodeFilter.FILTER_REJECT;
   return keyAt(node.nodeValue||'')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
 }});
 const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);nodes.forEach(replaceEmojiTextNode);
}
function updateFooter(){
 const footer=document.querySelector('.app-footer');if(!footer)return;
 const line=footer.querySelector('span');if(line)line.textContent='© 2026 Proplet · Česká slovní hra';
 const author=footer.querySelector('strong');if(author)author.hidden=true;
}
function updateThemeMeta(){
 const meta=document.querySelector('meta[name="theme-color"]');if(!meta)return;
 meta.dataset.lightColor='#FDFBF7';if(document.documentElement.dataset.theme!=='dark')meta.setAttribute('content','#FDFBF7');
}
let queued=false;
function apply(){
 queued=false;applyInitials();iconizeCloseButtons();replaceVisibleEmoji();updateFooter();updateThemeMeta();
}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(apply)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
})();