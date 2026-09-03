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
  star:'<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>',
  bolt:'<path d="m13 2-8 12h6l-1 8 9-13h-6V2Z"/>',
  crown:'<path d="m4 8 4 4 4-7 4 7 4-4-2 11H6L4 8Z"/><path d="M7 22h10"/>',
  gem:'<path d="m7 4-4 6 9 11 9-11-4-6H7Z"/><path d="M3 10h18M8 4l4 6 4-6M8 10l4 11 4-11"/>',
  medal:'<circle cx="12" cy="14" r="5"/><path d="m9 9-3-7h5l1 4 1-4h5l-3 7"/>',
  calendar:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/><path d="m9 15 2 2 4-4"/>',
  compass:'<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>',
  book:'<path d="M4 5c3-1 5 0 8 2v14c-3-2-5-3-8-2V5ZM20 5c-3-1-5 0-8 2v14c3-2 5-3 8-2V5Z"/>',
  key:'<circle cx="8" cy="12" r="4"/><path d="M12 12h9M17 12v3M20 12v2"/>',
  mountain:'<path d="m3 20 7-12 3 5 2-3 6 10H3Z"/><path d="m8 12 2 2 2-2"/>',
  snow:'<path d="M12 2v20M4.5 6.5l15 11M19.5 6.5l-15 11M9 4l3 3 3-3M9 20l3-3 3 3"/>',
  music:'<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  home:'<path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10M9 20v-6h6v6"/>',
  rocket:'<path d="M14 4c3-2 5-2 6-2 0 1 0 3-2 6l-6 6-4-4 6-6Z"/><path d="m8 10-4 1-2 4 6-1M12 14l-1 6-4 2 1-8"/><circle cx="15.5" cy="6.5" r="1.5"/>',
  circle:'<circle cx="12" cy="12" r="7"/>'
};
const MAP=new Map([
 ['🏆','trophy'],['⚙️','tool'],['⚙','tool'],['👤','user'],['💡','bulb'],['🔄','refresh'],['❤️','heart'],['❤','heart'],
 ['🔔','bell'],['📲','phone'],['🛟','lifebuoy'],['⬇️','download'],['⬇','download'],['🔍','search'],['📳','vibration'],['▶️','play'],['▶','play'],
 ['☁️','cloud'],['☁','cloud'],['⚑','flag'],['👁️','eye'],['👁','eye'],['🔥','flame'],['🌱','leaf'],['🎒','backpack'],['🧠','brain'],
 ['🧩','puzzle'],['🎯','target'],['🛡️','shield'],['🛡','shield'],['🫧','calm'],['⚔️','sword'],['⚔','sword'],['☀️','sun'],['☀','sun'],
 ['👥','users'],['✓','check'],['🛠️','tool'],['🛠','tool'],['💻','tool'],['🏁','flag'],['🔦','bulb'],['🧭','target'],['🎓','user'],
 ['🐣','leaf'],['🧒','user'],['🤯','brain'],['✨','star'],['✦','star'],['🙂','user'],['🥇','trophy'],['🥈','medal'],['🥉','medal'],
 ['⭐','star'],['🌟','star'],['🏅','medal'],['👑','crown'],['💎','gem'],['⚡','bolt'],['🚀','rocket'],['🦉','book'],
 ['🔎','search'],['🧵','puzzle'],['🪢','puzzle'],['↪️','refresh'],['♟️','target'],['🧶','puzzle'],['🛤️','compass'],['🐉','shield'],
 ['🌀','refresh'],['🧱','shield'],['🥷','shield'],['⚗️','tool'],['🐌','calm'],['🔮','star'],['🌌','star'],['🏰','shield'],['🎓','book'],
 ['🪄','star'],['🗿','shield'],['♾️','refresh'],['🌠','star'],['🛰️','rocket'],['🗝️','key'],['🕸️','puzzle'],
 ['🖐️','users'],['🔟','target'],['💯','target'],['🚂','rocket'],['🏃','bolt'],['🌿','leaf'],['🌳','leaf'],['🏡','home'],
 ['🌲','leaf'],['🤔','brain'],['🧐','search'],['🧬','brain'],['🧨','bolt'],['💥','bolt'],['🦾','shield'],['⛏️','tool'],['⚒️','tool'],
 ['🍽️','circle'],['🌤️','sun'],['🌞','sun'],['🌻','sun'],['🌍','compass'],['💭','brain'],['📜','book'],['🕳️','circle'],
 ['👍','check'],['🏺','gem'],['🧼','calm'],['🦅','compass'],['🪞','eye']
]);
function svgIcon(name){
 const span=document.createElement('span');span.className='ui-icon';span.setAttribute('aria-hidden','true');
 span.innerHTML='<svg viewBox="0 0 24 24" focusable="false">'+(ICONS[name]||ICONS.circle)+'</svg>';return span;
}
const LEGACY_AVATARS=['🙂','😎','🤓','🥳','🦊','🐱','🐶','🐼','🐯','🦁','🐸','🐵','🦄','🐲','🦖','🐙','🦉','🐝','🦋','🐧','🚀','⚡','🔥','🌈','🍕','⚽','🎮','🧩','🤯','👑'];
const AVATAR_NAMES=['Vynálezce','Botanička','Badatel','Řemeslnice','Kapitán','Snílka','Strážce','Posel','Mechanik','Bard','Učenka','Hraničářka','Polárník','Gentleman','Čarodějka'];
const AVATAR_COUNT=15;
function legacyAvatarIndex(value){return LEGACY_AVATARS.indexOf(String(value||'').trim())}
function visualAvatarIndex(value){
 const i=legacyAvatarIndex(value);return i<0?-1:i%AVATAR_COUNT;
}
function avatarNode(index,label='Herní avatar'){
 const n=document.createElement('span'),safe=Math.max(0,Math.min(15,Number(index)||0)),row=Math.floor(safe/4)+1,col=safe%4;
 n.className=`organic-avatar oa-row-${row} oa-col-${col}`;n.dataset.avatarIndex=String(safe);n.setAttribute('role','img');n.setAttribute('aria-label',label);return n;
}
function profileState(){try{return typeof getProfile==='function'?getProfile():null}catch{return null}}
function decorateAvatarElement(el,key,label){
 if(!el||el.querySelector('img.google-profile-avatar'))return false;
 const raw=String(key??el.dataset.organicAvatarKey??el.textContent??'').trim();
 const idx=visualAvatarIndex(raw);if(idx<0)return false;
 if(el.dataset.organicAvatarKey===raw&&el.querySelector('.organic-avatar'))return true;
 el.dataset.organicAvatarKey=raw;el.classList.add('organic-avatar-host');el.replaceChildren(avatarNode(idx,label||AVATAR_NAMES[idx]||'Herní avatar'));return true;
}
function decorateAvatarPickers(){
 const p=profileState(),current=visualAvatarIndex(p?.avatar||'🙂');
 document.querySelectorAll('.avatar-choice').forEach(btn=>{
   const raw=String(btn.dataset.avatar||'').trim(),legacy=legacyAvatarIndex(raw);
   if(legacy<0)return;
   const idx=legacy%AVATAR_COUNT,duplicate=legacy>=AVATAR_COUNT;
   btn.classList.toggle('organic-avatar-duplicate',duplicate);
   if(duplicate){btn.tabIndex=-1;btn.setAttribute('aria-hidden','true');return}
   btn.removeAttribute('aria-hidden');btn.tabIndex=0;btn.dataset.organicAvatarKey=raw;
   btn.classList.toggle('selected',idx===current);
   btn.setAttribute('aria-label',`Avatar: ${AVATAR_NAMES[idx]}`);btn.title=AVATAR_NAMES[idx];
   if(!btn.querySelector('.organic-avatar'))btn.replaceChildren(avatarNode(idx,AVATAR_NAMES[idx]));
 });
}
function decorateInlineLeaderboardAvatars(){
 document.querySelectorAll('.leader-name>strong').forEach(strong=>{
   if(strong.querySelector('.organic-avatar'))return;
   const first=strong.firstChild;if(!first||first.nodeType!==Node.TEXT_NODE)return;
   const text=first.nodeValue||'';
   const key=LEGACY_AVATARS.find(k=>text.trimStart().startsWith(k));if(!key)return;
   first.nodeValue=text.replace(key,'').replace(/^\\s+/,'');
   const host=document.createElement('span');host.className='ranking-avatar organic-avatar-host';host.dataset.organicAvatarKey=key;host.appendChild(avatarNode(visualAvatarIndex(key),'Herní avatar'));
   strong.prepend(host);
 });
}
function applyAvatars(){
 const p=profileState();
 const chip=document.getElementById('profileChipAvatar');
 if(p&&!p.useGoogleAvatar)decorateAvatarElement(chip,p.avatar||'🙂',`Avatar hráče ${p.name||''}`);
 else if(!p&&chip&&!chip.querySelector('.organic-avatar')){chip.classList.add('organic-avatar-host');chip.replaceChildren(avatarNode(15,'Profil zatím není uložen'))}
 if(p&&!p.useGoogleAvatar)document.querySelectorAll('.profile-avatar-big').forEach(el=>decorateAvatarElement(el,p.avatar||'🙂',`Avatar hráče ${p.name||''}`));
 const preview=document.getElementById('rankingPrivacyPreviewAvatar');if(preview&&p)decorateAvatarElement(preview,p.avatar||'🙂','Tvůj veřejný herní avatar');
 document.querySelectorAll('.home-ranking-avatar,.leader-avatar,.leaderboard-avatar,.ranking-avatar').forEach(el=>decorateAvatarElement(el,null,'Herní avatar'));
 decorateInlineLeaderboardAvatars();decorateAvatarPickers();
 const privateIcon=document.querySelector('.settings-privacy-icon');if(privateIcon&&profileState()?.publicRankings===false&&!privateIcon.querySelector('.organic-avatar')){privateIcon.replaceChildren(avatarNode(15,'Anonymní hráč'));privateIcon.classList.add('organic-private-avatar')}
}
function emblemSpec(key){
 const specs={
 '🥇':['trophy','amber'],'🥈':['medal','blue'],'🥉':['medal','clay'],'🏆':['trophy','amber'],'👑':['crown','amber'],'⭐':['star','amber'],'🌟':['star','amber'],'🏅':['medal','amber'],
 '🔥':['flame','coral'],'⚡':['bolt','coral'],'❤️':['heart','clay'],'❤':['heart','clay'],'💎':['gem','blue'],'🚀':['rocket','blue'],'🦉':['book','blue'],
 '🧠':['brain','blue'],'🤯':['brain','coral'],'🌱':['leaf','sage'],'🍀':['leaf','sage'],'🧭':['compass','blue'],'🔍':['search','blue'],'📚':['book','blue'],'📖':['book','blue'],
 '📅':['calendar','sage'],'🗓️':['calendar','sage'],'🔑':['key','amber'],'⛰️':['mountain','clay'],'🏔️':['mountain','blue'],'❄️':['snow','blue'],'🎵':['music','mauve'],'🎶':['music','mauve'],
 '✨':['star','mauve'],'💡':['bulb','amber'],'🛟':['lifebuoy','coral'],'👥':['users','sage'],'🛡️':['shield','sage'],'🎯':['target','coral'],'🧩':['puzzle','blue']
 };
 return specs[key]||null;
}
function emblemForEmoji(key){
 const spec=emblemSpec(key)||[MAP.get(key)||'star','ivory'];const span=document.createElement('span');span.className=`organic-emblem tone-${spec[1]}`;span.dataset.sourceEmoji=key;span.appendChild(svgIcon(spec[0]));return span;
}
function isEmblemContext(parent){return !!parent?.closest('.profile-badge,.level-step-icon,.profile-rank-icon,.achievement-summary-icons,.achievement-peek,.achievement-card,.achievement,.home-ranking-medal,.ranking-rank-chip,.streak-bubble,.profile-completion-grid')}
function iconizeCloseButtons(){
 document.querySelectorAll('.modal-close,.release-notes-v3331-close').forEach(btn=>{
   if(btn.querySelector('.ui-icon'))return;btn.replaceChildren(svgIcon('close'));btn.classList.add('ui-icon-only');
 });
}
const pictographic=/\p{Extended_Pictographic}/gu;
const NON_UI_PICTOGRAPHS=new Set(['©','®','™']);
function keyAt(text){
 for(const [key,name] of MAP){const i=text.indexOf(key);if(i>=0)return {key,name,i};}
 pictographic.lastIndex=0;
 let m;while((m=pictographic.exec(text))){if(!NON_UI_PICTOGRAPHS.has(m[0]))return {key:m[0],name:'circle',i:m.index}}
 return null;
}
function replaceEmojiTextNode(node){
 let text=node.nodeValue||'';const hit=keyAt(text);if(!hit)return false;
 const frag=document.createDocumentFragment();let cursor=0;
 while(cursor<text.length){
   const segment=text.slice(cursor);const h=keyAt(segment);
   if(!h){if(segment)frag.append(document.createTextNode(segment));break}
   if(h.i)frag.append(document.createTextNode(segment.slice(0,h.i)));
   frag.append(isEmblemContext(node.parentElement)?emblemForEmoji(h.key):svgIcon(h.name));cursor+=h.i+h.key.length;
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
 const line=footer.querySelector('span');if(line&&line.textContent!=='© 2026 Proplet · Česká slovní hra')line.textContent='© 2026 Proplet · Česká slovní hra';
 const author=footer.querySelector('strong');if(author&&!author.hidden)author.hidden=true;
}
function updateThemeMeta(){
 const meta=document.querySelector('meta[name="theme-color"]');if(!meta)return;
 meta.dataset.lightColor='#FDFBF7';if(document.documentElement.dataset.theme!=='dark')meta.setAttribute('content','#FDFBF7');
}
let queued=false;
function apply(){
 queued=false;applyAvatars();iconizeCloseButtons();replaceVisibleEmoji();updateFooter();updateThemeMeta();
}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(apply)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
})();