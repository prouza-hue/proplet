import { gridFor, paintCells } from './ink.js';

const storagePrefix = 'proplet.spojky.crossings.v1.';
const introKey = `${storagePrefix}example`;
const sessionCopy = new Map();
const unwritten = new Set();

function read(key) {
  if (unwritten.has(key)) return sessionCopy.get(key) ?? null;
  try { return localStorage.getItem(key); }
  catch { return sessionCopy.get(key) ?? null; }
}

function write(key, value) {
  if (value === null) sessionCopy.delete(key);
  else sessionCopy.set(key, value);
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    unwritten.delete(key);
  } catch { unwritten.add(key); }
}

const boardKey = board => `${storagePrefix}${board.id}`;
const answerKey = (board, index) => `${boardKey(board)}.answer.${index}`;
const signature = board => [board.rows.join('/'), ...board.chain, ...board.answers.map(answer => answer.word)].join('|');
const blankState = board => ({ signature: signature(board), started: false, found: board.answers.map(() => null), pair: [], path: [], hints: board.answers.map(() => 0), hintTarget: -1 });
const lettersOf = board => Array.from(board.rows.join(''));
const spells = (path, letters) => path.map(i => letters[i]).join('');
const progressOf = state => {
  const found = state.found.filter(Boolean).length;
  return { status: found === state.found.length ? 'complete' : state.started ? 'started' : 'new', found };
};
const neighbors = (a, b, cols) => Math.abs(a % cols - b % cols) + Math.abs(Math.floor(a / cols) - Math.floor(b / cols)) === 1;

function readJson(key) {
  try { return JSON.parse(read(key)); } catch { return null; }
}

function loadState(board) {
  const state = blankState(board);
  const letters = lettersOf(board);
  const validPath = path => Array.isArray(path) && path.length <= letters.length && new Set(path).size === path.length && path.every((n, i) =>
    Number.isInteger(n) && n >= 0 && n < letters.length && (i === 0 || neighbors(n, path[i - 1], board.rows[0].length)));
  // Each find has its own receipt. Two tabs can finish different words without overwriting either path.
  board.answers.forEach((answer, i) => {
    const receipt = readJson(answerKey(board, i));
    if (receipt?.signature === state.signature && validPath(receipt.path) && spells(receipt.path, letters) === answer.word) state.found[i] = receipt.path;
  });
  state.started = state.found.some(Boolean);
  const stored = readJson(boardKey(board));
  if (stored?.signature !== state.signature) return state;
  state.started ||= stored.started === true;
  state.hints.forEach((_, i) => {
    const level = stored.hints?.[i];
    if (Number.isInteger(level) && level >= 0 && level <= 3) state.hints[i] = level;
  });
  if (Array.isArray(stored.pair)) state.pair = [...new Set(stored.pair.filter(n => Number.isInteger(n) && n >= 0 && n < board.chain.length))].slice(0, 2);
  if (validPath(stored.path)) state.path = stored.path;
  if (Number.isInteger(stored.hintTarget) && state.hints[stored.hintTarget] > 0 && !state.found[stored.hintTarget]) state.hintTarget = stored.hintTarget;
  return state;
}

export function getProgress(board) { return progressOf(loadState(board)); }
export function resetProgress(board) {
  board.answers.forEach((_, i) => write(answerKey(board, i), null));
  write(boardKey(board), null);
}

function el(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
}

function button(className, text, action) {
  const element = el('button', className, text);
  element.type = 'button';
  if (action) element.addEventListener('click', action);
  return element;
}

// Touch can produce a compatibility click with detail === 0 as well as a pointerup.
const nonPointerClick = event => event.detail === 0 && !event.pointerType && !event.sourceCapabilities?.firesTouchEvents;

