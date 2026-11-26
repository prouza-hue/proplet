const fields = new WeakMap();

// Touch can produce a compatibility click with detail === 0 as well as a pointerup.
export const nonPointerClick = event => event.detail === 0 && !event.pointerType && !event.sourceCapabilities?.firesTouchEvents;

// A pointerup may replace the screen or open a modal. Its compatibility click can
// then land on a completely different element at the same spot.
function consumeTouchClick(tap) {
  const doc = tap.target.ownerDocument;
  const { pointerId, clientX, clientY } = tap;
  function release() {
    clearTimeout(timer);
    doc.removeEventListener('click', consume, true);
    doc.removeEventListener('pointerdown', release, true);
    doc.removeEventListener('keydown', release, true);
  }
  function consume(click) {
    if (nonPointerClick(click)) return;
    const samePointer = click.pointerType === 'touch' && click.pointerId === pointerId;
    if (!samePointer && Math.hypot(click.clientX - clientX, click.clientY - clientY) > 24) return;
    click.preventDefault();
    click.stopImmediatePropagation();
    release();
  }
  const timer = setTimeout(release, 800);
  doc.addEventListener('click', consume, true);
  doc.addEventListener('pointerdown', release, true);
  doc.addEventListener('keydown', release, true);
}

export function bindTaps(container, selector, activate) {
  let touch = null;
  container.addEventListener('pointerdown', event => {
    const control = event.target.closest(selector);
    if (!control || !event.isPrimary) return;
    touch = event.pointerType === 'touch' && event.button === 0 ? { control, id: event.pointerId, x: event.clientX, y: event.clientY } : null;
  });
  container.addEventListener('pointercancel', event => { if (touch?.id === event.pointerId) touch = null; });
  container.addEventListener('pointerup', event => {
    if (touch?.id !== event.pointerId) return;
    const { control, x, y } = touch;
    touch = null;
    if (Math.hypot(event.clientX - x, event.clientY - y) > 12 || document.elementFromPoint(event.clientX, event.clientY)?.closest(selector) !== control) return;
    // Chromium can suppress the first compatibility click after a drag on the grid.
    consumeTouchClick(event);
    activate(control);
  });
  container.addEventListener('click', event => {
    const control = event.target.closest(selector);
    if (!control) return;
    // Summary has its own default activation. Toggle it exactly once for touch, mouse and keyboard.
    event.preventDefault();
    activate(control);
  });
}

function span(className) {
  const element = document.createElement('span');
  element.className = className;
  return element;
}

function position(i, columns) {
  return `řádek ${Math.floor(i / columns) + 1}, sloupec ${i % columns + 1}`;
}

function inkOrder(board) {
  const inks = board.answers.map((_, i) => i);
  // Named weekly boards have their own palette. A stamp must not identify the middle link.
  if (!board.id) return inks;
  let seed = 0;
  for (const char of board.id) seed = (Math.imul(seed, 31) + char.codePointAt(0)) >>> 0;
  for (let i = inks.length - 1; i > 0; i--) {
    const pick = seed % (i + 1);
    [inks[i], inks[pick]] = [inks[pick], inks[i]];
    seed = Math.floor(seed / (i + 1));
  }
  return inks;
}

export function gridFor(board, interactive) {
  const columns = board.rows[0].length;
  const inks = inkOrder(board);
  const tray = document.createElement('div');
  tray.className = 'sj-tray';
  tray.style.setProperty('--sj-cols', columns);
  const grid = document.createElement('div');
  grid.className = 'sj-grid';
  grid.setAttribute('role', interactive ? 'group' : 'img');
  grid.setAttribute('aria-label', interactive ? 'Mřížka písmen. Spojuj políčka přes společnou stranu. Použitá písmena můžeš zapojit znovu.' : 'Mřížka nalezených slov.');
  const cells = Array.from(board.rows.join(''), (letter, i) => {
    const cell = document.createElement(interactive ? 'button' : 'span');
    cell.className = 'sj-cell';
    cell.dataset.cell = String(i);
    cell.textContent = letter;
    if (interactive) {
      cell.type = 'button';
      cell.setAttribute('aria-label', `${letter}, ${position(i, columns)}`);
    }
    grid.append(cell);
    return cell;
  });
  tray.append(grid);
  fields.set(cells, { grid, board, inks, printed: [], descriptions: [] });
  return { tray, grid, cells, inks };
}

