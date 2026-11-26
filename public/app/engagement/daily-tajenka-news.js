/* Release invitations share the Today queue. Manual review never claims a receipt. */
(() => {
  'use strict';
  const daily = 'daily-tajenka-2026-12';
  const joint = 'weekly-spojky-daily-tajenka-2026-11';
  const params = new URLSearchParams(location.search);
  const game = () => window.PropletDailyTajenka;
  const review = () => game()?.isReview() === true;
  const onToday = () => !!document.querySelector('#screen-daily.active');
  const blocked = () => document.hidden || document.body.classList.contains('playing') ||
    !!document.querySelector('dialog[open],.modal:not(.hidden),.quality-modal:not(.hidden)');
  const online = () => navigator.onLine !== false;
  const deliveries = new Map();
  let ready = false, dialog = null, opener = null, visibleCampaign = '', displayScope = '';
  let reviewed = false, reviewObserver = null;

  function preferred() {
    if (!game()?.readyToday()) return null;
    if (review() && !params.has('spojkyReview')) return daily;
    const spojky = window.PropletSpojky;
    // Modules may finish after the shell's ready event; a failed import can fall back after load.
    if (!spojky && document.getElementById('spojkyWeeklyBtn') && document.readyState !== 'complete') return null;
    if (spojky?.settled() === false) return null;
    if (spojky?.available() && deliveries.get(joint)?.controller.snapshot().state?.enabled !== false) return joint;
    return daily;
  }

  // Navigation may interrupt a successful cross-device claim just before painting.
  // Keep that invitation in the winning tab until the same account returns to Today.
  const deferred = new Map();
  const receiptKey = (campaign, owner) => 'proplet:' + campaign + ':pending:' + owner;
  function reserved(campaign, owner) {
    const key = receiptKey(campaign, owner);
    if (deferred.has(key)) return deferred.get(key);
    try { return sessionStorage.getItem(key); } catch { return null; }
  }
  function reserve(campaign, owner, value) {
    const key = receiptKey(campaign, owner);
    if (value) deferred.set(key, value);
    else deferred.delete(key);
    try {
      if (value) sessionStorage.setItem(key, value);
      else sessionStorage.removeItem(key);
    } catch {}
  }

  function close(restore = true) {
    if (!dialog?.open) return;
    dialog.close();
    if (restore) {
      const fallback = document.querySelector('#oneScreenToday [data-tile="spojky"],#oneScreenToday [data-tile="tajenka"],#oneScreenToday .os-feature,#playDailyBtn');
      const target = opener?.getClientRects().length ? opener : fallback;
      target?.focus({preventScroll:true});
    }
    opener = null;
  }

  function build(campaign, sawDaily) {
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'dailyTajenkaNews';
      dialog.setAttribute('aria-labelledby','dailyTajenkaNewsTitle');
      dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
      document.body.append(dialog);
    }
    const combined = campaign === joint;
    dialog.classList.toggle('is-combined', combined);
    if (combined) {
      dialog.removeAttribute('aria-describedby');
      dialog.innerHTML = `
        <div class="tajenka-news-sheet">
          <h2 id="dailyTajenkaNewsTitle" tabindex="-1">${sawDaily ? 'Každý týden <span>nové Spojky</span>' : 'Tajenka každý den. <span>Spojky každý týden.</span>'}</h2>
          <div class="joint-news-games">
            <button type="button" data-spojky-news-play aria-labelledby="newsSpojkyPlay" aria-describedby="newsSpojkyAbout">
              <img src="/design/spojky/spojky-print.svg" alt="" width="54" height="54">
              <span><strong id="newsSpojkyPlay">Hrát Spojky</strong><small id="newsSpojkyAbout">Najdi tři slova, která propojí čtyři kartičky. Stejné políčko může patřit k více slovům.</small></span>
            </button>
            <button type="button" data-tajenka-news-play aria-labelledby="newsTajenkaPlay" aria-describedby="newsTajenkaAbout">
              <img src="/assets/announcements/tajenka-denne.webp" alt="" width="54" height="54">
              <span><strong id="newsTajenkaPlay">Otevřít Tajenku</strong><small id="newsTajenkaAbout">Utekla ti některá? Posledních sedm najdeš v kalendáři.</small></span>
            </button>
          </div>
          <button type="button" data-tajenka-news-close>Teď ne</button>
        </div>`;
      dialog.querySelector('[data-spojky-news-play]').onclick = () => {
        close(false);
        window.PropletSpojky.open();
      };
    } else {
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
    }
    dialog.querySelector('[data-tajenka-news-close]').onclick = () => close();
    dialog.querySelector('[data-tajenka-news-play]').onclick = () => {
      close(false);
      if (combined) game().openToday();
      else game().openFromNews();
    };
  }

  function open(campaign, sawDaily = false) {
    if (!ready || !onToday() || !campaign || preferred() !== campaign || blocked()) return false;
    opener = document.activeElement === document.body ? null : document.activeElement;
    visibleCampaign = campaign;
    displayScope = deliveries.get(campaign)?.controller.sync() || '';
    build(campaign, sawDaily);
    dialog.showModal();
    dialog.querySelector('h2').focus({preventScroll:true});
    return true;
  }

  function manualReview() {
    const campaign = preferred();
    if (reviewed || !ready || !campaign || !onToday()) return;
    if (open(campaign, params.get('spojkyNews') === 'seen')) {
      reviewed = true;
      reviewObserver?.disconnect();
      return;
    }
    if (!reviewObserver) {
      reviewObserver = new MutationObserver(changes => {
        if (changes.some(c => c.target.matches?.('dialog,.modal,.quality-modal'))) manualReview();
      });
      reviewObserver.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class','open','hidden']});
    }
  }

  function register(campaign, route, priority) {
    const queue = window.PropletAnnouncements;
    if (deliveries.has(campaign) || !queue || !window.PropletReleaseNews?.delivery ||
        window.PROPLET_RUNTIME_META?.environment !== 'production') return;
    const entry = { completionsAtStatus:0 };
    const controller = window.PropletReleaseNews.delivery({
      campaign, path:route, getProfile:() => window.getProfile?.(), online,
      request:async (path, options) => {
        if (options.method !== 'POST') entry.completionsAtStatus = Number(options.authProfile.stats?.totalCompleted) || 0;
        const result = await window.api(path,options);
        if (options.method === 'POST' && result?.campaignId === campaign && result.enabled === true &&
            result.eligible === true && result.displayGranted === true && result.canShowAutomatically === false) {
          reserve(campaign, String(options.authProfile.id), result.sawDailyTajenka ? 'seen' : '1');
        }
        return result;
      },
    });
    entry.controller = controller;
    deliveries.set(campaign, entry);
    queue.register({
      id:campaign, priority,
      eligible:context => context.screen === 'daily' && preferred() === campaign && online() &&
        (reserved(campaign, context.account) || controller.canOffer(context.account)),
      show:async permit => {
        const display = () => {
          if (!permit.isCurrent() || !open(campaign, reserved(campaign, permit.account) === 'seen')) return false;
          reserve(campaign, permit.account, null);
          if (campaign === joint) {
            reserve(daily, permit.account, null);
            queue.acknowledge(daily, permit.account);
          }
          return true;
        };
        try {
          if (reserved(campaign, permit.account)) {
            const state = await controller.load(true);
            if (!state?.enabled || !state.eligible) {
              if (state) reserve(campaign, permit.account, null);
              return false;
            }
            return display();
          }
          return await controller.show(permit, display);
        } finally {
          if (!reserved(campaign, permit.account) && !controller.canOffer(permit.account)) queue.kick();
        }
      },
      close:() => close(false),
    });
  }

  function refresh() {
    if (review()) { manualReview(); return; }
    register(daily, '/api/release-news/daily-tajenka', 121);
    register(joint, '/api/release-news/weekly-spojky', 122);
    if (dialog?.open && (!onToday() || deliveries.get(visibleCampaign)?.controller.sync() !== displayScope ||
        (visibleCampaign === joint && !window.PropletSpojky?.available()))) close(false);
    window.PropletAnnouncements?.kick();
  }
  document.addEventListener('proplet:ready', () => { ready = true; refresh(); }, {once:true});
  for (const event of ['proplet:tajenka-ready','proplet:spojky-ready','proplet:screen-changed','proplet:account-changed','visibilitychange']) {
    document.addEventListener(event,refresh);
  }
  document.addEventListener('proplet:profile-refreshed',() => {
    const entry = deliveries.get(preferred()), state = entry?.controller.snapshot().state;
    if (state?.enabled && !state.eligible && entry.completionsAtStatus < 5 &&
        Number(window.getProfile?.()?.stats?.totalCompleted) >= 5 && online() &&
        !window.PropletAnnouncements?.sessionUsed()) entry.controller.load(true).then(refresh);
  });
  window.addEventListener('online',refresh);
  window.addEventListener('load',refresh,{once:true});
})();
