import { bindTaps, gridFor, nonPointerClick, paintCells } from './ink.js';

// The first find runs left to right. The second turns twice and reuses its Z.
const example = {
  rows: ['EJAK', 'ZUBY', 'DECO'],
  chain: ['Hřeben', 'Zip', 'Šachy'],
  answers: [
    { word: 'ZUBY', path: [4, 5, 6, 7] },
    { word: 'JEZDEC', path: [1, 0, 4, 8, 9, 10] },
  ],
};

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  if (tag === 'button') node.type = 'button';
  return node;
}

const width = example.rows[0].length;
const letters = example.rows.join('');
const [teeth, rider] = example.answers;
const adjacent = (a, b) => Math.abs(a % width - b % width) + Math.abs(Math.floor(a / width) - Math.floor(b / width)) === 1;
const spell = path => path.map(i => letters[i]).join('');

export function mountTutorial(root, { onPlay, onBack, replay = false }) {
  const screen = element('section', 'sj-tutorial');
  const sheet = element('div', 'sj-sheet sj-lesson');
  const nav = element('div', 'sj-top');
  const back = element('button', 'sj-back', replay ? 'Zpět do hry' : 'Dnes');
  back.prepend(element('span', 'sj-back-arrow'));
  const skip = element('button', 'sj-lesson-skip', 'Hrát rovnou');
  nav.append(back);
  if (!replay) nav.append(skip);

  const title = element('h1', 'sj-title', 'Jak na Spojky');
  title.tabIndex = -1;
  const lead = element('p', 'sj-lesson-lead', 'Ve hře propojíš čtyři kartičky třemi slovy. Hřeben i zip mají zuby.');
  const strip = element('div', 'sj-lesson-chain');
  strip.setAttribute('role', 'group');
  strip.setAttribute('aria-label', 'Kartičky cvičného řetězu');
  const cards = example.chain.map(text => element('button', 'sj-noun sj-lesson-noun', text));
  const firstLink = element('span', 'sj-lesson-link sj-fragment-link', 'zuby');
  firstLink.dataset.ink = '0';
  const missingLink = element('span', 'sj-lesson-link sj-lesson-missing', '?');
  missingLink.setAttribute('aria-label', 'Hledaná spojka');
  strip.append(cards[0], firstLink, cards[1], missingLink, cards[2]);

  const exercise = element('div', 'sj-lesson-exercise');
  const question = element('h2', 'sj-lesson-question', 'Co spojuje zip se šachy?');
  const instruction = element('p', 'sj-lesson-instruction', 'Písmena spoj tahem nebo klepáním, vodorovně či svisle. Označené Z můžeš použít znovu.');
  const { tray, grid, cells } = gridFor(example, true);
  grid.setAttribute('aria-label', 'Cvičná mřížka. Zuby už jsou vyznačené. I označená písmena můžeš použít znovu.');
  const status = element('div', 'sj-lesson-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-atomic', 'true');
  const typed = element('strong', 'sj-lesson-word');
  const message = element('span', 'sj-lesson-message');
  status.append(typed, message);
  const actions = element('div', 'sj-lesson-actions');
  const hint = element('button', 'sj-lesson-hint', 'Nápověda');
  const clear = element('button', 'sj-clear', 'Zrušit tah');
  const finish = element('button', 'sj-primary', replay ? 'Zpět do hry' : 'Jdu hrát');
  actions.append(hint, clear, finish);
  exercise.append(question, instruction, tray, status, actions);
  sheet.append(title, lead, strip, exercise);
  screen.append(nav, sheet);
  root.replaceChildren(screen);

  const found = [teeth.path, null];
  let pair = [1, 2];
  let path = [];
  let pointer = null;
  let hintLevel = 0;
  let note = '';
  let exited = false;

  function leave(callback) {
    if (exited) return;
    exited = true;
    callback();
  }
  const play = () => leave(onPlay);
  const onPress = new Map([
    [back, () => leave(onBack)], [skip, play], [finish, play], [clear, clearPath], [hint, giveHint],
    ...cards.map((card, i) => [card, () => chooseCard(i)]),
  ]);
  bindTaps(screen, 'button:not(.sj-cell)', control => {
    if (!exited && !control.disabled) onPress.get(control)();
  });

  function paint() {
    const complete = Boolean(found[1]);
    const word = spell(path);
    cards.forEach((card, i) => {
      card.setAttribute('aria-pressed', String(!complete && pair.includes(i)));
      card.disabled = complete;
    });
    paintCells(cells, found, path, !complete && hintLevel ? rider.path[0] : -1, true);
    typed.textContent = word;
    typed.hidden = !word;
    message.textContent = note;
    clear.hidden = !path.length || complete;
    hint.hidden = complete;
    finish.hidden = !complete;
    skip.hidden = complete;
    back.hidden = complete && replay;
    if (!complete) return;
    strip.classList.add('sj-lesson-complete');
    missingLink.className = 'sj-lesson-link sj-fragment-link';
    missingLink.dataset.ink = '1';
    missingLink.textContent = 'jezdec';
    missingLink.removeAttribute('aria-label');
    question.textContent = 'Dvě slova, jedno společné Z';
    instruction.textContent = 'Jezdec se pohybuje po zipu i po šachovnici. Pod Z teď vidíš značky obou slov.';
    cells.forEach(cell => { cell.disabled = true; });
  }

  function complete(trace) {
    const keyboard = document.activeElement?.matches(':focus-visible') && screen.contains(document.activeElement);
    found[1] = trace;
    path = [];
    note = 'Ve hře můžeš začít výběrem dvou kartiček nebo rovnou hledat slovo.';
    paint();
    if (keyboard) finish.focus({ preventScroll: true });
  }

  function checkWord() {
    if (spell(path) === rider.word) {
      if (pair.includes(1) && pair.includes(2)) { complete(path); return; }
      if (pair.length === 2) pair = [];
      note = 'Slovo máš. Vyber kartičky Zip a Šachy.';
    } else if (spell(path) === teeth.word) {
      note = 'Zuby už máš. Jejich písmena můžeš použít znovu.';
    }
    paint();
  }

  function chooseCard(i) {
    if (found[1]) return;
    if (pair.includes(i)) pair = pair.filter(n => n !== i);
    else pair = pair.length === 2 ? [i] : [...pair, i];
    note = pair.length === 1 ? 'Přidej druhou kartičku.' : '';
    if (pair.includes(0) && pair.includes(1)) {
      note = 'Hřeben a zip už propojují zuby. Zkus zip a šachy.';
      pair = [];
    }
    checkWord();
  }

  function clearPath() {
    if (!path.length || found[1]) return;
    path = [];
    note = '';
    paint();
  }
  function giveHint() {
    if (found[1]) return;
    if (hintLevel) { complete(rider.path); return; }
    hintLevel = 1;
    note = 'Na šachovnici skáče do L. Začni na J a cestou použij i označené Z.';
    hint.textContent = 'Ukázat řešení';
    pair = [1, 2];
    if (!path.every((cell, i) => rider.path[i] === cell)) path = [];
    paint();
  }

  function tap(i) {
    if (found[1]) return;
    const previous = path.indexOf(i);
    const end = path.at(-1);
    note = '';
    if (end === i) path.pop();
    else if (previous >= 0) path.length = previous + 1;
    else if (end != null && adjacent(end, i) && spell(path) !== rider.word) path.push(i);
    else path = [i];
    checkWord();
  }

  function cellAt(x, y) {
    const hit = document.elementFromPoint(x, y)?.closest('[data-cell]');
    return hit && grid.contains(hit) ? Number(hit.dataset.cell) : -1;
  }

  function trace(x, y) {
    const p = pointer;
    if (!p) return;
    if (!p.moved) {
      if (Math.hypot(x - p.x, y - p.y) < 8) return;
      p.moved = true;
      path = [p.start];
      note = '';
    }
    const steps = Math.max(1, Math.ceil(Math.hypot(x - p.x, y - p.y) / 10));
    for (let s = 1; s <= steps; s++) {
      const i = cellAt(p.x + (x - p.x) * s / steps, p.y + (y - p.y) * s / steps);
      if (i < 0 || i === p.last) continue;
      p.last = i;
      if (i === path.at(-2)) path.pop();
      else if (adjacent(path.at(-1), i) && !path.includes(i)) path.push(i);
    }
    p.x = x;
    p.y = y;
    paint();
  }

  function release() {
    const id = pointer?.id;
    pointer = null;
    if (id != null && grid.hasPointerCapture(id)) grid.releasePointerCapture(id);
  }

  grid.addEventListener('pointerdown', event => {
    if (found[1] || pointer || !event.isPrimary || event.button !== 0) return;
    const start = cellAt(event.clientX, event.clientY);
    if (start < 0) { clearPath(); return; }
    pointer = { id: event.pointerId, start, last: start, moved: false, x: event.clientX, y: event.clientY };
    grid.setPointerCapture(event.pointerId);
    if (!path.length) paintCells(cells, found, [start], hintLevel ? rider.path[0] : -1, true);
  });
  grid.addEventListener('pointermove', event => {
    if (pointer?.id === event.pointerId) trace(event.clientX, event.clientY);
  });
  grid.addEventListener('pointerup', event => {
    if (pointer?.id !== event.pointerId) return;
    trace(event.clientX, event.clientY);
    const { moved, start } = pointer;
    release();
    if (!moved) { tap(start); return; }
    if (spell(path) !== rider.word) {
      path = [];
      note = 'Zkus jinou cestu. Písmena musí sousedit přes společnou stranu.';
    }
    checkWord();
  });
  for (const name of ['pointercancel', 'lostpointercapture']) grid.addEventListener(name, event => {
    if (pointer?.id !== event.pointerId) return;
    if (pointer.moved) path = [];
    release();
    paint();
  });
  grid.addEventListener('click', event => {
    if (!nonPointerClick(event)) return;
    const cell = event.target.closest('[data-cell]');
    if (cell) tap(Number(cell.dataset.cell));
  });
  grid.addEventListener('keydown', event => {
    const offsets = { ArrowUp: -width, ArrowDown: width, ArrowLeft: -1, ArrowRight: 1 };
    if (!Object.hasOwn(offsets, event.key)) return;
    event.preventDefault();
    const i = Number(event.target.dataset.cell);
    const next = i + offsets[event.key];
    if (cells[next] && adjacent(i, next)) cells[next].focus();
  });
  function clickOutside(event) {
    if (exited || event.button !== 0 || grid.contains(event.target)) return;
    if (!event.target.closest?.('button, a, input, select, textarea, summary, dialog, [role="button"]')) clearPath();
  }
  document.addEventListener('click', clickOutside);
  paint();
  title.focus({ preventScroll: true });
  return {
    destroy() {
      exited = true;
      document.removeEventListener('click', clickOutside);
      release();
      screen.remove();
    },
  };
}
