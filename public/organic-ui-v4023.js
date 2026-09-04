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
// Avatar v2 runtime map. Generated verbatim from /assets/avatars/v2/manifest.json; smoke keeps it in lockstep.
const AVATAR_MANIFEST=[{"id":0,"name":"Liška","file":"liska.svg","category":"forest"},{"id":1,"name":"Sova","file":"sova.svg","category":"forest"},{"id":2,"name":"Ježek","file":"jezek.svg","category":"forest"},{"id":3,"name":"Medvěd","file":"medved.svg","category":"forest"},{"id":4,"name":"Jelen","file":"jelen.svg","category":"forest"},{"id":5,"name":"Srna","file":"srna.svg","category":"forest"},{"id":6,"name":"Jezevec","file":"jezevec.svg","category":"forest"},{"id":7,"name":"Veverka","file":"veverka.svg","category":"forest"},{"id":8,"name":"Mýval","file":"myval.svg","category":"forest"},{"id":9,"name":"Kočka","file":"kocka.svg","category":"forest"},{"id":10,"name":"Vlk","file":"vlk.svg","category":"forest"},{"id":11,"name":"Mourek","file":"mourek.svg","category":"forest"},{"id":12,"name":"Zajíc","file":"zajic.svg","category":"forest"},{"id":13,"name":"Králík","file":"kralik.svg","category":"forest"},{"id":14,"name":"Myška","file":"myska.svg","category":"forest"},{"id":15,"name":"Klubko","file":"klubko.svg","category":"craft"},{"id":16,"name":"Háček","file":"hacek.svg","category":"craft"},{"id":17,"name":"Písmeno P","file":"pismeno-p.svg","category":"craft"},{"id":18,"name":"Pletené brýle","file":"pletene-bryle.svg","category":"craft"},{"id":19,"name":"Kniha s copem","file":"kniha-s-copem.svg","category":"craft"},{"id":20,"name":"Kniha se stehem","file":"kniha-se-stehem.svg","category":"craft"},{"id":21,"name":"Hrnek v svetru","file":"hrnek-v-svetru.svg","category":"craft"},{"id":22,"name":"Brk a inkoust","file":"brk-a-inkoust.svg","category":"craft"},{"id":23,"name":"Cívka","file":"civka.svg","category":"craft"},{"id":24,"name":"Papírový pták","file":"papirovy-ptak.svg","category":"craft"},{"id":25,"name":"Papírová vlaštovka","file":"papirova-vlastovka.svg","category":"craft"},{"id":26,"name":"Přesýpačky modré","file":"presypacky-modre.svg","category":"craft"},{"id":27,"name":"Přesýpačky zlaté","file":"presypacky-zlate.svg","category":"craft"},{"id":28,"name":"Člunek","file":"clunek.svg","category":"craft"},{"id":29,"name":"Tkalcovský stav","file":"tkalcovsky-stav.svg","category":"craft"}];
const AVATAR_BASE_PATH='/assets/avatars/v2/';
const AVATAR_COUNT=AVATAR_MANIFEST.length;
const AVATAR_NAMES=AVATAR_MANIFEST.map(a=>a.name);
function avatarSvg(bg,body){return '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><circle cx="32" cy="32" r="31" fill="'+bg+'"/>'+body+'</svg>'}
const PRIVATE_AVATAR_ART=avatarSvg('#E7DDCC','<circle cx="32" cy="27" r="11" fill="#8F877B"/><path d="M13 54q2-18 19-18t19 18" fill="#8F877B"/><path d="M20 24q12-11 24 0" stroke="#F6F0DE" stroke-width="3" fill="none"/><path d="M22 44q10 7 20 0" stroke="#C66B42" stroke-width="3" fill="none" stroke-linecap="round"/>');
function legacyAvatarIndex(value){return LEGACY_AVATARS.indexOf(String(value||'').trim())}
function avatarHash(value){let h=2166136261;for(const ch of String(value||'')){h^=ch.codePointAt(0);h=Math.imul(h,16777619)}return h>>>0}
function visualAvatarIndex(value){const raw=String(value||'').trim(),legacy=legacyAvatarIndex(raw);return legacy>=0?legacy:(raw?avatarHash(raw)%15:-1)}
function avatarNode(index,label='Herní avatar'){
 const n=document.createElement('span'),safe=Number(index);
 n.className='organic-avatar';n.dataset.avatarIndex=String(safe);n.setAttribute('role','img');n.setAttribute('aria-label',label);
 if(safe>=0&&safe<AVATAR_COUNT){
   const meta=AVATAR_MANIFEST[safe],img=document.createElement('img');
   n.dataset.avatarFile=meta.file;n.dataset.avatarCategory=meta.category;
   img.src=AVATAR_BASE_PATH+meta.file;img.alt='';img.width=64;img.height=64;img.decoding='async';img.draggable=false;
   n.appendChild(img);
 }else n.innerHTML=PRIVATE_AVATAR_ART;
 return n;
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
   const raw=String(btn.dataset.avatar||btn.dataset.editAvatar||'').trim(),idx=legacyAvatarIndex(raw);
   if(idx<0)return;
   btn.classList.remove('organic-avatar-duplicate');btn.removeAttribute('aria-hidden');btn.tabIndex=0;btn.dataset.organicAvatarKey=raw;btn.dataset.avatarCategory=AVATAR_MANIFEST[idx].category;
   btn.classList.toggle('selected',idx===current);
   btn.setAttribute('aria-label',`Avatar: ${AVATAR_NAMES[idx]}`);btn.title=AVATAR_NAMES[idx];
   const existing=btn.querySelector('.organic-avatar');
   if(!existing||Number(existing.dataset.avatarIndex)!==idx)btn.replaceChildren(avatarNode(idx,AVATAR_NAMES[idx]));
 });
}
function polishAvatarEditor(){
 const grid=document.getElementById('profileEditAvatarGrid');
 if(grid){
   const buttons=[...grid.querySelectorAll('.avatar-choice')];
   if(buttons.length>=30&&!grid.querySelector('.avatar-group-label')){
     const a=document.createElement('span');a.className='avatar-group-label';a.textContent='LESNÍ ZVÍŘÁTKA';grid.insertBefore(a,buttons[0]);
     const b=document.createElement('span');b.className='avatar-group-label';b.textContent='PLETENÍ A ŘEMESLO';grid.insertBefore(b,buttons[15]);
   }
 }
 const note=document.querySelector('#profileEditModal .profile-edit-avatar-block .field-note');
 if(note&&note.textContent.includes('emoji'))note.textContent='Google fotka je soukromá pro tvoji hlavičku. Ve veřejném pořadí dál používáme zvolený herní avatar.';
}
function decorateInlineLeaderboardAvatars(){
 document.querySelectorAll('.leader-name>strong').forEach(strong=>{
   if(strong.querySelector('.organic-avatar'))return;
   const first=strong.firstChild;if(!first||first.nodeType!==Node.TEXT_NODE)return;
   const text=first.nodeValue||'',trimmed=text.trimStart();
   const key=LEGACY_AVATARS.find(k=>trimmed.startsWith(k))||(trimmed.match(/^(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)/u)?.[1]||'');if(!key)return;
   first.nodeValue=trimmed.slice(key.length).replace(/^\s+/,'');
   const host=document.createElement('span');host.className='ranking-avatar organic-avatar-host';host.dataset.organicAvatarKey=key;host.appendChild(avatarNode(visualAvatarIndex(key),'Herní avatar'));
   strong.prepend(host);
 });
}
function applyAvatars(){
 const p=profileState();
 const chip=document.getElementById('profileChipAvatar');
 if(p&&!p.useGoogleAvatar)decorateAvatarElement(chip,p.avatar||'🙂',`Avatar hráče ${p.name||''}`);
 else if(!p&&chip&&!chip.querySelector('.organic-avatar')){chip.classList.add('organic-avatar-host');chip.replaceChildren(avatarNode(-1,'Profil zatím není uložen'))}
 if(p&&!p.useGoogleAvatar)document.querySelectorAll('.profile-avatar-big').forEach(el=>decorateAvatarElement(el,p.avatar||'🙂',`Avatar hráče ${p.name||''}`));
 const preview=document.getElementById('rankingPrivacyPreviewAvatar');if(preview&&p)decorateAvatarElement(preview,p.avatar||'🙂','Tvůj veřejný herní avatar');
 document.querySelectorAll('.home-ranking-avatar,.leader-avatar,.leaderboard-avatar,.ranking-avatar').forEach(el=>decorateAvatarElement(el,null,'Herní avatar'));
 decorateInlineLeaderboardAvatars();decorateAvatarPickers();polishAvatarEditor();
 const privateIcon=document.querySelector('.settings-privacy-icon');if(privateIcon&&profileState()?.publicRankings===false&&!privateIcon.querySelector('.organic-avatar')){privateIcon.replaceChildren(avatarNode(-1,'Anonymní hráč'));privateIcon.classList.add('organic-private-avatar')}
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

const ACHIEVEMENT_SERIES={
 general:[
  '<path d="M14 30c8-12 28-12 36 0-8 12-28 12-36 0Z"/><path d="M21 29c7 7 15 7 22 0"/>',
  '<path d="M13 38c8-5 11-15 18-20 8 5 11 15 20 20"/><circle cx="32" cy="31" r="5"/>',
  '<rect x="14" y="18" width="11" height="11" rx="2"/><rect x="27" y="18" width="11" height="11" rx="2"/><rect x="40" y="18" width="11" height="11" rx="2"/><path d="M18 39h28M22 45h20"/>',
  '<circle cx="32" cy="32" r="17"/><circle cx="32" cy="32" r="9"/><path d="M32 10v11m0 22v11M10 32h11m22 0h11"/>',
  '<path d="M12 44c10-2 8-22 19-22 8 0 5 18 20 18"/><path d="m15 38-4 6 7 2m29-12 5 6-5 5"/>',
  '<path d="M13 35h38M16 26h32M20 44h24"/><path d="M20 21v27m8-31v35m8-35v35m8-31v27"/>',
  '<path d="M12 40h32l6-12H21z"/><circle cx="22" cy="45" r="5"/><circle cx="43" cy="45" r="5"/><path d="M17 30 27 18h15l6 10"/>',
  '<path d="M18 47c10-17 18-23 29-30"/><path d="m43 16 6 1-2 6M21 42l6 4m1-12 6 4m1-12 6 4"/>',
  '<circle cx="32" cy="32" r="18"/><path d="M18 42c8-9 20-12 29-21M15 30c12 0 20 8 32 7"/><circle cx="23" cy="23" r="2"/><circle cx="42" cy="44" r="2"/>'
 ],
 easy:[
  '<ellipse cx="32" cy="42" rx="8" ry="5"/><path d="M32 40V27"/><path class="fill" d="M31 30c-7 0-10-5-10-10 7 0 11 4 10 10Zm2-4c1-6 5-9 11-9 0 6-4 10-11 11Z"/>',
  '<path d="M32 48V25"/><path class="fill" d="M31 34c-8 0-12-5-12-11 8 0 12 4 12 11Zm2-6c1-7 6-11 13-11 0 7-5 12-13 13Z"/><path d="M20 49h24"/>',
  '<path d="M32 50V19"/><path class="fill" d="M31 29c-9 0-13-5-13-12 8 0 13 4 13 12Zm2 4c1-7 6-11 13-11 0 7-5 12-13 13Zm-2 8c-7 0-11-4-11-10 7 0 11 4 11 10Z"/>',
  '<path d="M12 46h40M15 36h34M18 26h28"/><path d="M20 23v26m12-31v31m12-26v26"/><path class="fill" d="m17 33 5-7 5 7-5 6zm20-3 5-7 5 7-5 6z"/>',
  '<path d="M32 50V27"/><path class="fill" d="M32 15c-11 0-17 8-17 17 6 3 11 2 17-3 6 5 11 6 17 3 0-9-6-17-17-17Z"/><path d="M20 50h24"/>',
  '<path d="M12 50h40M17 50V34h30v16M22 34V23h20v11"/><path class="fill" d="M21 26c3-8 8-11 11-11s8 3 11 11c-8 5-14 5-22 0Z"/><path d="M25 40h14"/>'
 ],
 medium:[
  '<circle cx="22" cy="27" r="8"/><circle cx="34" cy="22" r="5"/><circle cx="43" cy="34" r="4"/><path d="M18 39c6 5 13 7 22 5"/>',
  '<circle cx="23" cy="31" r="10"/><circle cx="43" cy="31" r="10"/><path d="M33 29h1M13 29l-5-3m45 3 5-3"/><path d="M20 43c8 4 16 4 24 0"/>',
  '<path class="fill" d="M13 18c8-2 14 0 19 5v28c-6-5-12-7-19-5Zm38 0c-8-2-14 0-19 5v28c6-5 12-7 19-5Z"/><path d="M32 23v28"/>',
  '<path class="fill" d="M43 13c-12 4-19 13-22 27 8-3 15-9 22-27Z"/><path d="M20 42h25v8H20zM22 39c8-5 14-10 20-18"/>',
  '<path d="M12 45 38 19l8 8-26 26"/><circle cx="44" cy="20" r="9"/><path d="M49 14l7-7M16 47l-6 6"/>',
  '<path d="M24 15c-9 0-12 8-8 14-6 4-4 14 4 15 1 8 12 9 16 3 5 6 15 3 14-5 7-3 7-13 1-16 3-8-6-14-13-9-4-4-8-2-14-2Z"/><path d="M32 15v35M21 28h11m0 10h13"/>'
 ],
 hard:[
  '<path class="fill" d="m31 12 4 13 12-2-9 9 7 10-12-5-8 11 2-14-12-4 12-3z"/>',
  '<path class="fill" d="M36 9 17 35h13l-3 20 21-29H35z"/>',
  '<path d="m14 17 13 13m-6-18 12 12M27 30l-13 18m18-23 15 15"/><rect class="fill" x="38" y="35" width="12" height="8" rx="2" transform="rotate(45 44 39)"/>',
  '<path class="fill" d="M14 23h29c-2 8-6 13-13 16h19v10H15V39h12c-7-3-11-8-13-16Z"/><path d="M18 18h22"/>',
  '<path class="fill" d="m9 49 18-31 7 12 7-10 14 29Z"/><path d="m24 23 5 8 5-6 5 9"/>',
  '<path d="M14 50h36M20 50V29h24v21M24 29v-9h16v9"/><path class="fill" d="M32 15c7 6 9 11 4 17-7 1-12-3-11-9 1-4 4-7 7-8Z"/>',
  '<path d="m15 19 13 13m-5-18 12 12M28 32 14 49m14-17 16 16"/><path class="fill" d="M43 13 50 21 44 27 36 19z"/><path d="M36 50h15"/>'
 ],
 hardcore:[
  '<path d="M22 16c-8 3-10 12-5 18-5 7 1 16 9 14 5 8 16 4 16-5 8-1 10-12 3-16 3-9-7-15-14-9-3-4-6-4-9-2"/><path class="fill" d="M39 16c7 0 12 5 12 12-5-2-9-6-12-12Z"/>',
  '<circle cx="32" cy="33" r="18"/><path d="M17 28h30M20 38h24"/><path class="fill" d="m23 21 5 7-5 6-5-6zm18 0 5 7-5 6-5-6z"/>',
  '<path d="M22 18c-7 4-8 13-3 18-4 8 4 16 12 12 7 7 17 0 13-8 8-6 3-17-6-17-3-6-10-7-16-5Z"/><path class="fill" d="M32 12c7 6 8 12 2 17-6-2-9-7-2-17Z"/>',
  '<path d="M14 42c2-15 14-23 28-15 7 4 8 13 3 18-6 7-18 4-19-4-1-6 7-9 11-5 3 3 0 8-4 6"/><path class="fill" d="M15 42h9v8h-9z"/>',
  '<path d="M23 17c-8 3-10 12-5 18-4 7 2 15 10 12 4 7 15 4 15-4 7-1 9-11 3-15 3-8-6-14-13-9-4-4-7-4-10-2"/><path class="fill" d="M11 41h12l-4 9H9zm42 0H41l4 9h10z"/>',
  '<path d="M23 18c-8 3-10 12-5 18-4 7 2 15 10 12 4 7 15 4 15-4 7-1 9-11 3-15 3-8-6-14-13-9-4-4-7-4-10-2"/><path class="fill" d="m24 15 4-7 5 6 6-6 2 8z"/>',
  '<path d="M19 17c-8 5-9 16-2 22 7 6 15 0 15-7 0 7 8 13 15 7 7-6 6-17-2-22-7-5-13 0-13 7 0-7-6-12-13-7Z"/><path d="M32 24v18"/>'
 ],
 daily:[
  '<circle class="fill" cx="32" cy="32" r="10"/><path d="M32 10v8m0 28v8M10 32h8m28 0h8M16 16l6 6m20 20 6 6m0-32-6 6M22 42l-6 6"/>',
  '<circle class="fill" cx="20" cy="32" r="7"/><circle class="fill" cx="32" cy="24" r="7"/><circle class="fill" cx="44" cy="32" r="7"/><path d="M16 45h32"/>',
  '<rect x="14" y="18" width="36" height="32" rx="4"/><path d="M14 27h36M22 12v12m20-12v12"/><path class="fill" d="m25 37 5 5 10-12-3-3-7 9-2-2z"/>',
  '<rect x="10" y="20" width="29" height="29" rx="4"/><rect x="25" y="15" width="29" height="29" rx="4"/><path d="M25 24h29M33 10v11m13-11v11"/><path class="fill" d="M33 30h5v5h-5zm8 0h5v5h-5z"/>',
  '<circle class="fill" cx="32" cy="31" r="17"/><path d="M32 14a17 17 0 0 0 0 34c-9-7-9-27 0-34Zm0 0c9 7 9 27 0 34"/><path d="M12 52h40"/>',
  '<circle class="fill" cx="32" cy="32" r="8"/><path d="M32 12c5 5 7 8 7 12 4-2 8-2 13 0-1 6-4 9-8 11 4 3 6 7 7 12-6 2-10 0-14-3-1 5-3 8-5 10-4-3-6-6-7-10-4 3-8 5-14 3 1-5 3-9 7-12-4-2-7-5-8-11 5-2 9-2 13 0 0-4 2-7 9-12Z"/>',
  '<circle cx="32" cy="32" r="15"/><path d="M32 10v7m0 30v7M10 32h7m30 0h7M15 15l5 5m24 24 5 5m0-34-5 5M20 44l-5 5"/><path class="fill" d="M25 27h14v10H25z"/>',
  '<circle cx="32" cy="32" r="18"/><path d="m32 18 5 10 10 4-10 4-5 10-5-10-10-4 10-4z"/><path class="fill" d="M29 29h6v6h-6z"/>',
  '<circle class="fill" cx="32" cy="32" r="14"/><path d="M18 31h28M22 22c7 5 13 5 20 0m-20 20c7-5 13-5 20 0M32 18v28"/><ellipse cx="32" cy="32" rx="23" ry="10" transform="rotate(-22 32 32)"/>'
 ],
 tajenka:[
  '<circle cx="32" cy="29" r="15"/><path class="fill" d="M32 23c5 0 7 6 3 9v9h-6v-9c-4-3-2-9 3-9Z"/>',
  '<circle cx="23" cy="29" r="10"/><path d="M32 29h22m-7 0v8m-7-8v6"/><path class="fill" d="M18 25h10v8H18z"/>',
  '<path class="fill" d="M13 18h38v27H28l-9 8 2-8h-8z"/><path d="M21 27h22M21 34h16"/>',
  '<path class="fill" d="M16 14h32l-3 9 3 9-3 9 3 9H16l3-9-3-9 3-9z"/><path d="M23 25h18M23 32h18M23 39h13"/>'
 ],
 mozkomor:[
  '<circle cx="32" cy="32" r="19"/><circle class="fill" cx="32" cy="32" r="8"/><path d="M15 15 25 25m24-10L39 25M15 49l10-10m24 10L39 39"/>',
  '<path d="M23 16c-8 3-10 12-5 18-4 7 2 15 10 12 4 7 15 4 15-4 7-1 9-11 3-15 3-8-6-14-13-9-4-4-7-4-10-2"/><path class="fill" d="M15 51h7v-7h6v7h7v-7h6v7h8"/>',
  '<path d="M32 12c22 0 22 40 0 40-16 0-20-23-4-29 12-5 20 10 11 17-7 6-16-3-10-9 4-4 9 2 5 5"/>',
  '<path d="M12 16h40v32H12zM20 16v32m8-32v32m8-32v32m8-32v32M12 24h40m-40 8h40m-40 8h40"/><circle class="fill" cx="32" cy="32" r="5"/>',
  '<circle cx="32" cy="32" r="11"/><path d="M32 10v7m0 30v7M10 32h7m30 0h7M17 17l5 5m20 20 5 5m0-30-5 5M22 42l-5 5"/><path class="fill" d="M28 28h8v8h-8z"/>',
  '<path d="M10 32s8-14 22-14 22 14 22 14-8 14-22 14S10 32 10 32Z"/><circle class="fill" cx="32" cy="32" r="7"/><circle cx="32" cy="32" r="2"/>'
 ],
 discovery:[
  '<rect x="14" y="19" width="36" height="28" rx="5"/><path d="m22 33 7 7 14-17"/><path class="fill" d="M18 23h7v7h-7z"/>',
  '<path d="M11 47c8-3 8-18 19-18 9 0 8 13 23 11"/><path class="fill" d="M24 21c7-5 14-3 17 3-7 4-12 4-17-3Z"/>',
  '<path class="fill" d="M22 20h20l5 30H17z"/><path d="M25 20c0-9 14-9 14 0M22 33h20"/><path d="M27 42h10"/>',
  '<path class="fill" d="M23 15h18v8l6 8-4 19H21l-4-19 6-8z"/><path d="M23 27h18M25 36h14"/><path d="M29 16v-5h6v5"/>'
 ],
 clean:[
  '<path class="fill" d="M44 12c-14 4-23 15-27 35 14-5 23-17 27-35Z"/><path d="M18 47c8-8 15-15 23-25"/>',
  '<circle class="fill" cx="23" cy="29" r="8"/><circle cx="39" cy="22" r="5"/><circle cx="44" cy="39" r="10"/><circle cx="20" cy="46" r="4"/>',
  '<rect class="fill" x="18" y="24" width="28" height="23" rx="6"/><path d="M22 24c0-8 20-8 20 0M24 36h16"/>',
  '<path class="fill" d="m32 10 17 13-6 24H21l-6-24z"/><path d="m20 23 12 24 12-24M15 23h34"/>',
  '<path class="fill" d="M12 36c9-13 18-19 29-19 2 9 6 13 13 18-9 2-16 7-20 16-4-8-11-12-22-15Z"/><circle cx="39" cy="26" r="2"/>',
  '<ellipse cx="32" cy="31" rx="18" ry="21"/><path d="M16 31h32M32 10v42"/><path class="fill" d="M22 23h8v8h-8zm12 9h8v8h-8z"/>',
  '<path d="m18 48 27-34"/><path class="fill" d="m45 14 3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/><path d="m18 48-6 5m14-14-5-4"/>'
 ],
 cleanDaily:[
  '<path d="M10 44h44M15 39c7-11 27-11 34 0"/><path class="fill" d="M22 39a10 10 0 0 1 20 0Z"/><path d="M32 14v9m-16-2 6 6m26-6-6 6"/>',
  '<path d="M12 45c5-20 35-20 40 0M18 45c4-14 24-14 28 0M24 45c3-8 13-8 16 0"/><path class="fill" d="M12 47h40v4H12z"/>',
  '<circle class="fill" cx="32" cy="32" r="12"/><path d="M32 9v8m0 30v8M9 32h8m30 0h8M16 16l6 6m20 20 6 6m0-32-6 6M22 42l-6 6"/><path d="m27 32 4 4 7-9"/>',
  '<path class="fill" d="m32 8 6 16 17 1-13 11 4 17-14-9-14 9 4-17L9 25l17-1z"/><path d="m25 32 5 5 10-12"/>'
 ],
 xp:[
  '<circle class="fill" cx="32" cy="34" r="14"/><path d="M26 29h12m-12 10h12M29 25v18m6-18v18"/>',
  '<path class="fill" d="M20 18h24v28H20z"/><ellipse cx="32" cy="18" rx="12" ry="5"/><ellipse cx="32" cy="46" rx="12" ry="5"/><path d="M22 25h20m-20 7h20m-20 7h20"/>',
  '<path class="fill" d="M12 26h18v23H12zm22-10h18v33H34z"/><path d="M14 32h14m8-8h14"/>',
  '<path class="fill" d="M13 25h38l-5 27H18z"/><path d="M20 25c0-12 24-12 24 0M22 35h20M25 43h14"/>',
  '<path d="M11 49h42M15 49V21h34v28M20 21v-8h24v8"/><path class="fill" d="M23 31h18v12H23z"/>',
  '<circle class="fill" cx="22" cy="25" r="8"/><circle class="fill" cx="42" cy="25" r="8"/><circle class="fill" cx="32" cy="42" r="8"/><path d="M22 33 32 42 42 33"/>',
  '<rect class="fill" x="12" y="18" width="40" height="28" rx="5"/><path d="M18 25h8m4 0h8m4 0h5M18 33h13m4 0h12M18 40h7m5 0h17"/>',
  '<path d="M13 48 21 18h22l8 30"/><path class="fill" d="M21 18h22l-4 12H25z"/><path d="M19 36h26"/>',
  '<path class="fill" d="M18 47c4-16 10-27 20-34l3 13 11 7c-8 9-19 14-34 14Z"/><path d="m19 47-7 6m15-9-6 7"/>',
  '<path d="M16 46h32M20 46V25h24v21"/><path class="fill" d="m32 12 5 8 10 2-7 7 2 10-10-5-10 5 2-10-7-7 10-2z"/>',
  '<circle cx="23" cy="32" r="10"/><path d="M33 32h21m-7 0v8m-7-8v6"/><path class="fill" d="M19 28h8v8h-8z"/>',
  '<path d="M11 16h42v32H11zM20 16v32m8-32v32m8-32v32m8-32v32M11 27h42m-42 10h42"/><path class="fill" d="M27 27h10v10H27z"/>',
  '<circle cx="32" cy="32" r="18"/><path d="M17 39c12-15 20-14 31-22M19 23c10 13 19 14 29 22"/><path class="fill" d="m32 12 3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/>'
 ],
 speed:[
  '<path class="fill" d="M45 13c-15 5-24 16-29 35 14-4 24-16 29-35Z"/><path d="M17 48h25"/>',
  '<path d="M10 22h31M15 32h39M10 42h31"/><path class="fill" d="m42 27 12 5-12 5z"/>',
  '<path class="fill" d="M36 9 17 35h13l-3 20 21-29H35z"/>',
  '<path class="fill" d="M36 10c11 5 15 14 12 25L35 48c-9 4-17 0-20-8l12-13c1-7 4-13 9-17Z"/><circle cx="38" cy="22" r="3"/><path d="M20 43 11 52m14-4-5 7"/>'
 ],
 rescue:[
  '<circle cx="32" cy="32" r="19"/><circle cx="32" cy="32" r="8"/><path class="fill" d="m18 18 8 8-6 6-8-8zm28 0-8 8 6 6 8-8zm0 28-8-8 6-6 8 8zM18 46l8-8-6-6-8 8z"/>',
  '<path d="M12 43c9-16 16-22 27-19 9 3 10 15 3 19-6 4-13-2-9-7 3-4 8 0 5 4"/><path class="fill" d="M11 43h11v9H11z"/>',
  '<path class="fill" d="m19 24 4-12 9 9 9-9 4 12v27H19z"/><path d="M23 35q9 8 18 0"/><circle cx="26" cy="29" r="2"/><circle cx="38" cy="29" r="2"/>',
  '<rect class="fill" x="22" y="17" width="20" height="34" rx="4"/><path d="M26 17v-6h12v6M27 27h10m-5-5v10M17 37h5m20 0h5"/>'
 ]
};
const ACHIEVEMENT_NAMES={
 general:['První Proplet','Pětka v kapse','Rozjezd','Čtvrtsto','Půl stovky','Stovka úloh','Nezastavitelný','Propletový maratonec','Nekonečný propletač'],
 easy:['První klíček','Rozcvička','Lehká váha','Půlka zahrady','Zelený velmistr','Vládce zelené banky'],
 medium:['Hlavička','Mozkovna','Přemýšlivec','Šedá kůra','Mistr středu','Dvojitá mozkovna'],
 hard:['Odvážlivec','Rozbuška','Nebojácný','Těžká práce','Ocelová hlava','Demoliční četa','Nezničitelná hlava'],
 hardcore:['Mozkožrout','Nakrmil Mozkožrouta','Neurony v plamenech','Požírač šneků','Mozkový kulturista','Mozkožroutí král','Mozkožroutí nesmrtelný'],
 daily:['Dnešní dávka','Tři slunce','Týdenní hráč','Dva týdny','Měsíčník','Sluneční sběratel','Stovka rán','Kalendářní démon','Celý rok'],
 tajenka:['První tajemství','Čtenář mezi řádky','Sběratel myšlenek','Mistr skrytých vět'],
 mozkomor:['Vstup do Hlubiny','Pětkrát bez milosti','Krotitel chaosu','Pán zákrut','Neuron z ocele','Mozkomorova Nemesis'],
 discovery:['Slovo navíc','Boční stezka','Lovec skrytých slov','Slovní archeolog'],
 clean:['Bez berliček','Čistá pětka','Čistá desítka','Bez nápovědy','Samostatný mozek','Čistokrevný propletač','Nápovědy jsou pro ostatní'],
 cleanDaily:['Čisté slunce','Sedm čistých rán','Čistý měsíc','Sluneční purista'],
 xp:['První stovka XP','Sběrač XP','Tisícovka','Pokladnice','Pět tisíc','Pěticiferný','XP magnát','Čtyřicet tisíc cest','Padesátitisícový let','Absolutní sběratel','Klíč ke všem cestám','Architekt XP','Za hranicí mřížky'],
 speed:['Pohodový sprint','Svižník','Rychlík','Blesk'],
 rescue:['Ne dnes, série!','Záchranář','Devět životů','Hasící přístroj']
};
const GROUP_ID_BY_LABEL={'Celkový postup':'general','Snadná':'easy','Střední':'medium','Těžká':'hard','Mozkožrout':'hardcore','Denní výzva':'daily','Tajenka':'tajenka','Mozkomor':'mozkomor','Objevená slova':'discovery','Čistá řešení':'clean','Čisté Daily':'cleanDaily','XP':'xp','Rychlost':'speed','Záchrana série':'rescue'};
const GROUP_TONE={general:'mauve',easy:'sage',medium:'blue',hard:'coral',hardcore:'clay',daily:'amber',tajenka:'mauve',mozkomor:'blue',discovery:'sage',clean:'blue',cleanDaily:'amber',xp:'clay',speed:'coral',rescue:'sage'};
function bespokeSvg(body,label=''){
 return '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">'+body+'</svg>';
}
function bespokeArt(group,index,label=''){
 const list=ACHIEVEMENT_SERIES[group]||[];const body=list[index]||list[list.length-1]||ACHIEVEMENT_SERIES.general[0];
 const span=document.createElement('span');span.className='proplet-ach-art tone-'+(GROUP_TONE[group]||'ivory');span.dataset.achArt=group+'-'+index;span.setAttribute('role','img');span.setAttribute('aria-label',label);span.innerHTML=bespokeSvg(body,label);return span;
}
function achievementIdentityByName(name){
 for(const [group,names] of Object.entries(ACHIEVEMENT_NAMES)){const i=names.indexOf(name);if(i>=0)return {group,index:i}}
 return null;
}
const LOYALTY_ART=[
 '<path d="M16 32h32"/><path class="fill" d="M22 24h20v16H22z"/><path d="m18 29 4 3-4 3m28-6-4 3 4 3"/>',
 '<path d="M17 23c8 0 8 18 16 18s8-18 16-18"/><circle class="fill" cx="33" cy="32" r="5"/>',
 '<path d="M14 22c10 0 8 20 18 20s8-20 18-20M14 42c10 0 8-20 18-20s8 20 18 20"/><circle class="fill" cx="32" cy="32" r="4"/>',
 '<path d="M18 16c9 8 19 8 28 0M18 26c9 8 19 8 28 0M18 36c9 8 19 8 28 0M18 46c9 8 19 8 28 0"/><path d="M22 12v40m20-40v40"/>',
 '<circle class="fill" cx="31" cy="31" r="16"/><path d="M18 26q13-11 27 0M16 34q15-11 30 0M20 42q11-8 23 0"/><path d="M45 43q8 1 9 8"/>',
 '<path class="fill" d="M20 17h24v30H20z"/><ellipse cx="32" cy="17" rx="12" ry="5"/><ellipse cx="32" cy="47" rx="12" ry="5"/><path d="M22 24h20m-20 7h20m-20 7h20"/>',
 '<path d="M12 17h40v34H12zM18 17v34m7-34v34m7-34v34m7-34v34m7-34v34"/><path class="fill" d="M18 34q7-10 14 0 7-10 14 0v14H18z"/>',
 '<path class="fill" d="M15 16h34v34H15z"/><path d="M20 20h24v26H20zM20 27h24m-24 7h24m-24 7h24"/><path d="M26 20v26m12-26v26"/>',
 '<path d="m32 12 5 9 10 2-7 7 3 11-11-6-11 6 3-11-7-7 10-2z"/><path class="fill" d="M25 30q7-9 14 0-7 9-14 0Z"/>',
 '<circle cx="32" cy="32" r="19"/><path d="M17 40c9-12 21-17 31-20M16 26c12 2 20 9 32 18"/><circle class="fill" cx="22" cy="22" r="3"/><circle class="fill" cx="44" cy="42" r="3"/>'
];
function loyaltyArt(index,label){
 const span=document.createElement('span');span.className='proplet-ach-art proplet-loyalty-art tone-'+(['clay','clay','amber','amber','sage','clay','blue','sage','amber','mauve'][index]||'clay');span.dataset.loyaltyArt=String(index);span.setAttribute('role','img');span.setAttribute('aria-label',label);span.innerHTML=bespokeSvg(LOYALTY_ART[index]||LOYALTY_ART[0]);return span;
}
const RANK_BODY={
 '🌱':ACHIEVEMENT_SERIES.easy[1],
 '🧩':'<path d="M15 16h15v8a5 5 0 1 0 10 0v-8h10v15h-8a5 5 0 1 0 0 10h8v9H35v-8a5 5 0 1 0-10 0v8H15V35h8a5 5 0 1 0 0-10h-8Z"/>',
 '🔎':'<circle cx="28" cy="28" r="13"/><path d="m38 38 14 14"/><path class="fill" d="M25 24h7v7h-7z"/>',
 '🧵':'<path d="m18 49 27-34"/><path d="M41 16q8 4 10 12-8 5-8 14"/><circle class="fill" cx="18" cy="49" r="4"/>',
 '🪢':LOYALTY_ART[2],
 '↪️':'<path d="M14 20h20q14 0 14 13T34 46H19"/><path d="m24 39-8 7 8 7"/><path class="fill" d="M36 27h7v7h-7z"/>',
 '🧭':'<circle cx="32" cy="32" r="20"/><path class="fill" d="m39 21-5 14-14 7 7-14z"/><circle cx="32" cy="32" r="3"/>',
 '♟️':'<path class="fill" d="M25 14h14l-3 10 7 8-5 12h7v7H19v-7h7l-5-12 7-8z"/><path d="M23 32h18"/>',
 '✨':'<path d="m18 49 27-34"/><path class="fill" d="m45 13 3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/>',
 '🧶':LOYALTY_ART[4],
 '👑':'<path class="fill" d="m14 23 10 10 8-18 8 18 10-10-5 25H19z"/><path d="M19 52h26"/>',
 '🛤️':'<path d="M18 54c0-18 10-26 28-44M32 54c-2-17 2-26 14-44"/><path class="fill" d="M14 45h8v8h-8z"/>',
 '🐉':'<path class="fill" d="M15 42c4-20 16-30 34-25l-8 8 10 4-10 5 6 9-12-3-7 12z"/><circle cx="36" cy="26" r="2"/><path d="M18 44q10 3 17-4"/>',
 '🌀':'<path d="M32 11c23 0 25 42 0 42-18 0-22-26-4-33 13-5 22 12 11 20-8 6-17-4-10-10 4-4 9 2 5 5"/>',
 '🧱':'<path d="M11 17h42v34H11zM11 28h42M11 40h42M21 17v11m20-11v11M16 28v12m20-12v12m13 0v11m-28-11v11"/><path class="fill" d="M28 28h8v12h-8z"/>',
 '💎':ACHIEVEMENT_SERIES.clean[3],
 '🥷':'<path class="fill" d="M15 28c2-15 32-20 37 0l-5 20H20z"/><path d="M18 31h31"/><path d="M24 34h6m7 0h6"/><path d="m43 19 9-7"/>',
 '⚗️':'<path d="M25 12h14M28 12v14L17 46q-4 7 5 7h20q9 0 5-7L36 26V12"/><path class="fill" d="M21 42h22l4 8H17z"/><circle cx="29" cy="38" r="2"/><circle cx="37" cy="44" r="2"/>',
 '🐌':ACHIEVEMENT_SERIES.hardcore[3],
 '🔮':'<circle class="fill" cx="32" cy="28" r="16"/><path d="M20 45h24l4 8H16z"/><path d="M22 27c6-8 13-9 20-2-6 10-13 12-20 2Z"/>',
 '🌌':ACHIEVEMENT_SERIES.general[8],
 '🤯':ACHIEVEMENT_SERIES.hardcore[2],
 '🏰':'<path class="fill" d="M14 25h10v-9h8v9h8v-9h10v38H14z"/><path d="M20 20v-7m24 7v-7M26 54V40h12v14M14 33h36"/>',
 '🎓':'<path class="fill" d="m10 24 22-12 22 12-22 12z"/><path d="M18 30v11q14 10 28 0V30M54 24v16"/>',
 '🪄':'<path d="m16 50 31-35"/><path class="fill" d="m47 11 3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/><circle cx="17" cy="16" r="3"/><circle cx="42" cy="47" r="3"/>',
 '🗿':'<path class="fill" d="M22 11h20l7 19-5 24H20l-5-24z"/><path d="M22 26h8m7 0h7M25 36h15M28 45h9"/>',
 '♾️':'<path d="M14 32c0-12 13-16 21-4l4 6c6 10 17 6 17-2s-11-12-17-2l-4 6c-8 12-21 8-21-4Z"/>',
 '🌠':'<path class="fill" d="m40 12 4 10 11 1-8 7 3 11-10-6-10 6 3-11-8-7 11-1z"/><path d="M10 48 28 30m-15 25 20-20"/>',
 '🛰️':'<path class="fill" d="m25 25 14 14-7 7-14-14z"/><path d="m18 18 7 7m14 14 7 7M12 17l8 1-3-8m30 37 5 5M38 22l10-10M15 49l10-10"/>',
 '🚀':ACHIEVEMENT_SERIES.speed[3],
 '🛡️':'<path class="fill" d="M32 10 49 17v13c0 12-7 20-17 25-10-5-17-13-17-25V17z"/><path d="m23 32 6 6 12-14"/>',
 '🏆':'<path class="fill" d="M21 14h22v12q0 13-11 13T21 26z"/><path d="M21 18h-8v5q0 9 10 10m20-15h8v5q0 9-10 10M32 39v9m-9 5h18"/>',
 '🗝️':'<circle cx="22" cy="27" r="10"/><path d="M32 27h23m-7 0v9m-8-9v6"/><path class="fill" d="M18 23h8v8h-8z"/>',
 '🕸️':'<circle cx="32" cy="32" r="20"/><path d="M32 12v40M12 32h40M18 18l28 28M46 18 18 46"/><circle cx="32" cy="32" r="8"/><circle cx="32" cy="32" r="14"/>'
};
function rankArt(key,index,label){
 const body=RANK_BODY[key]||ACHIEVEMENT_SERIES.general[index%ACHIEVEMENT_SERIES.general.length];
 const tone=['sage','sage','blue','clay','clay','mauve','blue','blue','mauve','clay','amber','sage','coral','mauve','clay','blue','charcoal','mauve','sage','mauve','blue','coral','clay','blue','mauve','clay','mauve','amber','blue','coral','sage','amber','clay','mauve','blue'][index]||'ivory';
 const span=document.createElement('span');span.className='proplet-rank-art tone-'+tone;span.dataset.rankArt=String(index);span.setAttribute('role','img');span.setAttribute('aria-label',label);span.innerHTML=bespokeSvg(body);return span;
}
function applyBespokeProgressArt(){
 document.querySelectorAll('.achievement-group').forEach(section=>{
   const label=section.querySelector('.achievement-group-head>strong')?.textContent?.trim()||'',group=GROUP_ID_BY_LABEL[label];if(!group)return;
   [...section.querySelectorAll('.achievement')].forEach((card,index)=>{
     const slot=card.querySelector(':scope>.emoji');if(!slot)return;
     const name=card.querySelector(':scope>strong')?.textContent?.trim()||'';slot.replaceChildren(bespokeArt(group,index,name));slot.classList.add('bespoke-ready');
   });
 });
 document.querySelectorAll('.achievement-peek').forEach(peek=>{
   const name=peek.getAttribute('title')||peek.getAttribute('aria-label')?.replace(/, splněno$/,'')||'',id=achievementIdentityByName(name),slot=peek.querySelector('b');
   if(id&&slot&&!slot.querySelector('.proplet-ach-art'))slot.replaceChildren(bespokeArt(id.group,id.index,name));
 });
 [...document.querySelectorAll('#profileBadges .profile-badge')].forEach((card,index)=>{
   const slot=card.querySelector(':scope>.emoji');if(!slot)return;const name=card.querySelector('strong')?.textContent||'';slot.replaceChildren(loyaltyArt(index,name));slot.classList.add('bespoke-ready');
 });
 [...document.querySelectorAll('#levelRoadmap .level-step')].forEach((step,index)=>{
   const slot=step.querySelector('.level-step-icon');if(!slot||slot.querySelector('.proplet-rank-art'))return;const key=slot.textContent.trim(),name=step.querySelector('strong')?.textContent||'';slot.replaceChildren(rankArt(key,index,name));
 });
 document.querySelectorAll('.profile-rank-icon').forEach(slot=>{
   if(slot.querySelector('.proplet-rank-art'))return;const key=slot.textContent.trim(),name=slot.parentElement?.querySelector('strong')?.textContent||'',match=name.match(/^(\d+)/),index=Math.max(0,Number(match?.[1]||1)-1);slot.replaceChildren(rankArt(key,index,name));
 });
}

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
 queued=false;applyAvatars();applyBespokeProgressArt();iconizeCloseButtons();replaceVisibleEmoji();updateFooter();updateThemeMeta();
}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(apply)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
})();