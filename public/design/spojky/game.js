import { bindTaps, gridFor, nonPointerClick, paintCells } from './ink.js';
import { mountTutorial } from './tutorial.js';

const storagePrefix = 'proplet.spojky.crossings.v1.';
const introKey = `${storagePrefix}tutorial.v2`;
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
  if (action) bindTaps(element, 'button', action);
  return element;
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

function rulesDialog(frame, onTutorial) {
  const dialog = el('dialog', 'sj-dialog');
  dialog.setAttribute('aria-label', 'Jak hrát Spojky');
  const rules = el('div', 'sj-dialog-copy');
  const actions = el('div', 'sj-rule-actions');
  actions.append(button('sj-primary', 'Zpátky ke hře', () => dialog.close()),
    button('sj-try-tutorial', 'Zahrát si ukázku', () => { dialog.close(); onTutorial(); }));
  rules.append(el('h2', '', 'Jak hrát Spojky'),
    el('p', '', 'Čtyři kartičky spojíš třemi slovy. Vyber dvě kartičky a v mřížce najdi slovo, které patří k oběma. Můžeš začít i slovem a kartičky přiřadit potom.'),
    el('p', '', 'Písmena spojuj tahem nebo klepáním přes společnou stranu políček. V jednom slově smíš každé políčko použít jednou. Další slovo přes něj může vést znovu.'),
    el('p', '', 'Nalezenou spojku poznáš podle stejné značky na kartičkách a pod písmeny. Některá písmena zůstanou volná i po dohrání.'),
    el('p', '', 'Klepnutím na poslední písmeno ho odebereš. Klepnutím do prázdna zrušíš celý tah.'), actions);
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

function showChainProgress(board, found, { cards, counter, track, goal, groups, inks }) {
  const known = board.chain.map(() => []);
  found.forEach((path, link) => {
    if (!path) return;
    known[link].push({ card: link + 1, link });
    known[link + 1].push({ card: link, link });
  });
  const remaining = found.filter(path => !path).length;
  counter.textContent = remaining === 1 ? 'Zbývá 1 spojka' : `Zbývají ${remaining} spojky`;
  counter.parentElement.dataset.remaining = String(remaining);
  // The marks count discoveries. Their positions carry no clues about the author's word order.
  Array.from(track.children).forEach((slot, i) => slot.toggleAttribute('data-gap', i >= found.length - remaining));
  cards.forEach(card => {
    const links = known[Number(card.dataset.card)];
    const stamps = links.map(({ link }) => {
      const stamp = el('span', 'sj-stamp');
      stamp.dataset.ink = String(inks[link]);
      return stamp;
    });
    card.querySelector('.sj-noun-marks').replaceChildren(...stamps);
    const words = links.map(({ link }) => board.answers[link].word.toLocaleLowerCase('cs'));
    if (words.length) card.setAttribute('aria-description', `Spojeno ${words.length === 1 ? 'slovem' : 'slovy'} ${words.join(', ')}.`);
    else card.removeAttribute('aria-description');
  });
  const free = board.shuffle.filter(i => !known[i].length);
  const names = free.map(i => `„${board.chain[i]}“`);
  if (remaining === found.length) goal.textContent = 'Začni dvojicí kartiček nebo slovem v mřížce.';
  else if (free.length === 2) goal.textContent = `${names.join(' a ')} ještě nemají spojku.`;
  else if (free.length === 1) goal.textContent = `Připoj kartičku ${names[0]}.`;
  else goal.textContent = 'Propoj obě dvojice.';

  groups.replaceChildren();
  const seen = new Set();
  // Walk only discovered edges. Choose the first visible endpoint in the shuffled card order.
  for (const start of board.shuffle) {
    if (known[start].length !== 1 || seen.has(start)) continue;
    const group = el('p', 'sj-fragment');
    let card = start;
    while (true) {
      seen.add(card);
      group.append(el('span', 'sj-fragment-card', board.chain[card]));
      const next = known[card].find(edge => !seen.has(edge.card));
      if (!next) break;
      const link = el('span', 'sj-fragment-link', board.answers[next.link].word.toLocaleLowerCase('cs'));
      link.dataset.ink = String(inks[next.link]);
      group.append(link);
      card = next.card;
    }
    groups.append(group);
  }
  groups.hidden = !groups.children.length;
}

function openTutorial(frame, { onPlay, onBack, replay = false }) {
  return mountTutorial(frame, { replay, onBack, onPlay() { write(introKey, '1'); onPlay(); } });
}

export function mountGameTutorial(root, options) {
  const frame = el('section', 'sj-game');
  root.replaceChildren(frame);
  const tutorial = openTutorial(frame, options);
  return { destroy() { tutorial.destroy(); frame.remove(); } };
}

function showResult(frame, { board, week, onBack, nextLabel }, found, review) {
  const sheet = el('section', 'sj-sheet sj-result');
  const header = heading(review ? 'Řešení Spojek' : 'Řetěz je celý!', week);
  const { tray, cells, inks } = gridFor(board, false);
  const list = el('ol', 'sj-sequence');
  list.setAttribute('aria-label', 'Celý řetěz');
  board.chain.forEach((noun, i) => {
    const item = el('li', 'sj-station');
    item.append(el('strong', 'sj-station-card', noun));
    const answer = board.answers[i];
    if (answer) {
      const link = el('div', 'sj-link');
      link.dataset.ink = String(inks[i]);
      link.append(el('b', 'sj-link-word', answer.word.toLocaleLowerCase('cs')), el('p', 'sj-link-meaning', answer.explanation || answer.clue));
      item.append(link);
    }
    list.append(item);
  });
  const details = el('details', 'sj-grid-details');
  details.append(el('summary', '', 'Ukázat slova v mřížce'));
  const picker = el('div', 'sj-trace-picker');
  picker.setAttribute('role', 'group');
  picker.setAttribute('aria-label', 'Zvýraznit cestu');
  const choices = ['Všechny', ...board.answers.map(answer => answer.word.toLocaleLowerCase('cs'))].map((label, i) => {
    const owner = i - 1;
    const choice = button('sj-trace-choice', label);
    if (owner >= 0) choice.dataset.ink = String(inks[owner]);
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
    else highlight(choices.indexOf(control) - 1);
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
  let tutorial;
  let chainProgress;
  let previousFinds;
  let cards, cells, grid, word, status, hints, clear, feedback;

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
    const activeHint = state.hintTarget;
    const target = targetWord();
    const typed = selectedWord();
    const tip = activeHint >= 0 && state.hints[activeHint] >= 2 ? board.answers[activeHint].path[0] : -1;
    cards.forEach(card => card.setAttribute('aria-pressed', String(state.pair.includes(Number(card.dataset.card)))));
    paintCells(cells, state.found, state.path, tip, true);
    const finds = state.found.map(Boolean).join(',');
    if (finds !== previousFinds) {
      showChainProgress(board, state.found, chainProgress);
      previousFinds = finds;
    }
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
    else status.textContent = '';
    feedback.classList.toggle('sj-no-feedback', !typed && !status.textContent);
    clear.hidden = !state.pair.length && !state.path.length;
    clear.textContent = state.path.length ? 'Zrušit tah' : 'Zrušit výběr';
    const hintLabel = hints.querySelector('span');
    hintLabel.textContent = activeHint >= 0 && state.hints[activeHint] < 3 ? 'Další nápověda' : 'Nápověda';
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
      if (activePointer || event.isPrimary === false || event.button !== 0) return;
      // Touch target adjustment can redirect a tap in the gutter to a nearby letter.
      const i = hitAt(event.clientX, event.clientY);
      if (i < 0) { clearPath(); return; }
      if (cells[i].disabled) return;
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
    previousFinds = null;
    dialog?.close();
    frame.replaceChildren();
    state.started = true;
    save();
    const sheet = el('section', 'sj-sheet sj-playing');
    if (board.chain.some(noun => noun.length > 7)) sheet.classList.add('sj-long-cards');
    const header = heading('Spojky', week);
    const tally = el('div', 'sj-count');
    const counter = el('strong', 'sj-count-text');
    counter.setAttribute('role', 'status');
    const track = el('span', 'sj-progress-track');
    track.setAttribute('aria-hidden', 'true');
    board.answers.forEach(() => track.append(el('span', 'sj-progress-slot')));
    tally.append(counter, track);
    header.append(tally);
    const content = el('div', 'sj-play-layout');
    const cardArea = el('div', 'sj-card-area');
    const nouns = el('div', 'sj-nouns');
    nouns.setAttribute('role', 'group');
    nouns.setAttribute('aria-label', 'Kartičky k propojení');
    cards = board.shuffle.map(i => {
      const card = button('sj-noun');
      card.dataset.card = String(i);
      const marks = el('span', 'sj-noun-marks');
      marks.setAttribute('aria-hidden', 'true');
      card.append(el('span', 'sj-noun-name', board.chain[i]), marks);
      nouns.append(card);
      return card;
    });
    bindTaps(nouns, '[data-card]', card => chooseCard(Number(card.dataset.card)));
    const goal = el('p', 'sj-chain-goal');
    cardArea.append(nouns, goal);
    const field = gridFor(board, true);
    ({ grid, cells } = field);
    const moves = el('div', 'sj-moves');
    feedback = el('div', 'sj-feedback');
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
    const fragments = el('div', 'sj-fragments');
    fragments.setAttribute('role', 'region');
    fragments.setAttribute('aria-label', 'Objevené části řetězu');
    chainProgress = { cards, counter, track, goal, groups: fragments, inks: field.inks };
    content.append(cardArea, field.tray, moves, fragments);
    sheet.append(header, content);
    frame.append(topRow(onBack, () => dialog.showModal()), sheet);
    dialog = rulesDialog(frame, () => showTutorial(true));
    bindGrid();
    paint();
    header.querySelector('h1').focus({ preventScroll: true });
  }

  function showTutorial(replay = false) {
    stopPointer();
    frame.replaceChildren();
    function resume() {
      tutorial.destroy();
      tutorial = null;
      state = loadState(board);
      if (state.found.every(Boolean)) display();
      else showGame();
      if (replay) frame.querySelector('.sj-rules-button')?.focus({ preventScroll: true });
    }
    tutorial = openTutorial(frame, { onPlay: resume, onBack: replay ? resume : onBack, replay });
  }

  function display() {
    if (state.found.every(Boolean)) { finishing = true; showResult(frame, options, state.found, false); }
    else if (state.started || read(introKey)) showGame();
    else showTutorial();
  }

  function storageChange(event) {
    if (event.key !== null && event.key !== draftKey && !answerKeys.includes(event.key)) return;
    const latest = loadState(board);
    if (tutorial) {
      state = latest;
      lastProgress = progressOf(state);
      onProgress?.(lastProgress);
      return;
    }
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
    tutorial?.destroy();
    dialog?.close();
    window.removeEventListener('storage', storageChange);
    document.removeEventListener('click', clickOutside);
    frame.remove();
  } };
}
