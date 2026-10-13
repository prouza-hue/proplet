/* Review-only snapshot of public/app.js and ribbon-catalog.js at main f31c895.
   Does not import the game, register a worker, call APIs or write account data. */
'use strict';
const RANKS = [{"xp":0,"name":"Nováček","phase":"První kroky","asset":"novacek"},{"xp":100,"name":"Písmenkář","phase":"První kroky","asset":"rank-02"},{"xp":250,"name":"Hledač nití","phase":"První kroky","asset":"rank-04"},{"xp":400,"name":"Slovolovec","phase":"První kroky","asset":"rank-03"},{"xp":600,"name":"Propletač","phase":"První kroky","asset":"rank-05"},{"xp":850,"name":"Kličkař","phase":"První kroky","asset":"rank-06"},{"xp":1100,"name":"Uzlovač","phase":"První kroky","asset":"rank-10"},{"xp":1450,"name":"Cestář","phase":"První kroky","asset":"rank-12"},{"xp":1800,"name":"Stopař slov","phase":"První kroky","asset":"achievement-discovery-10"},{"xp":2200,"name":"Průzkumník mřížky","phase":"První kroky","asset":"achievement-discovery-50"},{"xp":2700,"name":"Labyrintník","phase":"První kroky","asset":"rank-15"},{"xp":3250,"name":"Slovní taktik","phase":"První kroky","asset":"rank-08"},{"xp":3850,"name":"Krotitel zákrut","phase":"První kroky","asset":"rank-13"},{"xp":4500,"name":"Mistr cest","phase":"Mistrovství","asset":"rank-07"},{"xp":5200,"name":"Mistr zákrut","phase":"Mistrovství","asset":"rank-14"},{"xp":6000,"name":"Mistr šneků","phase":"Mistrovství","asset":"rank-19"},{"xp":6800,"name":"Propletový ninja","phase":"Mistrovství","asset":"rank-17"},{"xp":7700,"name":"Slovní alchymista","phase":"Mistrovství","asset":"alchymista"},{"xp":8700,"name":"Slovní mág","phase":"Mistrovství","asset":"rank-09"},{"xp":9700,"name":"Mřížkový mág","phase":"Mistrovství","asset":"rank-20"},{"xp":11000,"name":"Slovočaroděj","phase":"Mistrovství","asset":"rank-25"},{"xp":12500,"name":"Krotitel Mozkožroutů","phase":"Mistrovství","asset":"rank-22"},{"xp":14000,"name":"Strážce mřížky","phase":"Mistrovství","asset":"achievement-hard-50"},{"xp":15800,"name":"Architekt labyrintu","phase":"Velmistři a strážci","asset":"rank-34"},{"xp":18300,"name":"Mistr skrytých cest","phase":"Velmistři a strážci","asset":"achievement-tajenka-10"},{"xp":20000,"name":"Mistr nekonečna","phase":"Velmistři a strážci","asset":"rank-27"},{"xp":21500,"name":"Velmistr Propletu","phase":"Velmistři a strážci","asset":"rank-16"},{"xp":25000,"name":"Arcimistr Propletu","phase":"Velmistři a strážci","asset":"rank-24"},{"xp":27500,"name":"Strážce tajných cest","phase":"Velmistři a strážci","asset":"rank-33"},{"xp":30000,"name":"Strážce všech cest","phase":"Velmistři a strážci","asset":"rank-31"},{"xp":32500,"name":"Král mřížky","phase":"Velmistři a strážci","asset":"rank-23"},{"xp":35000,"name":"Propletový titán","phase":"Velmistři a strážci","asset":"rank-26"},{"xp":38500,"name":"Nadslovník","phase":"Velmistři a strážci","asset":"rank-21"},{"xp":42000,"name":"Hvězdný propletač","phase":"Za hranice mřížky","asset":"rank-28"},{"xp":46000,"name":"Orbitální luštitel","phase":"Za hranice mřížky","asset":"rank-29"},{"xp":50500,"name":"Galaktický slovolovec","phase":"Za hranice mřížky","asset":"rank-30"},{"xp":55500,"name":"Hvězdný navigátor","phase":"Za hranice mřížky","asset":"achievement-daily-200"},{"xp":58000,"name":"Čtenář souhvězdí","phase":"Za hranice mřížky","asset":"achievement-medium-100"},{"xp":61000,"name":"Strážce souhvězdí","phase":"Za hranice mřížky","asset":"achievement-xp-61000"},{"xp":66000,"name":"Mistr hvězdných cest","phase":"Za hranice mřížky","asset":"achievement-xp-75000"},{"xp":70500,"name":"Architekt souhvězdí","phase":"Za hranice mřížky","asset":"achievement-xp-95000"},{"xp":75000,"name":"Strážce slovního vesmíru","phase":"Za hranice mřížky","asset":"achievement-cd-100"},{"xp":80000,"name":"Mistr slovního vesmíru","phase":"Za hranice mřížky","asset":"achievement-daily-365"},{"xp":85000,"name":"Architekt slovního vesmíru","phase":"Za hranice mřížky","asset":"achievement-all-800"},{"xp":90000,"name":"Vládce slovního vesmíru","phase":"Za hranice mřížky","asset":"achievement-hc-100"},{"xp":95000,"name":"Strážce nekonečna","phase":"Za hranice mřížky","asset":"achievement-clean-250"},{"xp":100000,"name":"Velmistr nekonečna","phase":"Za hranice mřížky","asset":"achievement-xp-50000"},{"xp":105000,"name":"Arcimistr nekonečna","phase":"Za hranice mřížky","asset":"achievement-xp-120000"},{"xp":110000,"name":"Legenda Propletu","phase":"Legendy","asset":"rank-11"},{"xp":115000,"name":"Absolutní Propletač","phase":"Legendy","asset":"rank-32"},{"xp":120000,"name":"Legenda bez konce","phase":"Legendy","asset":"legenda"}];
const XP_ACHIEVEMENTS = [{"id":"xp-100","name":"První stovka XP","xp":100,"asset":"achievement-xp-100"},{"id":"xp-500","name":"Sběrač XP","xp":500,"asset":"achievement-xp-500"},{"id":"xp-1000","name":"Tisícovka","xp":1000,"asset":"achievement-xp-1000"},{"id":"xp-2500","name":"Pokladnice","xp":2500,"asset":"achievement-xp-2500"},{"id":"xp-5000","name":"Pět tisíc","xp":5000,"asset":"achievement-xp-5000"},{"id":"xp-10000","name":"Pěticiferný","xp":10000,"asset":"achievement-xp-10000"},{"id":"xp-25000","name":"XP magnát","xp":25000,"asset":"achievement-xp-25000"},{"id":"xp-40000","name":"Čtyřicet tisíc cest","xp":40000,"asset":"achievement-xp-40000"},{"id":"xp-50000","name":"Padesátitisícový let","xp":50000,"asset":"achievement-xp-50000"},{"id":"xp-61000","name":"Absolutní sběratel","xp":61000,"asset":"achievement-xp-61000"},{"id":"xp-75000","name":"Klíč ke všem cestám","xp":75000,"asset":"achievement-xp-75000"},{"id":"xp-95000","name":"Architekt XP","xp":95000,"asset":"achievement-xp-95000"},{"id":"xp-120000","name":"Za hranicí mřížky","xp":120000,"asset":"achievement-xp-120000"}];
const TOP_XP = 120000;
const CHAPTER_STEP = 5000;
const MILESTONE_START = 150000;
const MILESTONE_STEP = 50000;
const fmt = value => value.toLocaleString('cs-CZ');
const $ = id => document.getElementById(id);
let xp = 158000;

