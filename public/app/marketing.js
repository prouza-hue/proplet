(function (global) {
  'use strict';
  const CONSENT_KEY = 'proplet-marketing-consent-v1';
  const EVENTS_KEY = 'proplet-marketing-events-v1';
  const MAX_AGE = 180 * 86400000;
  // Dedicated Proplet dataset; never reuse the historical client pixel.
  const PIXEL_ID = '1379409957596561';
  const MARKETING_GATES = new Set(['eligible', 'unknown_parameter', 'auth_url', 'nonproduction', 'non_game_path']);
  const PIXEL_URL_PARAMS = new Set(['fbclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'open', 'styleRetry']);
  // Leave application deep links and QA controls intact rather than stripping them.
  const APP_URL_PARAMS = new Set(['play', 'kind', 'date', 't', 'h', 'm', 'via', 'tutorial', 'qa', 'content_preview', 'releasePreview']);

  function pixelGate(href, {environment, candidatePreview, pixelId = PIXEL_ID} = {}) {
    try {
      const url = new URL(href);
      if (!/^\d+$/.test(pixelId) || url.protocol !== 'https:' || url.hostname !== 'hrajproplet.cz' || environment === 'preview' || candidatePreview) return 'nonproduction';
      if (!['/', '/index.html'].includes(url.pathname)) return 'non_game_path';
      if (url.hash || [...url.searchParams.keys()].some(key => ['auth', 'challenge', 'access_token', 'refresh_token', 'id_token', 'token', 'code', 'state', 'password'].includes(key.toLowerCase()))) return 'auth_url';
      if (url.searchParams.getAll('styleRetry').some(value => !/^[1-9]\d{0,2}$/.test(value))) return 'unknown_parameter';
      if ([...url.searchParams.keys()].some(key => !PIXEL_URL_PARAMS.has(key))) return 'unknown_parameter';
      return 'eligible';
    } catch {return 'nonproduction';}
  }

  function cleanPixelLanding(href, options) {
    const state = pixelGate(href, options);
    if (!['eligible', 'unknown_parameter'].includes(state)) return null;
    const url = new URL(href);
    if (url.searchParams.getAll('styleRetry').some(value => !/^[1-9]\d{0,2}$/.test(value))) return null;
    if ([...url.searchParams.keys()].some(key => APP_URL_PARAMS.has(key))) return null;
    for (const key of [...url.searchParams.keys()]) if (!PIXEL_URL_PARAMS.has(key)) url.searchParams.delete(key);
    return url.href;
  }

  function create({storage, now = Date.now, enabled = () => false, gate = () => enabled() ? 'eligible' : 'nonproduction', diagnose = () => {}, load, send, revoke}) {
    let loaded = false, pageViewed = false, measurementNoted = false;
    const sentRegistrations = new Set();
    const read = key => {try {return JSON.parse(storage.getItem(key));} catch {return null;}};
    const write = (key, value) => {try {storage.setItem(key, JSON.stringify(value));} catch {}};
    let consent = read(CONSENT_KEY);
    if (!consent || !Number.isFinite(consent.at) || !['granted', 'denied'].includes(consent.value) || now() - consent.at >= MAX_AGE || consent.at > now()) consent = null;
    function consented() {return consent?.value === 'granted' && now() - consent.at < MAX_AGE;}
    function allowed() {return consented() && enabled();}
    function diagnostic(name) {
      if (!consented()) return;
      try {const state = gate(); diagnose(name, MARKETING_GATES.has(state) ? state : 'nonproduction');} catch {}
    }
    function start() {
      // Prepare the public landing URL only after consent, before diagnostics/SDK.
      const isAllowed = allowed();
      // This first-party signal records an opted-in visit, not Meta receipt.
      if (consented() && !measurementNoted) {measurementNoted = true; diagnostic('marketing_measurement_ready');}
      if (!isAllowed) return;
      try {
        load(); loaded = true;
        if (!pageViewed) {send('PageView', {}, true); pageViewed = true;}
      } catch { /* A blocked advertising script must never interrupt play. */ }
    }
    function choose(value) {
      if (!['granted', 'denied'].includes(value)) return;
      consent = {value, at: now()}; write(CONSENT_KEY, consent);
      if (value === 'denied') {
        try {revoke(); storage.removeItem(EVENTS_KEY);} catch {}
      } else start();
    }
    function event(name, game) {
      if (!allowed() || !game?.puzzle?.id || game.isReplay || !['starter', 'daily', 'free', 'tajenka'].includes(game.mode)) return;
      if (!['GameStarted', 'GameCompleted'].includes(name)) return;
      if (name === 'GameCompleted' && !game.finished) return;
      start();
      if (!loaded) return;
      const key = `${name}:${game.mode}:${game.puzzle.id}:${game.dailyDate || ''}`;
      const storedRows = read(EVENTS_KEY);
      const rows = (Array.isArray(storedRows) ? storedRows : []).filter(row => Array.isArray(row) && now() - row[1] < MAX_AGE);
      if (rows.some(row => row[0] === key)) return;
      try {
        send(name, {game_mode: game.mode}, false);
        if (name === 'GameCompleted' && game.mode === 'starter') send('CompleteTutorial', {}, false);
        write(EVENTS_KEY, [...rows, [key, now()]].slice(-1000));
      } catch {}
    }
    function registration(result) {
      // The server flag denotes a newly inserted player, not a login/link.
      if (!allowed() || result?.accountCreated !== true || !/^[a-zA-Z0-9-]{1,64}$/.test(result.id || '')) return;
      start();
      if (!loaded) return;
      const key = `CompleteRegistration:${result.id}`;
      const saved = read(EVENTS_KEY);
      const rows = (Array.isArray(saved) ? saved : []).filter(row => Array.isArray(row) && now() - row[1] < MAX_AGE);
      if (sentRegistrations.has(key) || rows.some(row => row[0] === key)) return;
      try {
        // No account ID, name, email, token or submitted form data goes to Meta.
        send('CompleteRegistration', {}, true);
        sentRegistrations.add(key);
        write(EVENTS_KEY, [...rows, [key, now()]].slice(-1000));
      } catch {}
    }
    return {start, choose, event, registration, allowed, consented, status: () => consent?.value || null};
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = {create, pixelGate, cleanPixelLanding, CONSENT_KEY, EVENTS_KEY};
  if (!global?.document) return;
  const doc = global.document;
  let storage;
  try {storage = global.localStorage;} catch {storage = {getItem: () => null, setItem() {}, removeItem() {}};}
  function gate() {
    return pixelGate(global.location.href, {environment:global.PROPLET_RUNTIME_ENV, candidatePreview:global.PROPLET_RUNTIME_META?.gen5CandidatePreview});
  }
  function enabled() {
    if (gate() === 'eligible') return true;
    const clean = cleanPixelLanding(global.location.href, {environment:global.PROPLET_RUNTIME_ENV, candidatePreview:global.PROPLET_RUNTIME_META?.gen5CandidatePreview});
    if (!clean) return false;
    try {
      // Pixel reads location itself. Never enable it against the unfiltered URL.
      global.history.replaceState(global.history.state, '', clean);
      return gate() === 'eligible';
    } catch {return false;}
  }
  function diagnose(name, state) {
    try {if (typeof global.trackProductEvent === 'function') global.trackProductEvent(name, {marketingGate:state});} catch {}
  }
  const sdkDiagnostics = new Set();
  function sdkDiagnostic(name) {
    if (!controller.consented() || sdkDiagnostics.has(name)) return;
    sdkDiagnostics.add(name); diagnose(name, gate());
  }
  function load() {
    if (!global.fbq) {
      const fbq = function () {fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments);};
      fbq.push = fbq; fbq.loaded = true; fbq.version = '2.0'; fbq.queue = []; fbq.disablePushState = true;
      global.fbq = fbq; global._fbq = fbq;
      const script = doc.createElement('script'); script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      script.onload = () => sdkDiagnostic('marketing_sdk_loaded');
      script.onerror = () => sdkDiagnostic('marketing_sdk_failed');
      doc.head.appendChild(script);
      fbq('set', 'autoConfig', false, PIXEL_ID);
      fbq('init', PIXEL_ID);
    }
    global.fbq('consent', 'grant');
  }
  function revoke() {
    if (global.fbq) global.fbq('consent', 'revoke');
    for (const name of ['_fbp', '_fbc']) {
      for (const domain of ['', `; Domain=${global.location.hostname}`, '; Domain=.hrajproplet.cz']) {
        doc.cookie = `${name}=; Max-Age=0; Path=/${domain}; SameSite=Lax; Secure`;
      }
    }
  }
  const controller = create({storage, enabled, gate, diagnose, load, revoke,
    send: (name, data, standard) => {
      // Re-grant handles an explicit opt-in after a previous revocation.
      global.fbq('consent', 'grant');
      global.fbq(standard ? 'trackSingle' : 'trackSingleCustom', PIXEL_ID, name, data);
    }});
  global.PropletMarketing = controller;
  let banner, showTimer;
  function show() {
    if (showTimer) global.clearTimeout(showTimer);
    if (!banner) {
      banner = doc.createElement('section'); banner.className = 'marketing-consent';
      banner.setAttribute('role', 'region');
      banner.setAttribute('aria-label', 'Reklamní cookies');
      banner.innerHTML = '<p>Můžeme použít cookies od Mety k měření reklamy? <a href="/privacy.html#marketing">Podrobnosti</a></p><div class="marketing-consent-actions"><button type="button" data-choice="denied">Ne, díky</button><button type="button" data-choice="granted">Povolit</button></div>';
      doc.body.appendChild(banner);
      banner.addEventListener('click', event => {
        const choice = event.target.closest('[data-choice]')?.dataset.choice;
        if (!choice) return;
        controller.choose(choice);
        if (choice === 'granted' && global.currentGame && !global.currentGame.finished) controller.event('GameStarted', global.currentGame);
        banner.hidden = true;
      });
    }
    banner.hidden = false;
  }
  doc.querySelectorAll('[data-marketing-settings]').forEach(button => button.addEventListener('click', show));
  // Hooks cover normal games, the starter and Tajenka without exporting account data.
  if (typeof global.registerGameSessionHook === 'function') global.registerGameSessionHook({id: 'meta-marketing', afterStart: ({game}) => controller.event('GameStarted', game)});
  if (typeof global.registerGameCompletionHook === 'function') global.registerGameCompletionHook({id: 'meta-marketing', after: ({game}) => controller.event('GameCompleted', game)});
  if (controller.status()) {
    controller.start();
    if (global.currentGame && !global.currentGame.finished) controller.event('GameStarted', global.currentGame);
  }
  else if (['/', '/index.html'].includes(global.location.pathname)) {
    // Let the player see the real UI first. The banner never locks play or moves focus.
    let noticeScheduled = false;
    const schedule = () => {if (noticeScheduled) return; noticeScheduled = true; showTimer = global.setTimeout(show, 800);};
    const waitForUi = () => {
      if (global.__PROPLET_CURRENT_UI_READY) schedule();
      else global.addEventListener('proplet-ui-ready', schedule, {once:true});
    };
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', waitForUi, {once: true});
    else waitForUi();
  }
  global.addEventListener('storage', event => {
    if (event.key === CONSENT_KEY) global.location.reload();
  });
})(typeof window !== 'undefined' ? window : null);
