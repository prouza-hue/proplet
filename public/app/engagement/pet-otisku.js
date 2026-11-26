/* The database owns monthly entitlements, offer claims and the funding balance. */
(() => {
  'use strict';
  const november = '2026-11', december = '2026-12';
  const editions = [november, december]; // Append only released, playable sets.
  const params = new URLSearchParams(location.search);
  const mode = params.get('pet_otisku');
  const preview = window.PROPLET_RUNTIME_META?.environment === 'preview' && ['dar', 'prosba'].includes(mode);
  const previewEdition = editions.includes(params.get('edice')) ? params.get('edice') : november;
  const dialog = document.querySelector('#otiskyLetter');
  const entry = document.querySelector('#otiskyEntry');
  const title = dialog.querySelector('h2');
  const copy = dialog.querySelector('[data-letter-copy]');
  const action = dialog.querySelector('[data-letter-action]');
  const closeButton = dialog.querySelector('[data-letter-close]');
  const model = () => window.PropletPatrons?.model;
  const account = () => typeof getProfile === 'function' && getProfile()?.token ? getProfile().id : null;
  const dayFormat = new Intl.DateTimeFormat('sv-SE', {timeZone:'Europe/Prague'});
  const today = () => dayFormat.format(new Date());
  const ordinary = row => ['free','daily','daily_special','tajenka'].includes(row?.mode);
  const activeMonth = () => preview ? previewEdition : today().slice(0,7);
  const dataMonth = () => editions.findLast(month => month <= activeMonth());
  const endpoint = month => month === november ? '/api/pet-otisku' : '/api/gift-editions/' + month;
  const crown = new Intl.NumberFormat('cs-CZ');
  let month = activeMonth(), state = null, ready = false, generation = 0;
  let returning = false, finished = false, requestedReturn = false, returned = false;
  let openType = null, paused = false, previewGift = mode === 'dar';
  let meterTimer, clockTimer, patronSignature, displayedAmount;
  // In memory only. Duplicating a tab copies sessionStorage and must never copy a claim.
  const reservations = new Set();
  const receipt = (type, owner=account(), edition=month) => [owner,edition,type].join('/');
  const hasCampaign = () => editions.includes(month) && month === activeMonth();
  function askWeek() {
    if (!hasCampaign()) return false;
    const [year, number, day] = today().split('-').map(Number);
    return day > new Date(Date.UTC(year, number, 0)).getUTCDate() - 7;
  }
  function askAllowed(value) {
    return askWeek() && value?.askActive === true && value.eligible === false &&
      value.pending === false && Number.isSafeInteger(value.remainingCzk) && value.remainingCzk > 0 &&
      model()?.enabled && model()?.authenticated && model()?.offersDisabled === false && !model()?.pending;
  }
  function acquired() {
    if (preview) return previewGift ? [previewEdition] : [];
    if (Array.isArray(state?.editions)) return state.editions.filter(edition => editions.includes(edition));
    return state?.eligible && dataMonth() === november ? [november] : [];
  }
  function renderEntry() {
    const owned = acquired();
    entry.hidden = !owned.length;
    entry.querySelector('span').textContent = owned.length === 1 && owned[0] === november ? 'Pět otisků' : 'Dárkové desky';
    entry.querySelector('small').textContent = owned.length > 1 ? owned.length + ' série' : 'Dárek';
  }
  function closeLetter() {
    clearInterval(meterTimer);
    openType = null;
    if (dialog.open) dialog.close();
  }
  function renderAsk(amount) {
    displayedAmount = amount;
    const sum = document.createElement('strong');
    sum.textContent = crown.format(amount) + ' Kč';
    copy.replaceChildren(month === december ? 'Do prosincového cíle zbývá ' : 'Do listopadového cíle zbývá ', sum,
      month === december ? '. Pokud chcete přispět na provoz Propletu, budu rád. Z prvního plechu jsem pro Vás schoval pět kousků.' :
        '. Pokud se chcete přidat, budu rád. Pro každého podporovatele jsem připravil pět speciálních desek.');
  }
  async function refresh() {
    const edition = dataMonth(), owner = account();
    if (preview || !ready || !owner || !edition || !model()?.authenticated || !model().enabled) return;
    const token = ++generation;
    try {
      const latest = await api(endpoint(edition));
      if (token !== generation || owner !== account() || edition !== dataMonth()) return;
      state = latest;
      renderEntry();
      if (openType === 'ask') {
        if (askAllowed(latest)) renderAsk(latest.remainingCzk);
        else closeLetter();
      }
      window.PropletAnnouncements?.kick();
    } catch {
      if (token !== generation) return;
      if (openType === 'ask') closeLetter();
      // Keep already acquired entries accessible while withholding unverified offers.
      if (state) state = {...state, askActive:false};
    }
  }
  function openLetter(type, amount) {
    openType = type;
    dialog.querySelector('[role=status]').textContent = '';
    dialog.querySelector('[data-letter-preview]').hidden = !preview;
    action.disabled = false;
    title.textContent = type === 'gift' ? (month === december ? 'Ještě jeden plech' : 'Pět desek do vlastních rukou') :
      (month === december ? 'Pomůžete s prosincovým provozem?' : 'Pomůžete s listopadovým provozem?');
    if (type === 'gift') {
      copy.textContent = month === december ?
        'Děkuju, že pomáháte držet Proplet v chodu. Z prvního plechu jsem pro Vás schoval pět kousků. Najdete je i na kartě Hrát.' :
        'Děkuju, že podporujete Proplet. Tentokrát posílám něco já Vám. V obálce je pět desek. Až na ně budete mít chuť, najdete je i na kartě Hrát.';
    } else renderAsk(amount);
    action.textContent = type === 'gift' ? 'Rozbalit dárek' : 'Přispět na Proplet';
    closeButton.textContent = type === 'gift' ? 'Později' : 'Teď ne';
    if (!dialog.open) dialog.showModal();
    title.focus({preventScroll:true});
    if (!preview && type === 'ask') meterTimer = setInterval(refresh, 15000);
  }
  async function onAction() {
    if (openType === 'gift') {
      if (preview) previewGift = true;
      renderEntry();
      closeLetter();
      window.PropletPetOtiskuGame.open({edition:month, preview});
      return;
    }
    if (preview) {
      previewGift = true;
      renderEntry();
      openLetter('gift');
      return;
    }
    const owner = account(), edition = month, acceptedAmount = displayedAmount;
    if (!owner || !askWeek()) { closeLetter(); return; }
    action.disabled = true;
    try {
      const latest = await api(endpoint(edition));
      if (owner !== account() || edition !== month || openType !== 'ask' || !dialog.open) return;
      state = latest;
      renderEntry();
      if (!askAllowed(latest)) { closeLetter(); return; }
      if (latest.remainingCzk !== acceptedAmount) {
        renderAsk(latest.remainingCzk);
        dialog.querySelector('[role=status]').textContent = 'Zbývající částka se právě změnila.';
        return;
      }
      closeLetter();
      window.PropletPatrons.open('offer', document.querySelector('[data-nav="daily"]'));
    } catch { if (openType === 'ask' && owner === account() && edition === month) closeLetter(); }
    finally { action.disabled = false; }
  }
  function eligible(type, context) {
    if (preview || !hasCampaign() || context.screen !== 'daily' || !state || model()?.thanksPending ||
        model()?.personalGift?.pending || model()?.personalGift?.delivery?.pending) return false;
    if (type === 'gift') return state.eligible && (!state.giftSeen || reservations.has(receipt(type)));
    return returning && finished && returned && (!state.askSeen || reservations.has(receipt(type))) && askAllowed(state);
  }
  async function show(type, {isCurrent}) {
    if (!isCurrent()) return false;
    const owner = account(), edition = month, key = receipt(type);
    const held = reservations.has(key);
    const route = endpoint(edition);
    const latest = held ? await api(route) : await api(route + '/seen', {method:'POST', body:JSON.stringify({kind:type})});
    if (!held && latest.claimed) reservations.add(key);
    if (owner !== account() || edition !== activeMonth()) return false;
    const current = isCurrent();
    ++generation;
    state = latest;
    renderEntry();
    if (!(type === 'gift' ? latest.eligible : askAllowed(latest))) { reservations.delete(key); return false; }
    if (!current || !reservations.delete(key)) return false;
    paused = true;
    document.querySelector('#patronOffer')?.remove();
    openLetter(type, latest.remainingCzk);
    return true;
  }
  function captureHistory() {
    if (!account()) return;
    const key = 'proplet:gift-series:prior-game:' + account();
    try {
      const recorded = sessionStorage.getItem(key);
      if (recorded !== null) { returning = recorded === '1'; return; }
    } catch {}
    returning = Number(getProfile()?.stats?.totalCompleted) > 0 || Object.values(getState()?.completed || {}).some(ordinary);
    try { sessionStorage.setItem(key, returning ? '1' : '0'); } catch {}
  }
  function syncMonth() {
    if (month !== activeMonth()) {
      ++generation;
      month = activeMonth();
      closeLetter();
      state = null;
      finished = returned = requestedReturn = paused = false;
      renderEntry();
      refresh();
    }
  }
  function scheduleClock() {
    clearTimeout(clockTimer);
    syncMonth();
    // Local midnight may be 23 or 25 hours away. Binary-search the date transition.
    const day = today();
    let low = Date.now(), high = low + 26 * 3600000;
    while (high - low > 1) {
      const mid = Math.floor((high + low) / 2);
      if (dayFormat.format(mid) === day) low = mid; else high = mid;
    }
    clockTimer = setTimeout(scheduleClock, Math.max(1, high - Date.now()));
  }
  function boot() {
    if (ready) return;
    ready = true;
    if (preview) {
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
      syncMonth();
      if (returning && game?.finished && ordinary(game) && !game.postStarterWarmup && !game.puzzle?.meta?.archiveExperience) finished = true;
    }});
    scheduleClock();
    refresh();
  }
  action.addEventListener('click', onAction);
  closeButton.addEventListener('click', closeLetter);
  dialog.addEventListener('close', () => { if (!dialog.open) closeLetter(); });
  dialog.addEventListener('click', event => { if (event.target === dialog) closeLetter(); });
  entry.addEventListener('click', () => window.PropletPetOtiskuGame.collection({editions:acquired(), preview}));
  document.addEventListener('click', event => {
    if (!finished || preview) return;
    const button = event.target.closest?.('[data-nav],button');
    if (!button) return;
    requestedReturn = button.dataset.nav === 'daily' || (['winMenuBtn','winPrimaryBtn'].includes(button.id) && /dnes|dnešek/i.test(button.textContent));
  }, true);
  window.addEventListener('popstate', () => { if (finished) requestedReturn = true; }, true);
  document.addEventListener('proplet:screen-changed', event => {
    syncMonth();
    if (openType && event.detail.screen !== 'daily') closeLetter();
    returned = event.detail.screen === 'daily' && finished && requestedReturn;
    requestedReturn = false;
    if (returned) refresh();
  });
  document.addEventListener('visibilitychange', () => {
    if (preview || !ready || document.hidden) return;
    scheduleClock();
    refresh();
  });
  document.addEventListener('proplet:account-changed', () => {
    ++generation;
    state = null;
    patronSignature = null;
    finished = returned = requestedReturn = returning = paused = false;
    closeLetter();
    renderEntry();
    if (ready && !preview) captureHistory();
  });
  document.addEventListener('proplet:exclusive-avatars-changed', () => {
    if (preview || !ready || !model()?.authenticated) return;
    const value = model();
    const signature = JSON.stringify([account(), value.paid, value.contributions, value.monthFunding, value.offersDisabled, value.pending]);
    if (signature === patronSignature && state) return;
    patronSignature = signature;
    if (openType === 'ask' && (value.pending || value.offersDisabled)) closeLetter();
    refresh();
  });
  window.PropletPetOtiskuCampaign = {suppressRegularOffer:() => hasCampaign() && (paused ||
    (returned && askWeek() && (!state?.askSeen || reservations.has(receipt('ask'))) && (!state || askAllowed(state))))};
  document.addEventListener('proplet:ready', boot, {once:true});
  if (window.__PROPLET_CURRENT_UI_READY) boot();
})();