function bindTaps(container, selector, activate) {
  let touch = null;
  const handledAt = new WeakMap();
  container.addEventListener('pointerdown', event => {
    const control = event.target.closest(selector);
    if (!control || !event.isPrimary) return;
    handledAt.delete(control);
    touch = event.pointerType === 'touch' && event.button === 0 ? { control, id: event.pointerId, x: event.clientX, y: event.clientY } : null;
  });
  container.addEventListener('pointercancel', event => { if (touch?.id === event.pointerId) touch = null; });
  container.addEventListener('pointerup', event => {
    if (touch?.id !== event.pointerId) return;
    const { control, x, y } = touch;
    touch = null;
    if (Math.hypot(event.clientX - x, event.clientY - y) > 12 || document.elementFromPoint(event.clientX, event.clientY)?.closest(selector) !== control) return;
    // Chromium can suppress the first compatibility click after a drag on the grid.
    handledAt.set(control, event.timeStamp);
    activate(control);
  });
  container.addEventListener('click', event => {
    const control = event.target.closest(selector);
    if (!control) return;
    // Summary has its own default activation. Toggle it exactly once for touch, mouse and keyboard.
    event.preventDefault();
    if (!nonPointerClick(event) && event.timeStamp - (handledAt.get(control) ?? -Infinity) < 800) return;
    activate(control);
  });
}

function topRow(onBack, onRules) {
  const row = el('div', 'sj-top');
  const back = button('sj-back', 'Dnes', onBack);
  back.prepend(el('span', 'sj-back-arrow'));
  row.append(back);
  if (onRules) row.append(button('sj-rules-button', 'Pravidla', onRules));
  return row;
}

function heading(text, week) {
  const header = el('header', 'sj-heading');
  const title = el('h1', 'sj-title', text);
  title.tabIndex = -1;
  header.append(title);
  if (week) header.append(el('span', 'sj-week', `${week}. týden`));
  return header;
}

function rulesDialog(frame) {
  const dialog = el('dialog', 'sj-dialog');
  dialog.setAttribute('aria-label', 'Jak hrát Spojky');
  const rules = el('div', 'sj-dialog-copy');
  rules.append(el('h2', '', 'Jak hrát Spojky'),
    el('p', '', 'Pila a hřeben mají zuby. Podobně patří každá spojka ke dvěma kartičkám.'),
    el('p', '', 'Vyber dvojici kartiček a najdi jejich společné slovo. Nebo začni slovem a kartičky přiřaď potom.'),
    el('p', '', 'Spojuj písmena tahem nebo postupným klepáním. Sousední políčka musí mít společnou stranu. V jednom slově smíš každé políčko použít jen jednou.'),
    el('p', '', 'Každá nalezená spojka má pod písmeny vlastní značku. Přes označené písmeno můžeš vést další slovo. Pak pod ním uvidíš obě značky.'),
    el('p', '', 'Klepnutím na poslední písmeno ho odebereš. Klepnutím do prázdna zrušíš celý tah.'),
    el('p', '', 'Tři spojky můžeš najít v libovolném pořadí. Některá písmena zůstanou volná.'),
    button('sj-primary', 'Zpátky ke hře', () => dialog.close()));
  dialog.append(rules);
  dialog.addEventListener('click', event => {
    if (event.target === dialog) {
      const { left, right, top, bottom } = dialog.getBoundingClientRect();
      if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) dialog.close();
    }
  });
  frame.append(dialog);
  return dialog;
}

function partialChain(board, found) {
  const fragment = document.createDocumentFragment();
  let group;
  found.forEach((path, i) => {
    if (!path) { group = null; return; }
    if (!group) {
      group = el('p', 'sj-fragment');
      group.append(el('span', 'sj-fragment-card', board.chain[i]));
      fragment.append(group);
    }
    const link = el('span', 'sj-fragment-link', board.answers[i].word.toLocaleLowerCase('cs'));
    link.dataset.ink = String(i);
    group.append(link, el('span', 'sj-fragment-card', board.chain[i + 1]));
  });
  return fragment;
}

