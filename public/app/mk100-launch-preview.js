/* Explicit visual draft only. Normal Proplet sessions never mount this dialog. */
(function (global) {
  'use strict';

  const requested = new URLSearchParams(global.location.search).get('announcement') === 'mozkokalypsa';
  if (!requested || global.PROPLET_MK100_INTEGRATED_PREVIEW !== true) return;

  let modal = null;
  let returnFocus = null;
  let background = [];
  let previousOverflow = '';

  // A decorative, fully covered 4×4 board: VÍR, MAPA, SLOVA and HRÁT.
  function boardArt() {
    const letters = ['V', 'Í', 'M', 'A', 'S', 'R', 'A', 'P', 'L', 'O', 'H', 'R', 'A', 'V', 'T', 'Á'];
    const paths = [
      ['mint', '30,30 70,30 70,70'],
      ['blue', '110,30 150,30 150,70 110,70'],
      ['rust', '30,70 30,110 70,110 70,150 30,150'],
      ['plum', '110,110 150,110 150,150 110,150']
    ];
    return `<svg class="mk-launch-board" viewBox="0 0 180 180" aria-hidden="true" focusable="false"><rect class="mk-launch-board-paper" x="5" y="5" width="170" height="170" rx="14"/>${paths.map(([color, points]) => `<polyline class="mk-launch-path ${color}" points="${points}"/>`).join('')}${letters.map((letter, index) => `<text x="${30 + (index % 4) * 40}" y="${30 + Math.floor(index / 4) * 40}">${letter}</text>`).join('')}</svg>`;
  }

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
    modal.innerHTML = `<section class="modal-card mk-launch-card"><button type="button" class="modal-close" data-mk-launch-close aria-label="Zavřít oznámení"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button><div class="mk-launch-art" aria-hidden="true"><span class="mk-launch-hundred">100</span><img class="mk-launch-vortex" src="/difficulty/printshop/mozkokalypsa-series-ochre.svg" width="180" height="180" alt="">${boardArt()}</div><h2 id="mk100LaunchTitle">Mozkokalypsa je tady.</h2><p id="mk100LaunchCopy">Sto nových desek. Plná mřížka. Každé políčko patří do řešení.</p><div class="mk-launch-actions"><button type="button" class="primary-btn big" data-mk-launch-play>Jdu do Mozkokalypsy <span aria-hidden="true">→</span></button><button type="button" class="text-btn" data-mk-launch-back>Zpět do náhledu</button></div></section>`;
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
