'use strict';
/*
 * Inheritance tests.
 *
 * The "ref:" cases are copied from worked examples published by islamweb.net (a Sunni fatwa
 * site), authored independently of this code. They are NOT a review by a qualified legal
 * expert and NOT specific to Bangladesh courts. Islamweb is not exclusively Hanafi; the heir
 * combinations used here follow directly from Qur'an 4:11-12 and are not, to our knowledge,
 * disputed between Sunni schools. A qualified reviewer should still confirm them.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { computeEstate } = require('../js/inheritance.js');
const { Fraction } = require('../js/fraction.js');

const H = (name, relation, extra) => Object.assign({ name, relation, status: 'survived' }, extra || {});
const cert = (heirs, extra) => Object.assign({ religion: 'muslim', school: 'hanafi', will: 'no', heirs }, extra || {});
const shareOf = (res, name) => res.shares.find((s) => s.name === name).share;
const sum = (res) => res.shares.reduce((a, s) => a.add(s.share), Fraction.ZERO);

/* ---------- External reference cases (independently authored) ---------- */

test('ref: wife, father, mother, one son, one daughter (islamweb.net printfatwa id=137655, 2010-07-08) -> 9,12,12,26,13 of 72', () => {
  const r = computeEstate(cert([H('W', 'wife'), H('F', 'father'), H('M', 'mother'), H('S', 'son'), H('D', 'daughter')]));
  assert.equal(r.status, 'computed');
  assert.ok(shareOf(r, 'W').eq(new Fraction(9, 72)));
  assert.ok(shareOf(r, 'F').eq(new Fraction(12, 72)));
  assert.ok(shareOf(r, 'M').eq(new Fraction(12, 72)));
  assert.ok(shareOf(r, 'S').eq(new Fraction(26, 72)));
  assert.ok(shareOf(r, 'D').eq(new Fraction(13, 72)));
});

test('ref: father, wife, two sons, two daughters (islamweb.net printfatwa id=158473, 2011-06-13) -> 24,18,34,34,17,17 of 144', () => {
  const r = computeEstate(cert([H('F', 'father'), H('W', 'wife'), H('S1', 'son'), H('S2', 'son'), H('D1', 'daughter'), H('D2', 'daughter')]));
  assert.equal(r.status, 'computed');
  assert.ok(shareOf(r, 'F').eq(new Fraction(24, 144)));
  assert.ok(shareOf(r, 'W').eq(new Fraction(18, 144)));
  assert.ok(shareOf(r, 'S1').eq(new Fraction(34, 144)));
  assert.ok(shareOf(r, 'D2').eq(new Fraction(17, 144)));
});

test('ref: husband, mother, three sons, two daughters (islamweb.net printfatwa id=259396, 2014-07-17) -> 24,16,14x3,7x2 of 96', () => {
  const r = computeEstate(cert([H('Hb', 'husband'), H('M', 'mother'), H('S1', 'son'), H('S2', 'son'), H('S3', 'son'), H('D1', 'daughter'), H('D2', 'daughter')]));
  assert.equal(r.status, 'computed');
  assert.ok(shareOf(r, 'Hb').eq(new Fraction(24, 96)));
  assert.ok(shareOf(r, 'M').eq(new Fraction(16, 96)));
  assert.ok(shareOf(r, 'S3').eq(new Fraction(14, 96)));
  assert.ok(shareOf(r, 'D1').eq(new Fraction(7, 96)));
});

test('ref: wife, one son, three daughters (islamweb.net printfatwa id=139516, 2010-08-21) -> 5,14,7x3 of 40', () => {
  const r = computeEstate(cert([H('W', 'wife'), H('S', 'son'), H('D1', 'daughter'), H('D2', 'daughter'), H('D3', 'daughter')]));
  assert.equal(r.status, 'computed');
  assert.ok(shareOf(r, 'W').eq(new Fraction(5, 40)));
  assert.ok(shareOf(r, 'S').eq(new Fraction(14, 40)));
  assert.ok(shareOf(r, 'D3').eq(new Fraction(7, 40)));
});

/* ---------- Internal consistency (same-author tests; not independent evidence) ---------- */

