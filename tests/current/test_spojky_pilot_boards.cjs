const assert = require('node:assert/strict');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

// The board always stays open. The only forbidden reuse is inside one spelling route.
function verifyBoard(board) {
  const { rows, answers, chain, shuffle } = board;
  const width = rows[0].length;
  const tiles = [...rows.join('')];
  assert(rows.every(row => row.length === width));
  assert.equal(new Set(chain).size, 4);
  assert.deepEqual([...shuffle].sort(), [0, 1, 2, 3]);
  assert.equal(answers.length, 3);
  assert.equal(new Set(answers.map(answer => answer.word)).size, 3);
  const adjacent = tiles.map((_, i) => {
    const row = Math.floor(i / width);
    const col = i % width;
    return [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]
      .filter(([r, c]) => r >= 0 && r < rows.length && c >= 0 && c < width)
      .map(([r, c]) => r * width + c);
  });
  function routes(word, locked) {
    const matches = [];
    function walk(i, trail) {
      if (locked.has(i) || trail.includes(i) || tiles[i] !== word[trail.length]) return;
      const next = [...trail, i];
      if (next.length === word.length) matches.push(next);
      else for (const neighbor of adjacent[i]) walk(neighbor, next);
    }
    for (let i = 0; i < tiles.length; i++) walk(i, []);
    return matches;
  }
  const open = new Set();
  const solutions = answers.map(answer => {
    const found = routes(answer.word, open);
    assert.equal(found.length, 1, `${board.id}: expected exactly one route for ${answer.word}`);
    const [solution] = found;
    assert.deepEqual(solution, answer.path, `${board.id}: hint must follow the valid route for ${answer.word}`);
    const starts = routes(answer.word.slice(0, 2), open);
    assert(starts.some(trace => trace[0] !== solution[0]), `${board.id}: no other plausible start for ${answer.word}`);
    return solution;
  });
  const visits = Array(tiles.length).fill(0);
  for (const solution of solutions) {
    for (const tile of solution) visits[tile]++;
  }
  assert(visits.filter(count => count > 1).length >= 2, `${board.id}: expected crossings on two distinct tiles`);
  assert(visits.includes(0), `${board.id}: no unused letters`);

  const orders = new Set();
  function play(order, previouslyUsed) {
    if (order.length === answers.length) {
      orders.add(order.join(''));
      return;
    }
    answers.forEach(({ word }, i) => {
      if (order.includes(i)) return;
      const route = solutions[i];
      if (order.length === answers.length - 1) {
        assert(route.some(tile => previouslyUsed.has(tile)), `${board.id}: the last word ${word} never reuses a tile`);
        assert.equal(routes(word, previouslyUsed).length, 0, `${board.id}: ${word} can bypass all prior words`);
      }
      play([...order, i], new Set([...previouslyUsed, ...route]));
    });
  }
  play([], open);
  assert.equal(orders.size, 6, board.id);
}

(async () => {
  const moduleUrl = pathToFileURL(path.resolve(__dirname, '../../public/design/spojky/boards.js'));
  const { boards: pilot } = await import(moduleUrl.href);
  const { boards, launchDate } = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../data/spojky_weeks.json'), 'utf8'));
  const publicIds = ['spojky-cross-01-v1', 'spojky-cross-02-v1', 'spojky-cross-03-v1', 'spojky-cross-04-v1'];
  assert.deepEqual(pilot.map(board => board.id), publicIds);
  assert.deepEqual(boards.slice(0, pilot.length), pilot, 'returning pilot players need the original grids');
  assert.ok(boards.length >= 8, 'the launch bank must cover at least the opening eight weeks');
  assert.equal(new Set(boards.map(board => board.id)).size, boards.length);
  const monday = Date.parse(boards[0].start);
  assert.equal(new Date(monday).getUTCDay(), 1);
  assert.equal(launchDate, '2026-11-27');
  boards.forEach((board, i) => {
    assert.equal(Date.parse(board.start) - monday, i * 7 * 86400000);
    verifyBoard(board);
  });
  console.log(`${boards.length} weekly crossing boards, all ${boards.length * 6} find orders and four public pilot boards verified.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
