'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Fraction } = require('../js/fraction.js');

test('parses integers, fractions and decimals exactly', () => {
  assert.equal(Fraction.from('1/2').toString(), '1/2');
  assert.equal(Fraction.from('4/8').toString(), '1/2');
  assert.equal(Fraction.from('17.5').toString(), '35/2');
  assert.equal(Fraction.from(12).toString(), '12');
  assert.equal(Fraction.from(' 7 / 24 ').toString(), '7/24');
});

test('rejects malformed input instead of guessing', () => {
  for (const bad of ['', 'abc', '1/0', '1//2', '0.5.1', '½']) {
    assert.equal(Fraction.tryFrom(bad), null, `should reject "${bad}"`);
  }
});

test('arithmetic is exact (no floating point drift)', () => {
  assert.ok(Fraction.from('0.1').add('0.2').eq('0.3'));
  assert.ok(new Fraction(1, 3).mul(3).eq(1));
  let s = Fraction.ZERO;
  for (let i = 0; i < 7; i++) s = s.add(new Fraction(1, 7));
  assert.ok(s.eq(Fraction.ONE));
});

test('decimal rendering marks rounding', () => {
  assert.equal(Fraction.from('35/2').toDecimal(2), '17.5');
  assert.equal(new Fraction(100, 3).toDecimal(2), '33.33');
  assert.equal(new Fraction(100, 3).isExactDecimal(2), false);
  assert.equal(Fraction.from('12.5').isExactDecimal(2), true);
});

test('accepts Bangla digits (raw text is kept by the caller)', () => {
  assert.ok(Fraction.from('৭/৪০').eq(new Fraction(7, 40)));
  assert.ok(Fraction.from('১৭.৫').eq(new Fraction(35, 2)));
  assert.ok(Fraction.from('১০০').eq(100));
});
