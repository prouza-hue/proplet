/* Verify the added shared-order story in the actual static native game. */
'use strict';
const {chromium} = require('playwright'), fs = require('node:fs'), path = require('node:path');
const base = process.env.FREE_REFRESH_PREVIEW_URL.replace(/\/$/, '');
const out = process.env.FREE_REFRESH_QA_OUTPUT || 'qa-free-refresh-300-online';
fs.mkdirSync(out, {recursive: true});
const checks = [], errors = [], requests = [];
const check = (name, pass) => {checks.push({name, pass: !!pass}); if (!pass) throw new Error(name);};
const monitor = page => {
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
  page.on('request', request => requests.push({url: request.url(), method: request.method()}));
  page.on('response', response => {if (response.status() >= 400) errors.push('HTTP ' + response.status() + ' ' + response.url());});
};
const ready = page => page.waitForFunction(() => document.querySelectorAll('[data-shared-catalogue]').length === 6);
const closeGame = page => page.evaluate(() => {
  document.querySelectorAll('.modal').forEach(modal => modal.classList.add('hidden'));
  const state = getState(); state.inProgress = {}; saveState(state); currentGame = null; nav('free');
});
(async () => {
  const browser = await chromium.launch({headless: true});
  let manifestHash, storagePrefix;
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 1000}, reducedMotion: 'reduce'}); monitor(page);
    await page.goto(base + '/', {waitUntil: 'networkidle'}); await ready(page);
    ({manifestHash, storagePrefix} = await page.evaluate(() => ({manifestHash: PROPLET_SHARED_FREE_ORDER_MANIFEST.contentHash, storagePrefix: PROPLET_FREE_REFRESH_PREVIEW.storagePrefix})));
    await page.locator('#freeRefreshToday button').click();
    check('shared switches appear in exactly the four mixed-content difficulties', await page.evaluate(() => {
      const expected = ['easy', 'medium', 'hard', 'hardcore'];
      return [...document.querySelectorAll('#difficultyCards .order-switch')].map(node => node.closest('[data-diff]').dataset.diff).join() === expected.join() && document.querySelectorAll('#difficultyCards [data-order-mode]').length === 8;
    }));
    check('Mozkomor and Mozkokalypsa keep their order and have no switch', await page.evaluate(() => ['mozkomor', 'mozkokalypsa'].every(diff => {
      const card = document.querySelector('#difficultyCards [data-diff="' + diff + '"]');
      return !card.querySelector('.order-controls') && !freeOrder().supports(diff) && freeOrder().record(diff).mode === 'numeric' && freeProgress(diff).nextUnsolved.id === sortedFreeBank(diff)[0].id;
    })));
    check('all source bank bodies match the immutable manifest digest', await page.evaluate(async () => {
      const bytes = new TextEncoder().encode(JSON.stringify(PROPLET_FREE_REFRESH_FIXTURES.puzzles.free));
      const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
      return digest === PROPLET_SHARED_FREE_ORDER_MANIFEST.sourceBanksSha256 && PROPLET_SHARED_FREE_ORDER_MANIFEST.bankContentHash === '7048e9bc26c8e7670bab4aad158bb87f73ff1bbf86e6215a7e262d2c3905635e';
    }));
    await page.screenshot({path: path.join(out, 'shared-order-hub-desktop.png'), fullPage: true});

    for (const diff of ['easy', 'medium', 'hard', 'hardcore']) {
      const preserved = await page.evaluate(async diff => {
        const before = JSON.stringify(getState());
        await changeFreeOrder(diff, 'numeric'); const numeric = freeProgress(diff).nextUnsolved.id;
        await changeFreeOrder(diff, 'varied'); const shared = freeProgress(diff).nextUnsolved.id;
        return {same: before === JSON.stringify(getState()), numeric, shared, numericFirst: sortedFreeBank(diff)[0].id, sharedFirst: PROPLET_SHARED_FREE_ORDER_MANIFEST.routes[diff][0]};
      }, diff);
      check('switching keeps progress and uses the selected route: ' + diff, preserved.same && preserved.numeric === preserved.numericFirst && preserved.shared === preserved.sharedFirst);
    }
    const invalid = await page.evaluate(async () => {
      const before = localStorage.getItem('shared-refresh-preview-choice');
      await freeOrder().change('easy', 'random'); await freeOrder().change('mozkomor', 'varied'); await freeOrder().change('mozkokalypsa', 'varied');
      return before === localStorage.getItem('shared-refresh-preview-choice');
    });
    check('invalid and dormant choices cannot overwrite stored preferences', invalid);

    let catalogueTotal = 0;
    for (const diff of ['easy', 'medium', 'hard', 'hardcore', 'mozkomor', 'mozkokalypsa']) {
      await page.locator('[data-order-catalogue="' + diff + '"]').click();
      const rows = await page.evaluate(diff => {
        const buttons = [...document.querySelectorAll('[data-shared-catalogue="' + diff + '"] [data-shared-board]')];
        const bank = sortedFreeBank(diff);
        return {count: buttons.length, exact: buttons.length === bank.length && buttons.every((button, i) => button.dataset.sharedBoard === bank[i].id && Number(button.textContent) === Number(bank[i].meta.level))};
      }, diff);
      catalogueTotal += rows.count; check('full numeric catalogue preserves original ID and number: ' + diff, rows.exact);
    }
    check('all 1750 active boards are directly available with no reserved slots', catalogueTotal === 1750);
    await page.locator('[data-shared-catalogue="easy"] [data-shared-board="g4-e-001"]').click();
    await page.waitForFunction(() => currentGame?.puzzle?.id === 'g4-e-001');
    const pointer = await page.evaluate(() => currentGame.puzzle.answers[0].path);
    const first = await page.locator('.cell[data-index="' + pointer[0] + '"]').boundingBox();
    await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2); await page.mouse.down();
    for (const index of pointer.slice(1)) {const b = await page.locator('.cell[data-index="' + index + '"]').boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, {steps: 2});}
    await page.mouse.up();
    check('numeric catalogue opens an old board and native pointer input works', await page.evaluate(() => currentGame.found.length === 1));
    await page.evaluate(async () => {saveGameProgress(); nav('free'); await changeFreeOrder('easy', 'numeric'); await changeFreeOrder('easy', 'varied');});
    await page.reload({waitUntil: 'networkidle'}); await ready(page);
    await page.evaluate(async () => startFree('easy'));
    check('route update, switches and reload preserve the original unfinished board and found path', await page.evaluate(() => currentGame.puzzle.id === 'g4-e-001' && currentGame.found.length === 1));
    await closeGame(page);

    for (const diff of ['hardcore', 'mozkomor', 'mozkokalypsa']) {
      await page.locator('[data-play-free="' + diff + '"]').click();
      await page.waitForFunction(diff => currentGame?.puzzle?.difficulty === diff, diff);
      const id = await page.evaluate(() => currentGame.puzzle.id);
      check('native play button selects correct higher-difficulty route: ' + diff, await page.evaluate(({diff, id}) => id === (diff === 'hardcore' ? PROPLET_SHARED_FREE_ORDER_MANIFEST.routes[diff][0] : sortedFreeBank(diff)[0].id), {diff, id}));
      await page.evaluate(() => {for (const answer of currentGame.puzzle.answers) {currentGame.path = [...answer.path]; submitPath();}});
      await page.waitForFunction(id => !!getState().completed['free:' + id] && currentGame.finished, id);
      check('native completion keeps ID, generation and single XP reward: ' + diff, await page.evaluate(({diff, id}) => {
        const result = getState().completed['free:' + id]; return result.puzzleId === id && result.contentGeneration === 4 && result.points === DIFF[diff].xp;
      }, {diff, id}));
      await page.locator('#winPrimaryBtn').click();
      await page.waitForFunction(id => currentGame?.puzzle?.id !== id, id);
      check('native next button skips completed board in correct route: ' + diff, await page.evaluate(diff => currentGame.puzzle.id === (diff === 'hardcore' ? PROPLET_SHARED_FREE_ORDER_MANIFEST.routes[diff][1] : sortedFreeBank(diff)[1].id), diff));
      await closeGame(page);
    }

    for (const width of [320, 390]) {
      await page.setViewportSize({width, height: 800}); await page.evaluate(() => nav('free'));
      check('shared switches and expanded catalogues fit mobile width ' + width, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({path: path.join(out, 'shared-order-hub-' + width + '.png'), fullPage: true});
    }

    const context = await browser.newContext({viewport: {width: 390, height: 800}}), migrated = await context.newPage(); monitor(migrated);
    const old = {easy: {mode: 'numeric', revision: 7, plan: {version: 'pestre-v1', ids: ['g4-e-009', 'g4-e-001']}, pending: {request_id: 'retain-old-request'}}, medium: {mode: 'numeric', revision: 3, plan: null}};
    await migrated.addInitScript(({prefix, old}) => {
      localStorage.setItem(prefix + 'proplet-free-order-v1:guest', JSON.stringify(old));
      localStorage.setItem(prefix + 'shared-refresh-preview-choice', JSON.stringify({easy: 'varied'}));
    }, {prefix: storagePrefix, old});
    await migrated.goto(base + '/', {waitUntil: 'networkidle'}); await ready(migrated);
    check('explicit existing preview choice wins and legacy numeric preference is retained', await migrated.evaluate(() => freeOrder().record('easy').mode === 'varied' && freeOrder().record('medium').mode === 'numeric'));
    check('old personal plan, revision and pending record remain untouched for rollback', await migrated.evaluate(old => localStorage.getItem('proplet-free-order-v1:guest') === JSON.stringify(old), old));
    check('different player histories cannot manufacture different relative shared orders', await migrated.evaluate(() => {
      const before = JSON.stringify(freeOrder().record('easy').plan.ids), state = getState();
      for (const id of [PROPLET_SHARED_FREE_ORDER_MANIFEST.routes.easy[0], PROPLET_SHARED_FREE_ORDER_MANIFEST.routes.easy[2]]) {
        const p = puzzleDB.free.easy.find(p => p.id === id); state.completed['free:' + id] = {puzzleId: id, difficulty: 'easy', mode: 'free', level: p.meta.level, contentGeneration: 4, points: 15};
      }
      saveState(state); return before === JSON.stringify(freeOrder().record('easy').plan.ids) && freeProgress('easy').nextUnsolved.id === PROPLET_SHARED_FREE_ORDER_MANIFEST.routes.easy[1];
    }));
    await context.close();
    check('no external or production API request reaches network', !requests.some(r => !r.url.startsWith(base + '/') || new URL(r.url).pathname.startsWith('/api/')));
    check('no browser, console or HTTP errors', errors.length === 0);
    console.log(JSON.stringify({checks, errors, manifestHash, catalogueTotal}, null, 2));
  } catch (error) {errors.push(String(error)); throw error;}
  finally {fs.writeFileSync(path.join(out, 'shared-order-verification.json'), JSON.stringify({at: new Date().toISOString(), checks, errors, requests, manifestHash}, null, 2)); await browser.close();}
})().catch(error => {console.error(error); process.exit(1);});