function rankState(points) {
  let index = 0;
  RANKS.forEach((rank, i) => { if (points >= rank.xp) index = i; });
  const current = RANKS[index];
  const next = RANKS[index + 1] || null;
  const chapter = points >= TOP_XP ? Math.floor((points - TOP_XP) / CHAPTER_STEP) + 1 : null;
  const chapterStart = chapter === null ? null : TOP_XP + (chapter - 1) * CHAPTER_STEP;
  return { index: index + 1, current, next, chapter, chapterStart };
}

function newMilestoneCount(points) {
  return points < MILESTONE_START ? 0 : Math.floor((points - MILESTONE_START) / MILESTONE_STEP) + 1;
}

function milestoneFor(target) {
  return XP_ACHIEVEMENTS.find(item => item.xp === target) || {
    id: `xp-${target}`, xp: target, name: `${fmt(target)} XP`, asset: null,
  };
}

function milestoneWindow(points) {
  const count = newMilestoneCount(points);
  if (count > 0) {
    const latest = MILESTONE_START + (count - 1) * MILESTONE_STEP;
    return [latest, latest + MILESTONE_STEP, latest + 2 * MILESTONE_STEP].map(milestoneFor);
  }
  const candidates = [...XP_ACHIEVEMENTS, milestoneFor(MILESTONE_START), milestoneFor(MILESTONE_START + MILESTONE_STEP)];
  const nextIndex = candidates.findIndex(item => points < item.xp);
  return candidates.slice(Math.max(0, nextIndex - 1), Math.max(0, nextIndex - 1) + 3);
}

