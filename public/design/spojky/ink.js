const fields = new WeakMap();

function span(className) {
  const element = document.createElement('span');
  element.className = className;
  return element;
}

function position(i, columns) {
  return `řádek ${Math.floor(i / columns) + 1}, sloupec ${i % columns + 1}`;
}

export function gridFor(board, interactive) {
  const columns = board.rows[0].length;
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
  fields.set(cells, { grid, board, printed: [], descriptions: [] });
  return { tray, grid, cells };
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
      stamp.dataset.ink = String(owner);
      layer.append(stamp);
      if (step + 1 < trail.length) {
        const seam = span('sj-seam');
        seam.dataset.ink = String(owner);
        seam.dataset.side = direction(i, trail[step + 1]);
        layer.append(seam);
      }
    });
    if (owners.length) {
      cell.dataset.owners = owners.join(' ');
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
    if (!live && selected) cell.dataset.ink = String(focus);
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
