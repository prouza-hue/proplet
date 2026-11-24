/* November 2026 supporter gift. The server decides entitlement, receipts and funding. */
(() => {
  'use strict';
  const route = '/api/pet-otisku';
  const mode = new URLSearchParams(location.search).get('pet_otisku');
  const preview = window.PROPLET_RUNTIME_META?.environment === 'preview' && ['dar', 'prosba'].includes(mode);
  const dialog = document.querySelector('#otiskyLetter');
  const entry = document.querySelector('#otiskyEntry');
  const title = dialog.querySelector('h2');
  const copy = dialog.querySelector('[data-letter-copy]');
  const action = dialog.querySelector('[data-letter-action]');
  const closeButton = dialog.querySelector('[data-letter-close]');
  const notice = dialog.querySelector('[role=status]');
  const model = () => window.PropletPatrons?.model;
  const account = () => typeof getProfile === 'function' && getProfile()?.token ? getProfile().id : null;
  const today = () => new Intl.DateTimeFormat('sv-SE', {timeZone:'Europe/Prague'}).format(new Date());
  const inNovember = () => today().startsWith('2026-11');
  let state = null, loading = false, epoch = 0, returning = false, completedThisVisit = false;
  let returnedToToday = false, previousScreen = null, kind = null, ready = false;
  let pausedOffers = false;
  let previewCount = 0, previewGift = mode === 'dar';

  // A granted server receipt belongs to this tab until the envelope really opens.
  // Navigation or a change of account during the request can defer delivery.
  const undelivered = new Set();
  function receiptKey(type, owner) {
    return 'proplet:pet-otisku:2026-11:delivery:' + owner + ':' + type;
  }
  function reserved(type, owner = account()) {
    if (!owner) return false;
    const key = receiptKey(type, owner);
    try { return undelivered.has(key) || sessionStorage.getItem(key) === '1'; }
    catch { return undelivered.has(key); }
  }
  function remember(type, owner, keep) {
    const key = receiptKey(type, owner);
    if (keep) undelivered.add(key);
    else undelivered.delete(key);
    try {
      if (keep) sessionStorage.setItem(key, '1');
      else sessionStorage.removeItem(key);
    } catch {}
  }

  function renderEntry() {
    const eligible = preview ? previewGift : state?.eligible === true;
    entry.hidden = !eligible;
    const count = preview ? previewCount : state?.completed?.length || 0;
    entry.querySelector('small').textContent = count ? count + ' / 5' : 'Dárek';
  }

  function askAllowed(value) {
    return inNovember() && value?.askActive === true && value.eligible === false &&
      value.pending === false && Number.isSafeInteger(value.remainingCzk) && value.remainingCzk > 0 &&
      model()?.enabled && model()?.authenticated && model()?.offersDisabled === false;
  }

  function refresh(force = false) {
    if (preview || !account() || loading || !model()?.authenticated || !model().enabled) return;
    if (!model().paid && !returnedToToday && !force) return;
    if (state && !force) return;
    const mine = epoch;
    loading = true;
    api(route).then(value => {
      if (mine !== epoch) return;
      state = value;
      renderEntry();
      window.PropletAnnouncements?.kick();
    }).catch(() => {}).finally(() => { if (mine === epoch) loading = false; });
  }

  function closeLetter() {
    if (dialog.open) dialog.close();
  }

  function openLetter(type, amount) {
    kind = type;
    notice.textContent = '';
    dialog.querySelector('[data-letter-preview]').hidden = !preview;
    action.disabled = false;
    action.hidden = false;
    title.textContent = type === 'gift' ? 'Pět desek do vlastních rukou' : 'Pomůžete s listopadovým provozem?';
    if (type === 'gift') {
      copy.textContent = 'Děkuju, že podporujete Proplet. Tentokrát posílám něco já Vám. V obálce je pět desek. Až na ně budete mít chuť, najdete je i na kartě Hrát.';
    } else {
      const sum = document.createElement('strong');
      sum.textContent = new Intl.NumberFormat('cs-CZ').format(amount) + ' Kč';
      copy.replaceChildren('Děkuju všem, kdo už na Proplet přispěli. Do listopadového cíle 2 000 Kč zbývá ', sum, '. Pokud se chcete přidat, budu rád. Pro každého podporovatele jsem připravil pět speciálních desek.');
    }
    action.textContent = type === 'gift' ? 'Rozbalit dárek' : 'Přispět na Proplet';
    closeButton.textContent = type === 'gift' ? 'Později' : 'Teď ne';
    if (!dialog.open) dialog.showModal();
    title.focus({preventScroll:true});
  }

  async function onAction() {
    if (kind === 'gift') {
      if (preview) previewGift = true;
      renderEntry();
      closeLetter();
      window.PropletPetOtiskuGame.open({preview});
      return;
    }
    if (preview) {
      title.textContent = 'Příspěvek v náhledu';
      copy.textContent = 'Ve hře se zde otevře výběr částky a platba přes QR kód. V náhledu si můžete vyzkoušet, jak dárek vypadá po potvrzení příspěvku.';
      action.textContent = 'Vyzkoušet dárek';
      closeButton.textContent = 'Zavřít';
      kind = 'gift';
      return;
    }
    const mine = epoch;
    action.disabled = true;
    try {
      const latest = await api(route);
      if (!dialog.open || mine !== epoch) return;
      state = latest;
      renderEntry();
      if (askAllowed(latest)) {
        closeLetter();
        window.PropletPatrons.open('offer', entry.hidden ? document.querySelector('[data-nav="daily"]') : entry);
      } else {
        title.textContent = latest.remainingCzk === 0 ? 'Listopad je pokrytý' : 'Děkuju za zájem';
        copy.textContent = latest.pending ? 'Váš příspěvek už čeká na potvrzení.' :
          latest.eligible ? 'Pět otisků najdete na kartě Hrát.' : 'Listopadová výzva už skončila.';
        action.hidden = true;
        closeButton.textContent = 'Zavřít';
      }
    } catch {
      if (mine === epoch) notice.textContent = 'Stav podpory se nepodařilo načíst. Zkuste to za chvíli.';
    } finally {
      if (mine === epoch) action.disabled = false;
    }
  }

  function eligible(type, context) {
    if (preview || context.screen !== 'daily' || !state || model()?.thanksPending ||
        model()?.personalGift?.pending || model()?.personalGift?.delivery?.pending) return false;
    if (type === 'gift') return state.eligible && (!state.giftSeen || reserved(type));
    return returning && returnedToToday && (!state.askSeen || reserved(type)) && askAllowed(state);
  }

  async function show(type, {isCurrent}) {
    if (!isCurrent()) return false;
    const mine = epoch, owner = account();
    const held = reserved(type, owner);
    const latest = held ? await api(route) :
      await api(route + '/seen', {method:'POST', body:JSON.stringify({kind:type})});
    if (!held && latest.claimed) remember(type, owner, true);
    if (mine !== epoch || owner !== account()) return false;
    const current = isCurrent();
    const allowed = type === 'gift' ? latest.eligible : askAllowed(latest);
    state = latest;
    renderEntry();
    if (!allowed) {
      remember(type, owner, false);
      return false;
    }
    if (!current || !reserved(type, owner)) return false;
    pausedOffers = true;
    document.querySelector('#patronOffer')?.remove();
    openLetter(type, latest.remainingCzk);
    remember(type, owner, false);
    return true;
  }

  function captureHistory() {
    if (!account()) return;
    returning = Number(getProfile()?.stats?.totalCompleted) > 0 ||
      Object.values(getState()?.completed || {}).some(row => ['free','daily','daily_special','tajenka'].includes(row?.mode));
  }

  function boot() {
    if (ready) return;
    ready = true;
    if (preview) {
      previewCount = window.PropletPetOtiskuGame.previewCompleted().length;
      renderEntry();
      openLetter(mode === 'dar' ? 'gift' : 'ask', 420);
      return;
    }
    captureHistory();
    for (const type of ['gift','ask']) {
      window.PropletAnnouncements.register({
        id:'pet-otisku-2026-' + type, repeatable:true, priority: type === 'gift' ? 18 : -11,
        minimumCompleted:type === 'gift' ? 0 : 1,
        eligible:context => eligible(type, context), show:ticket => show(type, ticket), close:closeLetter
      });
    }
    registerGameCompletionHook({id:'pet-otisku-return', priority:205, after:({game}) => {
      if (returning && inNovember() && game?.finished && !game.postStarterWarmup &&
          ['free','daily','daily_special','tajenka'].includes(game.mode)) completedThisVisit = true;
    }});
    refresh();
  }

  action.addEventListener('click', onAction);
  closeButton.addEventListener('click', closeLetter);
  entry.addEventListener('click', () => window.PropletPetOtiskuGame.open({preview, overview:true}));
  dialog.addEventListener('click', event => { if (event.target === dialog) closeLetter(); });
  document.addEventListener('proplet:screen-changed', event => {
    if ((completedThisVisit || reserved('ask')) && !state?.eligible && (!state?.askSeen || reserved('ask')) && inNovember() &&
        previousScreen && previousScreen !== 'daily' && event.detail.screen === 'daily') {
      returnedToToday = true;
      refresh(true);
    }
    previousScreen = event.detail.screen;
  });
  document.addEventListener('proplet:account-changed', () => {
    ++epoch;
    loading = false;
    state = null;
    completedThisVisit = returnedToToday = returning = pausedOffers = false;
    closeLetter();
    renderEntry();
    if (ready && !preview) captureHistory();
  });
  document.addEventListener('proplet:exclusive-avatars-changed', () => {
    if (ready && model()?.authenticated && model().paid && !state?.eligible && !state?.giftSeen) refresh(true);
  });
  document.addEventListener('proplet:pet-otisku-completed', event => {
    if (event.detail?.preview) previewCount = event.detail.completed.length;
    else if (state) state.completed = event.detail.completed;
    renderEntry();
  });
  window.PropletPetOtiskuCampaign = {suppressRegularOffer:() =>
    inNovember() && (pausedOffers || (returnedToToday && (!state?.askSeen || reserved('ask')) && (!state || askAllowed(state))))};
  document.addEventListener('proplet:ready', boot, {once:true});
  if (window.__PROPLET_CURRENT_UI_READY) boot();
})();
