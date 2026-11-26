/* Daily Tajenka is announced only after today's edition can actually be opened. */
(() => {
  'use strict';
  const campaign = 'daily-tajenka-2026-12';
  const route = '/api/release-news/daily-tajenka';
  const game = () => window.PropletDailyTajenka;
  const review = () => game()?.isReview() === true;
  const available = () => game()?.readyToday() === true;
  const onToday = () => !!document.querySelector('#screen-daily.active');
  const blocked = () => document.hidden || document.body.classList.contains('playing') ||
    !!document.querySelector('dialog[open],.modal:not(.hidden),.quality-modal:not(.hidden)');
  const online = () => navigator.onLine !== false;
  let ready = false, controller = null, dialog = null, opener = null, reviewed = false, scope = '';
  let reviewObserver = null;
  let completionsAtStatus = 0;

  // If navigation wins the race after a successful cross-device claim, keep the
  // winning tab's invitation until it can display it on Today for the same account.
  const deferred = new Set();
  const receiptKey = owner => 'proplet:' + campaign + ':pending:' + owner;
  function reserved(owner) {
    if (deferred.has(owner)) return true;
    try { return sessionStorage.getItem(receiptKey(owner)) === '1'; } catch { return false; }
  }
  function reserve(owner, pending) {
    if (pending) deferred.add(owner);
    else deferred.delete(owner);
    try {
      if (pending) sessionStorage.setItem(receiptKey(owner),'1');
      else sessionStorage.removeItem(receiptKey(owner));
    } catch {}
  }

  function close(restore = true) {
    if (!dialog?.open) return;
    dialog.close();
    if (restore) {
      const fallback = document.querySelector('#oneScreenToday [data-tile="tajenka"],#oneScreenToday .os-feature,#playDailyBtn');
      const target = opener?.getClientRects().length ? opener : fallback;
      target?.focus({preventScroll:true});
    }
    opener = null;
  }

  function build() {
    dialog = document.createElement('dialog');
    dialog.id = 'dailyTajenkaNews';
    dialog.setAttribute('aria-labelledby','dailyTajenkaNewsTitle');
    dialog.setAttribute('aria-describedby','dailyTajenkaNewsCopy');
    dialog.innerHTML = `
      <div class="tajenka-news-sheet">
        <div class="tajenka-news-intro">
          <div class="tajenka-news-art" aria-hidden="true">
            <img src="/assets/announcements/tajenka-denne.webp" alt="" width="144" height="144">
          </div>
          <div class="tajenka-news-text">
            <h2 id="dailyTajenkaNewsTitle" tabindex="-1">Tajenka <span>každý den</span></h2>
            <p id="dailyTajenkaNewsCopy">Utekla ti některá? Posledních sedm najdeš vždycky pohromadě.</p>
          </div>
        </div>
        <div class="tajenka-news-actions">
          <button type="button" data-tajenka-news-play>Jdu luštit <span aria-hidden="true">→</span></button>
          <button type="button" data-tajenka-news-close>Zavřít</button>
        </div>
      </div>`;
    document.body.append(dialog);
    dialog.querySelector('[data-tajenka-news-close]').onclick = () => close();
    dialog.querySelector('[data-tajenka-news-play]').onclick = () => {
      close(false);
      game()?.openFromNews();
    };
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  }

  function open() {
    if (!ready || !onToday() || !available() || blocked()) return false;
    if (!dialog) build();
    opener = document.activeElement === document.body ? null : document.activeElement;
    scope = controller?.sync() || '';
    dialog.showModal();
    dialog.querySelector('h2').focus({preventScroll:true});
    return true;
  }

  function manualReview() {
    if (!review() || reviewed || !ready || !available() || !onToday()) return;
    if (open()) {
      reviewed = true;
      reviewObserver?.disconnect();
      return;
    }
    // An explicit visual review may arrive during the normal onboarding dialog.
    // Retry only on visibility changes, never while drawing a word on the board.
    if (!reviewObserver) {
      reviewObserver = new MutationObserver(changes => {
        if (changes.some(c => c.target.matches?.('dialog,.modal,.quality-modal'))) manualReview();
      });
      reviewObserver.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class','open','hidden']});
    }
  }

  function register() {
    const queue = window.PropletAnnouncements;
    if (controller || !queue || !window.PropletReleaseNews?.delivery ||
        window.PROPLET_RUNTIME_META?.environment !== 'production') return;
    controller = window.PropletReleaseNews.delivery({
      campaign, path:route, getProfile:() => window.getProfile?.(), online,
      request:async (path, options) => {
        if (options.method !== 'POST') completionsAtStatus = Number(options.authProfile.stats?.totalCompleted) || 0;
        const result = await window.api(path,options);
        if (options.method === 'POST' && result?.campaignId === campaign && result.enabled === true &&
            result.eligible === true && result.displayGranted === true && result.canShowAutomatically === false) {
          reserve(String(options.authProfile.id),true);
        }
        return result;
      }
    });
    queue.register({
      id:campaign, priority:121,
      eligible:context => context.screen === 'daily' && available() && online() &&
        (reserved(context.account) || controller.canOffer(context.account)),
      show:async permit => {
        const display = () => {
          if (!permit.isCurrent() || !open()) return false;
          reserve(permit.account,false);
          return true;
        };
        try {
          if (reserved(permit.account)) {
            const state = await controller.load();
            if (!state?.enabled || !state.eligible) {
              if (state) reserve(permit.account,false);
              return false;
            }
            return display();
          }
          return await controller.show(permit,display);
        } finally {
          if (!reserved(permit.account) && !controller.canOffer(permit.account)) queue.kick();
        }
      },
      close:() => close(false)
    });
  }

  function refresh() {
    if (review()) { manualReview(); return; }
    register();
    if (dialog?.open && (!onToday() || controller?.sync() !== scope)) close(false);
    window.PropletAnnouncements?.kick();
  }
  document.addEventListener('proplet:ready', () => { ready = true; refresh(); }, {once:true});
  for (const event of ['proplet:tajenka-ready','proplet:screen-changed','proplet:account-changed','visibilitychange']) {
    document.addEventListener(event,refresh);
  }
  // A previously ineligible account can gain its fifth confirmed result while the tab stays open.
  document.addEventListener('proplet:profile-refreshed',() => {
    const state = controller?.snapshot().state;
    if (completionsAtStatus < 5 && Number(window.getProfile?.()?.stats?.totalCompleted) >= 5 &&
        available() && online() && state?.enabled && !state.eligible &&
        !window.PropletAnnouncements?.sessionUsed()) controller.load(true).then(refresh);
  });
  window.addEventListener('online',refresh);
})();
