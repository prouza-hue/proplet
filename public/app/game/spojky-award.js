const prefix = 'proplet.spojky.award.v1:';
const accountPrefix = id => prefix + encodeURIComponent(id) + ':';
const keyFor = (id, boardId) => accountPrefix(id) + encodeURIComponent(boardId);
const memory = new Map();
const inFlight = new Set();
let currentResult;
let timer;
let retryDelay = 15000;

function read(key) {
  try { return JSON.parse(localStorage.getItem(key)) || memory.get(key); }
  catch { return memory.get(key); }
}
function store(key, value) {
  if (value) memory.set(key, value);
  else memory.delete(key);
  try {
    if (value) localStorage.setItem(key, JSON.stringify(value));
    else localStorage.removeItem(key);
  } catch { /* Keep the receipt in memory when storage is unavailable. */ }
}
function keys(id) {
  const result = new Set(memory.keys());
  try {
    for (let i = 0; i < localStorage.length; i++) result.add(localStorage.key(i));
  } catch { /* Memory-only session. */ }
  return [...result].filter(key => key?.startsWith(accountPrefix(id)));
}
function view(record, firstAward = false) {
  if (record?.points) return { firstAward, xpLabel: (firstAward ? '+' : 'Získáno ') + record.points + ' XP' };
  if (!window.getProfile()?.token) return { notice: 'Po přihlášení se Ti připíše 200 XP.' };
  if (navigator.onLine === false) return { notice: 'XP připíšeme po připojení.' };
  return { notice: 'Čeká na připsání XP.' };
}

async function submit(key, profile) {
  const record = read(key);
  if (!record?.paths || inFlight.has(key) || navigator.onLine === false) return;
  inFlight.add(key);
  try {
    const receipt = await window.api('/api/spojky/result', {
      method: 'POST', authProfile: profile,
      body: JSON.stringify({ boardId: record.boardId, paths: record.paths }),
    });
    if (receipt?.points !== 200 || typeof receipt.newlyGranted !== 'boolean') throw new Error('Chybí potvrzení odměny');
    if (!read(key)) return; // Account data may have been removed while the request was in flight.
    store(key, { points: receipt.points });
    retryDelay = 15000;
    if (window.getProfile()?.id === profile.id) {
      if (currentResult?.key === key) currentResult.notify(view(receipt, receipt.newlyGranted && currentResult.firstFinish));
      window.refreshRemoteProfile?.().catch(() => {});
    }
  } catch (error) {
    if (!error.status || error.status === 429 || error.status >= 500) {
      clearTimeout(timer);
      timer = setTimeout(flush, retryDelay);
      retryDelay = Math.min(300000, retryDelay * 2);
    }
  } finally { inFlight.delete(key); }
}
function flush() {
  const profile = window.getProfile?.();
  if (profile?.token && navigator.onLine !== false) {
    for (const key of keys(profile.id)) submit(key, profile);
  }
}
export function transferAwards(from, to) {
  if (!from || from === to) return;
  for (const key of keys(from)) {
    const record = read(key);
    if (to && record?.paths) {
      const dest = keyFor(to, record.boardId);
      if (!read(dest)) store(dest, record);
    }
    store(key, null);
  }
  if (to) queueMicrotask(flush);
}
export function resultAward(edition, firstFinish, notify, paths) {
  const profile = window.getProfile?.(), key = keyFor(profile?.id || 'guest', edition.board.id);
  let record = read(key);
  if (!record) {
    record = { boardId: edition.board.id, paths };
    store(key, record);
  }
  currentResult = { key, firstFinish, notify };
  if (profile?.token && !record.points) submit(key, profile);
  return view(record);
}
window.addEventListener('online', flush);
window.addEventListener('pageshow', flush);
document.addEventListener('proplet:account-changed', flush);
document.addEventListener('visibilitychange', () => { if (!document.hidden) flush(); });
window.addEventListener('storage', event => {
  if (!event.key?.startsWith(prefix)) return;
  memory.delete(event.key);
  if (currentResult?.key === event.key && event.key.startsWith(accountPrefix(window.playerScope()))) {
    const record = read(event.key);
    if (record?.points) currentResult.notify(view(record));
  }
});
