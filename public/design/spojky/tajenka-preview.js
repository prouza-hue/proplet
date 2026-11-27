import '../../app/content/tajenka-editions.js';
import { getWordBoardStatus, mountWordBoard } from './board-preview.js';
import { archiveSamples, publicationDates } from './tajenka-samples.js';

const dailyFrom = '2026-11-27';
const cachePrefix = 'proplet.spojky.preview.tajenky.v1.';
const calendar = window.PropletDailyTajenka;
const dates = new Intl.DateTimeFormat('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Prague' });
const editions = publicationDates.map(([date, week], i) => {
  const sample = archiveSamples[i % archiveSamples.length];
  const id = `tajenka-v2-week-${String(week).padStart(2, '0')}`;
  return { date, week, id, sample };
});
let calendarVisit;

export function tajenkaEditions(day) {
  return editions.filter(entry => entry.date <= day).slice(-7).reverse()
    .map(({ date, week, id, sample }) => ({ date, week, id, difficulty: sample.difficulty }));
}

function resolveEdition(day, requested) {
  const published = editions.filter(entry => entry.date <= day).slice(-7);
  return published.find(entry => entry.date === requested) || published.at(-1);
}

function puzzleFor(entry) {
  return { ...entry.sample, id: entry.id, week: entry.week };
}

export function getTajenkaPuzzle(day, edition = day) {
  return puzzleFor(resolveEdition(day, edition));
}

export function getTajenkaStatus(day, edition = day) {
  const entry = resolveEdition(day, edition);
  return getWordBoardStatus(puzzleFor(entry), 'tajenka.' + entry.date);
}

export function mountTajenka(root, { day, edition = day, onBack, backLabel = 'Dnes' }) {
  const entry = resolveEdition(day, edition);
  return mountWordBoard(root, {
    mode: 'tajenka',
    puzzle: puzzleFor(entry),
    progressKey: 'tajenka.' + entry.date,
    title: 'Tajenka',
    subtitle: dates.format(new Date(entry.date + 'T12:00:00Z')),
    resultTitle: 'Tajenka odhalena',
    onBack,
    backLabel,
  });
}

export function closeTajenkaCalendar() {
  calendarVisit?.abort();
  calendarVisit = null;
  calendar.close();
}

export function openTajenkaCalendar(day, trigger, onChoose, onClose) {
  const entries = tajenkaEditions(day);
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  // The production calendar owns focus, dismissal, loading and row selection.
  // Each model day has its own list. No published or player account cache is used.
  calendarVisit?.abort();
  const visit = new AbortController();
  calendarVisit = visit;
  calendar.configure({
    cacheKey: cachePrefix + day,
    today: () => day,
    dailyFrom,
    enabled: () => true,
    previewHost: () => false,
    current: () => getTajenkaPuzzle(day),
    slotForDate: date => resolveEdition(day, date).week,
    scope: () => day,
    valid: p => {
      const entry = byId.get(p?.id);
      return !!entry && p.sampleId === getTajenkaPuzzle(day, entry.date).sampleId;
    },
    status: id => getTajenkaStatus(day, byId.get(id).date),
    fetchRecent: () => ({ date: day, dailyFrom, editions: entries }),
    fetchPuzzle: id => getTajenkaPuzzle(day, byId.get(id).date),
    openPuzzle(p) {
      if (calendarVisit !== visit) return;
      visit.abort();
      calendarVisit = null;
      onChoose(byId.get(p.id).date);
    },
  });
  const ready = calendar.open(trigger);
  const dialog = document.getElementById('tajenkaEditionsDialog');
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    visit.abort();
    calendarVisit = null;
    onClose?.();
  }, { signal: visit.signal });
  const statusList = () => entries.map(entry => getTajenkaStatus(day, entry.date)).join(',');
  let visibleStatuses = statusList();
  window.addEventListener('storage', async event => {
    if (!dialog.open || event.key?.startsWith(cachePrefix)) return;
    const updated = statusList();
    if (updated === visibleStatuses) return;
    visibleStatuses = updated;
    const focusedRow = [...dialog.querySelectorAll('.taj-ed-row')].indexOf(document.activeElement);
    await calendar.open(trigger);
    if (!visit.signal.aborted && focusedRow >= 0) {
      dialog.querySelectorAll('.taj-ed-row')[focusedRow]?.focus({ preventScroll: true });
    }
  }, { signal: visit.signal });
  return ready;
}
