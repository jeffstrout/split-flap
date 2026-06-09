import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timeToWords, timeToPhrase } from './timeToWords.js';
import { GRID, WORDS, WORD_TEXT } from './matrix.js';

const at = (h, m) => new Date(2026, 0, 1, h, m, 0);

test('grid is 10 rows x 11 cols', () => {
  assert.equal(GRID.length, 10);
  for (const row of GRID) assert.equal(row.length, 11);
});

test('every word span maps to the expected letters', () => {
  for (const [name, cells] of Object.entries(WORDS)) {
    const letters = cells.map(({ row, col }) => GRID[row][col]).join('');
    const expected = WORD_TEXT[name].replace(/[^A-Z]/g, ''); // OCLOCK from O'CLOCK
    assert.equal(letters, expected, `${name} -> ${letters} != ${expected}`);
  }
});

test('on the hour: O\'CLOCK', () => {
  assert.equal(timeToPhrase(at(9, 0)), 'IT IS NINE O\'CLOCK');
  assert.equal(timeToWords(at(9, 0)).dots, 0);
});

test('half past', () => {
  assert.equal(timeToPhrase(at(10, 30)), 'IT IS HALF PAST TEN');
});

test('twenty five to next hour', () => {
  assert.equal(timeToPhrase(at(10, 35)), 'IT IS TWENTY FIVE TO ELEVEN');
});

test('a quarter to, hour wraps 12 -> 1', () => {
  assert.equal(timeToPhrase(at(12, 45)), 'IT IS A QUARTER TO ONE');
});

test('a quarter past', () => {
  assert.equal(timeToPhrase(at(15, 15)), 'IT IS A QUARTER PAST THREE');
});

test('midnight reads twelve', () => {
  assert.equal(timeToPhrase(at(0, 0)), 'IT IS TWELVE O\'CLOCK');
});

test('noon reads twelve', () => {
  assert.equal(timeToPhrase(at(12, 0)), 'IT IS TWELVE O\'CLOCK');
});

test('corner dots = minute % 5', () => {
  assert.equal(timeToWords(at(10, 13)).dots, 3);
  assert.equal(timeToPhrase(at(10, 13)), 'IT IS TEN PAST TEN');
  assert.equal(timeToWords(at(10, 14)).dots, 4);
  assert.equal(timeToWords(at(10, 10)).dots, 0);
});

test('five past / twenty five past', () => {
  assert.equal(timeToPhrase(at(1, 5)), 'IT IS FIVE PAST ONE');
  assert.equal(timeToPhrase(at(1, 25)), 'IT IS TWENTY FIVE PAST ONE');
});

test('ten to / five to / twenty to', () => {
  assert.equal(timeToPhrase(at(7, 50)), 'IT IS TEN TO EIGHT');
  assert.equal(timeToPhrase(at(7, 55)), 'IT IS FIVE TO EIGHT');
  assert.equal(timeToPhrase(at(7, 40)), 'IT IS TWENTY TO EIGHT');
});

test('showItIs:false drops the prefix', () => {
  assert.equal(timeToPhrase(at(10, 30), { showItIs: false }), 'HALF PAST TEN');
  assert.ok(!timeToWords(at(10, 30), { showItIs: false }).litKeys.has('0-0'));
});

test('litKeys are valid grid coordinates', () => {
  const { litKeys } = timeToWords(at(10, 35));
  for (const key of litKeys) {
    const [r, c] = key.split('-').map(Number);
    assert.ok(r >= 0 && r < 10 && c >= 0 && c < 11);
  }
});
