/*
 * Sutro analysis engine.
 *
 * Input: a "packet" = the documents a buyer has actually been given (or obtained),
 * entered as structured data, plus the proposed sale ("offer").
 * The engine sees ONLY the packet. It never assumes that an event which is not in
 * the packet did not happen: absence is reported as missing evidence.
 *
 * Output keeps three questions apart:
 *   contradiction - two supplied documents (or one document internally) make
 *                   claims that cannot both be true as written
 *   missing       - the supplied documents leave something unexplained or uncovered
 *   review        - the scenario is outside what Sutro supports; a person must decide
 * Legal ownership is never determined.
 */
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const Fraction = isNode ? require('./fraction.js').Fraction : root.Sutro.Fraction;
  const computeEstate = isNode ? require('./inheritance.js').computeEstate : root.Sutro.computeEstate;

  const TYPE_ORDER = { death: 0, deed: 1, mutation: 2, khatian: 3 };
  const ENGINE_VERSION = '0.4.0';
  const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
  /* Bangla digits are accepted everywhere a number is read; the raw text stays in the packet untouched. */
  function asciiDigits(v) { return String(v === undefined || v === null ? '' : v).replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d))); }

  function norm(name) { return String(name || '').normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' '); }
  function khatianKey(k) { return (k.survey || '?') + '-' + asciiDigits(k.khatianNo).trim(); }
  function intYear(v) { const s=asciiDigits(v).trim(); return /^\d{4}$/.test(s) && +s>=1600 && +s<=2200 ? +s : null; }
  function sourceFraction(v) { return typeof v === 'string' && v.length > 64 ? null : Fraction.tryFrom(v); }
  function splitList(v) {
    if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
    return String(v || '').split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
  }

  /* A ledger maps person -> exact share of the whole plot, plus "pending" estates
     whose distribution could not be computed. */
  class Ledger {
    constructor() { this.h = new Map(); this.pending = new Map(); }
    clone() {
      const l = new Ledger();
      for (const [k, v] of this.h) l.h.set(k, { name: v.name, share: v.share });
      for (const [k, v] of this.pending) l.pending.set(k, new Set(v));
      return l;
    }
    get(name) { const e = this.h.get(norm(name)); return e ? e.share : Fraction.ZERO; }
    has(name) { return this.h.has(norm(name)); }
    set(name, share) {
      const k = norm(name);
      if (share.isZero()) this.h.delete(k);
      else this.h.set(k, { name: (this.h.get(k) || {}).name || String(name).trim(), share });
    }
    add(name, share) { this.set(name, this.get(name).add(share)); }
    isPending(name) { const p = this.pending.get(norm(name)); return !!(p && p.size); }
    addPending(name, estate) {
      const k = norm(name);
      if (!this.pending.has(k)) this.pending.set(k, new Set());
      this.pending.get(k).add(estate);
      if (!this.h.has(k)) this.h.set(k, { name: String(name).trim(), share: Fraction.ZERO });
    }
    pendingOf(name) { return Array.from(this.pending.get(norm(name)) || []); }
    snapshot() {
      const rows = [];
      for (const [k, v] of this.h) {
        rows.push({ name: v.name, share: v.share, pending: Array.from(this.pending.get(k) || []) });
      }
      rows.sort((a, b) => b.share.cmp(a.share) || a.name.localeCompare(b.name));
      return rows;
    }
    total() { let t = Fraction.ZERO; for (const v of this.h.values()) t = t.add(v.share); return t; }
  }

  function analyze(packet) {
    const docs = Array.isArray(packet.docs) ? packet.docs : [];
    const asOfYear = intYear(packet.asOfYear) ?? 1600;
    const findings = [];
    const inputErrors = [];
    const timeline = [];
    const estates = [];
    const add = (kind, code, params, docIds) => {
      findings.push({ kind, code, params: params || {}, docs: (docIds || []).filter(Boolean) });
    };
    const inputErr = (docId, field, value) => inputErrors.push({ docId, field, value });
    if (intYear(packet.asOfYear) === null) inputErr(null, 'asOfYear', packet.asOfYear);
    const seenDocumentIds = new Set(), seenKhatianKeys = new Set(), excludedDocuments = [];

    /* ---------- Parse ---------- */
    const khatians = [];
    const deeds = [];
    const mutations = [];
    const certs = [];
    const searches = [];

    for (const d of docs) {
      if (!d || !d.id || seenDocumentIds.has(d.id)) { inputErr(d && d.id, 'document.id', d && d.id); continue; }
      seenDocumentIds.add(d.id);
      const effectiveYear = intYear(d.type === 'heirCert' ? d.deathYear : d.type === 'search' ? d.toYear : d.year);
      if (effectiveYear !== null && effectiveYear > asOfYear) { excludedDocuments.push(d.id); continue; }
      const year = intYear(d.year);
      if (d.type === 'khatian') {
        const key = khatianKey(d);
        if (seenKhatianKeys.has(key)) { inputErr(d.id, 'duplicateKhatian', key); continue; }
        seenKhatianKeys.add(key);
        const area = sourceFraction(d.area);
        if (!area || !area.gt(0)) { inputErr(d.id, 'area', d.area); continue; }
        if (year === null) { inputErr(d.id, 'year', d.year); continue; }
        const owners = [];
        for (const o of d.owners || []) {
          const s = sourceFraction(o.share);
          if (!String(o.name || '').trim()) continue;
          if (!s || s.isNegative()) { inputErr(d.id, 'share', o.share); continue; }
          owners.push({ name: String(o.name).trim(), share: s });
        }
        khatians.push({ doc: d, year, area, owners, key: khatianKey(d) });
      } else if (d.type === 'deed') {
        if (year === null) { inputErr(d.id, 'year', d.year); continue; }
        const parseParties = (list, field) => {
          const res = [];
          for (const p of list || []) {
            if (!String(p.name || '').trim()) continue;
            const a = sourceFraction(p.area);
            if (!a || !a.gt(0)) { inputErr(d.id, field, p.area); continue; }
            res.push({ name: String(p.name).trim(), area: a });
          }
          return res;
        };
        deeds.push({
          doc: d, year,
          deedNo: String(d.deedNo || '').trim(),
          sellers: parseParties(d.sellers, 'sellerArea'),
          buyers: parseParties(d.buyers, 'buyerArea'),
          basis: String(d.basisKhatian || '').trim(),
          previous: splitList(d.previousDeeds)
        });
      } else if (d.type === 'mutation') {
        if (year === null) { inputErr(d.id, 'year', d.year); continue; }
        mutations.push({ doc: d, year, deedNo: String(d.deedNo || '').trim(), transferees: splitList(d.transferees) });
      } else if (d.type === 'heirCert') {
        const dy = intYear(d.deathYear);
        if (dy === null) { inputErr(d.id, 'deathYear', d.deathYear); continue; }
        certs.push({ doc: d, year: dy, decedent: String(d.decedent || '').trim() });
      } else if (d.type === 'search') {
        const f = intYear(d.fromYear), t = intYear(d.toYear);
        if (f === null || t === null || t < f) { inputErr(d.id, 'period', (d.fromYear || '') + '-' + (d.toYear || '')); continue; }
        searches.push({ doc: d, from: f, to: Math.min(t, asOfYear), dag: String(d.dag || '').trim(), listed: splitList(d.deedsFound) });
      }
    }

    khatians.sort((a, b) => a.year - b.year);
    const khatianByKey = new Map();
    for (const k of khatians) if (!khatianByKey.has(k.key)) khatianByKey.set(k.key, k);

    /* Duplicate deed numbers */
    const deedByNo = new Map();
    const uniqueDeeds = [];
    for (const dd of deeds) {
      if (!dd.deedNo) { uniqueDeeds.push(dd); continue; }
      const prev = deedByNo.get(dd.deedNo);
      if (!prev) { deedByNo.set(dd.deedNo, dd); uniqueDeeds.push(dd); continue; }
      const sig = (x) => JSON.stringify([x.year, String(x.doc.dag || '').trim(), x.basis, x.previous.slice().sort(), x.sellers.map((s) => [norm(s.name), s.area.toString()]).sort(), x.buyers.map((s) => [norm(s.name), s.area.toString()]).sort()]);
      if (sig(prev) !== sig(dd)) add('contradiction', 'C_DUP_DEED', { deedNo: dd.deedNo }, [prev.doc.id, dd.doc.id]);
    }

    /* Plot mapping (dag per survey) */
    const mapping = (packet.plot && packet.plot.dags) || {};
    const mappedDags = new Set(Object.values(mapping).map((v) => String(v).trim()).filter(Boolean));
    for (const k of khatians) {
      const m = mapping[k.doc.survey];
      if (m && String(k.doc.dag || '').trim() && String(m).trim() !== String(k.doc.dag).trim()) {
        add('missing', 'M_DAG_UNMAPPED', { dag: k.doc.dag, survey: k.doc.survey, expected: m }, [k.doc.id]);
      }
    }
    for (const dd of uniqueDeeds) {
      const dag = String(dd.doc.dag || '').trim();
      if (dag && mappedDags.size && !mappedDags.has(dag)) {
        add('missing', 'M_DAG_UNMAPPED', { dag, survey: '', expected: Array.from(mappedDags).join(', ') }, [dd.doc.id]);
      }
    }

    /* Internal consistency of each khatian */
    for (const k of khatians) {
      const sum = k.owners.reduce((a, o) => a.add(o.share), Fraction.ZERO);
      if (!sum.eq(1)) add('contradiction', 'C_SUM', { total: sum.toString() }, [k.doc.id]);
    }

    /* Deaths */
    const deathOf = new Map();
    for (const c of certs) deathOf.set(norm(c.decedent), c);

    /* ---------- Estates ---------- */
    const estateByDoc = new Map();
    for (const c of certs) {
      const d = c.doc;
      const result = computeEstate(d);
      // Shares explicitly stated on the document (e.g. a succession certificate)
      const eligible = (d.heirs || []).filter((h) => String(h.name || '').trim() && h.status !== 'predeceased');
      let stated = null;
      const anyStated = eligible.some((h) => String(h.statedShare || '').trim());
      if (anyStated) {
        const parsed = eligible.map((h) => ({ name: String(h.name).trim(), share: sourceFraction(h.statedShare) }));
        const invalid = parsed.some((p) => !p.share || p.share.isNegative() || p.share.gt(1));
        if (invalid) {
          inputErr(d.id, 'statedShare', eligible.map(h => h.statedShare).join(', '));
          add('contradiction', 'C_STATED_INCOMPLETE', { decedent: c.decedent }, [d.id]);
        } else {
          const sum = parsed.reduce((a, p) => a.add(p.share), Fraction.ZERO);
          if (!sum.eq(1)) add('contradiction', 'C_STATED_SUM', { decedent: c.decedent, total: sum.toString() }, [d.id]);
          else stated = parsed;
        }
      }
      let used = 'none';
      let distribution = null;
      if (stated) {
        used = 'stated';
        distribution = stated;
        if (result.status === 'computed') {
          const diffs = [];
          for (const s of stated) {
            const cpt = result.shares.find((x) => norm(x.name) === norm(s.name));
            const cv = cpt ? cpt.share : Fraction.ZERO;
            if (!cv.eq(s.share)) diffs.push({ name: s.name, stated: s.share.toString(), computed: cv.toString() });
          }
          if (diffs.length) add('review', 'U_STATED_DIFF', { decedent: c.decedent, diffs }, [d.id]);
        } else {
          add('review', 'U_STATED_USED', { decedent: c.decedent }, [d.id]);
        }
      } else if (result.status === 'computed') {
        used = 'computed';
        distribution = result.shares.map((s) => ({ name: s.name, share: s.share }));
      }
      for (const r of result.reasons) {
        const params = Object.assign({ decedent: c.decedent, reason: r.code }, r.params);
        if (r.kind === 'unsupported') add('review', 'U_INHERITANCE', params, [d.id]);
        else if (r.kind === 'missing') add('missing', 'M_ESTATE_INFO', params, [d.id]);
        else add('contradiction', 'C_CERT_INVALID', params, [d.id]);
      }
      const est = { docId: d.id, decedent: c.decedent, year: c.year, result, used, stated, distribution };
      estates.push(est);
      estateByDoc.set(d.id, est);
    }

    /* ---------- Timeline replay ---------- */
    const rootK = khatians[0] || null;
    if (!rootK) add('missing', 'M_NO_ROOT', {}, []);

    const areaAt = (year) => {
      let a = rootK ? rootK.area : null;
      for (const k of khatians) if (k.year <= year) a = k.area;
      return a;
    };
    const areaChanges = new Set(khatians.map((k) => k.area.toString()));

    const events = [];
    for (const c of certs) events.push({ year: c.year, type: 'death', item: c });
    for (const dd of uniqueDeeds) events.push({ year: dd.year, type: 'deed', item: dd });
    for (const m of mutations) events.push({ year: m.year, type: 'mutation', item: m });
    for (const k of khatians) if (k !== rootK) events.push({ year: k.year, type: 'khatian', item: k });
    events.sort((a, b) => a.year - b.year || TYPE_ORDER[a.type] - TYPE_ORDER[b.type]);

    const chain = new Ledger();
    let record = new Ledger();
    if (rootK) {
      for (const o of rootK.owners) { chain.add(o.name, o.share); record.add(o.name, o.share); }
      timeline.push({
        year: rootK.year, type: 'root', docId: rootK.doc.id, notes: [],
        area: rootK.area, chain: chain.snapshot(), record: record.snapshot()
      });
    }

    const mutatedDeeds = new Set();
    const commitments = new Map(); // khatianKey|seller -> [{docId, area, kind}]
    const commit = (kKey, seller, docId, area, kind) => {
      const key = kKey + '|' + norm(seller);
      if (!commitments.has(key)) commitments.set(key, { kKey, seller, items: [] });
      commitments.get(key).items.push({ docId, area, kind });
    };

    function applyDeath(ledger, est, isChain, notes) {
      const dec = est.decedent;
      const held = ledger.get(dec);
      const inherited = ledger.pendingOf(dec);
      if (isChain && held.isZero() && inherited.length === 0) {
        add('missing', 'M_DECEDENT_NO_HOLDING', { decedent: dec }, [est.docId]);
      }
      ledger.set(dec, Fraction.ZERO);
      ledger.pending.delete(norm(dec));
      const heirsListed = (deathOf.get(norm(dec)).doc.heirs || [])
        .filter((h) => String(h.name || '').trim() && h.status !== 'predeceased')
        .map((h) => String(h.name).trim());
      if (est.distribution) {
        for (const s of est.distribution) ledger.add(s.name, held.mul(s.share));
        for (const p of inherited) for (const h of heirsListed) ledger.addPending(h, p);
      } else {
        for (const h of heirsListed) ledger.addPending(h, dec);
        for (const p of inherited) for (const h of heirsListed) ledger.addPending(h, p);
        if (isChain) notes.push({ code: 'estate_unresolved', params: { decedent: dec } });
      }
    }

    function applyDeed(ledger, dd, isChain, notes) {
      const area = areaAt(dd.year);
      if (!area) return;
      for (const s of dd.sellers) {
        const share = s.area.div(area);
        const have = ledger.get(s.name);
        if (have.lt(share)) {
          if (ledger.isPending(s.name)) {
            notes.push({ code: isChain ? 'chain_depends_on_estate' : 'record_depends_on_estate', params: { name: s.name } });
          } else {
            add('missing', isChain ? 'M_CHAIN_SHORTFALL' : 'M_RECORD_SHORTFALL',
              { seller: s.name, deedNo: dd.deedNo, held: have.mul(area).toString(), sold: s.area.toString() }, [dd.doc.id]);
          }
          ledger.set(s.name, Fraction.ZERO);
        } else {
          ledger.set(s.name, have.sub(share));
        }
      }
      for (const b of dd.buyers) ledger.add(b.name, b.area.div(area));
    }

    for (const ev of events) {
      const notes = [];
      if (rootK && ev.year < rootK.year && ev.type !== 'khatian') {
        timeline.push({ year: ev.year, type: ev.type, docId: ev.item.doc.id, notes: [{ code: 'before_root', params: {} }],
          area: null, chain: null, record: null });
        continue;
      }
      if (ev.type === 'death') {
        const est = estateByDoc.get(ev.item.doc.id);
        if (rootK) { applyDeath(chain, est, true, notes); applyDeath(record, est, false, notes); }
      } else if (ev.type === 'deed') {
        const dd = ev.item;
        const sellTotal = dd.sellers.reduce((a, s) => a.add(s.area), Fraction.ZERO);
        const buyTotal = dd.buyers.reduce((a, s) => a.add(s.area), Fraction.ZERO);
        if (!sellTotal.eq(buyTotal)) {
          add('contradiction', 'C_DEED_SPLIT', { deedNo: dd.deedNo, sold: sellTotal.toString(), bought: buyTotal.toString() }, [dd.doc.id]);
        }
        for (const s of dd.sellers) {
          const death = deathOf.get(norm(s.name));
          if (death && death.year < dd.year) {
            add('contradiction', 'C_DEAD_SELLER', { seller: s.name, deedNo: dd.deedNo, deathYear: death.year, deedYear: dd.year }, [dd.doc.id, death.doc.id]);
          }
        }
        // Basis khatian recited in the deed
        if (dd.basis) {
          const k = khatianByKey.get(dd.basis);
          if (!k) add('missing', 'M_REF_KHATIAN', { ref: dd.basis, deedNo: dd.deedNo }, [dd.doc.id]);
          else {
            if (k.year > dd.year) add('contradiction', 'C_BASIS_LATER', { ref: dd.basis, deedNo: dd.deedNo }, [dd.doc.id, k.doc.id]);
            for (const s of dd.sellers) {
              if (!k.owners.some((o) => norm(o.name) === norm(s.name))) {
                add('contradiction', 'C_BASIS_NOT_OWNER', { seller: s.name, ref: dd.basis, deedNo: dd.deedNo }, [dd.doc.id, k.doc.id]);
              } else {
                commit(dd.basis, s.name, dd.doc.id, s.area, 'deed');
              }
            }
          }
        }
        // Previous deeds recited in the deed
        for (const pn of dd.previous) {
          const pd = deedByNo.get(pn);
          if (!pd) add('missing', 'M_REF_DEED', { ref: pn, from: dd.deedNo }, [dd.doc.id]);
          else {
            for (const s of dd.sellers) {
              if (!pd.buyers.some((b) => norm(b.name) === norm(s.name))) {
                add('contradiction', 'C_PREV_DEED_PARTY', { seller: s.name, deedNo: dd.deedNo, ref: pn }, [dd.doc.id, pd.doc.id]);
              }
            }
          }
        }
        if (rootK) { applyDeed(chain, dd, true, notes); applyDeed(record, dd, false, notes); }
      } else if (ev.type === 'mutation') {
        const m = ev.item;
        const dd = deedByNo.get(m.deedNo);
        if (!dd) add('missing', 'M_REF_DEED', { ref: m.deedNo, from: m.doc.caseNo || '' }, [m.doc.id]);
        else {
          mutatedDeeds.add(m.deedNo);
          if (m.year < dd.year) add('contradiction', 'C_MUTATION_BEFORE_DEED', { caseNo: m.doc.caseNo, deedNo: m.deedNo }, [m.doc.id, dd.doc.id]);
          const buyers = new Set(dd.buyers.map((b) => norm(b.name)));
          const odd = m.transferees.filter((t) => !buyers.has(norm(t)));
          if (odd.length) add('contradiction', 'C_MUTATION_PARTY', { caseNo: m.doc.caseNo, deedNo: m.deedNo, names: odd.join(', ') }, [m.doc.id, dd.doc.id]);
        }
      } else if (ev.type === 'khatian') {
        const k = ev.item;
        const diffs = [];
        const uncomparable = [];
        const names = new Map();
        for (const r of chain.snapshot()) names.set(norm(r.name), r.name);
        for (const o of k.owners) names.set(norm(o.name), o.name);
        for (const [key, name] of names) {
          const rec = k.owners.filter((o) => norm(o.name) === key).reduce((a, o) => a.add(o.share), Fraction.ZERO);
          if (chain.isPending(name)) { uncomparable.push(name); continue; }
          const cv = chain.get(name);
          if (!cv.eq(rec)) diffs.push({ name, chain: cv.mul(k.area).toString(), recorded: rec.mul(k.area).toString() });
        }
        if (diffs.length) {
          add('missing', 'M_UNEXPLAINED', { ref: k.key, year: k.year, diffs, uncomparable }, [k.doc.id]);
        }
        if (uncomparable.length) notes.push({ code: 'uncomparable', params: { names: uncomparable.join(', ') } });
        record = new Ledger();
        for (const o of k.owners) record.add(o.name, o.share);
      }
      timeline.push({
        year: ev.year, type: ev.type, docId: ev.item.doc.id, notes,
        area: rootK ? areaAt(ev.year) : null,
        chain: rootK ? chain.snapshot() : null,
        record: rootK ? record.snapshot() : null
      });
    }

    /* Registered transfers not reflected in any supplied mutation or later record */
    for (const dd of uniqueDeeds) {
      if (mutatedDeeds.has(dd.deedNo)) continue;
      const reflected = khatians.some((k) => k.year > dd.year &&
        dd.buyers.every((b) => k.owners.some((o) => norm(o.name) === norm(b.name))));
      if (!reflected) add('missing', 'M_DEED_NO_MUTATION', { deedNo: dd.deedNo, year: dd.year }, [dd.doc.id]);
    }

    /* ---------- Registry-search coverage ---------- */
    const coverage = { from: rootK ? rootK.year : null, to: asOfYear, covered: [], gaps: [] };
    for (const s of searches) {
      for (const dd of uniqueDeeds) {
        const dagOk = !s.dag || !String(dd.doc.dag || '').trim() || String(dd.doc.dag).trim() === s.dag;
        if (dagOk && dd.year >= s.from && dd.year <= s.to && dd.deedNo && !s.listed.includes(dd.deedNo)) {
          add('contradiction', 'C_SEARCH_OMITS', { deedNo: dd.deedNo, from: s.from, to: s.to }, [s.doc.id, dd.doc.id]);
        }
      }
      for (const n of s.listed) {
        if (!deedByNo.has(n)) add('missing', 'M_SEARCH_DEED_NOT_SUPPLIED', { deedNo: n, from: s.from, to: s.to }, [s.doc.id]);
      }
    }
    if (coverage.from !== null) {
      const wins = searches.map((s) => [Math.max(s.from, coverage.from), Math.min(s.to, coverage.to), s.doc.id])
        .filter((w) => w[0] <= w[1]).sort((a, b) => a[0] - b[0]);
      coverage.covered = wins;
      let cursor = coverage.from;
      for (const [f, t] of wins) {
        if (f > cursor) coverage.gaps.push([cursor, f - 1]);
        cursor = Math.max(cursor, t + 1);
      }
      if (cursor <= coverage.to) coverage.gaps.push([cursor, coverage.to]);
      if (coverage.gaps.length) add('missing', 'M_COVERAGE_GAP', { gaps: coverage.gaps }, []);
    }

    /* ---------- Offer ---------- */
    let offer = null;
    const o = packet.offer || {};
    const oArea = sourceFraction(o.area);
    if (String(o.area || '').trim() && (!oArea || !oArea.gt(0))) inputErr(null, 'offer.area', o.area);
    if (String(o.seller || '').trim() && oArea && oArea.gt(0) && rootK) {
      const area = areaAt(asOfYear);
      const basis = String(o.basisKhatian || '').trim();
      const evalAcc = (ledger) => {
        const held = ledger.get(o.seller).mul(area);
        const pending = ledger.pendingOf(o.seller);
        let status;
        if (oArea.gt(held)) status = pending.length ? 'undetermined' : 'exceeds';
        else status = 'within';
        return { held, pending, status };
      };
      offer = { seller: String(o.seller).trim(), area: oArea, basis, plotArea: area,
        chain: evalAcc(chain), record: evalAcc(record) };
      if (basis) {
        const k = khatianByKey.get(basis);
        if (!k) add('missing', 'M_REF_KHATIAN', { ref: basis, deedNo: '' }, []);
        else if (!k.owners.some((x) => norm(x.name) === norm(offer.seller))) {
          add('contradiction', 'C_BASIS_NOT_OWNER', { seller: offer.seller, ref: basis, deedNo: '' }, [k.doc.id]);
        } else commit(basis, offer.seller, null, oArea, 'offer');
      }
    }

    /* Double-commitment: transfers reciting the same basis record exceed what it records */
    for (const c of commitments.values()) {
      const k = khatianByKey.get(c.kKey);
      const recorded = k.owners.filter((x) => norm(x.name) === norm(c.seller)).reduce((a, x) => a.add(x.share), Fraction.ZERO).mul(k.area);
      const total = c.items.reduce((a, i) => a.add(i.area), Fraction.ZERO);
      if (total.gt(recorded) && c.items.length > 1) {
        add('contradiction', 'C_BASIS_OVERCOMMIT', {
          seller: c.seller, ref: c.kKey, recorded: recorded.toString(), total: total.toString(),
          items: c.items.map((i) => ({ docId: i.docId, area: i.area.toString(), kind: i.kind }))
        }, [k.doc.id].concat(c.items.map((i) => i.docId)));
      } else if (total.gt(recorded)) {
        add('contradiction', 'C_BASIS_EXCEEDED', {
          seller: c.seller, ref: c.kKey, recorded: recorded.toString(), total: total.toString(), kind: c.items[0].kind
        }, [k.doc.id, c.items[0].docId]);
      }
    }

    /* Copies not certified */
    const uncertified = docs.filter((d) => d.provenance === 'seller_copy' && !excludedDocuments.includes(d.id)).map((d) => d.id);
    if (uncertified.length) add('missing', 'M_UNCERTIFIED', { count: uncertified.length }, uncertified);

    /* ---------- Assumptions ---------- */
    const assumptions = [{ code: 'A_GENUINE' }, { code: 'A_NAMES' }, { code: 'A_SAME_PLOT' }];
    const computedEstates = estates.filter((e) => e.used === 'computed');
    if (computedEstates.length) {
      assumptions.push({ code: 'A_HEIRS_COMPLETE', params: { names: computedEstates.map((e) => e.decedent).join(', ') } });
      assumptions.push({ code: 'A_RULES_PENDING' });
      if (computedEstates.some((e) => e.result.assumptions.includes('no_bequest_assumed'))) assumptions.push({ code: 'A_NO_BEQUEST' });
      if (computedEstates.some((e) => e.result.assumptions.includes('school_assumed_hanafi'))) assumptions.push({ code: 'A_HANAFI' });
    }
    if (estates.some((e) => e.used === 'stated')) assumptions.push({ code: 'A_STATED_SHARES' });
    if (coverage.gaps.length) assumptions.push({ code: 'A_NO_HIDDEN_TRANSFERS', params: { gaps: coverage.gaps } });
    if (areaChanges.size > 1) assumptions.push({ code: 'A_AREA_CHANGES' });
    /* Only years are known. When different kinds of event share a year, the replay order
       (death -> deed -> mutation -> record) is an assumption and is said so. */
    const typesByYear = new Map();
    for (const ev of events) { if (!typesByYear.has(ev.year)) typesByYear.set(ev.year, new Set()); typesByYear.get(ev.year).add(ev.type); }
    const sharedYears = Array.from(typesByYear.entries()).filter(([, t]) => t.size > 1).map(([y]) => y).sort((a, b) => a - b);
    if (sharedYears.length) assumptions.push({ code: 'A_YEAR_ORDER', params: { years: sharedYears.join(', ') } });

    /* ---------- Checklist ---------- */
    const checklist = buildChecklist(findings);

    /* ---------- Summary ---------- */
    const count = (k) => findings.filter((f) => f.kind === k).length;
    const summary = {
      contradictions: count('contradiction'),
      missing: count('missing'),
      review: count('review'),
      inputErrors: inputErrors.length
    };

    if (inputErrors.length) offer = null;
    return { engineVersion: ENGINE_VERSION, excludedDocuments, revision: packet.revision || 0, asOfYear, synthetic: !!packet.synthetic, findings, inputErrors, timeline, estates,
      coverage, offer, assumptions, checklist, summary, rootDocId: rootK ? rootK.doc.id : null };
  }

  /* Each checklist item: which document, from where, and what it could clarify. */
  const CHECK_MAP = {
    M_REF_DEED: 'certified_deed',
    M_SEARCH_DEED_NOT_SUPPLIED: 'certified_deed',
    M_REF_KHATIAN: 'certified_khatian',
    M_UNEXPLAINED: 'transfer_records',
    M_DEED_NO_MUTATION: 'mutation_record',
    M_COVERAGE_GAP: 'registry_search',
    M_CHAIN_SHORTFALL: 'acquisition_docs',
    M_RECORD_SHORTFALL: 'acquisition_docs',
    M_DECEDENT_NO_HOLDING: 'acquisition_docs',
    M_ESTATE_INFO: 'heir_details',
    M_DAG_UNMAPPED: 'dag_concordance',
    M_UNCERTIFIED: 'certified_copies',
    M_NO_ROOT: 'certified_khatian',
    U_INHERITANCE: 'legal_review',
    U_STATED_DIFF: 'legal_review',
    U_STATED_USED: 'legal_review'
  };

  function buildChecklist(findings) {
    const items = new Map();
    findings.forEach((f, idx) => {
      let item = CHECK_MAP[f.code];
      if (!item && f.kind === 'contradiction') item = 'resolve_conflict';
      if (!item) return;
      if (!items.has(item)) items.set(item, { item, findingIdx: [], params: [] });
      const it = items.get(item);
      it.findingIdx.push(idx);
      it.params.push(f.params);
    });
    return Array.from(items.values());
  }

  const api = { analyze, Ledger, norm, khatianKey, asciiDigits, ENGINE_VERSION };
  root.Sutro = Object.assign(root.Sutro || {}, api);
  if (isNode) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
