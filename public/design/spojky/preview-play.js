import { getWordBoardStatus, mountWordBoard } from './board-preview.js';
import { playSamples } from './preview-play-boards.js';
import { reviewRhythm } from './today.js';

const dailies = {
  easy: ['g4-e-001', 'Snadná'],
  medium: ['g4-m-001', 'Střední'],
  hard: ['g4-h-001', 'Těžká'],
};
const extras = {
  hardcore: ['g4-x-001', 'Mozkožrout'],
  mozkomor: ['g4-z-001', 'Mozkomor'],
  mozkokalypsa: ['mk100-v2-001', 'Mozkokalypsa'],
};

function boardOptions(kind, day) {
  if (kind === 'free' || kind === 'free-new') {
    const resume = kind === 'free';
    const puzzle = playSamples[resume ? 'g4-m-012' : 'g4-m-013'];
    return {
      puzzle, mode: 'free', title: 'Volná hra', subtitle: `Střední · úroveň ${resume ? 12 : 13}`,
      progressKey: 'free', initialFound: resume ? [0] : [], resultTitle: 'Deska vyřešena',
    };
  }
  const rhythm = reviewRhythm(day);
  const isExtra = kind === 'extra';
  const sample = isExtra ? extras[rhythm.extra] : dailies[rhythm.daily];
  if (!sample || (!isExtra && kind !== 'daily')) return null;
  const [id, difficultyLabel] = sample;
  return {
    puzzle: playSamples[id], progressKey: kind + '.' + day,
    title: isExtra ? 'Extra' : 'Denní výzva', subtitle: `${difficultyLabel} · ukázková deska`,
    mode: isExtra ? 'daily_special' : 'daily', resultTitle: isExtra ? 'Extra výzva splněna' : 'Denní výzva splněna',
  };
}

export function getPlayStatus(kind, day) {
  const model = boardOptions(kind, day);
  return model ? getWordBoardStatus(model.puzzle, model.progressKey, model.initialFound) : 'new';
}

export function mountPlay(root, { kind, day, onBack }) {
  const model = boardOptions(kind, day);
  if (model) return mountWordBoard(root, { ...model, onBack });

  // A saved deep link to Extra can be opened for a day without a published special.
  const sheet = document.createElement('section');
  sheet.className = 'sj-sheet';
  const title = document.createElement('h1');
  title.className = 'sj-title';
  title.textContent = 'Dnes se Extra nehraje';
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'pilot-review-link';
  back.textContent = 'Zpět na Dnes';
  back.addEventListener('click', onBack);
  sheet.append(title, back);
  root.replaceChildren(sheet);
  return { destroy() { sheet.remove(); } };
}
