import { boards } from './boards.js';
import { getProgress, mountGame, mountGameTutorial, resetProgress, reviewSolution } from './game.js';
import { renderToday, reviewRhythm } from './today.js';
import { closeTajenkaCalendar, getTajenkaStatus, mountTajenka, openTajenkaCalendar } from './tajenka-preview.js';
import { getPlayStatus, mountPlay } from './preview-play.js';

// These four weeks are the pilot's review calendar. Everybody sees the same board for a week.
function calendarDate(iso) { return new Date(`${iso}T12:00:00Z`); }
function shortDate(date) { return `${date.getUTCDate()}. ${date.getUTCMonth() + 1}.`; }
const weeks = boards.map((board, index) => {
  const start = calendarDate(board.start);
  const end = calendarDate(board.start);
  end.setUTCDate(end.getUTCDate() + 6);
  const first = start.getUTCMonth() === end.getUTCMonth() ? `${start.getUTCDate()}.` : shortDate(start);
  const following = boards[index + 1];
  return {
    days: Array.from({ length: 7 }, (_, offset) => {
      const day = calendarDate(board.start);
      day.setUTCDate(day.getUTCDate() + offset);
      return day.toISOString().slice(0, 10);
    }),
    range: `${first} – ${shortDate(end)}`,
    next: following ? `Další deska v pondělí ${shortDate(calendarDate(following.start))}` : 'Poslední deska pilotu.',
  };
});
const settingsKey = 'proplet.spojky.crossings.settings.v1';
const app = document.querySelector('#pilot-app');
const menu = document.querySelector('#pilot-menu');
const detail = document.querySelector('#pilot-detail');
const weekList = document.querySelector('#pilot-weeks');
const dayChoice = document.querySelector('#pilot-day');
const resumeChoice = document.querySelector('#pilot-resume');
const themeChoice = document.querySelector('#pilot-theme');
const deviceTheme = window.matchMedia('(prefers-color-scheme: dark)');
const themeChoices = ['auto', 'light', 'dark'];
const czechDay = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit' });
function scheduledWeek() {
  const today = czechDay.format(new Date());
  const index = boards.findLastIndex(board => board.start <= today);
  return Math.max(1, index + 1);
}
const settings = { theme: 'auto' };
let game;
let mounted = '';
let renderedView = '';
let isResetDialog = false;
const dateLabel = new Intl.DateTimeFormat('cs-CZ', { weekday: 'long', day: 'numeric', month: 'numeric', timeZone: 'UTC' });
const views = new Set(['hra', 'navod', 'reseni', 'nahled', 'tajenka', 'kalendar', 'denni', 'extra', 'volna']);
const playViews = { denni: 'daily', extra: 'extra', volna: 'free' };

function validWeek(value) {
  return Number.isInteger(value) && value >= 1 && value <= weeks.length;
}
try {
  const saved = JSON.parse(localStorage.getItem(settingsKey)) || {};
  if (themeChoices.includes(saved.theme)) settings.theme = saved.theme;
} catch { /* The pilot also runs when the browser only allows in-memory progress. */ }
function saveSettings() {
  try { localStorage.setItem(settingsKey, JSON.stringify({ theme: settings.theme })); } catch { /* In-memory fallback. */ }
}
function applyTheme() {
  document.documentElement.dataset.theme = settings.theme === 'auto' ? (deviceTheme.matches ? 'dark' : 'light') : settings.theme;
  themeChoice.value = settings.theme;
}
applyTheme();
deviceTheme.addEventListener('change', applyTheme);
themeChoice.addEventListener('change', () => {
  settings.theme = themeChoice.value;
  applyTheme();
  saveSettings();
});

