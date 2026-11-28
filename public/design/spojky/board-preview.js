import '../../app/game/board.js';
import '../../app/game/input.js';
import '../../app/game/hints.js';
import { bindTaps, nonPointerClick } from './ink.js';

const inks = ['#7A3B32', '#175944', '#2E507E', '#66500F', '#574A8A', '#7A3E61', '#0F5862', '#6B3F19', '#3E5918', '#1D526A', '#6E3D79', '#303A78'];
const memory = new Map();
const defaultPrompt = 'Spojuj písmena přes společnou stranu. Můžeš táhnout i postupně ťukat.';

function baseKey(puzzle, progressKey) {
  return 'proplet.spojky.dnes.words.v1.' + encodeURIComponent(progressKey) + '/' + encodeURIComponent(puzzle.sampleId || puzzle.id) + '/';
}

function read(key) {
  if (memory.has(key)) return memory.get(key);
  try { return localStorage.getItem(key); } catch { return null; }
}

function write(key, value) {
  try { localStorage.setItem(key, value); memory.delete(key); }
  catch { memory.set(key, value); }
}

function checksum(answer) {
  return answer.word + ':' + answer.path.join(',');
}

function solved(puzzle, key, initialFound) {
  const initial = new Set(initialFound);
  return puzzle.answers.flatMap((answer, index) =>
    initial.has(index) || read(key + 'word/' + index) === checksum(answer) ? [index] : []);
}

export function getWordBoardStatus(puzzle, progressKey, initialFound = []) {
  const key = baseKey(puzzle, progressKey);
  const count = solved(puzzle, key, initialFound).length;
  if (count && count === puzzle.answers.length) return 'done';
  return count || read(key + 'opened') === '1' ? 'started' : 'new';
}

// Found words are independent receipts. Each visit also owns its counters, so two
// tabs can contribute different words, guesses and hints without overwriting them.
function totals(key) {
  const prefix = key + 'visit/';
  const keys = new Set(memory.keys());
  try {
    for (let i = 0; i < localStorage.length; i++) keys.add(localStorage.key(i));
  } catch { /* The in-memory session remains playable. */ }
  let mistakes = 0, hints = 0;
  for (const item of keys) {
    if (!item?.startsWith(prefix)) continue;
    const match = /^(\d+),(\d+)$/.exec(read(item));
    if (!match) continue;
    const wrong = Number(match[1]), used = Number(match[2]);
    if (Number.isSafeInteger(wrong) && Number.isSafeInteger(used)) { mistakes += wrong; hints += used; }
  }
  return { mistakes, hints };
}

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function phraseSlots(puzzle) {
  const phrase = puzzle.tajenka.displayText || puzzle.tajenka.phrase;
  const parts = phrase.match(/[\p{L}\p{N}]+|[^\p{L}\p{N}]+/gu) || [];
  const slots = parts.map(text => ({ text, word: /^[\p{L}\p{N}]/u.test(text), index: -1 }));
  const words = slots.filter(slot => slot.word);
  const norm = text => text.toLocaleUpperCase('cs-CZ');
  puzzle.answers.forEach((answer, index) => {
    const match = words.find(slot => slot.index < 0 && norm(slot.text) === norm(answer.word));
    if (match) match.index = index;
  });
  for (const companion of puzzle.tajenka.companions || []) {
    const parts = (companion.text.match(/[\p{L}\p{N}]+/gu) || []).map(norm);
    const index = puzzle.answers.findIndex(answer => norm(answer.word) === norm(companion.revealWith));
    if (!parts.length || index < 0) continue;
    const start = words.findIndex((_, i) => parts.every((text, j) => words[i + j]?.index === -1 && norm(words[i + j].text) === text));
    if (start >= 0) words.slice(start, start + parts.length).forEach(slot => { slot.index = index; });
  }
  return slots;
}

function countCz(number, one, few, many) {
  return number + ' ' + (number === 1 ? one : number >= 2 && number <= 4 ? few : many);
}

