import { boards } from './boards.js';
import { getProgress, mountGame, resetProgress, reviewSolution } from './game.js';
import { renderToday } from './today.js';

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
    range: `${first} – ${shortDate(end)}`,
    next: following ? `Další deska v pondělí ${shortDate(calendarDate(following.start))}` : 'Poslední deska pilotu.',
  };
});
const settingsKey = 'proplet.spojky.pilot.settings.v1';
const app = document.querySelector('#pilot-app');
const menu = document.querySelector('#pilot-menu');
const detail = document.querySelector('#pilot-detail');
const weekList = document.querySelector('#pilot-weeks');
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
let isResetDialog = false;

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
  const picked = Number(url.searchParams.get('tyden'));
  const view = url.hash.slice(1);
  return { week: validWeek(picked) ? picked : scheduledWeek(), view: ['hra', 'reseni', 'nahled'].includes(view) ? view : 'dnes' };
}
function go(view, week, { replace = false, previous = null } = {}) {
  const url = new URL(location.href);
  url.searchParams.set('tyden', String(week));
  url.hash = view === 'dnes' ? '' : view;
  history[replace ? 'replaceState' : 'pushState']({ pilot: true, previous }, '', url);
  render();
}
function goHome() {
  if (history.state?.pilot && history.state.previous === 'dnes') history.back();
  else go('dnes', route().week, { replace: true });
}
function makeButton(text, callback, className) {
  const button = document.createElement('button');
  button.type = 'button';
  if (className) button.className = className;
  button.textContent = text;
  button.addEventListener('click', callback);
  return button;
}
function showMenu(week) {
  weekList.replaceChildren();
  weeks.forEach(({ range }, index) => {
    const number = index + 1;
    const progress = getProgress(boards[index]);
    const button = makeButton('', () => {
      menu.close();
      go('dnes', number, { replace: true });
      focusToday();
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
  menu.querySelector('[data-action="ask-reset"]').hidden = getProgress(boards[week - 1]).status === 'new';
  if (!menu.open) menu.showModal();
}
function focusToday() {
  requestAnimationFrame(() => app.querySelector('[data-spojky]')?.focus({ preventScroll: true }));
}
function showDetail(title, copy, reset = false) {
  isResetDialog = reset;
  detail.querySelector('#pilot-detail-title').textContent = title;
  detail.querySelector('#pilot-detail-copy').textContent = copy;
  detail.querySelector('[data-action="reset"]').hidden = !reset;
  detail.querySelector('.pilot-detail-actions [data-action="close-detail"]').textContent = reset ? 'Ponechat postup' : 'Zpět na Dnes';
  if (!detail.open) detail.showModal();
}
function showOther(name) {
  const context = [
    [/Archiv/i, 'Tady hráč otevře dřívější desky. V tomto náhledu si můžeš zahrát všechny čtyři týdny Spojek.'],
    [/Tajenk/i, 'Odtud se hraje dnešní Tajenka. Vedle ní najdeš i samostatný vstup do archivu.'],
    [/Extra|Mozkožrout|Mozkomor|Mozkokalypsa/i, 'Extra je dobrovolná denní výzva s vlastním pořadím. V tomto náhledu si můžeš zahrát týdenní Spojky.'],
    [/rozehran|pokračovat|volná hra/i, 'Tudy se hráč vrací k rozehrané volné hře. Rozdělané Spojky najdeš přímo na jejich kartě.'],
    [/týden|rozvrh/i, 'Týdenní přehled patří denním výzvám. Nová deska Spojek je společná na celý týden.'],
    [/denní|dnešní výzva/i, 'Denní výzva udržuje sérii. V tomto náhledu si můžeš zahrát čtyři týdenní desky Spojek.'],
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
  const { week, view } = route();
  const board = boards[week - 1];
  const isToday = view === 'dnes' || view === 'nahled';
  const key = `${isToday ? 'dnes' : view}-${week}`;
  if (view !== 'nahled' && menu.open) menu.close();
  if (detail.open) detail.close();
  if (key !== mounted || (forceToday && isToday)) {
    game?.destroy?.();
    game = null;
    mounted = key;
    app.replaceChildren();
    app.className = isToday ? '' : 'pilot-game-page';
    const title = isToday ? 'Dnes' : view === 'reseni' ? `Řešení · ${week}. týden` : `Spojky · ${week}. týden`;
    document.title = `${title} · Proplet`;
    if (isToday) {
      renderToday(app, { week, weekStart: board.start, progress: getProgress(board), nextLabel: weeks[week - 1].next,
        onPlay: () => go('hra', week, { previous: 'dnes' }),
        onPreview: () => go('nahled', week, { previous: 'dnes' }), onOther: showOther });
    } else {
      const target = document.createElement('div');
      app.append(target);
      const options = { board, week, onBack: goHome, nextLabel: weeks[week - 1].next,
        hintImage: '/assets/hints/printshop/gentle-v1.webp' };
      if (view === 'reseni') {
        game = reviewSolution(target, options);
        app.append(reviewSwitcher(week));
      } else {
        game = mountGame(target, options);
      }
    }
    window.scrollTo(0, 0);
  }
  if (view === 'nahled') showMenu(week);
}
menu.querySelector('[data-action="close-menu"]').addEventListener('click', goHome);
menu.querySelector('[data-action="review"]').addEventListener('click', () => {
  go('reseni', route().week, { replace: true, previous: history.state?.previous });
});
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
  focusToday();
});
menu.addEventListener('cancel', event => { event.preventDefault(); goHome(); });
menu.addEventListener('click', event => { if (event.target === menu && outside(event, menu)) goHome(); });
detail.addEventListener('click', event => { if (event.target === detail && outside(event, detail)) detail.close(); });
function outside(event, dialog) {
  const rect = dialog.getBoundingClientRect();
  return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
}
window.addEventListener('popstate', () => render({ forceToday: true }));
window.addEventListener('pageshow', event => { if (event.persisted) render({ forceToday: true }); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && route().view === 'dnes') render(); });
window.addEventListener('storage', () => { if (route().view === 'dnes') render({ forceToday: true }); });
render();
