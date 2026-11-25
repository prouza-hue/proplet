const storagePrefix = 'proplet.spojky.pilot.v1.';
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
const signature = board => [board.rows.join('/'), ...board.answers.map(answer => answer.word)].join('|');
const blankState = board => ({ signature: signature(board), started: false, found: board.answers.map(() => null), pair: [], path: [], hints: board.answers.map(() => 0), hintTarget: -1 });
const lettersOf = board => Array.from(board.rows.join(''));
const spells = (path, letters) => path.map(i => letters[i]).join('');
const progressOf = state => {
  const found = state.found.filter(Boolean).length;
  return { status: found === state.found.length ? 'complete' : state.started ? 'started' : 'new', found };
};
const neighbors = (a, b, cols) => Math.abs(a % cols - b % cols) + Math.abs(Math.floor(a / cols) - Math.floor(b / cols)) === 1;

function loadState(board) {
  const state = blankState(board);
  let stored;
  try { stored = JSON.parse(read(boardKey(board))); } catch { return state; }
  if (stored?.signature !== state.signature) return state;
  const letters = lettersOf(board);
  const occupied = new Set();
  const validPath = path => Array.isArray(path) && path.length <= letters.length && new Set(path).size === path.length && path.every((n, i) =>
    Number.isInteger(n) && n >= 0 && n < letters.length && !occupied.has(n) && (i === 0 || neighbors(n, path[i - 1], board.rows[0].length)));
  board.answers.forEach((answer, i) => {
    const path = stored.found?.[i];
    if (validPath(path) && spells(path, letters) === answer.word) {
      state.found[i] = path;
      path.forEach(n => occupied.add(n));
    }
    const level = stored.hints?.[i];
    if (Number.isInteger(level) && level >= 0 && level <= 3) state.hints[i] = level;
  });
  state.started = stored.started === true || state.found.some(Boolean);
  if (Array.isArray(stored.pair)) state.pair = [...new Set(stored.pair.filter(n => Number.isInteger(n) && n >= 0 && n < board.chain.length))].slice(0, 2);
  if (validPath(stored.path)) state.path = stored.path;
  if (state.hints[stored.hintTarget] && !state.found[stored.hintTarget]) state.hintTarget = Number(stored.hintTarget);
  return state;
}

export function getProgress(board) { return progressOf(loadState(board)); }
export function resetProgress(board) { write(boardKey(board), null); }

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

