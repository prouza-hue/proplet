const printshop = '/difficulty/printshop/';
const pilotArt = name => new URL(name, import.meta.url).href;
const levels = {
  easy: ['Snadná', 'easy.webp'],
  medium: ['Střední', 'medium.webp'],
  hard: ['Těžká', 'hard.webp'],
  hardcore: ['Mozkožrout', 'hardcore.webp'],
  mozkomor: ['Mozkomor', 'mozkomor.webp'],
  mozkokalypsa: ['Mozkokalypsa', 'mozkokalypsa-series-ochre.svg'],
};
const weekdays = [
  ['Po', 'easy'], ['Út', 'easy'], ['St', 'medium', 'hardcore'],
  ['Čt', 'medium'], ['Pá', 'medium', 'mozkomor'],
  ['So', 'hard'], ['Ne', 'hard', 'mozkokalypsa'],
];
const dayMillis = 24 * 60 * 60 * 1000;
const namedDate = new Intl.DateTimeFormat('cs-CZ', {weekday:'long', day:'numeric', month:'long', timeZone:'UTC'});
const shortDate = new Intl.DateTimeFormat('cs-CZ', {day:'numeric', month:'numeric', timeZone:'UTC'});
const proplet = 'https://hrajproplet.cz';
const patronHeart = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20S3 14.5 3 8.5C3 3 10 2.5 12 7c2-4.5 9-4 9 1.5C21 14.5 12 20 12 20Z" fill="currentColor"/></svg>';

// The same four navigation signs as the Proplet shell.
const navigation = [
  ['Dnes', '<circle cx="12" cy="12" r="3.5"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"/>'],
  ['Hrát', '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>'],
  ['Soutěže', '<path d="M8 20v-7H4v7M14 20V8h-4v12M20 20V4h-4v16"/>'],
  ['Já', '<circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.5-4 2.7-6 6.5-6s6 2 6.5 6"/>'],
];

const art = (src, cls = '') => `<img class="${cls}" src="${src}" alt="" draggable="false">`;

function weekdayIndex(date) {
  return (date.getUTCDay() + 6) % 7;
}

export function reviewRhythm(dateISO) {
  const index = weekdayIndex(new Date(dateISO + 'T12:00:00Z'));
  const [, daily, extra = null] = weekdays[index];
  return { daily, extra };
}

function weekStrip(range, currentDay) {
  const days = weekdays.map(([label, base, extra], i) => `
    <span class="pt-day"${i === currentDay ? ' aria-current="date"' : ''}>
      <b>${label}</b>
      <span class="pt-day-art">${art(printshop + levels[base][1])}${extra ? art(printshop + levels[extra][1]) : ''}</span>
    </span>`).join('');
  return `<button type="button" class="pt-week" data-other="Týdenní rozvrh"
      aria-label="Týdenní rozvrh výzev, ${range}, dnes ${weekdays[currentDay][0]}">
    <span class="pt-week-title"><b>Tento týden</b><span>${range}</span></span>
    <span class="pt-days">${days}</span>
  </button>`;
}

function tile({key, label, detail, image, xp}) {
  return `<button type="button" class="pt-tile pt-${key}" data-other="${label}">
    ${art(image, 'pt-tile-art')}
    <span class="pt-tile-copy"><strong>${label}</strong><span>${detail}</span>
      ${xp ? `<span class="pt-xp">+${xp} XP</span>` : ''}
    </span>
  </button>`;
}

