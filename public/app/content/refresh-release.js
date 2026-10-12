/* Refresh 300 promotion. Eligibility mirrors production PR #167 (2026-10-03). */
(function (global) {
  'use strict';

  const SEEN = 'proplet:content-release:refresh300-v1';
  const FIRST_VISIT = 'proplet:refresh300-onboarding-visit';
  const RETURNING = FIRST_VISIT + ':returning-account';
  const accountId = () => { try { const p = typeof getProfile === 'function' ? getProfile() : null; return p?.token && p?.id ? String(p.id) : ''; } catch { return ''; } };
  // The historical key has no owner. Preserve it for guests only; it cannot
  // safely tell us which signed-in player dismissed the announcement.
  const seenKey = () => accountId() ? SEEN + ':account:' + accountId() : SEEN;
  const returningLogin = () => !!accountId() && sessionStorage.getItem(RETURNING) === accountId();
  let ready = false, shown = false, firstVisit = true, displayedKey = null;
  let ownerKey = seenKey();
  function captureVisit() {
    // Runs at native readiness, before a new visitor can complete the tutorial.
    // Subscribe before app.js so fast fixture boot cannot outrun the listener.
    try {
    const prior = typeof getState === 'function' ? getState() : null;
    const known = !!accountId() || Object.keys(prior?.completed || {}).length > 0 || Object.keys(prior?.inProgress || {}).length > 0;
    if (localStorage.getItem(ONBOARD_KEY) !== 'done' && !known) sessionStorage.setItem(FIRST_VISIT, '1');
    firstVisit = sessionStorage.getItem(FIRST_VISIT) === '1';
    localStorage.setItem(SEEN + ':storage-check', '1');
    localStorage.removeItem(SEEN + ':storage-check');
  } catch { firstVisit = true; }
    ownerKey = seenKey();
  }
  function eligible() {
    try {
      return (!firstVisit || returningLogin()) && localStorage.getItem(ONBOARD_KEY) === 'done'
        && localStorage.getItem(seenKey()) !== '1'
        && !(typeof onboardingMandatory !== 'undefined' && onboardingMandatory)
        && (!global.PropletFirstSteps?.quiet() || returningLogin())
        && ['easy','medium','hard'].every(diff => (puzzleDB.free?.[diff] || []).filter(p => p.id?.startsWith('g6-refresh-')).length === 100);
    } catch { return false; }
  }
  function maybeShow() {
    if (global.dailyExtraIntroPending?.()) return;
    if (!ready || shown || global.PropletContentAnnouncementShown === (accountId() || 'guest') || !eligible() || document.hidden) return;
    if (!['daily', 'free'].includes(currentScreen) || openTransientModal()
        || document.querySelector('dialog[open],.modal:not(.hidden),.quality-modal:not(.hidden)')) return;
    if (typeof global.nav !== 'function') return;
    shown = true; global.PropletContentAnnouncementShown = accountId() || 'guest';
    displayedKey = seenKey();
    if (modal) open(); else mount();
  }

  let modal = null;
  let returnFocus = null;
  let background = [];
  let previousOverflow = '';

  function restoreBackground() {
    for (const [element, inert] of background) element.inert = inert;
    background = [];
    document.body.style.overflow = previousOverflow;
  }

  function close(restoreFocus = true, remember = true) {
    if (!modal || modal.classList.contains('hidden')) return;
    modal.classList.add('hidden');
    try { if (remember && displayedKey) localStorage.setItem(displayedKey, '1'); } catch {}
    restoreBackground();
    if (restoreFocus && returnFocus?.isConnected) returnFocus.focus();
  }

  function onKeyDown(event) {
    if (!modal || modal.classList.contains('hidden')) return;
    modal.classList.remove('refresh-initial-focus');
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const buttons = Array.from(modal.querySelectorAll('button:not([disabled])'));
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }

  function open() {
    if (!modal || !modal.classList.contains('hidden')) return;
    returnFocus = document.activeElement;
    previousOverflow = document.body.style.overflow;
    background = Array.from(document.body.children)
      .filter(element => element !== modal && !['SCRIPT', 'STYLE', 'LINK'].includes(element.tagName))
      .map(element => [element, element.inert]);
    for (const [element] of background) element.inert = true;
    document.body.style.overflow = 'hidden';
    modal.classList.add('refresh-initial-focus');
    modal.classList.remove('hidden');
    modal.querySelector('[data-refresh-play]').focus();
  }

  function mount() {
    if (modal || typeof global.nav !== 'function') return;
    modal = document.createElement('div');
    modal.id = 'freeRefreshAnnouncement';
    modal.className = 'modal refresh-release-modal hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'freeRefreshAnnouncementTitle');
    modal.setAttribute('aria-describedby', 'freeRefreshAnnouncementCopy');
    modal.innerHTML = `<section class="modal-card refresh-announcement">
      <button type="button" class="modal-close" data-refresh-close aria-label="Zavřít oznámení"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
      <h2 id="freeRefreshAnnouncementTitle">Zase je co<br>rozplétat.</h2>
      <p id="freeRefreshAnnouncementCopy"><strong>300 nových desek</strong> pro chvíle,<br>kdy jedno kolo nestačí.</p>
      <div class="refresh-release-trio">
        <div class="refresh-release-series easy"><img src="/difficulty/printshop/easy.webp" width="64" height="64" alt=""><strong>Snadná</strong><span>100 nových</span></div>
        <div class="refresh-release-series medium"><img src="/difficulty/printshop/medium.webp" width="64" height="64" alt=""><strong>Střední</strong><span>100 nových</span></div>
        <div class="refresh-release-series hard"><img src="/difficulty/printshop/hard.webp" width="64" height="64" alt=""><strong>Těžká</strong><span>100 nových</span></div>
      </div>
      <div class="refresh-release-actions"><button type="button" class="primary-btn big" data-refresh-play>Vybrat si hru <span aria-hidden="true">→</span></button>
      <button type="button" class="text-btn" data-refresh-back>Teď ne</button></div>
    </section>`;
    document.body.appendChild(modal);
    modal.querySelector('[data-refresh-close]').addEventListener('click', () => close());
    modal.querySelector('[data-refresh-back]').addEventListener('click', () => close());
    modal.querySelector('[data-refresh-play]').addEventListener('click', () => {
      close(false);
      global.nav('free', {replace:true});
      document.querySelector('#difficultyCards [data-play-free]')?.focus({preventScroll:true});
    });
    modal.addEventListener('click', event => { if (event.target === modal) close(); });
    document.addEventListener('keydown', onKeyDown, true);
    open();
  }

  document.addEventListener('proplet:returning-player', () => {
    try { if (accountId()) sessionStorage.setItem(RETURNING, accountId()); } catch {}
    if (ready) setTimeout(maybeShow, 0);
  });
  document.addEventListener('proplet:account-changed', () => {
    const next = seenKey();
    if (next !== ownerKey) { close(false, false); shown = false; ownerKey = next; }
    if (ready) setTimeout(maybeShow, 0);
  });
  document.addEventListener('proplet:profile-refreshed', () => { if (ready) setTimeout(maybeShow, 0); });
  // Retry after a blocking dialog closes, without a polling loop.
  document.addEventListener('click', () => { if (ready && !shown) setTimeout(maybeShow, 0); });
  document.addEventListener('proplet:ready', () => { captureVisit(); ready = true; maybeShow(); });
  document.addEventListener('proplet:screen-changed', () => { if (ready) setTimeout(maybeShow, 0); });
  document.addEventListener('visibilitychange', maybeShow);
  document.addEventListener('proplet:content-ready',maybeShow);
  global.PropletRefreshRelease = Object.freeze({close});
})(window);