function bindCards(container, onPick) {
  let touch = null;
  const handledAt = new WeakMap();
  container.addEventListener('pointerdown', event => {
    const card = event.target.closest('[data-card]');
    if (!card || !event.isPrimary) return;
    handledAt.delete(card);
    touch = event.pointerType === 'touch' && event.button === 0 ? { card, id: event.pointerId, x: event.clientX, y: event.clientY } : null;
  });
  container.addEventListener('pointercancel', event => { if (touch?.id === event.pointerId) touch = null; });
  container.addEventListener('pointerup', event => {
    if (touch?.id !== event.pointerId) return;
    const { card, x, y } = touch;
    touch = null;
    if (Math.hypot(event.clientX - x, event.clientY - y) > 12 || document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-card]') !== card) return;
    // Chromium can suppress the first compatibility click after a drag on the grid.
    handledAt.set(card, event.timeStamp);
    onPick(Number(card.dataset.card));
  });
  container.addEventListener('click', event => {
    const card = event.target.closest('[data-card]');
    if (!card) return;
    if (event.detail > 0 && event.timeStamp - (handledAt.get(card) ?? -Infinity) < 800) return;
    onPick(Number(card.dataset.card));
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
    el('p', '', 'Písmena spoj tahem nebo na ně postupně klepej. Pokračuj nahoru, dolů nebo do stran. Každé políčko smíš ve slově použít jednou.'),
    el('p', '', 'Tři spojky můžeš najít v libovolném pořadí. Dohromady vytvoří jeden řetěz.'),
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

function trailFor(board, answer, occupied) {
  if (answer.path?.every(i => !occupied.has(i))) return answer.path;
  const letters = lettersOf(board);
  const cols = board.rows[0].length;
  const path = [];
  function visit(i) {
    if (occupied.has(i) || path.includes(i) || letters[i] !== answer.word[path.length]) return false;
    path.push(i);
    if (path.length === answer.word.length) return true;
    for (let j = 0; j < letters.length; j++) if (neighbors(i, j, cols) && visit(j)) return true;
    path.pop();
    return false;
  }
  for (let i = 0; i < letters.length; i++) if (visit(i)) return path;
  return [];
}

function gridFor(board, interactive) {
  const tray = el('div', 'sj-tray');
  tray.style.setProperty('--sj-cols', board.rows[0].length);
  const grid = el('div', 'sj-grid');
  grid.setAttribute('role', interactive ? 'group' : 'img');
  grid.setAttribute('aria-label', interactive ? 'Mřížka písmen. Spojuj sousední políčka přes společnou stranu.' : 'Mřížka se třemi vyznačenými spojkami.');
  lettersOf(board).forEach((letter, i) => {
    const cell = interactive ? button('sj-cell', letter) : el('span', 'sj-cell', letter);
    cell.dataset.cell = String(i);
    if (interactive) cell.setAttribute('aria-label', `${letter}, řádek ${Math.floor(i / board.rows[0].length) + 1}, sloupec ${i % board.rows[0].length + 1}`);
    grid.append(cell);
  });
  tray.append(grid);
  return { tray, grid, cells: Array.from(grid.children) };
}

function paintCells(cells, found, path, tip, interactive) {
  cells.forEach((cell, i) => {
    const owner = found.findIndex(trail => trail?.includes(i));
    const trail = owner >= 0 ? found[owner] : path;
    const step = trail.indexOf(i);
    const chosen = owner < 0 && step >= 0;
    if (owner >= 0) cell.dataset.ink = String(owner);
    else delete cell.dataset.ink;
    cell.classList.toggle('sj-current', chosen);
    cell.classList.toggle('sj-end', chosen && step === trail.length - 1);
    cell.classList.toggle('sj-tip', i === tip && owner < 0);
    if (step >= 0 && step + 1 < trail.length) {
      const diff = trail[step + 1] - i;
      cell.dataset.to = diff === 1 ? 'r' : diff === -1 ? 'l' : diff > 0 ? 'd' : 'u';
    } else delete cell.dataset.to;
    if (interactive) {
      cell.disabled = owner >= 0;
      cell.setAttribute('aria-pressed', String(chosen));
      if (i === tip) cell.setAttribute('aria-description', 'Tady slovo začíná.');
      else cell.removeAttribute('aria-description');
    }
  });
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
  paintCells(cells, found, [], -1, false);
  details.append(tray);
  const spread = el('div', 'sj-result-spread');
  spread.append(list, details);
  sheet.append(header, spread);
  if (!review && nextLabel) sheet.append(el('p', 'sj-next-week', nextLabel));
  frame.replaceChildren(topRow(onBack), sheet);
  header.querySelector('h1').focus({ preventScroll: true });
}

export function reviewSolution(root, options) {
  const frame = el('section', 'sj-game');
  root.replaceChildren(frame);
  const { board } = options;
  const occupied = new Set();
  const paths = board.answers.map(answer => {
    const path = trailFor(board, answer, occupied);
    path.forEach(i => occupied.add(i));
    return path;
  });
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
  let finishing = false;
  let activePointer = null;
  let notice = '';
  let dialog;
  let cards, cells, grid, counter, word, status, hints, clear, fragments;

  function save() {
    write(boardKey(board), JSON.stringify(state));
    const progress = progressOf(state);
    if (progress.status !== lastProgress.status || progress.found !== lastProgress.found) {
      lastProgress = progress;
      onProgress?.(progress);
    }
  }

  const selectedWord = () => spells(state.path, letters);
  const targetWord = () => board.answers.findIndex((answer, i) => !state.found[i] && answer.word === selectedWord());
  const targetPair = () => state.pair.length === 2 && Math.abs(state.pair[0] - state.pair[1]) === 1 ? Math.min(...state.pair) : -1;
  const locked = i => state.found.some(path => path?.includes(i));

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
    const tip = activeHint >= 0 && state.hints[activeHint] >= 2 ? trailFor(board, board.answers[activeHint], new Set(state.found.flatMap(path => path || [])))[0] : -1;
    cards.forEach(card => card.setAttribute('aria-pressed', String(state.pair.includes(Number(card.dataset.card)))));
    paintCells(cells, state.found, state.path, tip, true);
    counter.textContent = `${count} ze ${board.answers.length}`;
    word.textContent = typed;
    word.hidden = !typed;
    if (notice) status.textContent = notice;
    else if (target >= 0) status.textContent = state.pair.length === 1 ? 'Přidej druhou kartičku.' : 'Ke kterým dvěma kartičkám patří?';
    else if (activeHint >= 0) status.textContent = hintText(activeHint);
    else if (typed) status.textContent = typed.length === 1 ? 'Pokračuj sousedním písmenem.' : '';
    else if (state.pair.length === 2) status.textContent = 'Najdi v mřížce slovo, které k oběma sedí.';
    else if (state.pair.length === 1) status.textContent = 'Přidej druhou kartičku.';
    else status.textContent = 'Začni dvojicí kartiček nebo slovem v mřížce.';
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
    if (target >= 0 && state.pair.length === 2) {
      if (target === targetPair()) {
        state.found[target] = [...state.path];
        state.path = [];
        state.pair = [];
        state.hintTarget = -1;
        stopPointer();
        notice = board.answers[target].explanation || board.answers[target].clue;
        if (state.found.every(Boolean)) {
          finishing = true;
          save();
          showResult(frame, options, state.found, false);
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

  function addCell(i, start) {
    const end = state.path.at(-1);
    if (locked(i) || end === i || targetWord() >= 0) return;
    notice = '';
    if (state.path.length >= 2 && state.path.at(-2) === i) state.path.pop();
    else if (state.path.includes(i)) {
      if (start) { notice = 'Políčko můžeš ve slově použít jen jednou.'; paint(); }
      return;
    } else if (end == null || neighbors(end, i, cols)) state.path.push(i);
    else {
      if (start) { notice = 'Navazuj přes společnou stranu. Pro nové slovo zruš tah.'; paint(); }
      return;
    }
    update();
  }

  function askHint() {
    const ready = targetWord();
    const pair = targetPair();
    const target = ready >= 0 ? ready : pair >= 0 && !state.found[pair] ? pair : state.found.findIndex(path => !path);
    if (target < 0) return;
    notice = '';
    if (!board.answers[target].word.startsWith(selectedWord())) state.path = [];
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
    const { x: fromX, y: fromY } = activePointer;
    const steps = Math.max(1, Math.ceil(Math.hypot(x - fromX, y - fromY) / 10));
    for (let s = 1; s <= steps && activePointer; s++) {
      const index = hitAt(fromX + (x - fromX) * s / steps, fromY + (y - fromY) * s / steps);
      if (index >= 0 && index !== activePointer.last) {
        activePointer.moved = true;
        activePointer.last = index;
        addCell(index, false);
      }
    }
    if (activePointer) { activePointer.x = x; activePointer.y = y; }
  }

  function bindGrid() {
    grid.addEventListener('pointerdown', event => {
      const cell = event.target.closest('[data-cell]');
      if (activePointer || event.button !== 0 || !cell || cell.disabled) return;
      const i = Number(cell.dataset.cell);
      event.preventDefault();
      activePointer = { id: event.pointerId, x: event.clientX, y: event.clientY, last: i, moved: false };
      grid.setPointerCapture(event.pointerId);
      addCell(i, true);
    });
    grid.addEventListener('pointermove', event => {
      if (activePointer?.id === event.pointerId) traceTo(event.clientX, event.clientY);
    });
    grid.addEventListener('pointerup', event => {
      if (activePointer?.id !== event.pointerId) return;
      traceTo(event.clientX, event.clientY);
      if (!activePointer) return;
      const wasDrag = activePointer.moved;
      stopPointer();
      if (wasDrag && state.path.length > 1 && targetWord() < 0 && !board.answers.some((answer, i) => !state.found[i] && answer.word.startsWith(selectedWord()))) {
        notice = 'Tohle slovo kartičky nespojuje. Zkus jinou cestu.';
        paint();
      }
    });
    for (const name of ['pointercancel', 'lostpointercapture']) grid.addEventListener(name, event => {
      if (activePointer?.id === event.pointerId) activePointer = null;
    });
    grid.addEventListener('click', event => {
      // Keyboard and assistive clicks have no pointer gesture to handle them.
      const cell = event.target.closest('[data-cell]');
      if (event.detail === 0 && cell && !cell.disabled) addCell(Number(cell.dataset.cell), true);
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
    bindCards(nouns, chooseCard);
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
    const explanation = el('p', 'sj-intro-copy', 'Na desce dostaneš čtyři kartičky. Najdi v mřížce tři slova, která je takhle propojí.');
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
    if (event.key !== boardKey(board)) return;
    stopPointer();
    state = loadState(board);
    lastProgress = progressOf(state);
    onProgress?.(lastProgress);
    notice = '';
    if (event.newValue === null) { onBack(); return; }
    if (!state.started || finishing || state.found.every(Boolean) || !grid?.isConnected) display();
    else paint();
  }

  display();
  window.addEventListener('storage', storageChange);
  return { destroy() { stopPointer(); dialog?.close(); window.removeEventListener('storage', storageChange); frame.remove(); } };
}