function direction(from, to) {
  if (to === from + 1) return 'r';
  if (to === from - 1) return 'l';
  return to > from ? 'd' : 'u';
}

// Each completed word owns a separate print mark and a separate lane across each gutter.
// A shared letter or edge can therefore keep every impression, in either traversal order.
function printFound(cells, field, found) {
  field.printed = found.slice();
  cells.forEach((cell, i) => {
    cell.querySelector('.sj-impressions')?.remove();
    const owners = [];
    const layer = span('sj-impressions');
    layer.setAttribute('aria-hidden', 'true');
    found.forEach((trail, owner) => {
      const step = trail?.indexOf(i) ?? -1;
      if (step === -1) return;
      owners.push(owner);
      const stamp = span('sj-stamp');
      stamp.dataset.ink = String(field.inks[owner]);
      layer.append(stamp);
      if (step + 1 < trail.length) {
        const seam = span('sj-seam');
        seam.dataset.ink = String(field.inks[owner]);
        seam.dataset.side = direction(i, trail[step + 1]);
        layer.append(seam);
      }
    });
    if (owners.length) {
      cell.dataset.owners = owners.map(owner => field.inks[owner]).join(' ');
      cell.append(layer);
    } else {
      delete cell.dataset.owners;
    }
    const words = owners.map(owner => field.board.answers[owner].word.toLocaleLowerCase('cs'));
    field.descriptions[i] = words.length ? `Nalezené ${words.length === 1 ? 'slovo' : 'spojky'} – ${words.join(', ')}.` : '';
  });
}

export function paintCells(cells, found, path, tip, interactive, focus = -1) {
  const field = fields.get(cells);
  const live = path.length > 0;
  const trail = live ? path : (found[focus] || []);
  if (found.length !== field.printed.length || found.some((p, owner) => p !== field.printed[owner])) printFound(cells, field, found);
  field.grid.classList.toggle('sj-tracing', live);
  field.grid.classList.toggle('sj-inspecting', !live && focus >= 0);
  cells.forEach((cell, i) => {
    const step = trail.indexOf(i);
    const selected = step >= 0;
    cell.classList.toggle('sj-current', live && selected);
    cell.classList.toggle('sj-end', live && step === trail.length - 1);
    cell.classList.toggle('sj-tip', i === tip);
    cell.classList.toggle('sj-trace-focus', !live && selected);
    cell.classList.toggle('sj-trace-start', !live && step === 0);
    if (!live && selected) cell.dataset.ink = String(field.inks[focus]);
    else delete cell.dataset.ink;
    if (selected && step + 1 < trail.length) cell.dataset.to = direction(i, trail[step + 1]);
    else delete cell.dataset.to;
    if (interactive) {
      cell.setAttribute('aria-pressed', String(live && selected));
      const description = [i === tip ? 'Tady slovo začíná.' : '', field.descriptions[i]].filter(Boolean).join(' ');
      if (description) cell.setAttribute('aria-description', description);
      else cell.removeAttribute('aria-description');
    }
  });
  if (!interactive) {
    const columns = field.board.rows[0].length;
    const names = field.board.answers.map(answer => answer.word.toLocaleLowerCase('cs'));
    const summary = focus < 0
      ? `Mřížka se slovy ${names.join(', ')}. Zvolením slova si můžeš prohlédnout jeho cestu.`
      : `Cesta slova ${names[focus]}. ${trail.map(i => position(i, columns)).join('. ')}.`;
    field.grid.setAttribute('aria-label', summary);
  }
}
