// English QLOCKTWO language pack. Wraps the English matrix/word data and
// provides a compose() that turns a 5-minute bucket + hours into the ordered
// list of active word names (prefix + minute/connector words + hour word).
import { GRID, WORDS, HOUR_WORDS, WORD_TEXT } from '../matrix.js';

function compose({ bucket, hourCurrent, hourNext, showPrefix }) {
  const useNext = bucket >= 35; // "... TO <next hour>" from :35
  const hourWord = HOUR_WORDS[useNext ? hourNext : hourCurrent];

  const out = [];
  if (showPrefix) out.push('IT', 'IS');

  switch (bucket) {
    case 0:  out.push(hourWord, 'OCLOCK'); break;
    case 5:  out.push('FIVE_MIN', 'PAST', hourWord); break;
    case 10: out.push('TEN_MIN', 'PAST', hourWord); break;
    case 15: out.push('A', 'QUARTER', 'PAST', hourWord); break;
    case 20: out.push('TWENTY', 'PAST', hourWord); break;
    case 25: out.push('TWENTY', 'FIVE_MIN', 'PAST', hourWord); break;
    case 30: out.push('HALF', 'PAST', hourWord); break;
    case 35: out.push('TWENTY', 'FIVE_MIN', 'TO', hourWord); break;
    case 40: out.push('TWENTY', 'TO', hourWord); break;
    case 45: out.push('A', 'QUARTER', 'TO', hourWord); break;
    case 50: out.push('TEN_MIN', 'TO', hourWord); break;
    case 55: out.push('FIVE_MIN', 'TO', hourWord); break;
    default: out.push(hourWord, 'OCLOCK');
  }
  return out;
}

export const en = {
  id: 'en',
  dir: 'ltr',
  fontFamily: "'Roboto Condensed', sans-serif",
  grid: GRID,
  words: WORDS,
  wordText: WORD_TEXT,
  compose,
};