function route() {
  const url = new URL(location.href);
  const requestedDay = url.searchParams.get('datum');
  const datedWeek = weeks.findIndex(({ days }) => days.includes(requestedDay));
  const picked = Number(url.searchParams.get('tyden'));
  const defaultWeek = validWeek(picked) ? picked : scheduledWeek();
  const week = datedWeek >= 0 ? datedWeek + 1 : defaultWeek;
  const day = datedWeek >= 0 ? requestedDay : weeks[week - 1].days[2];
  const hash = url.hash.slice(1);
  const view = views.has(hash) && (hash !== 'extra' || reviewRhythm(day).extra) ? hash : 'dnes';
  const level = Number(url.searchParams.get('uroven'));
  return { week, day, view, edition: url.searchParams.get('vydani') || day, resume: url.searchParams.get('rozehrano') !== '0',
    freeLevel: [12, 13].includes(level) ? level : 0 };
}
function nextFreeLevel(day, resume) {
  return resume && getPlayStatus('free', day) !== 'done' ? 12 : 13;
}
function go(view, week, { replace = false, previous = null, day, edition, resume } = {}) {
  const current = route();
  const url = new URL(location.href);
  url.searchParams.set('tyden', String(week));
  const weekday = weeks[current.week - 1].days.indexOf(current.day);
  url.searchParams.set('datum', day || weeks[week - 1].days[weekday]);
  if ((resume ?? current.resume) === false) url.searchParams.set('rozehrano', '0');
  else url.searchParams.delete('rozehrano');
  if (view === 'tajenka' && edition && edition !== url.searchParams.get('datum')) url.searchParams.set('vydani', edition);
  else url.searchParams.delete('vydani');
  if (view === 'volna') url.searchParams.set('uroven', String(nextFreeLevel(url.searchParams.get('datum'), resume ?? current.resume)));
  else url.searchParams.delete('uroven');
  url.hash = view === 'dnes' ? '' : view;
  history[replace ? 'replaceState' : 'pushState']({ pilot: true, previous }, '', url);
  render();
}
function focusReturn(view) {
  const selectors = {
    kalendar: '[data-tajenka-calendar]', tajenka: '[data-tajenka-today]', nahled: '[data-preview]',
    denni: '.pt-daily', extra: '.pt-extra', volna: '.pt-free',
  };
  requestAnimationFrame(() => app.querySelector(selectors[view] || '[data-spojky]')?.focus({ preventScroll: true }));
}
function goHome() {
  if (history.state?.pilot && ['dnes', 'kalendar'].includes(history.state.previous)) history.back();
  else {
    const { view, week } = route();
    go('dnes', week, { replace: true });
    focusReturn(view);
  }
}
function makeButton(text, callback, className) {
  const button = document.createElement('button');
  button.type = 'button';
  if (className) button.className = className;
  button.textContent = text;
  button.addEventListener('click', callback);
  return button;
}
function showMenu(week, day, resume) {
  weekList.replaceChildren();
  weeks.forEach(({ range }, index) => {
    const number = index + 1;
    const progress = getProgress(boards[index]);
    const button = makeButton('', () => {
      menu.close();
      go('dnes', number, { replace: true });
      focusReturn('nahled');
    }, 'pilot-week');
    button.setAttribute('aria-pressed', String(number === week));
    const label = document.createElement('strong');
    const dates = document.createElement('span');
    const status = document.createElement('small');
    label.textContent = `${number}. týden`;
    dates.textContent = range;
    status.textContent = progress.status === 'complete' ? 'Vyřešeno' : progress.status === 'started' ? `Rozehráno · ${progress.found}/3` : 'Nová deska';
    button.append(label, dates, status);
    weekList.append(button);
  });
  dayChoice.replaceChildren(...weeks[week - 1].days.map(iso => {
    const label = dateLabel.format(calendarDate(iso));
    return new Option(label.charAt(0).toLocaleUpperCase('cs') + label.slice(1), iso);
  }));
  dayChoice.value = day;
  resumeChoice.checked = resume;
  menu.querySelector('[data-action="ask-reset"]').hidden = getProgress(boards[week - 1]).status === 'new';
  if (!menu.open) menu.showModal();
}
dayChoice.addEventListener('change', () => {
  go('dnes', route().week, { replace: true, day: dayChoice.value });
  focusReturn('nahled');
});
resumeChoice.addEventListener('change', () => {
  go('dnes', route().week, { replace: true, resume: resumeChoice.checked });
  focusReturn('nahled');
});
function showDetail(title, copy, reset = false) {
  isResetDialog = reset;
  detail.querySelector('#pilot-detail-title').textContent = title;
  detail.querySelector('#pilot-detail-copy').textContent = copy;
  detail.querySelector('[data-action="reset"]').hidden = !reset;
  detail.querySelector('.pilot-detail-actions [data-action="close-detail"]').textContent = reset ? 'Ponechat postup' : 'Zpět na Dnes';
  if (!detail.open) detail.showModal();
}
function showOther(name) {
  const play = { 'Denní výzva': 'denni', Extra: 'extra', Rozehráno: 'volna', 'Volná hra': 'volna' }[name];
  if (play) {
    go(play, route().week, { previous: 'dnes' });
    return;
  }
  const context = [
    [/Archiv/i, 'Tady hráč otevře dřívější desky. V tomto náhledu si můžeš zahrát všechny čtyři týdny Spojek.'],
    [/týden|rozvrh/i, 'Týdenní přehled patří denním výzvám. Nová deska Spojek je společná na celý týden.'],
  ];
  const item = context.find(([pattern]) => pattern.test(name));
  showDetail(name, item?.[1] || 'Tahle část patří do běžného Propletu. V tomto náhledu si můžeš zahrát Spojky z karty Dnes.');
}
function reviewSwitcher(active) {
  const nav = document.createElement('nav');
  nav.className = 'pilot-review-switch';
  nav.setAttribute('aria-label', 'Řešení podle týdne');
  weeks.forEach((_, index) => {
    const week = index + 1;
    const button = makeButton(`${week}. týden`, () => go('reseni', week, { replace: true, previous: history.state?.previous }));
    button.setAttribute('aria-label', `Řešení pro ${week}. týden`);
    button.setAttribute('aria-pressed', String(week === active));
    nav.append(button);
  });
  return nav;
}
function render({ forceToday = false } = {}) {
  const { week, day, view, edition, resume, freeLevel } = route();
  const board = boards[week - 1];
  const isToday = ['dnes', 'nahled', 'kalendar'].includes(view);
  const activeFreeLevel = view === 'volna' && freeLevel ? freeLevel : nextFreeLevel(day, resume);
  if (view === 'volna' && !freeLevel) {
    const url = new URL(location.href);
    url.searchParams.set('uroven', String(activeFreeLevel));
    history.replaceState(history.state, '', url);
  }
  const key = [isToday ? 'dnes' : view, day, resume, view === 'tajenka' ? edition : view === 'volna' ? activeFreeLevel : ''].join('/');
  if (renderedView === 'kalendar' && view !== 'kalendar') closeTajenkaCalendar();
  renderedView = view;
  if (view !== 'nahled' && menu.open) menu.close();
  if (detail.open) detail.close();
  if (key !== mounted || (forceToday && isToday)) {
    game?.destroy?.();
    game = null;
    mounted = key;
    app.replaceChildren();
    app.className = isToday ? '' : 'pilot-game-page';
    const titles = {
      dnes: 'Dnes · Spojky s křížením',
      reseni: `Řešení · ${week}. týden`,
      navod: 'Jak hrát Spojky',
      hra: `Spojky s křížením · ${week}. týden`,
      tajenka: 'Tajenka', denni: 'Denní výzva', extra: 'Extra', volna: 'Volná hra',
    };
    document.title = `${titles[isToday ? 'dnes' : view]} · Proplet`;
    const freeKind = activeFreeLevel === 12 ? 'free' : 'free-new';
    if (isToday) {
      const freeStatus = getPlayStatus(freeKind, day);
      renderToday(app, { week, weekStart: board.start, dateISO: day, progress: getProgress(board), nextLabel: weeks[week - 1].next,
        dailyStatus: getPlayStatus('daily', day), hasExtra: !!reviewRhythm(day).extra, extraStatus: getPlayStatus('extra', day),
        hasResume: freeStatus === 'started', freeStatus, freeLevel: activeFreeLevel, tajenkaStatus: getTajenkaStatus(day),
        onCalendar: () => go('kalendar', week, { previous: 'dnes' }),
        onTajenka: () => go('tajenka', week, { previous: 'dnes' }),
        onPlay: () => go('hra', week, { previous: 'dnes' }),
        onPreview: () => go('nahled', week, { previous: 'dnes' }), onOther: showOther });
    } else {
      const target = document.createElement('div');
      app.append(target);
      const options = { board, week, onBack: goHome, nextLabel: weeks[week - 1].next,
        hintImage: '/assets/hints/printshop/gentle-v1.webp' };
      if (view === 'tajenka') {
        game = mountTajenka(target, { day, edition, onBack: goHome,
          backLabel: history.state?.previous === 'kalendar' ? 'Zpět do kalendáře' : 'Dnes' });
      } else if (playViews[view]) {
        game = mountPlay(target, { kind: view === 'volna' ? freeKind : playViews[view], day, onBack: goHome });
      } else if (view === 'reseni') {
        game = reviewSolution(target, options);
        app.append(reviewSwitcher(week));
      } else if (view === 'navod') {
        game = mountGameTutorial(target, { onBack: goHome,
          onPlay: () => go('hra', week, { replace: true, previous: history.state?.previous }) });
      } else {
        game = mountGame(target, options);
      }
    }
    window.scrollTo(0, 0);
  }
  if (view === 'nahled') showMenu(week, day, resume);
  if (view === 'kalendar') {
    openTajenkaCalendar(day, app.querySelector('[data-tajenka-calendar]'),
      selected => go('tajenka', week, { edition: selected, previous: 'kalendar' }),
      () => { if (route().view === 'kalendar') goHome(); });
  }
}
menu.querySelector('[data-action="close-menu"]').addEventListener('click', goHome);
for (const [action, view] of [['tutorial', 'navod'], ['review', 'reseni']]) {
  menu.querySelector(`[data-action="${action}"]`).addEventListener('click', () => {
    go(view, route().week, { replace: true, previous: history.state?.previous });
  });
}
menu.querySelector('[data-action="ask-reset"]').addEventListener('click', () => {
  const { week } = route();
  showDetail(`Začít ${week}. týden znovu?`, 'Smažou se tvoje nalezené spojky, rozdělaný tah a nápovědy z této desky.', true);
});
detail.querySelectorAll('[data-action="close-detail"]').forEach(button => button.addEventListener('click', () => detail.close()));
detail.querySelector('[data-action="reset"]').addEventListener('click', () => {
  if (!isResetDialog) return;
  const { week } = route();
  resetProgress(boards[week - 1]);
  detail.close();
  mounted = '';
  go('dnes', week, { replace: true });
  focusReturn('hra');
});
menu.addEventListener('cancel', event => { event.preventDefault(); goHome(); });
menu.addEventListener('click', event => { if (event.target === menu && outside(event, menu)) goHome(); });
detail.addEventListener('click', event => { if (event.target === detail && outside(event, detail)) detail.close(); });
function outside(event, dialog) {
  const rect = dialog.getBoundingClientRect();
  return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
}
window.addEventListener('popstate', () => {
  const from = renderedView;
  render({ forceToday: true });
  if (route().view === 'dnes') focusReturn(from);
});
window.addEventListener('pageshow', event => { if (event.persisted) render({ forceToday: true }); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && route().view === 'dnes') render(); });
window.addEventListener('storage', () => { if (route().view === 'dnes') render({ forceToday: true }); });
render();
