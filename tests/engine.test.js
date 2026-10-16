'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { analyze } = require('../js/engine.js');
const { DEMO_PACKETS } = require('../js/demo-packets.js');
const { Fraction } = require('../js/fraction.js');

const clone = (x) => JSON.parse(JSON.stringify(x));
const packet = (id) => clone(DEMO_PACKETS.find((p) => p.id === id));
const codes = (r, kind) => r.findings.filter((f) => !kind || f.kind === kind).map((f) => f.code);

test('demo A: seller packet -> unexplained change, uncovered years, no contradiction, offer exceeds chain', () => {
  const r = analyze(packet('demo-a'));
  assert.equal(r.summary.contradictions, 0);
  assert.deepEqual(codes(r, 'missing').sort(), ['M_COVERAGE_GAP', 'M_UNCERTIFIED', 'M_UNEXPLAINED']);
  assert.ok(r.offer.chain.held.eq(35));
  assert.equal(r.offer.chain.status, 'exceeds');
  assert.ok(r.offer.record.held.eq(50));
  assert.equal(r.offer.record.status, 'within');
  assert.deepEqual(r.coverage.gaps, [[1962, 2026]]);
});

test('demo A: an unexplained change is reported as missing evidence, never as a contradiction', () => {
  const r = analyze(packet('demo-a'));
  const f = r.findings.find((x) => x.code === 'M_UNEXPLAINED');
  assert.equal(f.kind, 'missing');
  assert.ok(f.params.diffs.some((d) => d.name === 'Rokeya' && d.recorded === '0'));
});

test('demo B: registry search + deed -> over-commitment against BS-512 and account drops to 15', () => {
  const r = analyze(packet('demo-b'));
  assert.deepEqual(codes(r, 'contradiction'), ['C_BASIS_OVERCOMMIT']);
  assert.ok(r.offer.chain.held.eq(15));
  assert.ok(r.offer.record.held.eq(30));
  assert.ok(codes(r, 'missing').includes('M_DEED_NO_MUTATION'));
  assert.deepEqual(r.coverage.gaps, [[1962, 2004], [2016, 2026]]);
});

test('removing the deed from packet B does not "detect" it: the search still lists it as not supplied', () => {
  const p = packet('demo-b');
  p.docs = p.docs.filter((d) => d.id !== 'd-4417');
  const r = analyze(p);
  assert.equal(r.summary.contradictions, 0);
  assert.ok(codes(r, 'missing').includes('M_SEARCH_DEED_NOT_SUPPLIED'));
  assert.ok(r.offer.chain.held.eq(35), 'the account is based only on supplied documents');
});

test('removing the search too leaves only the coverage gap: no hidden knowledge of the 2011 sale', () => {
  const p = packet('demo-b');
  p.docs = p.docs.filter((d) => d.id !== 'd-4417' && d.id !== 's-2005');
  const r = analyze(p);
  assert.deepEqual(r.coverage.gaps, [[1962, 2026]]);
  assert.ok(!JSON.stringify(r.findings).includes('4417'));
});

test('demo C: predeceased son with unknown issue -> missing info, chain undetermined, record still compared', () => {
  const r = analyze(packet('demo-c'));
  assert.deepEqual(codes(r), ['M_ESTATE_INFO']);
  assert.equal(r.offer.chain.status, 'undetermined');
  assert.deepEqual(r.offer.chain.pending, ['Hasan']);
  assert.equal(r.offer.record.status, 'within');
});

test('demo C: stating "no surviving children" computes the estate and matches BS-641 exactly', () => {
  const p = packet('demo-c');
  p.docs.find((d) => d.id === 'h-hasan').heirs.find((h) => h.name === 'Kamal').childrenSurvived = 'no';
  const r = analyze(p);
  assert.equal(r.findings.length, 0);
  assert.ok(r.offer.chain.held.eq(35));
});

test('demo C: stating "yes" routes to review and computes nothing', () => {
  const p = packet('demo-c');
  p.docs.find((d) => d.id === 'h-hasan').heirs.find((h) => h.name === 'Kamal').childrenSurvived = 'yes';
  const r = analyze(p);
  assert.deepEqual(codes(r, 'review'), ['U_INHERITANCE']);
  assert.equal(r.offer.chain.status, 'undetermined');
});

