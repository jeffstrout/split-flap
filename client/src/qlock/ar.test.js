import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timeToWords, timeToPhrase } from './timeToWords.js';
import { ar } from './lang/ar.js';

const at = (h, m) => new Date(2026, 0, 1, h, m, 0);
const phrase = (h, m, opts) => timeToPhrase(at(h, m), ar, opts);

test('arabic grid: every word span spells its word', () => {
  for (const [name, cells] of Object.entries(ar.words)) {
    const letters = cells.map(({ row, col }) => Array.from(ar.grid[row])[col]).join('');
    assert.equal(letters, ar.wordText[name], `${name}`);
  }
});

test('arabic grid rows all 15 cols', () => {
  assert.equal(ar.grid.length, 9);
  for (const row of ar.grid) assert.equal(Array.from(row).length, 15);
});

test('on the hour', () => {
  assert.equal(phrase(6, 0), 'الساعة السادسة');
  assert.equal(timeToWords(at(6, 0), ar).dots, 0);
});

test('quarter past (و الربع)', () => {
  assert.equal(phrase(3, 15), 'الساعة الثالثة و ربع');
});

test('twenty past (و الثلث)', () => {
  assert.equal(phrase(3, 20), 'الساعة الثالثة و ثلث');
});

test('half past (و النصف)', () => {
  assert.equal(phrase(3, 30), 'الساعة الثالثة و نصف');
});

test(':25 = half except five, current hour', () => {
  assert.equal(phrase(3, 25), 'الساعة الثالثة و نصف إلا خمس');
});

test(':35 = half and five, current hour', () => {
  assert.equal(phrase(3, 35), 'الساعة الثالثة و نصف و خمس');
});

test('to next hour: إلا (quarter to)', () => {
  assert.equal(phrase(5, 45), 'الساعة السادسة إلا ربع');
});

test('five to next hour', () => {
  assert.equal(phrase(5, 55), 'الساعة السادسة إلا خمس');
});

test('hour 11 uses الحادية عشرة', () => {
  assert.equal(phrase(11, 0), 'الساعة الحادية عشرة');
});

test('hour 12 uses الثانية عشرة', () => {
  assert.equal(phrase(0, 0), 'الساعة الثانية عشرة');
});

test('to-next wraps 12 -> 1 (12:40)', () => {
  assert.equal(phrase(12, 40), 'الساعة الواحدة إلا ثلث');
});

test('corner dots = minute % 5', () => {
  assert.equal(timeToWords(at(6, 58), ar).dots, 3);
  assert.equal(timeToWords(at(6, 55), ar).dots, 0);
});

test('showPrefix:false drops الساعة', () => {
  assert.equal(phrase(6, 0, { showPrefix: false }), 'السادسة');
});

test('litKeys are valid grid coordinates', () => {
  const { litKeys } = timeToWords(at(5, 45), ar);
  assert.ok(litKeys.size > 0);
  for (const key of litKeys) {
    const [r, c] = key.split('-').map(Number);
    assert.ok(r >= 0 && r < 9 && c >= 0 && c < 15);
  }
});