function rankCard(points, continuation) {
  const r = rankState(points);
  const chapterActive = continuation && r.chapter !== null;
  const start = chapterActive ? r.chapterStart : r.current.xp;
  const next = chapterActive ? start + CHAPTER_STEP : r.next?.xp;
  const progress = next ? Math.max(0, Math.min(100, (points - start) / (next - start) * 100)) : 100;
  const progressText = next ? `${fmt(points - start)} / ${fmt(next - start)} XP` : 'Všechny hodnosti dosaženy';
  const nextLabel = chapterActive ? `Kapitola ${fmt(r.chapter + 1)}` : r.next?.name;
  return `<div class="profile-card">
    <div class="card-top"><img class="avatar" src="/assets/avatars/v3/01-liska.svg" alt=""><div><h3>Alex</h3><p>Moje cesta Propletem</p></div><div class="xp-total"><strong>${fmt(points)}</strong><span>XP celkem</span></div></div>
    <div class="rank-main"><img class="rank-icon" src="/rewards/printshop/${r.current.asset}.svg" alt=""><div class="rank-copy"><h3>${r.current.name}</h3><p>Hodnost ${r.index} · od ${fmt(r.current.xp)} XP</p>${chapterActive ? `<button type="button" class="chapter" data-detail="chapter">Kapitola ${fmt(r.chapter)} <span aria-hidden="true">?</span></button>` : ''}</div></div>
    <div class="progress-label"><strong>${chapterActive ? 'Tahle kapitola' : next ? 'K další hodnosti' : 'Tvoje cesta'}</strong><span>${next ? progressText : '51 / 51'}</span></div>
    <div class="progress ${next ? '' : 'complete'}" role="progressbar" aria-label="${chapterActive ? 'Postup v kapitole' : 'Postup k další hodnosti'}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Number(progress.toFixed(2))}" aria-valuetext="${progressText}"><span style="width:${progress}%"></span></div>
    <p class="next-goal">${next ? `<strong>${nextLabel}</strong><br>Za ${fmt(next - points)} XP · při ${fmt(next)} XP` : 'Jsi na nejvyšší hodnosti. Další cíl chybí.'}</p>
    ${continuation ? `<button type="button" class="rank-detail" data-detail="transition">Jak se započítají moje dosavadní XP?</button>` : ''}
  </div>${continuation ? '' : `<p class="old-caption">${points >= TOP_XP ? 'XP se dál sčítají. Hodnost i XP úspěchy ale končí na 120 000 XP.' : 'Do 120 000 XP jsou oba návrhy stejné. Žádná hranice ani dosažená hodnost se neposouvá.'}</p>`}`;
}

function art(item, large = false) {
  return item.asset
    ? `<img class="${large ? 'detail-image' : ''}" src="/rewards/printshop/${item.asset}.svg" alt="">`
    : `<div class="${large ? 'detail-number' : 'number-art'}">${fmt(item.xp)}${large ? '' : '<small>XP</small>'}</div>`;
}

function render() {
  $('newCard').innerHTML = rankCard(xp, true);
  $('oldCard').innerHTML = rankCard(xp, false);
  const milestones = milestoneWindow(xp);
  $('milestoneList').innerHTML = milestones.map(item => `<button type="button" class="milestone ${xp >= item.xp ? 'done' : 'pending'}" data-milestone="${item.xp}" aria-label="${item.name}, ${xp >= item.xp ? 'splněno' : `zbývá ${fmt(item.xp - xp)} XP`}, zobrazit detail">${art(item)}<strong>${item.name}</strong><small>${xp >= item.xp ? 'Splněno ✓' : `Chybí ${fmt(item.xp - xp)} XP`}</small></button>`).join('');
  const count = XP_ACHIEVEMENTS.filter(item => xp >= item.xp).length + newMilestoneCount(xp);
  $('milestoneCount').textContent = `${fmt(count)} získáno`;
  $('xp').value = String(xp);
  $('sample').value = [...$('sample').options].some(option => Number(option.value) === xp) ? String(xp) : '';
}

