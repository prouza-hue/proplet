/* Explicit visual draft only. Normal Proplet sessions never mount this dialog. */
(function (global) {
  'use strict';

  const requested = new URLSearchParams(global.location.search).get('announcement') === 'mozkokalypsa';
  if (!requested || global.PROPLET_MK100_INTEGRATED_PREVIEW !== true) return;

  let modal = null;
  let returnFocus = null;
  let background = [];
  let previousOverflow = '';

  function restoreBackground() {
    for (const [element, inert] of background) element.inert = inert;
    background = [];
    document.body.style.overflow = previousOverflow;
  }

  function close(restoreFocus = true) {
    if (!modal || modal.classList.contains('hidden')) return;
    modal.classList.add('hidden');
    restoreBackground();
    if (restoreFocus && returnFocus?.isConnected) returnFocus.focus();
  }

  function onKeyDown(event) {
    if (!modal || modal.classList.contains('hidden')) return;
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
    modal.classList.remove('hidden');
    modal.querySelector('[data-mk-launch-play]').focus();
  }

  function mount() {
    if (modal || typeof global.startFree !== 'function') return;
    modal = document.createElement('div');
    modal.id = 'mk100LaunchPreview';
    modal.className = 'modal mk-launch-preview hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'mk100LaunchTitle');
    modal.setAttribute('aria-describedby', 'mk100LaunchCopy');
    // Frozen mozkokalypsa-100/bank.json: 100 boards, 100 cells each,
    // 1,008 distinct targets across 1,400 occurrences (not 1,008 newly added lexemes).
    modal.innerHTML = `<section class="modal-card mk-launch-card"><button type="button" class="modal-close" data-mk-launch-close aria-label="Zavřít oznámení"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button><div class="mk-launch-art" aria-hidden="true"><img class="mk-launch-vortex" src="/difficulty/printshop/mozkokalypsa-series-ochre.svg" width="180" height="180" alt=""></div><h2 id="mk100LaunchTitle">Troufneš si na<br><span>Mozkokalypsu?</span></h2><div id="mk100LaunchCopy" class="mk-launch-facts"><p><strong>1&nbsp;008</strong><span>různých slov</span></p><p><strong>100</strong><span>nových desek</span></p><p><strong>100</strong><span>písmen na desce</span></p></div><div class="mk-launch-actions"><button type="button" class="primary-btn big" data-mk-launch-play>Troufnu si <span aria-hidden="true">→</span></button><button type="button" class="text-btn" data-mk-launch-back>Teď ne</button></div></section>`;
    document.body.appendChild(modal);
    modal.querySelector('[data-mk-launch-close]').addEventListener('click', () => close());
    modal.querySelector('[data-mk-launch-back]').addEventListener('click', () => close());
    modal.querySelector('[data-mk-launch-play]').addEventListener('click', () => {
      close(false);
      global.startFree('mozkokalypsa');
    });
    modal.addEventListener('click', event => { if (event.target === modal) close(); });
    document.addEventListener('keydown', onKeyDown, true);
    open();
  }

  document.addEventListener('proplet:ready', mount, {once: true});
  // Additive scripts may also load after the native readiness event.
  if (document.querySelector('.cp-card[data-diff="mozkokalypsa"]')) mount();
  global.PropletMk100LaunchPreview = {open, close};
})(window);
