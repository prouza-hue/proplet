const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

// A different spelling route can be legal yet strand the other two words.
// Play out every find in every order using only letters still on the board.
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
  const orders = new Set();
  function play(order, locked) {
    if (order.length === answers.length) {
      orders.add(order.join(''));
      return;
    }
    answers.forEach(({ word, path: hintPath }, i) => {
      if (order.includes(i)) return;
      const available = routes(word, locked);
      assert(available.length, `${board.id}: ${word} is unreachable after [${order}]; locked [${[...locked]}]`);
      if (!order.length) assert(available.some(trace => trace.join() === hintPath.join()), `${board.id}: wrong hint path for ${word}`);
      for (const trace of available) play([...order, i], new Set([...locked, ...trace]));
    });
  }
  play([], new Set());
  assert.equal(orders.size, 6, board.id);
}

(async () => {
  const moduleUrl = pathToFileURL(path.resolve(__dirname, '../../public/design/spojky/boards.js'));
  const { boards } = await import(moduleUrl.href);
  assert.equal(boards.length, 4);
  assert.equal(new Set(boards.map(board => board.id)).size, 4);
  const monday = Date.parse(boards[0].start);
  assert.equal(new Date(monday).getUTCDay(), 1);
  boards.forEach((board, i) => {
    assert.equal(Date.parse(board.start) - monday, i * 7 * 86400000);
    verifyBoard(board);
  });
  console.log('Four weekly boards, all find orders and locking routes verified.');
})().catch(error => { console.error(error); process.exitCode = 1; });