function openDetail(kind, value) {
  const r = rankState(xp);
  let html = '';
  if (kind === 'chapter') {
    html = `<img class="detail-image" src="/rewards/printshop/legenda.svg" alt=""><h2 id="detailTitle">Legenda bez konce</h2><p class="detail-status">Kapitola ${fmt(r.chapter)} · od ${fmt(r.chapterStart)} XP</p><p>Titul už ti patří. Každých dalších 5 000 XP otevíráš další kapitolu své legendy.</p><p>První začíná na 120 000 XP. Žádný restart a žádné nové sbírání od nuly — počítají se všechny tvoje dosavadní XP.</p><p>Do kapitoly ${fmt(r.chapter + 1)} ti chybí <strong>${fmt(r.chapterStart + CHAPTER_STEP - xp)} XP</strong>.</p>`;
  } else if (kind === 'transition') {
    const count = newMilestoneCount(xp);
    html = `<img class="detail-image" src="/rewards/printshop/${r.current.asset}.svg" alt=""><h2 id="detailTitle">Tvoje cesta má pokračování</h2><p>Všech <strong>${fmt(xp)} XP</strong> se počítá i do nového pokračování. Hodnost <strong>${r.current.name}</strong> a získané úspěchy zůstávají.</p><p class="detail-status">${r.chapter !== null ? `Rovnou pokračuješ v kapitole ${fmt(r.chapter)}.` : 'Ke své další hodnosti pokračuješ jako dosud.'}${count > 0 ? `<br>${count === 1 ? 'Ve sbírce přibude 1 nový XP úspěch.' : `Ve sbírce přibudou nové XP úspěchy: ${fmt(count)}.`}` : ''}</p><p>Nic se znovu neodehrává a není potřeba nic vyzvedávat. Kapitoly a odznaky samy o sobě další XP nepřidávají.</p>`;
  } else if (kind === 'legacy') {
    html = `<h2 id="detailTitle">Dosavadní XP úspěchy</h2><p>Všech třináct zůstává se stejným názvem, obrázkem i hranicí.</p><ul class="legacy-list">${XP_ACHIEVEMENTS.map(item => `<li><img src="/rewards/printshop/${item.asset}.svg" alt=""><div><strong>${item.name}</strong><small>${fmt(item.xp)} XP</small></div>${xp >= item.xp ? '<span class="check" aria-label="Splněno">✓</span>' : ''}</li>`).join('')}</ul>`;
  } else {
    const item = milestoneFor(value);
    html = `${art(item, true)}<h2 id="detailTitle">${item.name}</h2><p style="text-align:center">Nasbírej ${fmt(item.xp)} XP.</p><p class="detail-status">${xp >= item.xp ? 'Splněno. Patří do tvé sbírky.' : `Zbývá ${fmt(item.xp - xp)} XP.`}</p><p>Započítávají se celoživotní XP. Tento úspěch žádné další XP nepřidává.</p>`;
  }
  $('detailContent').innerHTML = html;
  $('detail').showModal();
}

$('sample').addEventListener('change', event => { xp = Number(event.target.value); render(); });
$('xp').addEventListener('change', event => {
  const value = Number(event.target.value);
  xp = Number.isFinite(value) ? Math.max(0, Math.min(999999999, Math.floor(value))) : 0;
  render();
});
$('compare').addEventListener('click', () => {
  const comparing = $('compare').getAttribute('aria-pressed') !== 'true';
  $('compare').setAttribute('aria-pressed', String(comparing));
  $('compare').textContent = comparing ? 'Skrýt dnešní stav' : 'Porovnat s dneškem';
  $('comparison').classList.toggle('is-comparing', comparing);
  $('oldPanel').hidden = !comparing;
});
$('allAchievements').addEventListener('click', () => openDetail('legacy'));
document.addEventListener('click', event => {
  const detail = event.target.closest('[data-detail]');
  if (detail) openDetail(detail.dataset.detail);
  const milestone = event.target.closest('[data-milestone]');
  if (milestone) openDetail('milestone', Number(milestone.dataset.milestone));
});
$('detail').addEventListener('click', event => {
  if (event.target !== $('detail')) return;
  const box = $('detail').getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) $('detail').close();
});
render();