test('every supported combination distributes exactly the whole estate, son = 2 x daughter', () => {
  let checked = 0;
  for (const spouse of [null, 'husband', 'wife1', 'wife2', 'wife4']) {
    for (const father of [false, true]) for (const mother of [false, true]) {
      for (let sons = 1; sons <= 3; sons++) for (let daughters = 0; daughters <= 3; daughters++) {
        const heirs = [];
        if (spouse === 'husband') heirs.push(H('Hb', 'husband'));
        if (spouse && spouse.startsWith('wife')) for (let i = 0; i < +spouse.slice(4); i++) heirs.push(H('W' + i, 'wife'));
        if (father) heirs.push(H('F', 'father'));
        if (mother) heirs.push(H('M', 'mother'));
        for (let i = 0; i < sons; i++) heirs.push(H('S' + i, 'son'));
        for (let i = 0; i < daughters; i++) heirs.push(H('D' + i, 'daughter'));
        const r = computeEstate(cert(heirs));
        assert.equal(r.status, 'computed');
        assert.ok(sum(r).eq(1), 'sum must be 1');
        if (daughters) assert.ok(shareOf(r, 'S0').eq(shareOf(r, 'D0').mul(2)));
        checked++;
      }
    }
  }
  assert.equal(checked, 5 * 4 * 3 * 4);
});

test('the demo family: wife, two sons, one daughter -> 1/8, 7/20, 7/20, 7/40', () => {
  const r = computeEstate(cert([H('Amena', 'wife'), H('Rahim', 'son'), H('Salim', 'son'), H('Rokeya', 'daughter')]));
  assert.ok(shareOf(r, 'Amena').eq(new Fraction(1, 8)));
  assert.ok(shareOf(r, 'Rahim').eq(new Fraction(7, 20)));
  assert.ok(shareOf(r, 'Rokeya').eq(new Fraction(7, 40)));
});

/* ---------- Refusals: unsupported scenarios are routed, never guessed ---------- */

const refuse = (heirs, extra, expectStatus, expectCode) => {
  const r = computeEstate(cert(heirs, extra));
  assert.equal(r.status, expectStatus);
  assert.ok(r.reasons.some((x) => x.code === expectCode), `expected reason ${expectCode}, got ${r.reasons.map((x) => x.code)}`);
  assert.equal(r.shares.length, 0, 'no shares may be computed when refusing');
};

test('no surviving son -> unsupported (residue/radd/awl not implemented)', () => {
  refuse([H('W', 'wife'), H('D', 'daughter')], {}, 'unsupported', 'no_surviving_son');
  refuse([H('Hb', 'husband'), H('F', 'father'), H('M', 'mother'), H('D1', 'daughter'), H('D2', 'daughter')], {}, 'unsupported', 'no_surviving_son');
});
test('relatives outside the set -> unsupported', () => refuse([H('S', 'son'), H('B', 'other')], {}, 'unsupported', 'other_relative'));
test('will recorded -> unsupported', () => refuse([H('S', 'son')], { will: 'yes' }, 'unsupported', 'will_yes'));
test('non-Muslim succession -> unsupported', () => refuse([H('S', 'son')], { religion: 'hindu' }, 'unsupported', 'religion_other'));
test('religion not stated -> missing', () => refuse([H('S', 'son')], { religion: 'unknown' }, 'missing', 'religion_unknown'));
test('non-Hanafi school -> unsupported', () => refuse([H('S', 'son')], { school: 'other' }, 'unsupported', 'school_other'));
test('husband and wife both listed -> invalid', () => refuse([H('Hb', 'husband'), H('W', 'wife'), H('S', 'son')], {}, 'invalid', 'husband_and_wife'));

test('a predeceased son by itself does NOT establish an orphaned-grandchild case', () => {
  const base = [H('W', 'wife'), H('J', 'son'), H('N', 'daughter')];
  refuse(base.concat([H('K', 'son', { status: 'predeceased', childrenSurvived: 'unknown' })]), {}, 'missing', 'predeceased_child_issue_unknown');
  const r = computeEstate(cert(base.concat([H('K', 'son', { status: 'predeceased', childrenSurvived: 'no' })])));
  assert.equal(r.status, 'computed');
  assert.ok(r.excluded.some((x) => x.name === 'K' && x.reason === 'predeceased_no_issue'));
  assert.ok(shareOf(r, 'J').eq(new Fraction(7, 12)));
  refuse(base.concat([H('K', 'son', { status: 'predeceased', childrenSurvived: 'yes' })]), {}, 'unsupported', 'predeceased_child_with_issue');
});

test('unknown school/will are surfaced as assumptions, not silently applied', () => {
  const r = computeEstate(cert([H('S', 'son')], { school: 'unknown', will: 'unknown' }));
  assert.equal(r.status, 'computed');
  assert.deepEqual(r.assumptions.sort(), ['no_bequest_assumed', 'school_assumed_hanafi']);
});
