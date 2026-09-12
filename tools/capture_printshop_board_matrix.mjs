#!/usr/bin/env node

/**
 * Deterministic visual-state capture for the Proplet game board.
 *
 * Examples:
 *   node tools/capture_printshop_board_matrix.mjs \
 *     --public-root ./public --output /tmp/proplet-board-matrix
 *
 *   node tools/capture_printshop_board_matrix.mjs \
 *     --url http://127.0.0.1:8000 --output /tmp/proplet-board-matrix
 *
 * The script deliberately uses the application's own startGame/render functions.
 * It changes state only inside the disposable browser context; no production file
 * or persistent player state is modified.
 */

import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);

function loadPlaywright() {
  const runtimeModules = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
  const candidates = [
    'playwright',
    runtimeModules ? resolve(runtimeModules, 'playwright') : null,
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      if (candidate === candidates.at(-1)) {
        throw new Error(
          `Playwright se nepodařilo načíst. Nastav CODEX_PRIMARY_RUNTIME_NODE_MODULES nebo nainstaluj playwright. (${error.message})`,
        );
      }
    }
  }
  throw new Error('Playwright se nepodařilo načíst.');
}

function parseArgs(argv) {
  const options = { output: null, url: null, publicRoot: null, executablePath: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--url') options.url = argv[++i];
    else if (arg === '--public-root') options.publicRoot = argv[++i];
    else if (arg === '--output') options.output = argv[++i];
    else if (arg === '--executable-path') options.executablePath = argv[++i];
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Neznámý argument: ${arg}`);
  }
  if (options.help) return options;
  if (!!options.url === !!options.publicRoot) {
    throw new Error('Zadej právě jeden zdroj: --url, nebo --public-root.');
  }
  if (!options.output) throw new Error('Chybí --output.');
  return options;
}

function usage() {
  return [
    'Použití:',
    '  node tools/capture_printshop_board_matrix.mjs --public-root ./public --output ./artifacts/board-matrix',
    '  node tools/capture_printshop_board_matrix.mjs --url http://127.0.0.1:8000 --output ./artifacts/board-matrix',
    '',
    'Volitelně: --executable-path /cesta/k/chromium',
  ].join('\n');
}

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

async function startStaticServer(publicRoot) {
  const root = resolve(publicRoot);
  if (!(await stat(root)).isDirectory()) throw new Error(`--public-root není adresář: ${root}`);

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      let pathname = decodeURIComponent(url.pathname);
      if (pathname === '/') pathname = '/index.html';
      const target = resolve(root, `.${pathname}`);
      if (target !== root && !target.startsWith(`${root}${sep}`)) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      const fileStat = await stat(target);
      if (!fileStat.isFile()) throw new Error('Not a file');
      const body = await readFile(target);
      response.writeHead(200, {
        'cache-control': 'no-store',
        'content-type': MIME[extname(target).toLowerCase()] || 'application/octet-stream',
      });
      response.end(body);
    } catch {
      response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
      response.end('{"detail":"Not found"}');
    }
  });

  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const address = server.address();
  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
  };
}

async function chromiumExecutable(explicitPath) {
  const candidates = [
    explicitPath,
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Continue to Playwright's bundled browser.
    }
  }
  return null;
}

const REQUIRED_SCENARIOS = [
  { file: '01-easy-default-desktop.png', difficulty: 'easy', state: 'default', viewport: { width: 1440, height: 960 } },
  { file: '02-easy-active-desktop.png', difficulty: 'easy', state: 'active', viewport: { width: 1440, height: 960 } },
  { file: '03-easy-wrong-desktop.png', difficulty: 'easy', state: 'wrong', viewport: { width: 1440, height: 960 } },
  { file: '04-easy-correct-desktop.png', difficulty: 'easy', state: 'correct', viewport: { width: 1440, height: 960 } },
  { file: '05-easy-hint-desktop.png', difficulty: 'easy', state: 'hint', viewport: { width: 1440, height: 960 } },
  { file: '06-easy-completed-desktop.png', difficulty: 'easy', state: 'completed', viewport: { width: 1440, height: 960 } },
  { file: '07-mozkozrout-default-desktop.png', difficulty: 'hardcore', state: 'default', viewport: { width: 1440, height: 960 } },
  { file: '08-mozkozrout-progress-desktop.png', difficulty: 'hardcore', state: 'progress', viewport: { width: 1440, height: 960 } },
  { file: '09-easy-default-mobile-390x844.png', difficulty: 'easy', state: 'default', viewport: { width: 390, height: 844 }, mobile: true },
  { file: '10-mozkozrout-default-mobile-390x844.png', difficulty: 'hardcore', state: 'default', viewport: { width: 390, height: 844 }, mobile: true },
];

const SUPPLEMENTARY_SCENARIOS = [
  {
    file: '11-mozkozrout-progress-desktop-grayscale.png',
    difficulty: 'hardcore',
    state: 'progress',
    viewport: { width: 1440, height: 960 },
    visualFilter: 'grayscale(1)',
    purpose: 'grayscale',
  },
  {
    file: '12-mozkozrout-progress-desktop-low-brightness.png',
    difficulty: 'hardcore',
    state: 'progress',
    viewport: { width: 1440, height: 960 },
    visualFilter: 'brightness(.55) contrast(.88) saturate(.72)',
    purpose: 'low-brightness-and-poor-display',
  },
];

const SCENARIOS = [...REQUIRED_SCENARIOS, ...SUPPLEMENTARY_SCENARIOS];

const APP_READY = () => (
  typeof puzzleDB !== 'undefined'
  && Array.isArray(puzzleDB?.free?.easy)
  && Array.isArray(puzzleDB?.free?.hardcore)
  && typeof startGame === 'function'
);

function prepareScenario({ difficulty, state }) {
  const bank = puzzleDB.free[difficulty];
  const puzzle = bank.find((entry) => Number(entry.meta?.level) === 1)
    || bank.find((entry) => entry.id === (difficulty === 'easy' ? 'g4-e-001' : 'g4-x-001'))
    || bank[0];
  if (!puzzle) throw new Error(`Puzzle pro ${difficulty} není dostupný.`);

  startGame(puzzle, 'free', null);
  stopTimer();
  currentGame.pausedAt = performance.now();
  currentGame.path = [];
  currentGame.wrongPath = [];
  currentGame.found = [];
  currentGame.used = new Map();
  currentGame.lastFound = [];
  currentGame.finished = false;

  const addAnswer = (answerIndex, fresh = false) => {
    const answer = puzzle.answers[answerIndex];
    const colorIndex = currentGame.found.length % COLORS.length;
    currentGame.found.push({
      answerIndex,
      word: answer.word,
      colorIndex,
      path: [...answer.path],
    });
    answer.path.forEach((index) => currentGame.used.set(index, colorIndex));
    if (fresh) currentGame.lastFound = [...answer.path];
  };

  const findWrongPath = () => {
    const answerPaths = new Set(puzzle.answers.map((answer) => answer.path.join(',')));
    const mask = new Set(puzzle.mask);
    const neighbours = (index) => {
      const row = Math.floor(index / puzzle.cols);
      const col = index % puzzle.cols;
      return [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]
        .filter(([r, c]) => r >= 0 && r < puzzle.rows && c >= 0 && c < puzzle.cols)
        .map(([r, c]) => r * puzzle.cols + c)
        .filter((indexValue) => mask.has(indexValue));
    };
    const visit = (path) => {
      if (path.length === 4 && !answerPaths.has(path.join(','))) return path;
      for (const next of neighbours(path.at(-1))) {
        if (!path.includes(next)) {
          const found = visit([...path, next]);
          if (found) return found;
        }
      }
      return null;
    };
    for (const start of puzzle.mask) {
      const found = visit([start]);
      if (found) return found;
    }
    throw new Error('Nepodařilo se najít chybnou sousední cestu.');
  };

  if (state === 'active') {
    currentGame.path = [...puzzle.answers[0].path];
  } else if (state === 'wrong') {
    currentGame.wrongPath = findWrongPath();
  } else if (state === 'correct') {
    addAnswer(0, true);
  } else if (state === 'hint') {
    // Use the real hint implementation after the board exists below.
  } else if (state === 'completed') {
    puzzle.answers.forEach((_, index) => addAnswer(index));
    currentGame.finished = true;
  } else if (state === 'progress') {
    puzzle.answers.slice(0, 4).forEach((_, index) => addAnswer(index));
  }

  renderGameBoard();
  renderGameHUD();
  updateGameFeel();
  if (state === 'active') updateActive();
  if (state === 'wrong') {
    const word = currentGame.wrongPath.map((index) => puzzle.letters[index]).join('');
    message(`„${word}“ do tohohle Propletu nezapadá.`, 'bad');
  } else if (state === 'correct') {
    message(`✓ ${puzzle.answers[0].word}`, 'good');
  } else if (state === 'completed') {
    message('Celá plocha zapadla na své místo.', 'good');
  }

  return {
    id: puzzle.id,
    level: Number(puzzle.meta?.level) || 1,
    answers: puzzle.answers.length,
    letters: puzzle.mask.length,
  };
}

async function newScenarioPage(browser, baseUrl, scenario) {
  const context = await browser.newContext({
    viewport: scenario.viewport,
    deviceScaleFactor: 1,
    colorScheme: 'light',
    locale: 'cs-CZ',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    timezoneId: 'Europe/Prague',
    hasTouch: Boolean(scenario.mobile),
    isMobile: Boolean(scenario.mobile),
  });
  await context.addInitScript(() => {
    try {
      localStorage.setItem('proplet-v3-7-required-onboarding', 'done');
      localStorage.setItem('proplet-v3-16-2-helper-onboarding', 'done');
      localStorage.setItem('proplet-onboarding-v1', 'done');
      localStorage.setItem('proplet-helper-onboarding-v1', 'done');
      localStorage.setItem('proplet-v3-16-2-helper-mode', 'none');
      localStorage.setItem('proplet-v3-settings', JSON.stringify({
        sound: false,
        haptics: false,
        wakeLock: false,
        magnifier: true,
        theme: 'light',
      }));
      sessionStorage.setItem('proplet-gen4-release-modal-v1', '1');
    } catch {
      // about:blank and sandboxed frames can reject storage before navigation.
    }
    Date.now = () => 1788912000000;
  });
  const page = await context.newPage();
  await page.route('**/api/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '{}',
  }));
  const consoleErrors = [];
  page.on('console', (entry) => {
    if (entry.type() === 'error') consoleErrors.push(entry.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto(`${baseUrl.replace(/\/$/, '')}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForFunction(APP_READY, null, { timeout: 30_000 });
  const metadata = await page.evaluate(prepareScenario, scenario);
  await page.waitForSelector('#screen-game.active .cell', { state: 'visible', timeout: 10_000 });

  if (scenario.state === 'hint') {
    await page.evaluate(() => applySmartHint(3));
  }
  await page.evaluate((visualFilter) => {
    document.querySelectorAll('.modal:not(.hidden)').forEach((modal) => modal.classList.add('hidden'));
    const timer = document.querySelector('#timer');
    if (timer) timer.textContent = '00:00';
    document.documentElement.classList.add('visual-fixture');
    const style = document.createElement('style');
    style.dataset.visualFixture = 'true';
    style.textContent = `
      html.visual-fixture *, html.visual-fixture *::before, html.visual-fixture *::after {
        animation-play-state: paused !important;
        caret-color: transparent !important;
        scroll-behavior: auto !important;
        transition: none !important;
      }
    `;
    document.head.appendChild(style);
    if (visualFilter) {
      document.documentElement.style.filter = visualFilter;
      document.documentElement.style.background = '#000';
    }
    window.scrollTo(0, 0);
    fitGameBoard();
    drawPaths();
  }, scenario.visualFilter || null);
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(120);
  return { context, page, metadata, consoleErrors };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const output = resolve(options.output);
  await mkdir(output, { recursive: true });
  let staticServer = null;
  let baseUrl = options.url;
  if (options.publicRoot) {
    staticServer = await startStaticServer(options.publicRoot);
    baseUrl = staticServer.url;
  }

  let browser = null;
  try {
    const { chromium } = loadPlaywright();
    const executablePath = await chromiumExecutable(options.executablePath);
    browser = await chromium.launch({
      headless: true,
      executablePath: executablePath || undefined,
      args: executablePath ? [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-font-subpixel-positioning',
        '--font-render-hinting=none',
        '--disable-lcd-text',
      ] : [],
    });
    const report = {
      generatedAt: new Date().toISOString(),
      source: options.publicRoot ? resolve(options.publicRoot) : baseUrl,
      scenarios: [],
    };
    for (const scenario of SCENARIOS) {
      process.stdout.write(`Fotím ${scenario.file}… `);
      const { context, page, metadata, consoleErrors } = await newScenarioPage(browser, baseUrl, scenario);
      try {
        await page.screenshot({ path: resolve(output, scenario.file), fullPage: false });
        const boardBox = await page.locator('#board').boundingBox();
        const cells = await page.locator('#board .cell').count();
        report.scenarios.push({ ...scenario, metadata, boardBox, cells, consoleErrors });
        process.stdout.write('hotovo\n');
      } finally {
        await context.close();
      }
    }
    await writeFile(resolve(output, 'matrix-report.json'), `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`\n12 screenshotů (10 povinných + 2 zátěžové) a report: ${output}\n`);
  } finally {
    if (browser) await browser.close();
    if (staticServer) await new Promise((resolveClose) => staticServer.server.close(resolveClose));
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n\n${usage()}\n`);
  process.exitCode = 1;
});
