import { reviewSolution } from './game.js';

const list = document.getElementById('ed-list');
const weeks = document.getElementById('ed-weeks');
const status = document.getElementById('ed-status');
const retry = document.getElementById('ed-retry');
const solution = document.getElementById('ed-solution');
const dateFormat = new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'long', timeZone: 'Europe/Prague' });
const deviceTheme = matchMedia('(prefers-color-scheme: dark)');
const setTheme = () => { document.documentElement.dataset.theme = deviceTheme.matches ? 'dark' : 'light'; };
setTheme();
deviceTheme.addEventListener('change', setTheme);

let editions;
let activeRequest;
let showing;
let returnLink;

async function request(review, signal) {
  const response = await fetch('/api/spojky?' + new URLSearchParams({ review }), { cache: 'no-store', signal });
  if (!response.ok) throw new Error('Vydání není k dispozici.');
  return response.json();
}

function drawList() {
  const fragment = document.createDocumentFragment();
  for (const { week, start, end } of editions) {
    const row = document.createElement('li');
    row.className = 'ed-week';
    const copy = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = week + '. týden';
    const dates = document.createElement('p');
    dates.className = 'ed-dates';
    dates.textContent = dateFormat.formatRange(new Date(start + 'T12:00:00Z'), new Date(end + 'T12:00:00Z'));
    copy.append(title, dates);
    const actions = document.createElement('div');
    actions.className = 'ed-actions';
    const play = document.createElement('a');
    play.className = 'ed-play';
    play.textContent = 'Hrát';
    play.href = '/?' + new URLSearchParams({ open: 'spojky', spojkyReview: start });
    play.setAttribute('aria-label', 'Hrát Spojky pro ' + week + '. týden');
    const answer = document.createElement('a');
    answer.className = 'ed-solution-link';
    answer.textContent = 'Řešení';
    answer.href = '#reseni=' + start;
    answer.setAttribute('aria-label', 'Ukázat řešení pro ' + week + '. týden');
    answer.addEventListener('click', event => {
      if (event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) return;
      event.preventDefault();
      returnLink = answer;
      history.pushState({ fromList: true }, '', answer.href);
      render();
    });
    actions.append(play, answer);
    row.append(copy, actions);
    fragment.append(row);
  }
  weeks.replaceChildren(fragment);
}

function backToList() {
  if (history.state?.fromList) history.back();
  else {
    history.replaceState(null, '', location.pathname + location.search);
    render();
  }
}

async function render() {
  activeRequest?.abort();
  const controller = new AbortController();
  activeRequest = controller;
  showing?.destroy();
  showing = null;
  list.hidden = false;
  solution.hidden = true;
  retry.hidden = true;
  const requested = new URLSearchParams(location.hash.slice(1)).get('reseni');
  try {
    if (!editions) {
      status.hidden = false;
      status.textContent = 'Načítám vydání…';
      const data = await request('editions', controller.signal);
      if (controller.signal.aborted) return;
      editions = data.editions;
      drawList();
    }
    const selected = editions.find(item => item.start === requested);
    if (!selected) {
      status.hidden = editions.length > 0;
      status.textContent = editions.length ? '' : 'Zatím tu není žádné vydání.';
      returnLink?.focus({ preventScroll: true });
      return;
    }
    status.hidden = false;
    status.textContent = 'Načítám řešení pro ' + selected.week + '. týden…';
    const data = await request(selected.start, controller.signal);
    if (controller.signal.aborted) return;
    if (!data.available || data.week !== selected.week || !data.board) throw new Error('Chybí vydání.');
    list.hidden = true;
    solution.hidden = false;
    showing = reviewSolution(solution, { board: data.board, week: selected.week, backLabel: 'Všechna vydání', onBack: backToList });
    window.scrollTo(0, 0);
  } catch (error) {
    if (controller.signal.aborted) return;
    status.hidden = false;
    status.textContent = 'Vydání se nepodařilo načíst. Zkontroluj připojení a otevři přehled v náhledu Spojek.';
    retry.hidden = false;
  }
}

retry.addEventListener('click', render);
window.addEventListener('popstate', render);
render();