export function mountWordBoard(root, {
  puzzle, progressKey, title, subtitle, onBack, backLabel = 'Dnes', mode = 'free', initialFound = [], resultTitle
}) {
  const key = baseKey(puzzle, progressKey);
  const visit = key + 'visit/' + (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2));
  const tajenka = mode === 'tajenka';
  const slots = tajenka ? phraseSlots(puzzle) : [];
  const game = { puzzle, mode, found: [], used: new Map(), path: [], hints: 0, dragging: false, finished: false };
  const frame = node('section', 'sj-game wb-game');
  const query = selector => frame.querySelector(selector);
  const all = selector => frame.querySelectorAll(selector);
  let stroke = null, hintTimeout, observer, destroyed = false;
  let visitMistakes = 0, visitHints = 0, moves = 0, feedback = '', focusIndex = puzzle.mask[0];
  let hinted = [];

  frame.innerHTML = '<div class="sj-top"><button type="button" class="sj-back" data-action="back"><span class="sj-back-arrow" aria-hidden="true"></span></button></div>' +
    '<section class="sj-sheet wb-sheet"><header class="wb-head"><h1 class="sj-title"></h1><p class="wb-subtitle"></p></header>' +
    '<div class="wb-play"><div class="wb-copy"><p class="wb-count"></p></div>' +
    '<div id="boardStage" class="wb-stage"><div id="boardWrap" class="wb-wrap"><div id="board" class="wb-grid" role="group" aria-label="Mřížka písmen"></div>' +
    '<svg aria-hidden="true" id="pathLayer" class="wb-paths"></svg></div></div>' +
    '<div class="wb-tools"><p class="wb-feedback" role="status" aria-live="polite"></p><button type="button" class="wb-hint-button" data-action="hints">Nápověda</button></div></div>' +
    '<dialog class="wb-hints" aria-labelledby="wb-hints-title"><h2 id="wb-hints-title">Jak moc napovědět?</h2>' +
    '<button type="button" class="sj-clear" data-action="close">Zavřít</button></dialog></section>';
  query('.sj-back').append(document.createTextNode(backLabel));
  query('.sj-title').textContent = title;
  query('.wb-subtitle').textContent = subtitle || '';
  query('.wb-subtitle').hidden = !subtitle;
  frame.style.setProperty('--wb-cols', puzzle.cols);
  frame.style.setProperty('--wb-rows', puzzle.rows);
  root.replaceChildren(frame);
  const grid = query('#board'), dialog = query('dialog'), copy = query('.wb-copy');
  const phrase = node('p', 'wb-phrase');
  const targets = node('p', 'wb-targets'), foundWords = node('p', 'wb-found');
  if (tajenka) { phrase.id = 'tajenkaPhrase'; copy.append(phrase); }
  else copy.append(targets, foundWords);

  const board = window.PropletGameBoard.create({
    getGame: () => game, query, queryAll: all, colors: inks,
    requestAnimationFrameFn: fn => requestAnimationFrame(() => { if (!destroyed && !game.finished) fn(); }),
    onPointerDown: startStroke
  });
  const input = window.PropletGameInput.create({
    getGame: () => game, neighbours: board.neighbours, updateActive: paintSelection, clearHints: clearHint,
    submit, query, colors: inks, getSettings: () => ({ magnifier: false })
  });
  const hints = window.PropletGameHints.create({ getGame: () => game });
  for (const [i, [label, detail]] of hints.choices(mode).entries()) {
    const choice = node('button', 'wb-hint-choice');
    choice.type = 'button';
    choice.dataset.action = 'hint';
    choice.dataset.hintLevel = String(i + 1);
    choice.append(node('strong', '', label), node('small', '', detail));
    dialog.insertBefore(choice, query('[data-action="close"]'));
  }

  function readProgress() {
    const indices = solved(puzzle, key, initialFound);
    game.found = indices.map(index => ({ answerIndex: index, colorIndex: index, word: puzzle.answers[index].word, path: puzzle.answers[index].path }));
    game.used.clear();
    for (const found of game.found) for (const i of found.path) game.used.set(i, found.colorIndex);
    const state = totals(key);
    game.hints = state.hints;
    moves = indices.length + state.mistakes;
    game.finished = indices.length === puzzle.answers.length;
  }

  function showKnown(container) {
    container.replaceChildren(...game.found.map(answer => {
      const chip = node('span', 'wb-word', answer.word.toLocaleLowerCase('cs-CZ'));
      chip.style.setProperty('--word-color', inks[answer.colorIndex % inks.length]);
      return chip;
    }));
    container.setAttribute('aria-label', 'Nalezená slova');
  }

  function renderCopy() {
    const indices = new Set(game.found.map(f => f.answerIndex));
    const remaining = puzzle.answers.filter((_, i) => !indices.has(i));
    query('.wb-count').textContent = 'Nalezeno ' + indices.size + ' z ' + puzzle.answers.length;
    if (tajenka) {
      phrase.replaceChildren(...slots.map(slot => {
        if (!slot.word) return document.createTextNode(slot.text);
        const pending = [...slot.text].length >= 4 && !indices.has(slot.index);
        const part = node('span', 'wb-slot', pending ? '·'.repeat([...slot.text].length) : slot.text);
        if (pending) {
          part.dataset.pending = '';
          part.setAttribute('aria-label', countCz([...slot.text].length, 'písmeno', 'písmena', 'písmen'));
        }
        return part;
      }));
    } else {
      targets.replaceChildren(document.createTextNode('Délky hledaných slov '));
      for (const length of remaining.map(a => a.word.length).sort((a, b) => a - b))
        targets.append(node('span', 'wb-length', String(length)));
      showKnown(foundWords);
      foundWords.hidden = !game.found.length;
    }
    query('.wb-hint-button').textContent = game.hints ? 'Nápověda · ' + game.hints + '×' : 'Nápověda';
  }

  function paintSelection() {
    for (const cell of all('.cell')) {
      const i = Number(cell.dataset.index);
      const selected = game.path.includes(i);
      cell.classList.toggle('active', selected);
      cell.classList.toggle('wb-hinted', hinted.includes(i));
      cell.setAttribute('aria-pressed', String(selected));
    }
    query('.wb-feedback').textContent = game.path.length ? input.currentWord() : feedback || defaultPrompt;
    board.drawPaths();
  }

  function renderBoard() {
    const hadFocus = grid.contains(document.activeElement);
    board.render();
    if (game.used.has(focusIndex)) focusIndex = puzzle.mask.find(i => !game.used.has(i));
    for (const cell of all('.cell')) {
      const i = Number(cell.dataset.index);
      cell.setAttribute('role', 'button');
      cell.setAttribute('aria-label', puzzle.letters[i] + ', řádek ' + (Math.floor(i / puzzle.cols) + 1) + ', sloupec ' + (i % puzzle.cols + 1));
      cell.setAttribute('aria-disabled', String(game.used.has(i)));
      cell.tabIndex = i === focusIndex ? 0 : -1;
    }
    if (hadFocus) grid.querySelector('[tabindex="0"]')?.focus({ preventScroll: true });
    renderCopy();
    paintSelection();
  }

  function renderResult(focus) {
    clearHint();
    if (dialog.open) dialog.close();
    observer?.disconnect();
    const sheet = query('.wb-sheet');
    query('.wb-play')?.remove();
    sheet.classList.add('wb-result');
    query('.sj-title').textContent = resultTitle || (tajenka ? 'Tajenka vyluštěna' : 'Hotovo!');
    if (query('.wb-summary')) return;
    if (tajenka) sheet.append(node('p', 'wb-phrase', puzzle.tajenka.displayText || puzzle.tajenka.phrase));
    const summary = node('p', 'wb-summary');
    sheet.append(summary);
    summary.textContent = countCz(game.found.length, 'slovo', 'slova', 'slov') + ' · ' + countCz(moves, 'tah', 'tahy', 'tahů') +
      ' · ' + (game.hints ? countCz(game.hints, 'nápověda', 'nápovědy', 'nápověd') : 'bez nápovědy');
    const words = node('p', 'wb-found');
    showKnown(words);
    const back = node('button', 'sj-primary', backLabel);
    back.type = 'button';
    back.dataset.action = 'back';
    sheet.append(words, back);
    if (focus) {
      const heading = query('.sj-title');
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }

  function clearHint() {
    clearTimeout(hintTimeout);
    hinted = [];
    game.starterGuidePath = [];
    feedback = '';
  }

  function hint(level) {
    const plan = hints.applyState(level);
    dialog.close();
    if (!plan) return;
    visitHints++;
    write(visit, visitMistakes + ',' + visitHints);
    readProgress();
    clearHint();
    game.path = [];
    const { word, clue } = plan.pick.a;
    if (level === 3) { hinted = plan.path; feedback = word; }
    else if (level === 1 && tajenka && clue) feedback = clue;
    else if (level === 2 && !tajenka) { hinted = plan.path.slice(0, 3); feedback = 'Začni vyznačenými třemi písmeny.'; }
    else { hinted = plan.path.slice(0, 1); feedback = 'Začíná na ' + word[0] + ' a má ' + countCz(word.length, 'písmeno', 'písmena', 'písmen') + '.'; }
    game.starterGuidePath = hinted;
    renderCopy();
    paintSelection();
    if (level === 3) hintTimeout = setTimeout(() => { clearHint(); paintSelection(); }, 3500);
  }

  function answerIndex() {
    const word = input.currentWord();
    return puzzle.answers.findIndex(a => a.word === word && a.path.length === game.path.length && a.path.every((value, j) => value === game.path[j]));
  }

  function submit() {
    const word = input.currentWord(), index = answerIndex();
    clearHint();
    game.path = [];
    if (word.length < 4) { feedback = 'Slova mají aspoň čtyři písmena.'; paintSelection(); return; }
    if (index >= 0) {
      write(key + 'word/' + index, checksum(puzzle.answers[index]));
      feedback = '✓ ' + word;
    } else {
      visitMistakes++;
      write(visit, visitMistakes + ',' + visitHints);
      feedback = puzzle.answers.some(a => a.word === word) ? 'Správné slovo. Zkus jinou cestu.' : '„' + word + '“ do tohohle Propletu nezapadá.';
    }
    readProgress();
    if (game.finished) {
      // Keep the original touch target until touchend and its compatibility click finish.
      requestAnimationFrame(() => { if (!destroyed) renderResult(true); });
    } else renderBoard();
  }

  function tapCell(index) {
    if (game.finished || game.used.has(index)) return;
    clearHint();
    const previous = game.path.at(-1);
    if (previous === index) game.path.pop();
    else if (previous === undefined || !board.neighbours(previous).includes(index)) game.path = [index];
    else input.extendPath(index);
    if (game.path.length && answerIndex() >= 0) submit();
    else paintSelection();
  }

  function startStroke(event) {
    if (stroke || game.finished || event.isPrimary === false || event.button !== 0) return;
    const previous = [...game.path];
    if (!input.pointerDown(event)) return;
    const index = Number(event.currentTarget.dataset.index);
    focusIndex = index;
    stroke = { id: event.pointerId, index, x: event.clientX, y: event.clientY, previous, moved: false };
  }

  function moveStroke(event) {
    if (!stroke || event.pointerId !== stroke.id) return;
    if (!stroke.moved && Math.hypot(event.clientX - stroke.x, event.clientY - stroke.y) < 7) return;
    stroke.moved = true;
    input.pointerMove(event);
    input.samplePointer(event.clientX, event.clientY);
  }

  function cancelStroke() {
    stroke = null;
    game.dragging = false;
    game.lastPointer = null;
    game.path = [];
    if (!game.finished) paintSelection();
  }

  grid.addEventListener('pointermove', moveStroke);
  grid.addEventListener('pointerup', event => {
    if (!stroke || event.pointerId !== stroke.id) return;
    moveStroke(event);
    const { index, moved, previous } = stroke;
    stroke = null;
    if (moved) input.pointerUp(event);
    else {
      game.dragging = false;
      game.lastPointer = null;
      game.path = previous;
      tapCell(index);
    }
  });
  grid.addEventListener('pointercancel', event => { if (stroke?.id === event.pointerId) cancelStroke(); });
  frame.addEventListener('pointerdown', event => {
    if (game.path.length && !event.target.closest('.cell,button,dialog') && !stroke) cancelStroke();
  });
  grid.addEventListener('click', event => {
    const cell = event.target.closest('.cell');
    if (cell && nonPointerClick(event)) tapCell(Number(cell.dataset.index));
  });
  grid.addEventListener('keydown', event => {
    const cell = event.target.closest('.cell');
    if (!cell || event.ctrlKey || event.altKey || event.metaKey) return;
    const i = Number(cell.dataset.index);
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!event.repeat) tapCell(i);
    } else if (event.key === 'Escape' || event.key === 'Backspace') {
      event.preventDefault();
      if (event.key === 'Backspace') game.path.pop();
      else game.path = [];
      paintSelection();
    } else {
      const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -puzzle.cols, ArrowDown: puzzle.cols }[event.key];
      if (delta === undefined) return;
      event.preventDefault();
      const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
      for (let j = i + delta; j >= 0 && j < puzzle.cols * puzzle.rows; j += delta) {
        if (horizontal && Math.floor(i / puzzle.cols) !== Math.floor(j / puzzle.cols)) break;
        const next = grid.querySelector('[data-index="' + j + '"]');
        if (!next || game.used.has(j)) continue;
        grid.querySelector('[tabindex="0"]')?.setAttribute('tabindex', '-1');
        next.tabIndex = 0;
        focusIndex = j;
        next.focus({ preventScroll: true });
        break;
      }
    }
  });
  bindTaps(frame, 'button[data-action]', button => {
    if (destroyed) return;
    if (button.dataset.action === 'back') onBack();
    else if (button.dataset.action === 'hints' && !dialog.open) dialog.showModal();
    else if (button.dataset.action === 'close') dialog.close();
    else if (button.dataset.action === 'hint') hint(Number(button.dataset.hintLevel));
  });

  function changed(event) {
    if ((event.key && !event.key.startsWith(key)) || destroyed || game.finished) return;
    readProgress();
    if (game.finished) { renderResult(true); return; }
    if (stroke || game.path.some(i => game.used.has(i))) cancelStroke();
    renderBoard();
  }

  function fit() { if (!game.finished) board.fit(); }
  write(key + 'opened', '1');
  readProgress();
  if (game.finished) renderResult(false);
  else {
    renderBoard();
    if (globalThis.ResizeObserver) {
      observer = new ResizeObserver(fit);
      observer.observe(query('#boardStage'));
    } else window.addEventListener('resize', fit);
  }
  window.addEventListener('storage', changed);
  return { destroy() {
    destroyed = true;
    clearTimeout(hintTimeout);
    if (dialog.open) dialog.close();
    observer?.disconnect();
    window.removeEventListener('resize', fit);
    window.removeEventListener('storage', changed);
    frame.remove();
  } };
}
