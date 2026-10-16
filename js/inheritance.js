/*
 * Narrow, explicitly-scoped intestate succession calculator.
 *
 * SUPPORTED (and only this):
 *   - Decedent is Muslim; school Hanafi (or not stated -> shown as an assumption).
 *   - No bequest (will = "no", or "unknown" -> shown as an assumption).
 *   - Heirs drawn only from: husband, wife/wives, sons, daughters, father, mother.
 *   - At least one son survives the decedent.
 *   Under these conditions the fixed shares (spouse 1/4 or 1/8, each parent 1/6)
 *   total at most 7/12, so the residue always goes to the children 2:1 and the
 *   special adjustments ('awl, radd) never arise.
 *
 * Rule sources (checked by the developers, NOT reviewed by a qualified legal expert):
 *   - Qur'an 4:11 (children 2:1; each parent 1/6 when the deceased has a child)
 *   - Qur'an 4:12 (husband 1/4, wife/wives 1/8 when the deceased has a child)
 *   - Father takes only 1/6 when a son survives (son is the residuary heir):
 *     worked examples at islamweb.net cited in tests/inheritance.test.js
 *
 * Everything else is returned as "unsupported" or "missing" and no share is computed.
 */
(function (root) {
  'use strict';
  const Fraction = (typeof module !== 'undefined' && module.exports)
    ? require('./fraction.js').Fraction
    : root.Sutro.Fraction;

  const RULES_STATUS = 'pending-qualified-review';
  const RULE_SOURCES = [
    { id: 'Q4:11', text: "Qur'an 4:11" },
    { id: 'Q4:12', text: "Qur'an 4:12" },
    { id: 'IW', text: 'islamweb.net worked examples (see README)' }
  ];

  const RELATIONS = ['husband', 'wife', 'son', 'daughter', 'father', 'mother', 'other'];

  /*
   * cert: { decedent, religion, school, will, heirs:[{name, relation, status, childrenSurvived}] }
   * Returns { status, reasons:[{code, params}], assumptions:[code], shares:[{name, relation, share, basis}],
   *           excluded:[{name, reason}] }
   * status: 'computed' | 'unsupported' | 'missing' | 'invalid'
   */
  function computeEstate(cert) {
    const out = { status: 'computed', reasons: [], assumptions: [], shares: [], excluded: [] };
    const heirs = Array.isArray(cert.heirs) ? cert.heirs : [];
    const unsupported = (code, params) => out.reasons.push({ kind: 'unsupported', code, params: params || {} });
    const missing = (code, params) => out.reasons.push({ kind: 'missing', code, params: params || {} });
    const invalid = (code, params) => out.reasons.push({ kind: 'invalid', code, params: params || {} });

    // Religion and school
    const religion = cert.religion || 'unknown';
    if (religion === 'unknown') missing('religion_unknown');
    else if (religion !== 'muslim') unsupported('religion_other', { religion });
    const school = cert.school || 'unknown';
    if (religion === 'muslim') {
      if (school === 'unknown') out.assumptions.push('school_assumed_hanafi');
      else if (school !== 'hanafi') unsupported('school_other', { school });
    }
    const will = cert.will || 'unknown';
    if (will === 'yes') unsupported('will_yes');
    else if (will === 'unknown') out.assumptions.push('no_bequest_assumed');

    if (heirs.length === 0) missing('no_heirs_listed');

    // Classify heirs
    const surviving = [];
    for (const h of heirs) {
      const name = (h.name || '').trim();
      const rel = h.relation;
      if (!name) { invalid('heir_without_name'); continue; }
      if (!RELATIONS.includes(rel)) { invalid('unknown_relation', { name }); continue; }
      if (rel === 'other') { unsupported('other_relative', { name }); continue; }
      if (h.status === 'predeceased') {
        if (rel === 'son' || rel === 'daughter') {
          // A predeceased child matters only if they left children who survived the decedent
          // (Muslim Family Laws Ordinance 1961, s.4). That fact must be supplied, not inferred.
          const cs = h.childrenSurvived || 'unknown';
          if (cs === 'yes') unsupported('predeceased_child_with_issue', { name });
          else if (cs === 'unknown') missing('predeceased_child_issue_unknown', { name });
          else out.excluded.push({ name, reason: 'predeceased_no_issue' });
        } else {
          out.excluded.push({ name, reason: 'predeceased_not_heir' });
        }
        continue;
      }
      surviving.push({ name, relation: rel });
    }

    const count = (r) => surviving.filter((h) => h.relation === r).length;
    const nHusband = count('husband'), nWife = count('wife');
    const nSon = count('son'), nDaughter = count('daughter');
    const nFather = count('father'), nMother = count('mother');

    if (nHusband > 1) invalid('multiple_husbands');
    if (nHusband > 0 && nWife > 0) invalid('husband_and_wife');
    if (nWife > 4) invalid('too_many_wives');
    if (nFather > 1) invalid('multiple_fathers');
    if (nMother > 1) invalid('multiple_mothers');
    if (heirs.length > 0 && nSon === 0 && !out.reasons.some((r) => r.code === 'predeceased_child_issue_unknown')) {
      unsupported('no_surviving_son');
    }

    if (out.reasons.some((r) => r.kind === 'invalid')) out.status = 'invalid';
    else if (out.reasons.some((r) => r.kind === 'unsupported')) out.status = 'unsupported';
    else if (out.reasons.some((r) => r.kind === 'missing')) out.status = 'missing';
    if (out.status !== 'computed') { out.assumptions = []; return out; }

    // Fixed shares (a child -- at least one son -- is always present in supported cases)
    let fixed = Fraction.ZERO;
    if (nHusband === 1) {
      const h = surviving.find((x) => x.relation === 'husband');
      out.shares.push({ name: h.name, relation: 'husband', share: new Fraction(1, 4), basis: 'Q4:12' });
      fixed = fixed.add(new Fraction(1, 4));
    }
    if (nWife > 0) {
      const each = new Fraction(1, 8).div(nWife);
      for (const w of surviving.filter((x) => x.relation === 'wife')) {
        out.shares.push({ name: w.name, relation: 'wife', share: each, basis: 'Q4:12' });
      }
      fixed = fixed.add(new Fraction(1, 8));
    }
    for (const rel of ['father', 'mother']) {
      const p = surviving.find((x) => x.relation === rel);
      if (p) {
        out.shares.push({ name: p.name, relation: rel, share: new Fraction(1, 6), basis: rel === 'father' ? 'Q4:11+IW' : 'Q4:11' });
        fixed = fixed.add(new Fraction(1, 6));
      }
    }
    // Residue to children, son = 2 units, daughter = 1 unit
    const residue = Fraction.ONE.sub(fixed);
    const units = BigInt(2 * nSon + nDaughter);
    const unit = residue.div(new Fraction(units));
    for (const c of surviving.filter((x) => x.relation === 'son' || x.relation === 'daughter')) {
      out.shares.push({
        name: c.name,
        relation: c.relation,
        share: c.relation === 'son' ? unit.mul(2) : unit,
        basis: 'Q4:11'
      });
    }
    return out;
  }

  const api = { computeEstate, RULES_STATUS, RULE_SOURCES };
  root.Sutro = Object.assign(root.Sutro || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
