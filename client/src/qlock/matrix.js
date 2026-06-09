// QLOCKTWO Classic — English letter matrix (11 columns x 10 rows, FR-27).
//
// The full grid is always rendered; words below are illuminated to tell the
// time. Letters not part of any word are "filler" and are never lit — their
// exact glyphs are cosmetic. Each word maps to its cells as {row, col}
// (0-indexed). Two distinct FIVE/TEN words exist: the minute words (rows 2-3)
// and the hour words (rows 6, 9), suffixed _MIN / _HR.

export const COLS = 11;
export const ROWS = 10;

export const GRID = [
  'ITLISASAMPM', // 0
  'ACQUARTERDC', // 1
  'TWENTYFIVEX', // 2
  'HALFBTENFTO', // 3
  'PASTERUNINE', // 4
  'ONESIXTHREE', // 5
  'FOURFIVETWO', // 6
  'EIGHTELEVEN', // 7
  'SEVENTWELVE', // 8
  'TENSEOCLOCK', // 9
];

// Inclusive horizontal span of cells on a single row.
function span(row, start, end) {
  const cells = [];
  for (let col = start; col <= end; col++) cells.push({ row, col });
  return cells;
}

export const WORDS = {
  IT: span(0, 0, 1),
  IS: span(0, 3, 4),
  A: span(1, 0, 0),
  QUARTER: span(1, 2, 8),
  TWENTY: span(2, 0, 5),
  FIVE_MIN: span(2, 6, 9),
  HALF: span(3, 0, 3),
  TEN_MIN: span(3, 5, 7),
  TO: span(3, 9, 10),
  PAST: span(4, 0, 3),
  NINE: span(4, 7, 10),
  ONE: span(5, 0, 2),
  SIX: span(5, 3, 5),
  THREE: span(5, 6, 10),
  FOUR: span(6, 0, 3),
  FIVE_HR: span(6, 4, 7),
  TWO: span(6, 8, 10),
  EIGHT: span(7, 0, 4),
  ELEVEN: span(7, 5, 10),
  SEVEN: span(8, 0, 4),
  TWELVE: span(8, 5, 10),
  TEN_HR: span(9, 0, 2),
  OCLOCK: span(9, 5, 10),
};

// 12-hour clock -> hour word name.
export const HOUR_WORDS = {
  1: 'ONE', 2: 'TWO', 3: 'THREE', 4: 'FOUR', 5: 'FIVE_HR', 6: 'SIX',
  7: 'SEVEN', 8: 'EIGHT', 9: 'NINE', 10: 'TEN_HR', 11: 'ELEVEN', 12: 'TWELVE',
};

// Word name -> human-readable text (for debug / phrase rendering).
export const WORD_TEXT = {
  IT: 'IT', IS: 'IS', A: 'A', QUARTER: 'QUARTER', TWENTY: 'TWENTY',
  FIVE_MIN: 'FIVE', TEN_MIN: 'TEN', HALF: 'HALF', TO: 'TO', PAST: 'PAST',
  OCLOCK: "O'CLOCK", ONE: 'ONE', TWO: 'TWO', THREE: 'THREE', FOUR: 'FOUR',
  FIVE_HR: 'FIVE', SIX: 'SIX', SEVEN: 'SEVEN', EIGHT: 'EIGHT', NINE: 'NINE',
  TEN_HR: 'TEN', ELEVEN: 'ELEVEN', TWELVE: 'TWELVE',
};
