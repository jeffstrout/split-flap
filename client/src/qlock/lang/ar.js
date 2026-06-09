// Arabic (Modern Standard Arabic) QLOCKTWO language pack — issue #33.
//
// The grid is BUILT from a word layout so each word's cell-span is guaranteed
// to spell that word (a unit test re-verifies this). Right-to-left: the grid is
// stored in logical (reading) order; the renderer applies dir="rtl".
//
// Phrasing convention (MSA, fraction-based):
//   prefix الساعة + <hour> then:
//     و خمس / عشر / ربع / ثلث            (past, current hour)
//     و نصف                              (half)
//     و نصف إلا خمس                       (:25, current hour)
//     و نصف و خمس                         (:35, current hour)
//     إلا ثلث / ربع / عشر / خمس           (:40–:55, NEXT hour)

const COLS = 15;
const FILLER = 'بتجحدذزسشصضطظغف';

// Each row is a list of {name, text} word tokens placed in logical order.
const LAYOUT = [
  [{ name: 'SAA', text: 'الساعة' }],
  [{ name: 'WAHIDA', text: 'الواحدة' }, { name: 'THANIYA', text: 'الثانية' }],
  [{ name: 'THALITHA', text: 'الثالثة' }, { name: 'RABIA', text: 'الرابعة' }],
  [{ name: 'KHAMISA', text: 'الخامسة' }, { name: 'SADISA', text: 'السادسة' }],
  [{ name: 'SABIA', text: 'السابعة' }, { name: 'THAMINA', text: 'الثامنة' }],
  [{ name: 'TASIA', text: 'التاسعة' }, { name: 'ASHIRA', text: 'العاشرة' }],
  [{ name: 'HADIYA', text: 'الحادية' }, { name: 'ASHRA', text: 'عشرة' }],
  [
    { name: 'KHAMS', text: 'خمس' }, { name: 'ASHR', text: 'عشر' },
    { name: 'RUBA', text: 'ربع' }, { name: 'THULTH', text: 'ثلث' },
    { name: 'NISF', text: 'نصف' },
  ],
  [{ name: 'WA', text: 'و' }, { name: 'ILLA', text: 'إلا' }],
];

// Build grid rows + word spans from the layout.
const GRID = [];
const WORDS = {};
const WORD_TEXT = {};
let fillerIdx = 0;
for (let row = 0; row < LAYOUT.length; row++) {
  let chars = [];
  for (const token of LAYOUT[row]) {
    const letters = Array.from(token.text);
    const start = chars.length;
    chars = chars.concat(letters);
    WORDS[token.name] = letters.map((_, i) => ({ row, col: start + i }));
    WORD_TEXT[token.name] = token.text;
  }
  while (chars.length < COLS) {
    chars.push(FILLER[fillerIdx++ % FILLER.length]);
  }
  GRID.push(chars.join(''));
}

// 12-hour clock -> hour word token(s). 11 and 12 use two tokens (+ عشرة).
function hourTokens(h) {
  switch (h) {
    case 1: return ['WAHIDA'];
    case 2: return ['THANIYA'];
    case 3: return ['THALITHA'];
    case 4: return ['RABIA'];
    case 5: return ['KHAMISA'];
    case 6: return ['SADISA'];
    case 7: return ['SABIA'];
    case 8: return ['THAMINA'];
    case 9: return ['TASIA'];
    case 10: return ['ASHIRA'];
    case 11: return ['HADIYA', 'ASHRA'];
    case 12: return ['THANIYA', 'ASHRA'];
    default: return ['THANIYA', 'ASHRA'];
  }
}

function compose({ bucket, hourCurrent, hourNext, showPrefix }) {
  // Arabic shifts to the next hour only for the pure إلا cases (:40–:55).
  const useNext = bucket >= 40;
  const h = useNext ? hourNext : hourCurrent;

  const out = [];
  if (showPrefix) out.push('SAA');
  out.push(...hourTokens(h));

  switch (bucket) {
    case 0:  break;
    case 5:  out.push('WA', 'KHAMS'); break;
    case 10: out.push('WA', 'ASHR'); break;
    case 15: out.push('WA', 'RUBA'); break;
    case 20: out.push('WA', 'THULTH'); break;
    case 25: out.push('WA', 'NISF', 'ILLA', 'KHAMS'); break;
    case 30: out.push('WA', 'NISF'); break;
    case 35: out.push('WA', 'NISF', 'WA', 'KHAMS'); break;
    case 40: out.push('ILLA', 'THULTH'); break;
    case 45: out.push('ILLA', 'RUBA'); break;
    case 50: out.push('ILLA', 'ASHR'); break;
    case 55: out.push('ILLA', 'KHAMS'); break;
    default: break;
  }
  return out;
}

export const ar = {
  id: 'ar',
  dir: 'rtl',
  fontFamily: "'Cairo', sans-serif",
  grid: GRID,
  words: WORDS,
  wordText: WORD_TEXT,
  compose,
};
