/* Loaded only by the separate static MK100 preview builder, before application boot. */
(function (global) {
  'use strict';
  const fixtures = global.PROPLET_MK100_FIXTURES;
  if (!fixtures) return;
  if (global.PROPLET_MK100_PREVIEW?.fixtureOnly === true) return;
  const productionHosts = new Set(['hrajproplet.cz', 'www.hrajproplet.cz', 'proplet-nine.vercel.app',
    'proplet-pavel-prouzas-projects.vercel.app', 'proplet-git-main-pavel-prouzas-projects.vercel.app']);
  if (productionHosts.has(location.hostname)) throw new Error('MK100 preview cannot run on production.');
  const puzzles = fixtures.puzzles;
  const bank = puzzles?.free?.mozkokalypsa100 || puzzles?.free?.mozkokalypsa;
  if (!Array.isArray(bank) || bank.length !== 100 || !Array.isArray(fixtures.recognitionWords)) {
    throw new Error('Complete isolated MK100 fixtures are required.');
  }

  global.PROPLET_MK100_INTEGRATED_PREVIEW = true;
  global.PROPLET_RUNTIME_ENV = 'preview';
  global.PROPLET_RUNTIME_META = Object.freeze({...global.PROPLET_RUNTIME_META,
    canonicalOrigin: location.origin, mk100IntegratedPreview: true, gen4CandidatePreview: false, gen5CandidatePreview: false});
  const params = new URLSearchParams(location.search);
  const requestedCount = params.has('previewHC') ? Number(params.get('previewHC')) :
    params.get('previewPlayer') === 'new' ? 0 : 200;
  const initialHardcoreCount = Number.isInteger(requestedCount) && requestedCount >= 0 && requestedCount <= 200 ? requestedCount : 200;
  const bankHash = String(fixtures.build?.bankSha256 || fixtures.build?.bankContentHash || 'mk100');
  const storagePrefix = `proplet-mk100-preview:${bankHash.slice(0, 16)}:hc${initialHardcoreCount}:`;
  const requests = [];
  const recognized = new Set(fixtures.recognitionWords.map(normalize));
  const recognitionText = fixtures.recognitionWords.join('\n') + '\n';

  function normalize(word) { return String(word || '').normalize('NFC').trim().toLocaleUpperCase('cs-CZ'); }
  function response(value, status = 200, type = 'application/json; charset=utf-8', head = false) {
    return new Response(head ? null : type.startsWith('application/json') ? JSON.stringify(value) : value,
      {status, headers: {'Content-Type': type, 'Cache-Control': 'no-store', 'X-Proplet-Preview': 'fixture-only'}});
  }
  // There is deliberately no retained native fetch or network fallback.
  global.fetch = async function (input, options = {}) {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
    const method = String(options.method || input?.method || 'GET').toUpperCase();
    requests.push({path: url.pathname, method, external: url.origin !== location.origin});
    if (requests.length > 200) requests.shift();
    const head = method === 'HEAD';
    if (url.origin !== location.origin) return response({error: 'Externí služby jsou v náhledu vypnuté.'}, 403, undefined, head);
    if (method !== 'GET' && !head) return response({error: 'Náhled ukládá hraní jen v tomto prohlížeči. Účty a odesílání jsou vypnuté.'}, 409);
    const path = url.pathname;
    if (path === '/puzzles.json') return response(puzzles, 200, undefined, head);
    if (path === '/valid-words-v3328.txt') return response(recognitionText, 200, 'text/plain; charset=utf-8', head);
    if (path === '/api/word-recognition') {
      const word = normalize(url.searchParams.get('word'));
      return response({word, recognized: recognized.has(word), source: 'frozen-mk100-preview'}, 200, undefined, head);
    }
    if (path === '/api/config') return response({...fixtures.config, environment: 'preview',
      version: global.PROPLET_RUNTIME_META?.version, appVersion: global.PROPLET_RUNTIME_META?.version,
      mk100IntegratedPreview: true, accountsEnabled: false, pushEnabled: false}, 200, undefined, head);
    if (path === '/api/free-order/config' || path === '/api/play-session/config') {
      return response({enabled: false, isolatedPreview: false, environment: 'preview'}, 200, undefined, head);
    }
    if (path === '/api/rolling-content') return response({version: 1, asOf: fixtures.build?.asOf,
      latestBatch: null, nextRelease: null, puzzles: {}, meta: {},
      availableFreeCounts: Object.fromEntries(Object.entries(puzzles.free).map(([key, rows]) => [key, rows.length]))}, 200, undefined, head);
    if (path === '/api/tajenka' && fixtures.tajenka) return response(fixtures.tajenka, 200, undefined, head);
    if (path === '/api/mozkokalypsa/status') return response({eligible: false, invited: false, closed: true,
      enabled: false, qa: false, boards: [], attempts: [], completed: 0}, 200, undefined, head);
    if (/^\/api\/[^/]*leaderboard$/.test(path) || /^\/api\/rankings(?:\/(?:xp|daily))?$/.test(path)) return response({rows: [], players: [], teams: [],
      levels: [], total: 0, myRank: null, topPercent: null, anonymous: true, hasMore: false, preview: true}, 200, undefined, head);
    if (path === '/api/push/config') return response({enabled: false, configured: false, publicKey: '', environment: 'preview'}, 200, undefined, head);
    if (path === '/sw.js') return response('', 200, 'application/javascript; charset=utf-8', head);
    return response({error: 'Tato služba není součástí místního náhledu.'}, 404, undefined, head);
  };
  if (typeof navigator.sendBeacon === 'function') navigator.sendBeacon = () => false;
  if (navigator.serviceWorker) {
    // The app also checks the explicit preview flag before registration.
    navigator.serviceWorker.register = () => Promise.reject(new Error('Service worker is disabled in the isolated preview.'));
    navigator.serviceWorker.getRegistrations().then(rows => Promise.all(rows.map(row => row.unregister()))).catch(() => {});
  }

  function isolatedStorage(nativeStorage) {
    const memory = new Map();
    const backend = nativeStorage || {get length() { return memory.size; }, key: i => [...memory.keys()][i] ?? null,
      getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, String(value)), removeItem: key => memory.delete(key)};
    const keys = () => Array.from({length: backend.length}, (_, i) => backend.key(i)).filter(key => key?.startsWith(storagePrefix));
    return {get length() { return keys().length; }, key: i => keys()[i]?.slice(storagePrefix.length) ?? null,
      getItem: key => backend.getItem(storagePrefix + String(key)),
      setItem: (key, value) => backend.setItem(storagePrefix + String(key), String(value)),
      removeItem: key => backend.removeItem(storagePrefix + String(key)),
      clear: () => keys().forEach(key => backend.removeItem(key))};
  }
  for (const name of ['localStorage', 'sessionStorage']) {
    let nativeStorage;
    try { nativeStorage = global[name]; } catch {}
    Object.defineProperty(global, name, {configurable: true, value: isolatedStorage(nativeStorage)});
  }
  const storage = global.localStorage;
  const stateKey = 'proplet-v2-state:guest';
  // Never manufacture an authenticated profile. Progress belongs to this preview's anonymous guest.
  storage.removeItem('proplet-v2-profile');
  if (storage.getItem(stateKey) === null) {
    const state = {completed: {}, rescues: {}, inProgress: {}, dailyDates: [], statsVersion: 5};
    const hardcore = [...(puzzles.free.hardcore || [])].sort((a, b) => Number(a.meta?.level) - Number(b.meta?.level));
    if (hardcore.length < initialHardcoreCount) throw new Error('Current hardcore fixtures are incomplete.');
    for (const puzzle of hardcore.slice(0, initialHardcoreCount)) {
      const challengeKey = `free:${puzzle.id}`;
      state.completed[challengeKey] = {puzzleId: puzzle.id, challengeKey, mode: 'free', difficulty: 'hardcore',
        level: Number(puzzle.meta?.level), contentGeneration: Number(puzzle.meta?.contentGeneration) || Number(puzzles.freeGeneration),
        elapsedMs: 60000, moves: puzzle.answers.length, points: 100, hintsUsed: 0, wrongAttempts: 0,
        maxHintLevel: 0, attemptId: null, cleanSolve: true, completedAt: '2026-10-01T08:00:00.000Z', previewSynthetic: true};
    }
    storage.setItem(stateKey, JSON.stringify(state));
    storage.setItem('proplet-v2-sync-queue:guest', '[]');
  }
  const now = new Date().toISOString();
  const defaults = {'proplet-v3-7-required-onboarding': 'done', 'proplet-v3-16-2-helper-onboarding': 'done',
    'proplet-v3-32-8-rule-principle-seen': '1', 'proplet-v3-16-2-helper-mode': 'none',
    'proplet-v3-5-account-nudge': JSON.stringify({shown: [1, 2, 3], lastShownAt: now}),
    'proplet-v4-01-4-progress-guard': JSON.stringify({lastShownAt: now}),
    'proplet-v3-26-install-nudge': JSON.stringify({done: true})};
  for (const [key, value] of Object.entries(defaults)) if (storage.getItem(key) === null) storage.setItem(key, value);

  function previewToast() {
    if (typeof showToast === 'function') showToast('Náhled ukládá hraní jen tady. Účty a odesílání jsou vypnuté.');
  }
  // OAuth navigates rather than using fetch; stop that separate transport as well.
  document.addEventListener('click', event => {
    const element = event.target.closest?.('a,button');
    if (!element) return;
    const href = element.getAttribute('href');
    const blockedLink = href && (() => { try { const url = new URL(href, location.href); return url.origin !== location.origin || url.pathname.startsWith('/api/'); } catch { return true; } })();
    if (blockedLink || ['googleLoginBtn', 'linkGoogleBtn', 'firstStepsGoogle', 'progressGuardGoogleBtn'].includes(element.id)) {
      event.preventDefault(); event.stopImmediatePropagation(); previewToast();
    }
  }, true);
  document.addEventListener('submit', event => {
    const action = event.target.getAttribute?.('action');
    if (action) { event.preventDefault(); event.stopImmediatePropagation(); previewToast(); }
  }, true);

  function openBoard(ordinal) {
    const puzzle = bank.find(row => Number(row.meta?.level) === Number(ordinal));
    if (!puzzle || typeof startGame !== 'function') return false;
    startGame(puzzle, 'free', null);
    return true;
  }
  function link(label, changes) {
    const a = document.createElement('a');
    const url = new URL(location.href);
    for (const key of ['board', 'review', 'announcement']) url.searchParams.delete(key);
    for (const [key, value] of Object.entries(changes)) url.searchParams.set(key, value);
    a.href = url.pathname + url.search; a.textContent = label;
    return a;
  }
  function installPreviewControls() {
    if (document.getElementById('mk100PreviewNotice')) return;
    const style = document.createElement('style');
    style.textContent = '#mk100PreviewNotice,#mk100PreviewChooser{font-size:15px;line-height:1.45;color:var(--ink,#332d28)}' +
      '#mk100PreviewNotice{margin:12px 0;padding:12px 16px;border:1px solid var(--line,#ded6c9);border-radius:16px;background:var(--surface,#fffaf2)}' +
      '#mk100PreviewNotice p{margin:0 0 8px}#mk100PreviewNotice nav{display:flex;flex-wrap:wrap;gap:8px 16px}' +
      '#mk100PreviewNotice a{font-size:15px;line-height:1.45;text-decoration:underline}' +
      '#mk100PreviewChooser{margin:20px 0}#mk100PreviewChooser summary{cursor:pointer;font-weight:700;min-height:44px;display:flex;align-items:center}' +
      '#mk100PreviewChooser p{margin:4px 0 12px}#mk100PreviewChooser .mk100-preview-buttons{display:grid;grid-template-columns:repeat(auto-fit,minmax(85px,1fr));gap:8px}' +
      '#mk100PreviewChooser button{font:inherit;min-height:44px;padding:8px;border:1px solid var(--line,#ded6c9);border-radius:12px;background:var(--surface,#fffaf2);color:inherit;cursor:pointer}';
    document.head.appendChild(style);
    const notice = document.createElement('aside'); notice.id = 'mk100PreviewNotice'; notice.setAttribute('role', 'note');
    const text = document.createElement('p');
    text.textContent = `Náhled Propletu · ${initialHardcoreCount ? `ukázkový postup ${initialHardcoreCount} Mozkožroutů. ` : 'nový hráč. '}Hraní se ukládá jen v tomto prohlížeči.`;
    notice.appendChild(text);
    const links = document.createElement('nav'); links.setAttribute('aria-label', 'Náhled Propletu');
    links.append(link('Rychlá dvanáctka', {review: '12'}), link('Návrh oznámení', {announcement: 'mozkokalypsa'}));
    notice.appendChild(links);
    const footer = document.querySelector('.app-footer');
    if (footer) footer.before(notice); else document.body.appendChild(notice);
    const chooser = document.createElement('details'); chooser.id = 'mk100PreviewChooser';
    const summary = document.createElement('summary'); summary.textContent = 'Rychlá dvanáctka Mozkokalypsy'; chooser.appendChild(summary);
    const explanation = document.createElement('p'); explanation.textContent = 'Vybrané desky se otevřou v běžné Volné hře.'; chooser.appendChild(explanation);
    const buttons = document.createElement('div'); buttons.className = 'mk100-preview-buttons';
    const levels = fixtures.build?.representativeLevels || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 20];
    for (const ordinal of levels) {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.mk100Board = String(ordinal);
      button.textContent = `Deska ${ordinal}`; button.addEventListener('click', () => openBoard(ordinal)); buttons.appendChild(button);
    }
    chooser.appendChild(buttons); document.querySelector('#screen-free')?.appendChild(chooser);
    if (params.get('review') === '12') { chooser.open = true; if (typeof nav === 'function') nav('free', {replace: true}); }
    if (params.has('board')) openBoard(Number(params.get('board')));
  }
  global.PROPLET_MK100_PREVIEW = {fixtureOnly: true, storagePrefix, initialHardcoreCount, bankHash, requests, openBoard};
  document.addEventListener('proplet:ready', installPreviewControls, {once: true});
})(window);
