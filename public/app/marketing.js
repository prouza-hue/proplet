(function (global) {
  'use strict';
  const CONSENT_KEY = 'proplet-marketing-consent-v1';
  const EVENTS_KEY = 'proplet-marketing-events-v1';
  const MAX_AGE = 180 * 86400000;
  // Public identifier, filled after the dedicated Proplet dataset is created.
  const PIXEL_ID = '';

  function create({storage, now = Date.now, enabled = () => false, load, send, revoke}) {
    let loaded = false, pageViewed = false;
    const read = key => {try {return JSON.parse(storage.getItem(key));} catch {return null;}};
    const write = (key, value) => {try {storage.setItem(key, JSON.stringify(value));} catch {}};
    let consent = read(CONSENT_KEY);
    if (!consent || !Number.isFinite(consent.at) || !['granted', 'denied'].includes(consent.value) || now() - consent.at >= MAX_AGE || consent.at > now()) consent = null;
    function allowed() {return consent?.value === 'granted' && now() - consent.at < MAX_AGE && enabled();}
    function start() {
      if (!allowed()) return;
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
    return {start, choose, event, status: () => consent?.value || null};
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = {create, CONSENT_KEY, EVENTS_KEY};
  if (!global?.document) return;
  const doc = global.document;
  let storage;
  try {storage = global.localStorage;} catch {storage = {getItem: () => null, setItem() {}, removeItem() {}};}
  function enabled() {
    const url = new URL(global.location.href);
    return /^\d+$/.test(PIXEL_ID) && url.hostname === 'hrajproplet.cz' && ['/', '/index.html'].includes(url.pathname) && !url.hash &&
      [...url.searchParams.keys()].every(key => ['fbclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'open'].includes(key)) &&
      global.PROPLET_RUNTIME_ENV !== 'preview' && !global.PROPLET_RUNTIME_META?.gen5CandidatePreview;
  }
  function load() {
    if (!global.fbq) {
      const fbq = function () {fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments);};
      fbq.push = fbq; fbq.loaded = true; fbq.version = '2.0'; fbq.queue = []; fbq.disablePushState = true;
      global.fbq = fbq; global._fbq = fbq;
      const script = doc.createElement('script'); script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
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
  const controller = create({storage, enabled, load, revoke,
    send: (name, data, standard) => {
      // Re-grant handles an explicit opt-in after a previous revocation.
      global.fbq('consent', 'grant');
      global.fbq(standard ? 'trackSingle' : 'trackSingleCustom', PIXEL_ID, name, data);
    }});
  let dialog, previousFocus;
  function show() {
    if (!dialog) {
      dialog = doc.createElement('dialog'); dialog.className = 'marketing-consent';
      dialog.setAttribute('aria-labelledby', 'marketing-consent-title');
      dialog.setAttribute('aria-describedby', 'marketing-consent-copy');
      dialog.innerHTML = '<h2 id="marketing-consent-title">Pomůžeš nám vyhodnotit reklamu?</h2><p id="marketing-consent-copy">S tvým souhlasem použijeme Meta Pixel a reklamní cookies. Meta získá údaje o návštěvě a hraní, technické údaje a identifikátory pro propojení s reklamou. Hra funguje stejně i bez souhlasu.</p><p>Volbu můžeš kdykoli změnit v nastavení soukromí. <a href="/privacy.html#marketing">Podrobnosti o měření</a></p><div class="marketing-consent-actions"><button type="button" data-choice="denied">Pokračovat bez měření</button><button type="button" data-choice="granted">Povolit měření</button></div>';
      doc.body.appendChild(dialog);
      dialog.addEventListener('click', event => {
        const choice = event.target.closest('[data-choice]')?.dataset.choice;
        if (choice) {
          controller.choose(choice);
          // The starter may already be displayed while the player makes a choice.
          // Begin measuring the active game now, never replay earlier events.
          if (choice === 'granted' && global.currentGame && !global.currentGame.finished) controller.event('GameStarted', global.currentGame);
          dialog.close(); previousFocus?.focus();
        }
      });
      dialog.addEventListener('cancel', () => {controller.choose('denied');});
    }
    previousFocus = doc.activeElement;
    if (!dialog.open) dialog.showModal();
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
    // DOM readiness also covers cached/offline startup where game readiness can
    // happen before this script is evaluated.
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', show, {once: true});
    else show();
  }
  global.addEventListener('storage', event => {
    if (event.key === CONSENT_KEY) global.location.reload();
  });
})(typeof window !== 'undefined' ? window : null);