function showResult(frame, { board, week, onBack, nextLabel }, found, review) {
  const sheet = el('section', 'sj-sheet sj-result');
  const header = heading(review ? 'Řešení Spojek' : 'Řetěz je celý!', week);
  const list = el('ol', 'sj-sequence');
  list.setAttribute('aria-label', 'Celý řetěz');
  board.chain.forEach((noun, i) => {
    const item = el('li', 'sj-station');
    item.append(el('strong', 'sj-station-card', noun));
    const answer = board.answers[i];
    if (answer) {
      const link = el('div', 'sj-link');
      link.dataset.ink = String(i);
      link.append(el('b', 'sj-link-word', answer.word.toLocaleLowerCase('cs')), el('p', 'sj-link-meaning', answer.explanation || answer.clue));
      item.append(link);
    }
    list.append(item);
  });
  const details = el('details', 'sj-grid-details');
  details.append(el('summary', '', 'Ukázat slova v mřížce'));
  const { tray, cells } = gridFor(board, false);
  const picker = el('div', 'sj-trace-picker');
  picker.setAttribute('role', 'group');
  picker.setAttribute('aria-label', 'Zvýraznit cestu');
  const choices = ['Všechny', ...board.answers.map(answer => answer.word.toLocaleLowerCase('cs'))].map((label, i) => {
    const owner = i - 1;
    const choice = button('sj-trace-choice', label);
    if (owner >= 0) choice.dataset.ink = String(owner);
    picker.append(choice);
    return choice;
  });
  function highlight(owner) {
    choices.forEach((choice, i) => choice.setAttribute('aria-pressed', String(i - 1 === owner)));
    paintCells(cells, found, [], -1, false, owner);
  }
  highlight(-1);
  details.append(picker, tray);
  bindTaps(details, 'summary, .sj-trace-choice', control => {
    if (control.tagName === 'SUMMARY') details.open = !details.open;
    else highlight(Number(control.dataset.ink ?? -1));
  });
  const spread = el('div', 'sj-result-spread');
  spread.append(list, details);
  sheet.append(header, spread);
  if (!review && nextLabel) sheet.append(el('p', 'sj-next-week', nextLabel));
  const navigation = topRow();
  bindTaps(navigation, '.sj-back', onBack);
  frame.replaceChildren(navigation, sheet);
  header.querySelector('h1').focus({ preventScroll: true });
}

export function reviewSolution(root, options) {
  const frame = el('section', 'sj-game');
  root.replaceChildren(frame);
  const { board } = options;
  const paths = board.answers.map(answer => answer.path);
  showResult(frame, options, paths, true);
  return { destroy() { frame.remove(); } };
}

