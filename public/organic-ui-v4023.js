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
const AVATAR_NAMES=['Liška','Sova','Ježek','Medvěd','Jelen','Srna','Jezevec','Veverka','Mýval','Kočka','Vlk','Mourek','Zajíc','Králík','Myška','Klubko','Háček','Písmeno P','Pletené brýle','Kniha s copem','Kniha se stehem','Hrnek v svetru','Brk a inkoust','Cívka','Papírový pták','Papírová vlaštovka','Přesýpačky modré','Přesýpačky zlaté','Člunek','Tkalcovský stav'];
const AVATAR_COUNT=30;
const AVATAR_PALETTE={cream:'#F7F0DE',ink:'#30343A',rust:'#C9693A',clay:'#D67A4F',sage:'#A9C59C',teal:'#6FA7A0',gold:'#E6B53E',blue:'#7898B3',tan:'#D8B57F',charcoal:'#394346',soft:'#E7D7BD',grey:'#AEB3B0'};
function avatarSvg(bg,body){return '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><circle cx="32" cy="32" r="31" fill="'+bg+'"/>'+body+'</svg>'}
const AVATAR_ART=[
 avatarSvg('#344244','<path fill="#C65F36" d="M14 20 20 7l9 12h6l9-12 6 13-4 31H18z"/><path fill="#F8E8C8" d="M17 34c5 12 12 17 15 17s10-5 15-17c-7 5-10 5-15 0-5 5-8 5-15 0z"/><path fill="#F4D9B2" d="m19 13 3 9-6-3zm26 0-3 9 6-3z"/><circle cx="25" cy="30" r="2" fill="#252525"/><circle cx="39" cy="30" r="2" fill="#252525"/><path d="M27 39q5 5 10 0" fill="none" stroke="#252525" stroke-width="2.5" stroke-linecap="round"/>'),
 avatarSvg('#A9C59C','<ellipse cx="32" cy="38" rx="16" ry="19" fill="#BD6337"/><path fill="#A94E2D" d="M18 21 23 12l8 6h2l8-6 5 10z"/><circle cx="25" cy="28" r="8" fill="#F3E3BC"/><circle cx="39" cy="28" r="8" fill="#F3E3BC"/><circle cx="25" cy="28" r="3.6" fill="#253338"/><circle cx="39" cy="28" r="3.6" fill="#253338"/><path fill="#E3B32F" d="m32 30 5 4-5 4-5-4z"/><path d="M25 44h14M27 49h10" stroke="#D79A2A" stroke-width="2" stroke-linecap="round"/>'),
 avatarSvg('#C96536','<path d="M15 39c0-16 12-26 30-20l6 16-7 14-24 2z" fill="#344244"/><path d="M12 38c4-10 9-15 19-13 5 1 8 5 10 10-8 7-18 12-29 3z" fill="#E5C294"/><circle cx="20" cy="34" r="2" fill="#242424"/><circle cx="12" cy="38" r="2.4" fill="#242424"/><path d="M34 22 38 17M41 25l4-5M46 30l4-3M35 31l5-5M29 21l2-5" stroke="#C7A778" stroke-width="2" stroke-linecap="round"/>'),
 avatarSvg('#E6B53E','<circle cx="21" cy="19" r="7" fill="#A95231"/><circle cx="43" cy="19" r="7" fill="#A95231"/><circle cx="32" cy="34" r="20" fill="#A95231"/><ellipse cx="32" cy="39" rx="10" ry="8" fill="#D6A878"/><circle cx="25" cy="31" r="2" fill="#202020"/><circle cx="39" cy="31" r="2" fill="#202020"/><ellipse cx="32" cy="37" rx="3.5" ry="2.8" fill="#202020"/><path d="M32 40v4m0 0q-5 3-8 0m8 0q5 3 8 0" stroke="#202020" stroke-width="1.7" fill="none" stroke-linecap="round"/>'),
 avatarSvg('#A9C59C','<path d="M23 12 17 2m9 11-2-10m15 9 7-10m-4 12 1-11" stroke="#5B4031" stroke-width="3" stroke-linecap="round"/><path d="M19 21 10 15l3 13 7 3m25-10 9-6-3 13-7 3" fill="#C66A38"/><path d="M19 20q13-11 26 0l-3 29q-10 10-20 0z" fill="#C66A38"/><ellipse cx="32" cy="39" rx="8" ry="9" fill="#E6C49A"/><circle cx="25" cy="31" r="2" fill="#202020"/><circle cx="39" cy="31" r="2" fill="#202020"/><ellipse cx="32" cy="40" rx="3" ry="2.5" fill="#202020"/>'),
 avatarSvg('#B7CDAA','<path d="M20 20 11 16l3 12 7 3m22-11 10-4-3 12-7 3" fill="#B86537"/><path d="M20 21q12-10 24 0l-3 29q-9 8-18 0z" fill="#C97A49"/><path d="M26 39q6-5 12 0v10H26z" fill="#E8C9A3"/><circle cx="26" cy="31" r="2" fill="#202020"/><circle cx="38" cy="31" r="2" fill="#202020"/><ellipse cx="32" cy="40" rx="3" ry="2.3" fill="#202020"/><path d="M32 42v4" stroke="#202020" stroke-width="1.6"/>'),
 avatarSvg('#E2B03C','<path d="M14 16q18-12 36 0v30q-18 16-36 0z" fill="#303B3D"/><path d="M22 15q5 8 10 15 5-7 10-15l7 6-8 31H23L15 21z" fill="#F0E1BE"/><path d="M27 29h-8l4 9m14-9h8l-4 9" stroke="#303B3D" stroke-width="5" stroke-linecap="round"/><circle cx="24" cy="31" r="2" fill="#111"/><circle cx="40" cy="31" r="2" fill="#111"/><ellipse cx="32" cy="41" rx="4" ry="3" fill="#202020"/>'),
 avatarSvg('#6FA7A0','<path d="M43 15q18 3 11 22-3 9-13 10 4-10-2-16z" fill="#B85E34"/><ellipse cx="29" cy="39" rx="14" ry="15" fill="#C96838"/><circle cx="25" cy="31" r="2" fill="#222"/><path d="M16 38q-7 2-9 8 8 2 15-2" fill="#E4B532"/><path d="M39 46q9-6 12-13" fill="none" stroke="#A14E2E" stroke-width="3" stroke-linecap="round"/><ellipse cx="31" cy="49" rx="6" ry="4" fill="#E7C59E"/>'),
 avatarSvg('#E6B53E','<path d="M15 18q17-12 34 0v29q-17 14-34 0z" fill="#808A8A"/><path d="M14 28q8-11 18-4 10-7 18 4-4 14-18 14T14 28z" fill="#26363B"/><path d="M18 28q7-5 13 2-7 9-13 3zm28 0q-7-5-13 2 7 9 13 3z" fill="#D9DDD8"/><circle cx="25" cy="30" r="2" fill="#111"/><circle cx="39" cy="30" r="2" fill="#111"/><ellipse cx="32" cy="39" rx="3" ry="2" fill="#111"/><path d="M32 42q-5 4-9 0m9 0q5 4 9 0" stroke="#111" stroke-width="1.5" fill="none"/>'),
 avatarSvg('#C96536','<path d="m17 23 3-13 10 10h4L44 10l3 13v29H17z" fill="#E4A92E"/><path d="m21 17 2 7-6-2zm22 0-2 7 6-2z" fill="#EFCF78"/><circle cx="25" cy="31" r="2" fill="#252525"/><circle cx="39" cy="31" r="2" fill="#252525"/><path d="M32 35q3 0 3 3-3 3-6 0 0-3 3-3z" fill="#B85F35"/><path d="M21 39 9 37m12 6L8 44m35-5 12-2m-12 6 13 1" stroke="#30343A" stroke-width="1.5"/>'),
 avatarSvg('#C96536','<path d="M10 42q7-18 23-28 3 8 14 13-7 3-7 11 0 8-4 15H15z" fill="#354449"/><path d="M23 26q9-8 15-5-3 7 5 9-7 1-11 8z" fill="#E7E0C9"/><path d="M20 18 14 11m18 7 2-9" stroke="#354449" stroke-width="3" stroke-linecap="round"/><circle cx="35" cy="28" r="2" fill="#181818"/>'),
 avatarSvg('#354449','<path d="m16 23 5-12 9 9h4l9-9 5 12-2 29H18z" fill="#D59B32"/><path d="M20 28h24" stroke="#B46B2F" stroke-width="2"/><path d="M23 22v6m9-7v7m9-6v6" stroke="#B46B2F" stroke-width="2"/><circle cx="25" cy="33" r="2" fill="#252525"/><circle cx="39" cy="33" r="2" fill="#252525"/><path d="M28 40q4 5 8 0" fill="none" stroke="#7A4B2B" stroke-width="2" stroke-linecap="round"/>'),
 avatarSvg('#ADB2B0','<ellipse cx="34" cy="41" rx="17" ry="10" fill="#D8A43C"/><circle cx="22" cy="37" r="7" fill="#D8A43C"/><path d="M17 31 20 10q2-7 6 0l-1 20m6 2 5-20q2-7 6 0l-6 25" fill="#D8A43C" stroke="#A85C35" stroke-width="2"/><circle cx="20" cy="35" r="1.8" fill="#222"/><circle cx="50" cy="43" r="3.5" fill="#F1E5C8"/>'),
 avatarSvg('#6FA7A0','<ellipse cx="34" cy="43" rx="15" ry="10" fill="#D7A137"/><circle cx="24" cy="35" r="8" fill="#D7A137"/><path d="M22 29 27 8q2-7 6 0l-3 22m5 1 8-21q2-6 6 1l-9 25" fill="#D7A137" stroke="#B66637" stroke-width="2"/><circle cx="23" cy="34" r="1.8" fill="#222"/><circle cx="48" cy="44" r="3.5" fill="#F0E2C5"/>'),
 avatarSvg('#C96536','<circle cx="22" cy="24" r="8" fill="#9AA3A0"/><circle cx="42" cy="24" r="8" fill="#9AA3A0"/><path d="M20 27q12-12 24 0l3 23H17z" fill="#9AA3A0"/><path d="M18 38q-8 5-9 13" fill="none" stroke="#8F563E" stroke-width="2"/><circle cx="24" cy="34" r="2" fill="#222"/><ellipse cx="16" cy="38" rx="3" ry="2" fill="#222"/><path d="M44 49q8-6 11-13 5 6 0 12" fill="none" stroke="#E6B9A0" stroke-width="2"/>'),
 avatarSvg('#F3E6C8','<circle cx="31" cy="32" r="17" fill="#C66B42"/><path d="M19 26q12-9 24 0M17 33q14-10 28 0M19 40q12-9 24 0M23 20q7 6 16 0M24 46q7-6 15 0" fill="none" stroke="#9E4F36" stroke-width="2.4"/><path d="M17 17 10 8M45 18l8-9M11 8l3 13M53 9l-2 13" stroke="#354449" stroke-width="2.2" stroke-linecap="round"/><path d="M45 43q8 1 10 7" fill="none" stroke="#C66B42" stroke-width="2.2"/>'),
 avatarSvg('#F4EEDC','<path d="M18 46 39 12" stroke="#8DAE82" stroke-width="6" stroke-linecap="round"/><path d="M36 15q9 5 12 12" fill="none" stroke="#7898B3" stroke-width="2.6"/><path d="M47 26q-6 7-4 17" fill="none" stroke="#7898B3" stroke-width="2"/><circle cx="17" cy="47" r="3" fill="#B8653A"/>'),
 avatarSvg('#F4E7CF','<rect x="17" y="15" width="25" height="30" rx="5" fill="#D7B07A"/><rect x="20" y="18" width="19" height="24" rx="3" fill="#C69A63"/><text x="29.5" y="37" text-anchor="middle" font-size="21" font-weight="800" font-family="sans-serif" fill="#354449">P</text><path d="M42 37q10-8 12 2-2 8-11 7" fill="none" stroke="#D4A41B" stroke-width="2.4"/>'),
 avatarSvg('#F6F0DE','<path d="M12 30q8-13 19 0t21 0" fill="none" stroke="#627E99" stroke-width="3.5"/><path d="M12 30q8 13 19 0t21 0" fill="none" stroke="#627E99" stroke-width="3.5"/><path d="M13 28q-6 9 0 15m38-15q6 9 0 15" fill="none" stroke="#627E99" stroke-width="2"/>'),
 avatarSvg('#F4EEDC','<path d="M12 16q10-3 20 5v30q-10-8-20-5zm40 0q-10-3-20 5v30q10-8 20-5z" fill="#D4744E" stroke="#B55E42" stroke-width="1.5"/><path d="M33 19v31" stroke="#F4EEDC" stroke-width="2"/><path d="M37 12q-4 8 2 13-6 5-2 10-6 5 0 13" fill="none" stroke="#7E9D77" stroke-width="4"/>'),
 avatarSvg('#F5EFDE','<path d="M12 16q10-3 20 5v30q-10-8-20-5zm40 0q-10-3-20 5v30q10-8 20-5z" fill="none" stroke="#D4744E" stroke-width="3"/><path d="M31 20v28" stroke="#D4744E" stroke-width="1.5"/><path d="M36 13q-5 8 1 14-6 6 0 12-5 5 0 12" fill="none" stroke="#8DAE82" stroke-width="4"/>'),
 avatarSvg('#F4E7CF','<path d="M18 29h30v15q0 10-15 10T18 44z" fill="#7898B3"/><path d="M20 33h26" stroke="#AFC1CF" stroke-width="2"/><path d="M22 36h22M24 39h18" stroke="#AFC1CF" stroke-width="1.5"/><path d="M48 32q10 0 8 10-2 7-9 5" fill="none" stroke="#D5A524" stroke-width="4"/><path d="M20 28h28" stroke="#D5A524" stroke-width="5"/><path d="M25 21q-3-4 0-8m8 8q-3-4 0-8m8 8q-3-4 0-8" fill="none" stroke="#B76A3D" stroke-width="2"/>'),
 avatarSvg('#F6F0DE','<path d="M35 12 23 42" stroke="#344244" stroke-width="4" stroke-linecap="round"/><path d="M35 12q14 4 18 10-13 3-22 13 0-14 4-23z" fill="#455763"/><path d="M20 43h20l4 11H16z" fill="#4C5151"/><path d="M20 43h20v4H20z" fill="#E3E0D4"/><path d="M31 38q4 2 6 6" stroke="#7E9D77" stroke-width="2" fill="none"/>'),
 avatarSvg('#F4E7CF','<path d="M19 16h26v34H19z" fill="#D2744B"/><ellipse cx="32" cy="17" rx="13" ry="5" fill="#B85D3E"/><ellipse cx="32" cy="49" rx="13" ry="5" fill="#B85D3E"/><path d="M20 22h24M20 27h24M20 32h24M20 37h24M20 42h24" stroke="#D8AB2E" stroke-width="2.7"/><path d="M45 38q8 1 10 6" stroke="#D8AB2E" stroke-width="2" fill="none"/>'),
 avatarSvg('#F6F0DE','<path d="M12 18 30 27 20 35 30 52l-7-15-13 8 5-12-8-9z" fill="#D37B55"/><path d="m30 27 19-11-8 17 14 5-18 3-7 11-1-16z" fill="#8DAE82"/><path d="M31 41q14 0 20 11" fill="none" stroke="#354449" stroke-width="2"/>'),
 avatarSvg('#F6F0DE','<path d="m10 34 16-17 9 12 18-8-9 16 10 10-20-5-12 10 2-14z" fill="#8DAE82"/><path d="m26 17 9 12-11 9-14-4zm9 12 9 8-10 5-10-4z" fill="#D47852"/><path d="M42 43q8 0 12 9" fill="none" stroke="#354449" stroke-width="2"/>'),
 avatarSvg('#F6F0DE','<path d="M19 10h26M19 54h26M22 10v9q0 11 10 14-10 4-10 14v7m20-44v9q0 11-10 14 10 4 10 14v7" fill="none" stroke="#4F5960" stroke-width="3"/><path d="M24 19h16q-2 8-8 11-6-3-8-11zm0 27q2-8 8-11 6 3 8 11z" fill="#7898B3"/><path d="M25 24q7 2 14 0M26 42q6-2 12 0" stroke="#D8A829" stroke-width="2"/>'),
 avatarSvg('#F6F0DE','<path d="M19 10h26M19 54h26M22 10v9q0 11 10 14-10 4-10 14v7m20-44v9q0 11-10 14 10 4 10 14v7" fill="none" stroke="#4F5960" stroke-width="3"/><path d="M24 19h16q-2 8-8 11-6-3-8-11zm0 27q2-8 8-11 6 3 8 11z" fill="#D8A829"/><path d="M25 24q7 2 14 0M26 42q6-2 12 0" stroke="#7898B3" stroke-width="2"/>'),
 avatarSvg('#F6F0DE','<path d="M14 49 45 13" stroke="#344244" stroke-width="5" stroke-linecap="round"/><path d="M19 44 45 17M16 39l8 8m-4-13 8 8m-4-13 8 8m-4-13 8 8m-4-13 8 8" stroke="#7898B3" stroke-width="2"/><path d="M45 13l6-3-2 7zM14 49l-3 5 6-2z" fill="#344244"/>'),
 avatarSvg('#F6F0DE','<path d="M13 18h38v32H13z" fill="none" stroke="#C96D49" stroke-width="3"/><path d="M18 20v28m5-28v28m5-28v28m5-28v28m5-28v28m5-28v28" stroke="#8DAE82" stroke-width="1.5"/><path d="M17 37q8-10 16 0 8-8 14 0v11H17z" fill="#7898B3"/><path d="M17 42q8-8 16 0 8-7 14 0v6H17z" fill="#8DAE82"/><path d="M13 16v36M51 16v36" stroke="#C96D49" stroke-width="4" stroke-linecap="round"/>')
];
const PRIVATE_AVATAR_ART=avatarSvg('#E7DDCC','<circle cx="32" cy="27" r="11" fill="#8F877B"/><path d="M13 54q2-18 19-18t19 18" fill="#8F877B"/><path d="M20 24q12-11 24 0" stroke="#F6F0DE" stroke-width="3" fill="none"/><path d="M22 44q10 7 20 0" stroke="#C66B42" stroke-width="3" fill="none" stroke-linecap="round"/>');
function legacyAvatarIndex(value){return LEGACY_AVATARS.indexOf(String(value||'').trim())}
function visualAvatarIndex(value){return legacyAvatarIndex(value)}
function avatarNode(index,label='Herní avatar'){
 const n=document.createElement('span'),safe=Number(index);
 n.className='organic-avatar';n.dataset.avatarIndex=String(safe);n.setAttribute('role','img');n.setAttribute('aria-label',label);
 n.innerHTML=safe>=0&&safe<AVATAR_COUNT?AVATAR_ART[safe]:PRIVATE_AVATAR_ART;
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
   const raw=String(btn.dataset.avatar||'').trim(),idx=legacyAvatarIndex(raw);
   if(idx<0)return;
   btn.classList.remove('organic-avatar-duplicate');btn.removeAttribute('aria-hidden');btn.tabIndex=0;btn.dataset.organicAvatarKey=raw;
   btn.classList.toggle('selected',idx===current);
   btn.setAttribute('aria-label',`Avatar: ${AVATAR_NAMES[idx]}`);btn.title=AVATAR_NAMES[idx];
   const existing=btn.querySelector('.organic-avatar');
   if(!existing||Number(existing.dataset.avatarIndex)!==idx)btn.replaceChildren(avatarNode(idx,AVATAR_NAMES[idx]));
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
 else if(!p&&chip&&!chip.querySelector('.organic-avatar')){chip.classList.add('organic-avatar-host');chip.replaceChildren(avatarNode(-1,'Profil zatím není uložen'))}
 if(p&&!p.useGoogleAvatar)document.querySelectorAll('.profile-avatar-big').forEach(el=>decorateAvatarElement(el,p.avatar||'🙂',`Avatar hráče ${p.name||''}`));
 const preview=document.getElementById('rankingPrivacyPreviewAvatar');if(preview&&p)decorateAvatarElement(preview,p.avatar||'🙂','Tvůj veřejný herní avatar');
 document.querySelectorAll('.home-ranking-avatar,.leader-avatar,.leaderboard-avatar,.ranking-avatar').forEach(el=>decorateAvatarElement(el,null,'Herní avatar'));
 decorateInlineLeaderboardAvatars();decorateAvatarPickers();
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