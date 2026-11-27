import { boards } from './boards.js';
import { getProgress, mountGame } from './game.js';
import { getWordBoardStatus, mountWordBoard } from './board-preview.js';
import { playSamples } from './preview-play-boards.js';

const board = boards[0];
const sample = playSamples['g4-m-001'];
const scenarios = new Set(['tah', 'poprve', 'navrat', 'offline']);
const app = document.querySelector('#vr-app');
const menu = document.querySelector('#vr-menu');
const guide = document.querySelector('#vr-guide');
const sync = document.querySelector('#vr-sync');
const notice = document.querySelector('#vr-notice');
const theme = document.querySelector('#vr-theme');
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
const shareDialog = document.querySelector('#vr-share');
const invitation = { text: 'Týdenní Spojky mám! Podaří se Ti propojit všechny čtyři kartičky?', url: 'https://hrajproplet.cz/?open=spojky' };
const shareText = document.querySelector('#vr-share-text');
shareText.value = invitation.text + '\n' + invitation.url;

let scenario, scope, mounted;
const awardKey = () => 'proplet.spojky.result-preview.' + scope + '.award.' + board.id;
const dailyKey = () => 'result-preview.' + scope;
const dailyStatus = () => getWordBoardStatus(sample, dailyKey());

function seed(name) {
  scenario = name;
  scope = 'result-preview.' + crypto.randomUUID();
  const prefix = 'proplet.spojky.crossings.v1.' + scope + '.' + board.id;
  const signature = [board.rows.join('/'), ...board.chain, ...board.answers.map(answer => answer.word)].join('|');
  const lastMove = name === 'tah';
  const answers = lastMove ? board.answers.slice(0, -1) : board.answers;
  for (const [i, answer] of answers.entries()) {
    localStorage.setItem(prefix + '.answer.' + i, JSON.stringify({ signature, path: answer.path }));
  }
  if (lastMove) {
    const finalPath = board.answers[2].path;
    localStorage.setItem(prefix, JSON.stringify({ signature, started: true, pair: [2, 3], path: finalPath.slice(0, -1) }));
  }
  if (name === 'navrat') localStorage.setItem(awardKey(), 'credited');
  if (name === 'offline') localStorage.setItem(awardKey(), 'pending');
  const url = new URL(location.href);
  url.searchParams.set('stav', name);
  url.hash = '';
  history.replaceState({ scene: name, scope }, '', url);
}

function resultState(firstFinish) {
  guide.hidden = true;
  const previous = localStorage.getItem(awardKey());
  const pending = previous === 'pending';
  const firstAward = firstFinish || scenario === 'poprve' || scenario === 'tah';
  if (!previous && firstAward) localStorage.setItem(awardKey(), 'credited');
  sync.hidden = !pending;
  const daily = dailyStatus();
  return {
    firstAward: !previous && firstAward,
    xpLabel: pending ? '' : previous === 'credited' ? 'Získáno 200 XP' : '+200 XP',
    notice: pending ? 'XP připíšeme po připojení.' : '',
    primaryLabel: daily === 'done' ? 'Zpět na Dnes' : daily === 'started' ? 'Pokračovat v denní výzvě' : 'Hrát dnešní výzvu',
  };
}

async function share() {
  if (navigator.share) {
    try { await navigator.share(invitation); return; }
    catch (error) { if (error.name === 'AbortError') return; }
  }
  shareDialog.showModal();
}

function home() {
  const progress = getProgress(board, scope);
  const complete = progress.status === 'complete';
  const daily = dailyStatus();
  const template = document.createElement('section');
  template.className = 'vr-home';
  template.innerHTML = `<h1>Dnes</h1>
    <button type="button" class="vr-card vr-daily"><img src="/rewards/printshop/symbol-daily.svg" alt="">
      <span><strong>Denní výzva</strong><small>${daily === 'done' ? 'Hotovo' : 'Střední · +100 XP'}</small></span>
      <b>${daily === 'done' ? 'Výsledek' : daily === 'started' ? 'Pokračovat' : 'Hrát'}</b></button>
    <button type="button" class="vr-card vr-spojky"><img src="./spojky-print.svg" alt="">
      <span><strong>Spojky</strong><small>${complete ? 'Další deska v pondělí 7. prosince' : 'Rozehráno · ' + progress.found + ' ze 3'}</small></span>
      <b>${complete ? 'Výsledek' : 'Pokračovat'}</b></button>`;
  template.querySelector('.vr-daily').onclick = () => navigate('denni');
  template.querySelector('.vr-spojky').onclick = () => navigate('');
  app.replaceChildren(template);
}

function render() {
  mounted?.destroy();
  mounted = null;
  sync.hidden = true;
  guide.hidden = true;
  notice.textContent = '';
  if (location.hash === '#dnes') home();
  else if (location.hash === '#denni') {
    mounted = mountWordBoard(app, { puzzle: sample, progressKey: dailyKey(), title: 'Denní výzva', subtitle: 'Střední · ukázková deska', mode: 'daily', resultTitle: 'Denní výzva splněna', onBack: () => navigate('dnes') });
  } else {
    guide.hidden = scenario !== 'tah' || getProgress(board, scope).status === 'complete';
    mounted = mountGame(app, { board, storageScope: scope, week: 1, onBack: () => navigate('dnes'),
      nextLabel: 'Další deska v pondělí 7. prosince', hintImage: '/assets/hints/printshop/gentle-v1.webp',
      resultPreview: { onResult: resultState, onShare: share, onPrimary: () => navigate(dailyStatus() === 'done' ? 'dnes' : 'denni') } });
  }
  window.scrollTo(0, 0);
}

function navigate(view) {
  const url = new URL(location.href);
  url.hash = view;
  history.pushState({ scene: scenario, scope }, '', url);
  render();
}

function restore() {
  const name = new URLSearchParams(location.search).get('stav') || 'tah';
  const state = history.state;
  if (state?.scene === name && /^result-preview\.[\da-f-]{36}$/.test(state.scope)) {
    scenario = name;
    scope = state.scope;
  } else seed(scenarios.has(name) ? name : 'tah');
  render();
}

function applyTheme() {
  document.documentElement.dataset.theme = theme.value === 'auto' ? (systemTheme.matches ? 'dark' : 'light') : theme.value;
}
theme.onchange = applyTheme;
systemTheme.addEventListener('change', applyTheme);
applyTheme();
document.querySelector('#vr-options').onclick = () => menu.showModal();
for (const closer of document.querySelectorAll('[data-close]')) closer.onclick = () => closer.closest('dialog').close();
for (const control of menu.querySelectorAll('[data-scene]')) {
  control.onclick = () => { menu.close(); seed(control.dataset.scene); render(); };
}
sync.querySelector('button').onclick = () => {
  if (localStorage.getItem(awardKey()) !== 'pending') return;
  localStorage.setItem(awardKey(), 'credited');
  render();
  notice.textContent = 'Připojeno. Odměna je připsaná.';
};
document.querySelector('#vr-copy').onclick = async () => {
  try {
    await navigator.clipboard.writeText(shareText.value);
    shareDialog.close();
    notice.textContent = 'Pozvánka je zkopírovaná.';
  } catch {
    shareText.focus(); shareText.select();
  }
};
window.addEventListener('popstate', restore);
try { restore(); }
catch (error) {
  if (error.name !== 'SecurityError' && error.name !== 'QuotaExceededError') throw error;
  document.querySelector('#vr-options').hidden = true;
  app.textContent = 'Náhled potřebuje místní uložení. Otevři jej v prohlížeči s povoleným ukládáním herního postupu.';
}