export function mountGame(root, options) {
  const { board, week, onBack, onProgress, hintImage } = options;
  const frame = el('section', 'sj-game');
  root.replaceChildren(frame);
  let state = loadState(board);
  let lastProgress = progressOf(state);
  const letters = lettersOf(board);
  const cols = board.rows[0].length;
  const draftKey = boardKey(board);
  const answerKeys = board.answers.map((_, i) => answerKey(board, i));
  let finishing = false;
  let activePointer = null;
  let notice = '';
  let dialog;
  let cards, cells, grid, counter, word, status, hints, clear, fragments;

  function save() {
    const { found, ...draft } = state;
    write(draftKey, JSON.stringify(draft));
    const progress = progressOf(state);
    if (progress.status !== lastProgress.status || progress.found !== lastProgress.found) {
      lastProgress = progress;
      onProgress?.(progress);
    }
  }

  const selectedWord = () => spells(state.path, letters);
  const matchingWord = () => {
    const typed = selectedWord();
    return board.answers.findIndex(answer => answer.word === typed);
  };
  const targetWord = () => {
    const index = matchingWord();
    return state.found[index] ? -1 : index;
  };
  const targetPair = () => state.pair.length === 2 && Math.abs(state.pair[0] - state.pair[1]) === 1 ? Math.min(...state.pair) : -1;
  const duplicateMessage = 'Tuhle spojku už máš. Její písmena můžeš použít znovu.';

  function hintText(index) {
    const answer = board.answers[index];
    if (state.hints[index] >= 3) return `V mřížce hledej slovo ${answer.word}.`;
    const extra = state.hints[index] === 2 ? ` Začni na ${answer.word[0]}.` : '';
    return answer.clue + extra;
  }

  function paint() {
    const count = state.found.filter(Boolean).length;
    const activeHint = state.hintTarget;
    const target = targetWord();
    const typed = selectedWord();
    const tip = activeHint >= 0 && state.hints[activeHint] >= 2 ? board.answers[activeHint].path[0] : -1;
    cards.forEach(card => card.setAttribute('aria-pressed', String(state.pair.includes(Number(card.dataset.card)))));
    paintCells(cells, state.found, state.path, tip, true);
    counter.textContent = `${count} ze ${board.answers.length}`;
    word.textContent = typed;
    word.hidden = !typed;
    if (notice) status.textContent = notice;
    else if (target >= 0 && activePointer?.moved && state.pair.length === 2) status.textContent = 'Puštěním ukončíš tah.';
    else if (target >= 0) status.textContent = state.pair.length === 1 ? 'Přidej druhou kartičku.' : 'Ke kterým dvěma kartičkám patří?';
    else if (state.found[matchingWord()]) status.textContent = duplicateMessage;
    else if (activeHint >= 0) status.textContent = hintText(activeHint);
    else if (typed) status.textContent = typed.length === 1 ? 'Pokračuj sousedním písmenem.' : '';
    else if (state.pair.length === 2) status.textContent = 'Najdi v mřížce slovo, které k oběma sedí.';
    else if (state.pair.length === 1) status.textContent = 'Přidej druhou kartičku.';
    else status.textContent = count ? 'Další spojka může vést i přes označená písmena.' : 'Začni dvojicí kartiček nebo slovem. Spojky se můžou křížit.';
    clear.hidden = !state.pair.length && !state.path.length;
    clear.textContent = state.path.length ? 'Zrušit tah' : 'Zrušit výběr';
    const hintLabel = hints.querySelector('span');
    hintLabel.textContent = activeHint >= 0 && state.hints[activeHint] < 3 ? 'Další nápověda' : 'Nápověda';
    fragments.replaceChildren(partialChain(board, state.found));
    fragments.hidden = count === 0;
  }

  function stopPointer() {
    const pointerId = activePointer?.id;
    activePointer = null;
    if (pointerId != null && grid?.hasPointerCapture(pointerId)) grid.releasePointerCapture(pointerId);
  }

  function update() {
    const target = targetWord();
    // Keep the touched grid mounted until release, even when this stroke completes the board.
    if (target >= 0 && state.pair.length === 2 && !activePointer?.moved) {
      if (target === targetPair()) {
        state.found[target] = [...state.path];
        write(answerKeys[target], JSON.stringify({ signature: state.signature, path: state.found[target] }));
        state.path = [];
        state.pair = [];
        state.hintTarget = -1;
        stopPointer();
        notice = board.answers[target].explanation || board.answers[target].clue;
        if (state.found.every(Boolean)) {
          finishing = true;
          save();
          // Chrome dispatches touchend after pointerup. Keep their original target for both.
          requestAnimationFrame(() => {
            if (finishing && frame.isConnected) showResult(frame, options, state.found, false);
          });
          return;
        }
      } else {
        state.pair = [];
        state.hintTarget = -1;
        notice = 'Slovo máš. Patří ale k jiné dvojici kartiček.';
      }
    }
    save();
    paint();
  }

  function chooseCard(n) {
    notice = '';
    state.hintTarget = -1;
    if (state.pair.includes(n)) state.pair = state.pair.filter(i => i !== n);
    else state.pair = state.pair.length === 2 ? [n] : [...state.pair, n];
    if (state.found[targetPair()]) {
      state.pair = [];
      notice = 'Tuhle dvojici už máš spojenou. Vyber jiné kartičky.';
    }
    update();
  }

  function tapCell(i) {
    const step = state.path.indexOf(i);
    const end = state.path.at(-1);
    notice = '';
    if (i === end) state.path.pop();
    else if (step >= 0) state.path.length = step + 1;
    else if (end != null && neighbors(end, i, cols) && targetWord() < 0) state.path.push(i);
    else state.path = [i];
    update();
  }

  function extendDrag(i) {
    const end = state.path.at(-1);
    if (i === end) return;
    if (i === state.path.at(-2)) state.path.pop();
    else if (neighbors(end, i, cols) && !state.path.includes(i) && targetWord() < 0) state.path.push(i);
    else return;
    notice = '';
    update();
  }

  function clearPath() {
    if (!state.path.length) return;
    state.path = [];
    state.hintTarget = -1;
    notice = '';
    update();
  }

  function clickOutside(event) {
    if (!grid?.isConnected || !state.path.length || event.button !== 0) return;
    if (grid.contains(event.target) || event.target.closest?.('button, a, input, select, textarea, summary, dialog, [role="button"]')) return;
    clearPath();
  }

  function askHint() {
    const ready = targetWord();
    const pair = targetPair();
    const target = ready >= 0 ? ready : pair >= 0 && !state.found[pair] ? pair : state.found.findIndex(path => !path);
    if (target < 0) return;
    notice = '';
    const hintPath = board.answers[target].path;
    if (ready < 0 && !state.path.every((i, step) => i === hintPath[step])) state.path = [];
    state.pair = [target, target + 1];
    state.hints[target] = Math.min(3, state.hints[target] + 1);
    state.hintTarget = target;
    update();
  }

  function hitAt(x, y) {
    const hit = document.elementFromPoint(x, y)?.closest('[data-cell]');
    return hit && grid.contains(hit) ? Number(hit.dataset.cell) : -1;
  }

  function traceTo(x, y) {
    if (!activePointer) return;
    if (!activePointer.moved) {
      if (Math.hypot(x - activePointer.x, y - activePointer.y) < 8) return;
      // A continuous stroke starts at this press, even beside an older tapped word.
      activePointer.moved = true;
      state.path = [activePointer.start];
      notice = '';
      update();
    }
    const { x: fromX, y: fromY } = activePointer;
    const steps = Math.max(1, Math.ceil(Math.hypot(x - fromX, y - fromY) / 10));
    for (let s = 1; s <= steps && activePointer; s++) {
      const index = hitAt(fromX + (x - fromX) * s / steps, fromY + (y - fromY) * s / steps);
      if (index >= 0 && index !== activePointer.last) {
        activePointer.last = index;
        extendDrag(index);
      }
    }
    if (activePointer) { activePointer.x = x; activePointer.y = y; }
  }

  function bindGrid() {
    grid.addEventListener('pointerdown', event => {
      const cell = event.target.closest('[data-cell]');
      if (activePointer || event.isPrimary === false || event.button !== 0) return;
      if (!cell) { clearPath(); return; }
      if (cell.disabled) return;
      const i = Number(cell.dataset.cell);
      event.preventDefault();
      activePointer = { id: event.pointerId, x: event.clientX, y: event.clientY, start: i, last: i, moved: false };
      grid.setPointerCapture(event.pointerId);
      if (!state.path.length) paintCells(cells, state.found, [i], -1, true);
    });
    grid.addEventListener('pointermove', event => {
      if (activePointer?.id === event.pointerId) traceTo(event.clientX, event.clientY);
    });
    grid.addEventListener('pointerup', event => {
      if (activePointer?.id !== event.pointerId) return;
      traceTo(event.clientX, event.clientY);
      if (!activePointer) return;
      const { moved, start } = activePointer;
      stopPointer();
      if (!moved) tapCell(start);
      else if (targetWord() >= 0) update();
      else {
        notice = state.found[matchingWord()] ? duplicateMessage : 'Zkus jinou cestu.';
        state.path = [];
        update();
      }
    });
    for (const name of ['pointercancel', 'lostpointercapture']) grid.addEventListener(name, event => {
      if (activePointer?.id !== event.pointerId) return;
      const { moved } = activePointer;
      activePointer = null;
      if (moved) clearPath();
      else paint();
    });
    grid.addEventListener('click', event => {
      // Keyboard and assistive clicks have no pointer gesture to handle them.
      const cell = event.target.closest('[data-cell]');
      if (nonPointerClick(event) && cell && !cell.disabled) tapCell(Number(cell.dataset.cell));
    });
    grid.addEventListener('keydown', event => {
      const delta = { ArrowUp: -cols, ArrowDown: cols, ArrowLeft: -1, ArrowRight: 1 }[event.key];
      if (!delta) return;
      event.preventDefault();
      const i = Number(event.target.dataset.cell);
      const next = i + delta;
      if (cells[next] && !cells[next].disabled && neighbors(i, next, cols)) cells[next].focus();
    });
  }

  function showGame() {
    finishing = false;
    dialog?.close();
    frame.replaceChildren();
    state.started = true;
    save();
    const sheet = el('section', 'sj-sheet sj-playing');
    if (board.chain.some(noun => noun.length > 7)) sheet.classList.add('sj-long-cards');
    const header = heading('Spojky', week);
    counter = el('span', 'sj-count');
    counter.setAttribute('aria-label', 'Nalezené spojky');
    header.append(counter);
    const content = el('div', 'sj-play-layout');
    const nouns = el('div', 'sj-nouns');
    nouns.setAttribute('role', 'group');
    nouns.setAttribute('aria-label', 'Kartičky k propojení');
    cards = board.shuffle.map(i => {
      const card = button('sj-noun', board.chain[i]);
      card.dataset.card = String(i);
      nouns.append(card);
      return card;
    });
    bindTaps(nouns, '[data-card]', card => chooseCard(Number(card.dataset.card)));
    const field = gridFor(board, true);
    ({ grid, cells } = field);
    const moves = el('div', 'sj-moves');
    const feedback = el('div', 'sj-feedback');
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-atomic', 'true');
    word = el('b', 'sj-word');
    status = el('span', 'sj-status');
    feedback.append(word, status);
    const buttons = el('div', 'sj-actions');
    hints = button('sj-hint', null, askHint);
    if (hintImage) {
      const art = el('img', 'sj-hint-art');
      art.alt = '';
      art.addEventListener('error', () => art.remove(), { once: true });
      art.src = hintImage;
      hints.append(art);
    }
    hints.append(el('span', '', 'Nápověda'));
    clear = button('sj-clear', '', () => {
      if (state.path.length) state.path = [];
      else state.pair = [];
      state.hintTarget = -1;
      notice = '';
      update();
    });
    buttons.append(hints, clear);
    moves.append(feedback, buttons);
    fragments = el('div', 'sj-fragments');
    fragments.setAttribute('role', 'region');
    fragments.setAttribute('aria-label', 'Nalezené spojky');
    content.append(nouns, field.tray, moves, fragments);
    sheet.append(header, content);
    frame.append(topRow(onBack, () => dialog.showModal()), sheet);
    dialog = rulesDialog(frame);
    bindGrid();
    paint();
    header.querySelector('h1').focus({ preventScroll: true });
  }

  function showIntro() {
    const sheet = el('section', 'sj-sheet sj-intro');
    const header = heading('Spojky', week);
    const example = el('div', 'sj-example');
    example.append(el('h2', 'sj-question', 'Co mají společného pila a hřeben?'));
    const blocks = el('div', 'sj-example-tiles');
    blocks.setAttribute('aria-label', 'Zuby.');
    blocks.setAttribute('role', 'img');
    Array.from('ZUBY').forEach(letter => blocks.append(el('span', '', letter)));
    example.append(blocks);
    const explanation = el('p', 'sj-intro-copy', 'Najdi tři slova, která takhle propojí čtyři kartičky. Jejich cesty se kříží. Písmeno z jedné spojky můžeš použít i v další.');
    sheet.append(header, example, explanation, button('sj-primary', 'Jdu hrát', () => { write(introKey, '1'); showGame(); }));
    frame.replaceChildren(topRow(onBack), sheet);
    header.querySelector('h1').focus({ preventScroll: true });
  }

  function display() {
    if (state.found.every(Boolean)) { finishing = true; showResult(frame, options, state.found, false); }
    else if (state.started || read(introKey)) showGame();
    else showIntro();
  }

  function storageChange(event) {
    if (event.key !== null && event.key !== draftKey && !answerKeys.includes(event.key)) return;
    const latest = loadState(board);
    if (!latest.started && event.newValue === null) { stopPointer(); onBack(); return; }
    if (finishing && latest.found.every(Boolean)) return;
    // Finish the local stroke even when the other tab is busy selecting letters.
    if (activePointer && !latest.found.every(Boolean)) state.found = latest.found;
    else { stopPointer(); state = latest; }
    lastProgress = progressOf(state);
    onProgress?.(lastProgress);
    notice = '';
    if (!state.started || finishing || state.found.every(Boolean) || !grid?.isConnected) display();
    else paint();
  }

  display();
  window.addEventListener('storage', storageChange);
  document.addEventListener('click', clickOutside);
  return { destroy() {
    stopPointer();
    dialog?.close();
    window.removeEventListener('storage', storageChange);
    document.removeEventListener('click', clickOutside);
    frame.remove();
  } };
}
