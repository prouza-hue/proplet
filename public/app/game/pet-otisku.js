(function installPetOtiskuGame(global) {
  'use strict';

  const bankUrl = '/app/content/pet-otisku.json?v=2';
  const apiPath = '/api/pet-otisku';
  const stamps = ['D', 'Í', 'K', 'Y', '!'];
  let bankPromise;
  let dialog;
  let launchId = 0;

  function bank() {
    if (!bankPromise) {
      bankPromise = fetch(bankUrl).then(async response => {
        if (!response.ok) throw new Error('Dárkové desky se nepodařilo načíst.');
        const {boards} = await response.json();
        if (!Array.isArray(boards) || boards.length !== stamps.length) throw new Error('Balíček desek je neúplný.');
        return boards;
      }).catch(error => { bankPromise = null; throw error; });
    }
    return bankPromise;
  }

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  }
  function key(context, puzzle) {
    return 'proplet:pet-otisku:nov26:' + context.scope + ':' + puzzle.id;
  }
  function scope(preview) { return preview ? 'preview' : 'account:' + playerScope(); }
  function sameAccount(context) { return context.scope === scope(context.preview); }

  function persist(game) {
    const context = game.otisky;
    if (!context || game.finished || !sameAccount(context)) return false;
    const row = {
      found: game.found.map(item => item.answerIndex), replay: !!game.isReplay,
      moves: game.moves, hints: game.hints, maxHintLevel: game.maxHintLevel,
      wrongAttempts: game.wrongAttempts, elapsedMs: Math.round(gameElapsed(game))
    };
    try { localStorage.setItem(key(context, game.puzzle), JSON.stringify(row)); return true; }
    catch { return false; }
  }

  function restore(puzzle, context) {
    const row = read(key(context, puzzle), null);
    if (!Array.isArray(row?.found) || (context.completed.includes(context.board) && !row.replay)) return null;
    const indices = [...new Set(row.found)].filter(index => Number.isInteger(index) && puzzle.answers[index]);
    const found = indices.map((index, i) => ({
      answerIndex: index, colorIndex: i % COLORS.length,
      word: puzzle.answers[index].word, path: [...puzzle.answers[index].path]
    }));
    return {found, moves: +row.moves || 0, hints: +row.hints || 0,
      maxHintLevel: +row.maxHintLevel || 0, elapsedMs: +row.elapsedMs || 0,
      wrongAttempts: +row.wrongAttempts || 0};
  }

  const demoKey = 'proplet:pet-otisku:nov26:preview:completed';
  function currentStatus(preview) {
    if (preview) return {eligible: true, completed: read(demoKey, [])};
    return api(apiPath);
  }

  async function open({preview = false, board = null, overview = false} = {}) {
    const id = ++launchId;
    const context = {scope: scope(preview), preview};
    try {
      const [boards, status] = await Promise.all([bank(), currentStatus(preview)]);
      if (id !== launchId || !sameAccount(context)) return false;
      if (!status.eligible) throw new Error('Dárek se otevře po potvrzení příspěvku.');
      context.completed = status.completed || [];
      context.boardStamps = boards.map(puzzle => puzzle.stamp);
      const next = boards.findIndex((_, i) => !context.completed.includes(i + 1)) + 1;
      if (overview || (!board && !next)) {
        showCollection(boards, context);
        return true;
      }
      context.board = board || next;
      if (!boards[context.board - 1] || (!context.completed.includes(context.board) && context.board !== next)) return false;
      // Returning to a previously solved board starts a fresh replay unless a replay is already in progress.
      closeDialog();
      const started = await startGame(boards[context.board - 1], 'otisky', null, {otisky: context});
      if (started && currentGame?.otisky === context) {
        const reward = context.completed.includes(context.board) ? 'Opakování · bez dalších XP'
          : '300 XP za první dohrání. Počítají se jen do Vaší osobní hodnosti.';
        const hud = document.getElementById('cleanStatus');
        if (hud) hud.title = reward;
        if (!currentGame.found.length) message(reward);
      }
      return !!started;
    } catch (error) { showToast(error.message || 'Dárek se nepodařilo otevřít.'); return false; }
  }

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function button(text, action, primary = false) {
    const node = element('button', text, primary ? 'primary-btn' : 'secondary-btn');
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
  }
  function closeDialog() {
    if (dialog?.open) dialog.close();
    dialog?.remove();
    dialog = null;
  }
  function leave() {
    closeDialog();
    if (currentScreen === 'game' && currentGame?.mode === 'otisky') nav('free', {replace:true});
  }
  function sheet(title) {
    closeDialog();
    dialog = element('dialog', '', 'otisky-result');
    dialog.setAttribute('aria-labelledby', 'otisky-result-title');
    dialog.addEventListener('cancel', event => { event.preventDefault(); leave(); });
    const h = element('h2', title);
    h.id = 'otisky-result-title';
    dialog.append(h);
    document.body.append(dialog);
    return dialog;
  }
  function imprint({completed, boardStamps}) {
    const earnedStamps = new Set(completed.map(n => boardStamps[n - 1]));
    const strip = element('div', '', 'otisky-strip');
    strip.setAttribute('role','img');
    strip.setAttribute('aria-label',completed.length === 5 ? 'Pět otisků. DÍKY!' : 'Získané otisky: ' + completed.length + ' z pěti');
    stamps.forEach(letter => {
      const earned = earnedStamps.has(letter);
      strip.append(element('span', earned ? letter : '', earned ? 'otisky-stamp earned' : 'otisky-stamp'));
    });
    return strip;
  }
  function appendThanks(view) {
    view.append(element('p', 'Díky za každé propletené slovo!', 'otisky-note'),
      element('p', 'Pavel', 'otisky-sign'));
  }
  function actionBar() { return element('div', '', 'otisky-actions'); }
  function showCollection(boards, context) {
    const complete = context.completed.length === boards.length;
    const view = sheet(complete ? 'Dopis je doručený' : 'Pět otisků');
    view.append(imprint(context));
    if (complete) appendThanks(view);
    const menu = actionBar();
    const next = boards.findIndex((_, i) => !context.completed.includes(i + 1)) + 1;
    boards.forEach((b, i) => {
      const n = i + 1;
      if (context.completed.includes(n) || n === next) {
        menu.append(button((n === next ? 'Pokračovat · ' : 'Znovu · ') + b.title, () => open({preview:context.preview, board:n}), n === next));
      }
    });
    menu.append(button('Zavřít', leave));
    view.append(menu);
    view.showModal();
  }
  async function finish(game) {
    const context = game.otisky;
    if (!context || !sameAccount(context)) return;
    stopTimer();
    persist(game);
    const done = [...new Set(context.completed.concat(context.board))];
    let receipt;
    try {
      if (context.preview) {
        const previous = read(demoKey, []);
        const completed = [...new Set(previous.concat(context.board))];
        localStorage.setItem(demoKey, JSON.stringify(completed));
        receipt = {completed, awardedXp: previous.includes(context.board) ? 0 : 300};
      } else {
        const solution = [...game.found].sort((a,b) => a.answerIndex - b.answerIndex).map(row => row.path);
        receipt = await api(apiPath + '/complete', {method:'POST', body:JSON.stringify({board:context.board, solution})});
      }
    } catch (error) {
      game.finishing = false;
      if (currentGame === game && currentScreen === 'game' && sameAccount(context)) {
        const view = sheet('Všechna slova jsou na místě');
        view.append(element('p', 'Potvrzení výsledku se nepodařilo. ' + error.message));
        const actions = actionBar();
        actions.append(button('Zkusit znovu', () => {closeDialog(); finishGame();}, true), button('Později', leave));
        view.append(actions); view.showModal();
      }
      return;
    }
    context.completed = receipt.completed || done;
    game.finished = true;
    game.finishing = false;
    // A second tab may already have acknowledged the same board. Only the server's receipt awards XP.
    if (sameAccount(context)) {
      try { localStorage.removeItem(key(context, game.puzzle)); } catch {}
      document.dispatchEvent(new CustomEvent('proplet:pet-otisku-completed',{detail:{preview:context.preview,completed:context.completed}}));
      if (!context.preview) refreshRemoteProfile().catch(() => {});
    }
    if (currentGame !== game || currentScreen !== 'game' || !sameAccount(context)) return;
    releaseGameWakeLock();
    const complete = context.completed.length === stamps.length;
    const view = sheet(complete ? 'Dopis je doručený' : game.puzzle.title);
    view.append(imprint(context));
    view.append(element('p',receipt.awardedXp > 0 ? '+300 XP do osobní hodnosti' : 'Dohráno znovu · bez dalších XP','otisky-award'));
    if (complete) appendThanks(view);
    const actions = actionBar();
    if (!complete) actions.append(button('Další deska', () => open({preview:context.preview}), true));
    actions.append(button('Přehled série', () => open({preview:context.preview,overview:true})),button('Zpět do Hrát', leave,complete));
    view.append(actions); view.showModal();
  }

  document.addEventListener('proplet:screen-changed', () => {
    if (dialog?.open && currentScreen !== 'game') closeDialog();
    if (currentGame?.mode !== 'otisky') document.getElementById('cleanStatus')?.removeAttribute('title');
  });
  document.addEventListener('proplet:account-changed', () => {
    ++launchId;
    closeDialog();
    if (currentGame?.mode === 'otisky' && !sameAccount(currentGame.otisky) && currentScreen === 'game') nav('free', {replace:true});
  });
  global.PropletPetOtiskuGame = {open, persist, restore, finish, previewCompleted: () => currentStatus(true).completed};
})(window);
