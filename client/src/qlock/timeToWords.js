// QLOCKTWO time-telling logic (FR-28, FR-29, FR-30, FR-31).
// Pure functions: map a Date to the set of lit cells, the active word names,
// and the corner-dot count. No framework, no side effects.

import { WORDS, HOUR_WORDS, WORD_TEXT } from './matrix.js';

// Returns the active word names for a 5-minute bucket plus the chosen hour word.
function phraseFor(bucket, hourWord) {
  switch (bucket) {
    case 0:  return [hourWord, 'OCLOCK'];
    case 5:  return ['FIVE_MIN', 'PAST', hourWord];
    case 10: return ['TEN_MIN', 'PAST', hourWord];
    case 15: return ['A', 'QUARTER', 'PAST', hourWord];
    case 20: return ['TWENTY', 'PAST', hourWord];
    case 25: return ['TWENTY', 'FIVE_MIN', 'PAST', hourWord];
    case 30: return ['HALF', 'PAST', hourWord];
    case 35: return ['TWENTY', 'FIVE_MIN', 'TO', hourWord];
    case 40: return ['TWENTY', 'TO', hourWord];
    case 45: return ['A', 'QUARTER', 'TO', hourWord];
    case 50: return ['TEN_MIN', 'TO', hourWord];
    case 55: return ['FIVE_MIN', 'TO', hourWord];
    default: return [hourWord, 'OCLOCK'];
  }
}

function to12Hour(hours24) {
  const h = hours24 % 12;
  return h === 0 ? 12 : h;
}

/**
 * @param {Date} date
 * @param {{ showItIs?: boolean }} [opts]
 * @returns {{ words: string[], litKeys: Set<string>, dots: number, bucket: number, hour: number }}
 */
export function timeToWords(date, { showItIs = true } = {}) {
  const minutes = date.getMinutes();
  const hours24 = date.getHours();

  const bucket = Math.floor(minutes / 5) * 5;
  const dots = minutes - bucket; // 0..4

  // From :35 onward the phrase reads "... TO <next hour>".
  const baseHour24 = bucket >= 35 ? hours24 + 1 : hours24;
  const hour = to12Hour(baseHour24);
  const hourWord = HOUR_WORDS[hour];

  const words = [];
  if (showItIs) words.push('IT', 'IS');
  words.push(...phraseFor(bucket, hourWord));

  const litKeys = new Set();
  for (const name of words) {
    for (const { row, col } of WORDS[name]) litKeys.add(`${row}-${col}`);
  }

  return { words, litKeys, dots, bucket, hour };
}

/** Human-readable phrase, e.g. "IT IS HALF PAST TEN". */
export function timeToPhrase(date, opts) {
  return timeToWords(date, opts).words.map((w) => WORD_TEXT[w]).join(' ');
}
