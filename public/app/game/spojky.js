import { resultAward, transferAwards } from './spojky-award.js';
import { getProgress, launchSubtitle, mountGame, transferProgress } from '../../design/spojky/game.js';

const dateFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit' });
const prettyDate = new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague', day: 'numeric', month: 'long' });
const pragueHour = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Prague', hour: '2-digit', hourCycle: 'h23' });
const isoDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
const requestedDay = new URLSearchParams(location.search).get('spojkyReview');
const review = window.PROPLET_RUNTIME_META?.environment === 'preview' && isoDate(requestedDay);
const today = () => review ? requestedDay : dateFormat.format(new Date());
const cacheKey = 'proplet.spojky.edition.v1.' + (review ? 'review' : 'live');
const scopeFor = id => (review ? 'review.' : 'live.') + encodeURIComponent(id).replaceAll('.', '%2E');
const scope = () => scopeFor(window.playerScope?.() || 'guest');
const entry = document.getElementById('spojkyWeeklyBtn');
const screen = document.getElementById('screen-spojky');
let edition = null;
let checked = '';
let pending;
let pendingDay = '';
let settledDay = '';
let playing;
let mountedScope;
let midnight;

function validEdition(data, day) {
  if (!data?.available || !isoDate(data.start) || !isoDate(data.end) || day < data.start || day > data.end) return false;
  const board = data.board;
  return Number.isInteger(data.week) && data.week > 0 && typeof board?.id === 'string' &&
    Array.isArray(board.rows) && board.rows.length > 0 && board.rows.every(row => typeof row === 'string' && row.length === board.rows[0].length && row.length > 0) &&
    Array.isArray(board.chain) && board.chain.length === 4 && Array.isArray(board.shuffle) && board.shuffle.length === 4 &&
    Array.isArray(board.answers) && board.answers.length === 3 &&
    board.answers.every(answer => typeof answer?.word === 'string' && Array.isArray(answer.path));
}
function available() { return validEdition(edition, today()); }
function nextLabel() {
  return isoDate(edition?.nextStart) ? 'Další deska v pondělí ' + prettyDate.format(new Date(edition.nextStart + 'T12:00:00Z')) : '';
}
function nextCardLabel(nextStart, day) {
  if (!isoDate(nextStart)) return '';
  // Compare Prague calendar dates at a common UTC midnight, including across DST.
  const days = (Date.parse(nextStart) - Date.parse(day)) / 86400000;
  if (!(days > 0)) return '';
  if (days === 1) return 'Příští již zítra';
  return `Příští již za ${days} ${days <= 4 ? 'dny' : 'dní'}`;
}
function updateCard() {
  entry.hidden = !available();
  if (entry.hidden) return;
  const { status, found } = getProgress(edition.board, scope());
  const detail = entry.querySelector('.os-spojky-detail');
  const action = entry.querySelector('.os-spojky-action-text');
  entry.dataset.state = status;
  const newBoardDetail = edition.week === 1 ? launchSubtitle(today(), edition.start) : '';
  detail.textContent = status === 'complete' ? nextCardLabel(edition.nextStart, today()) : status === 'started' ? `Rozehráno · ${found} ze 3` : newBoardDetail;
  entry.querySelector('.os-spojky-done').hidden = status !== 'complete';
  action.textContent = status === 'complete' ? 'Řetěz' : status === 'started' ? 'Pokračovat' : 'Hrát';
  entry.setAttribute('aria-label', status === 'complete' ? 'Prohlédnout dokončený řetěz Spojek' : status === 'started' ? 'Pokračovat ve Spojkách' : 'Hrát Spojky');
}

