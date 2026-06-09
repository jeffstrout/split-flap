// QLOCKTWO time-telling logic (FR-28, FR-29, FR-30, FR-31), language-agnostic.
// Pure functions: map a Date + a language pack to the set of lit cells, the
// active word names, and the corner-dot count. Defaults to English.

import { en } from './lang/en.js';

function to12Hour(hours24) {
  const h = hours24 % 12;
  return h === 0 ? 12 : h;
}

/**
 * @param {Date} date
 * @param {object} [pack] language pack (default English)
 * @param {{ showPrefix?: boolean }} [opts]
 * @returns {{ words: string[], litKeys: Set<string>, dots: number, bucket: number, hour: number }}
 */
export function timeToWords(date, pack = en, { showPrefix = true } = {}) {
  const minutes = date.getMinutes();
  const hours24 = date.getHours();

  const bucket = Math.floor(minutes / 5) * 5;
  const dots = minutes - bucket; // 0..4

  const hourCurrent = to12Hour(hours24);
  const hourNext = to12Hour(hours24 + 1);

  const words = pack.compose({ bucket, hourCurrent, hourNext, showPrefix });

  const litKeys = new Set();
  for (const name of words) {
    const span = pack.words[name];
    if (!span) continue;
    for (const { row, col } of span) litKeys.add(`${row}-${col}`);
  }

  return { words, litKeys, dots, bucket, hour: hourCurrent };
}

/** Human-readable phrase, e.g. "IT IS HALF PAST TEN" / "الساعة السادسة إلا خمس". */
export function timeToPhrase(date, pack = en, opts) {
  return timeToWords(date, pack, opts).words.map((w) => pack.wordText[w]).join(' ');
}