export function renderToday(root, {week, weekStart, dateISO, progress, nextLabel, tajenkaStatus = 'new',
  dailyStatus = 'new', extraStatus = 'new', freeStatus = 'started', freeLevel = 12, hasExtra, hasResume,
  onPlay, onPreview, onOther, onTajenka, onCalendar}) {
  const monday = Date.parse(weekStart + 'T12:00:00Z');
  const selectedDate = dateISO ? Date.parse(dateISO + 'T12:00:00Z') : monday + 2 * dayMillis;
  const currentDay = weekdayIndex(new Date(selectedDate));
  const [, base, scheduledExtra] = weekdays[currentDay];
  const extra = hasExtra === false ? null : levels[scheduledExtra];
  const weekdayDate = namedDate.format(selectedDate);
  const date = weekdayDate[0].toLocaleUpperCase('cs') + weekdayDate.slice(1);
  const range = shortDate.formatRange(monday, monday + 6 * dayMillis);
  const started = progress.status === 'started';
  const complete = progress.status === 'complete';
  const linkHint = started ? `Rozehráno · ${progress.found} ze 3` : 'Slova se mohou křížit';
  const linkAction = complete ? 'Řetěz' : started ? 'Pokračovat' : 'Hrát';
  const linkLabel = complete ? 'Prohlédnout dokončený řetěz Spojek' : started ? 'Pokračovat ve Spojkách' : 'Hrát Spojky s křížením';
  const tajenkaComplete = tajenkaStatus === 'done';
  const tajenkaStarted = tajenkaStatus === 'started';
  const tajenkaAction = tajenkaComplete ? 'Zobrazit výsledek dnešní Tajenky' : tajenkaStarted ? 'Pokračovat v dnešní Tajence' : 'Luštit dnešní Tajenku';
  const dailyComplete = dailyStatus === 'done';
  const dailyAction = dailyComplete ? 'Výsledek' : dailyStatus === 'started' ? 'Pokračovat' : 'Hrát';
  const extraComplete = extraStatus === 'done';
  const extraDetail = extraComplete ? '✓ Hotovo' : extraStatus === 'started' ? 'Rozehráno' : extra?.[0];
  const resume = hasResume !== false && freeStatus === 'started';
  const level = Number.isInteger(freeLevel) && freeLevel > 0 ? freeLevel : 12;
  const freeDetail = `${freeStatus === 'done' ? 'Výsledek' : 'Střední'} · úroveň\u00a0${level}`;
  const freeTile = tile({key:'free',label:resume ? 'Rozehráno' : 'Volná hra',detail:freeDetail,
    image:printshop + 'medium.webp'});
  const nav = navigation.map(([label, glyph], i) => `<button type="button"
      ${i === 0 ? 'aria-current="page"' : `data-other="${label}"`}>
    <svg viewBox="0 0 24 24" aria-hidden="true">${glyph}</svg><span>${label}</span>
  </button>`).join('');

  root.innerHTML = `<div class="pt-today"><div class="pt-shell">
    <header class="pt-head">
      <div class="pt-brand" aria-label="Proplet">${art('/brand/mark.svg')}<span>Proplet</span></div>
      <button type="button" class="pt-preview" data-preview>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h8m5 0h5M3 12h2m5 0h11M3 18h10m5 0h3"/><circle cx="13.5" cy="6" r="2.5"/><circle cx="7.5" cy="12" r="2.5"/><circle cx="15.5" cy="18" r="2.5"/></svg>
        <span>Náhled <span class="pt-preview-count">· ${week}/4</span></span>
      </button>
    </header>

    <section class="pt-main" aria-labelledby="pt-today-title">
      <h1 id="pt-today-title" class="pt-visually-hidden">Dnes</h1>
      <div class="pt-primary-row">
        <button type="button" class="pt-daily" data-other="Denní výzva">
          <span class="pt-daily-copy">
            <strong>Denní výzva</strong>
            <span class="pt-date">${date}</span>
            <span class="pt-daily-stats">${dailyComplete ? '✓ Hotovo' : `${levels[base][0]} <span class="pt-xp">+100 XP</span>`}</span>
          </span>
          ${art('/rewards/printshop/symbol-daily.svg', 'pt-daily-art')}
          ${dailyComplete ? '' : '<span class="pt-streak">Dohráním udržíš sérii.</span>'}
          <span class="pt-primary-cta">${dailyAction}</span>
        </button>
        ${weekStrip(range, currentDay)}
      </div>

      <button type="button" class="pt-links" data-spojky data-state="${progress.status}" aria-label="${linkLabel}">
        ${art(pilotArt('./spojky-print.svg'), 'pt-links-art')}
        <span class="pt-links-copy">
          <span class="pt-links-heading"><strong>Spojky</strong>
            ${complete ? '<span class="pt-done"><span aria-hidden="true">✓</span> Hotovo</span>' : ''}
          </span>
          ${complete ? '<span class="pt-next"></span>' : `<span class="pt-link-status">${linkHint}</span>`}
        </span>
        <span class="pt-links-action">${linkAction}<span class="pt-angle" aria-hidden="true"></span></span>
      </button>

      <div class="pt-tiles">
        ${dailyComplete ? freeTile : ''}
        ${extra ? tile({key:'extra',label:'Extra',detail:extraDetail,image:printshop + extra[1],xp:extraComplete ? 0 : 200}) : ''}
        <div class="os-taj-combo pt-taj-combo">
          <button type="button" class="pt-tile pt-taj-play" data-tajenka-today aria-label="${tajenkaAction}">
            ${art(pilotArt('./tajenka.webp'), 'pt-tile-art')}
            <span class="pt-tile-copy">
              <strong>Tajenka</strong>
              ${tajenkaComplete ? '<span>✓ Hotovo</span>' : `${tajenkaStarted ? '<span>Rozehráno</span>' : ''}<span class="pt-xp">+200 XP</span>`}
            </span>
          </button>
          <button type="button" class="os-taj-calendar pt-taj-calendar" data-tajenka-calendar
              title="Posledních sedm Tajenek" aria-label="Posledních sedm Tajenek" aria-haspopup="dialog" aria-controls="tajenkaEditionsDialog">
            <span aria-hidden="true">7</span>
          </button>
        </div>
        ${dailyComplete ? '' : freeTile}
        ${tile({key:'team',label:'Soutěže',detail:'Týdenní · měsíční',image:'/assets/navigation/competitions-v1.webp'})}
        ${extra ? '' : tile({key:'archive',label:'Archiv',detail:'800 desek',image:'/assets/archive/archive-letterpress-v2.webp'})}
      </div>
      <a class="pt-support" href="${proplet}/?open=daily#patronTodayLink:~:text=Podpo%C5%99it%20Proplet"
         aria-label="Podpořit Proplet na hrajproplet.cz" title="Přejít k podpoře na hrajproplet.cz">
        <span class="pt-stamps" aria-hidden="true"><i>${patronHeart}</i><i>${patronHeart}</i></span>
        <strong>Podpořit Proplet</strong><span class="pt-support-arrow" aria-hidden="true">→</span>
      </a>
    </section>

    <footer class="pt-footer">
      <div>© 2026 Proplet <span aria-hidden="true">·</span> Pavel Prouza</div>
      <nav class="pt-footer-links" aria-label="O Propletu">
        <a href="${proplet}/jak-hrat.html">Jak hrát</a>
        <a href="${proplet}/privacy.html">Soukromí</a>
        <a href="${proplet}/terms.html">Podmínky</a>
        <a href="${proplet}/?open=daily#appVersionFooter:~:text=Nahl%C3%A1sit%20chybu"
           aria-label="Nahlásit chybu na hrajproplet.cz" title="Přejít k hlášení chyby na hrajproplet.cz">Nahlásit chybu</a>
      </nav>
    </footer>
    <nav class="pt-nav" aria-label="Hlavní navigace">${nav}</nav>
  </div></div>`;

  if (complete) root.querySelector('.pt-next').textContent = nextLabel || '';
  root.querySelector('[data-preview]').addEventListener('click', onPreview);
  root.querySelector('[data-spojky]').addEventListener('click', onPlay);
  root.querySelector('[data-tajenka-today]').addEventListener('click', event => onTajenka(event.currentTarget));
  root.querySelector('[data-tajenka-calendar]').addEventListener('click', event => onCalendar(event.currentTarget));
  for (const control of root.querySelectorAll('[data-other]')) {
    control.addEventListener('click', () => onOther(control.dataset.other));
  }
}