function readSaved(day) {
  try {
    const saved = JSON.parse(localStorage.getItem(cacheKey));
    return validEdition(saved, day) ? saved : null;
  } catch { return null; }
}
function announce() {
  settledDay = today();
  updateCard();
  document.dispatchEvent(new CustomEvent('proplet:spojky-ready'));
}
function refresh(force = false) {
  const day = today();
  if (!force && checked === day) return pending || Promise.resolve();
  if (pending && pendingDay === day) return pending;
  if (!validEdition(edition, day)) edition = readSaved(day);
  if (edition) announce();
  else updateCard();
  if (navigator.onLine === false) {
    if (settledDay !== day) announce();
    return Promise.resolve();
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  const request = Promise.resolve().then(async () => {
    try {
      const url = '/api/spojky' + (review ? '?review=' + encodeURIComponent(day) : '');
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) return;
      const data = await response.json();
      if (day !== today() || typeof data?.available !== 'boolean' || !isoDate(data.date)) return;
      if (data.available && !validEdition(data, day)) return;
      edition = data.available ? data : null;
      checked = day;
      try {
        if (edition) localStorage.setItem(cacheKey, JSON.stringify(edition));
        else localStorage.removeItem(cacheKey);
      } catch { /* The active game also works in memory. */ }
    } catch { /* Keep a published board only through its stated end date. */ }
  }).finally(() => {
    clearTimeout(timeout);
    if (pending === request) pending = null;
    if (day === today()) announce();
  });
  pending = request;
  pendingDay = day;
  return request;
}
function scheduleMidnight() {
  clearTimeout(midnight);
  if (review) return;
  const utc = Date.parse(today() + 'T00:00:00Z') + 86400000;
  const boundary = utc - Number(pragueHour.format(utc)) * 3600000;
  midnight = setTimeout(() => { refresh(); scheduleMidnight(); }, Math.max(500, boundary - Date.now() + 100));
}

function open(replace = false) {
  if (!available()) return false;
  if (!screen.classList.contains('active')) {
    if (!document.getElementById('screen-daily').classList.contains('active')) window.nav('daily', { replace: true });
    window.nav('spojky', { replace: replace === true });
  }
  return true;
}
async function openEntry(restore) {
  const url = new URL(location.href);
  if (url.searchParams.get('open') === 'spojky') {
    url.searchParams.delete('open');
    history.replaceState(history.state, '', url);
  }
  await refresh();
  if (document.getElementById('screen-daily').classList.contains('active')) open(restore);
}
function dailyStatus() {
  const day = today();
  try {
    const daily = window.dailyResultState(day);
    if (daily.active) return 'done';
    if (window.savedProgressFor(daily.puzzle, 'daily', day)) return 'started';
  } catch { /* The daily bank may still be loading on an offline start. */ }
  return 'new';
}
function resultActions(boardEdition) {
  return {
    onResult(firstFinish, updateReward, paths) {
      const status = dailyStatus();
      const award = review ? {} : resultAward(boardEdition, firstFinish, updateReward, paths);
      return { ...award, primaryLabel: status === 'done' ? 'Zpět na Dnes' : status === 'started' ? 'Pokračovat v denní výzvě' : 'Hrát dnešní výzvu' };
    },
    onPrimary() {
      const done = dailyStatus() === 'done';
      window.nav('daily', { replace: true });
      if (!done) window.startDaily();
    },
    onShare: () => window.shareProplet('Týdenní Spojky mám! Podaří se Ti propojit všechny čtyři kartičky?\n\nZahraj si taky: https://hrajproplet.cz/?open=spojky'),
  };
}
function syncScreen(name) {
  if (name === 'spojky' && available() && !playing) {
    mountedScope = scope();
    screen.scrollTop = 0;
    playing = mountGame(screen, { board: edition.board, week: edition.week, storageScope: mountedScope,
      resultActions: resultActions(edition), hintImage: '/assets/hints/printshop/gentle-v1.webp', nextLabel: nextLabel(),
      onBack: () => history.back(), onProgress: updateCard });
  } else if (name !== 'spojky' && playing) {
    playing.destroy();
    playing = null;
    mountedScope = null;
    updateCard();
    if (name === 'daily' && !entry.hidden) requestAnimationFrame(() => entry.focus({ preventScroll: true }));
  }
}
function accountChanged() {
  if (playing && mountedScope !== scope()) window.nav('daily', { replace: true });
  updateCard();
}

window.PropletSpojky = {
  available, settled: () => settledDay === today(), open: () => open(), openEntry,
  adoptGuest: id => {
    if (!review) transferAwards('guest', id);
    return transferProgress(scopeFor('guest'), scopeFor(id));
  },
  removeAccount: id => {
    if (!review) transferAwards(id, null);
    return transferProgress(scopeFor(id), null);
  },
};
entry.addEventListener('click', () => open());
document.addEventListener('proplet:screen-changed', event => syncScreen(event.detail.screen));
document.addEventListener('proplet:account-changed', accountChanged);
window.addEventListener('storage', event => {
  if (event.key === 'proplet-v2-profile' || event.key === null) accountChanged();
  if (event.key?.startsWith('proplet.spojky.crossings.v1.')) updateCard();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) { refresh(); scheduleMidnight(); }
});
window.addEventListener('online', () => refresh(true));
window.addEventListener('pageshow', event => { if (event.persisted) { refresh(); scheduleMidnight(); } });
refresh();
scheduleMidnight();