test('contradictions: dead seller, split mismatch, mutation before deed, search omits deed', () => {
  const p = packet('demo-b');
  const deed = p.docs.find((d) => d.id === 'd-4417');
  deed.deedNo = '9999/2010';          // inside the 2005-2015 search window but not listed by it
  deed.year = 2010;
  deed.sellers = [{ name: 'Karim', area: '20' }]; // Karim died in 1985
  deed.buyers = [{ name: 'Farid', area: '25' }];  // split mismatch
  p.docs.push({ id: 'm1', type: 'mutation', caseNo: 'M-1', year: 2009, deedNo: '9999/2010', transferees: 'Farid' });
  const r = analyze(p);
  const c = codes(r, 'contradiction');
  for (const expected of ['C_DEAD_SELLER', 'C_DEED_SPLIT', 'C_MUTATION_BEFORE_DEED', 'C_SEARCH_OMITS']) {
    assert.ok(c.includes(expected), `expected ${expected} in ${c}`);
  }
});

test('khatian whose shares do not sum to 1 is a contradiction', () => {
  const p = packet('demo-a');
  p.docs.find((d) => d.id === 'k-bs512').owners[0].share = '3/4';
  assert.ok(codes(analyze(p), 'contradiction').includes('C_SUM'));
});

test('malformed numbers become input errors, not silent zeros', () => {
  const p = packet('demo-a');
  p.docs.find((d) => d.id === 'k-sa87').area = 'one hundred';
  const r = analyze(p);
  assert.equal(r.inputErrors.length, 1);
  assert.equal(r.inputErrors[0].field, 'area');
});

test('stated shares on a certificate are used and compared with the calculation', () => {
  const p = packet('demo-a');
  const h = p.docs.find((d) => d.id === 'h-karim');
  h.heirs.forEach((x) => { x.statedShare = { Amena: '1/8', Rahim: '7/20', Salim: '7/20', Rokeya: '7/40' }[x.name]; });
  let r = analyze(p);
  assert.ok(!codes(r).includes('U_STATED_DIFF'));
  assert.equal(r.estates[0].used, 'stated');
  h.heirs.find((x) => x.name === 'Rokeya').statedShare = '1/4';
  h.heirs.find((x) => x.name === 'Rahim').statedShare = '11/40';
  r = analyze(p);
  assert.ok(codes(r, 'review').includes('U_STATED_DIFF'));
});

test('area changes between surveys convert shares by the area in force', () => {
  const p = packet('demo-a');
  p.docs.find((d) => d.id === 'k-bs512').area = '98';
  const r = analyze(p);
  assert.ok(r.offer.plotArea.eq(98));
  assert.ok(r.offer.record.held.eq(49));
  assert.ok(r.assumptions.some((a) => a.code === 'A_AREA_CHANGES'));
});

test('empty packet produces M_NO_ROOT and no crash', () => {
  const r = analyze({ docs: [], offer: {}, plot: {} });
  assert.deepEqual(codes(r), ['M_NO_ROOT']);
  assert.equal(r.offer, null);
});

test('checklist maps each missing finding to a document with an explanation key', () => {
  const r = analyze(packet('demo-b'));
  const items = r.checklist.map((c) => c.item);
  for (const k of ['transfer_records', 'mutation_record', 'registry_search', 'resolve_conflict', 'certified_copies']) assert.ok(items.includes(k), k);
});

test('all exported shares are Fractions, never floats', () => {
  const r = analyze(packet('demo-b'));
  for (const ev of r.timeline) for (const h of (ev.chain || [])) assert.ok(h.share instanceof Fraction);
});

test('engine reports its version and the same-year ordering assumption only when years are shared', () => {
  const { ENGINE_VERSION } = require('../js/engine.js');
  const r = analyze(packet('demo-b'));
  assert.equal(r.engineVersion, ENGINE_VERSION);
  assert.ok(!r.assumptions.some((a) => a.code === 'A_YEAR_ORDER'), 'demo-b has no shared years');
  const p = packet('demo-b'); p.docs.find((d) => d.id === 'd-4417').year = 1998; // same year as the BS khatian
  const r2 = analyze(p);
  const a = r2.assumptions.find((x) => x.code === 'A_YEAR_ORDER');
  assert.ok(a && a.params.years.includes('1998'));
});

test('Bangla digits are accepted in numeric fields and years', () => {
  const p = packet('demo-a');
  p.docs.find((d) => d.id === 'k-sa87').area = '১০০';
  p.docs.find((d) => d.id === 'k-sa87').year = '১৯৬২';
  p.offer.area = '৫০';
  const r = analyze(p);
  assert.equal(r.inputErrors.length, 0);
  assert.ok(r.offer.area.eq(50));
  assert.equal(r.timeline[0].year, 1962);
});

test('revision is echoed back so views can show which revision an analysis belongs to', () => {
  const p = packet('demo-a'); p.revision = 7;
  assert.equal(analyze(p).revision, 7);
});
