/* Exact rational arithmetic using BigInt. No floating point is used for shares. */
(function (root) {
  'use strict';

  function gcd(a, b) {
    a = a < 0n ? -a : a;
    b = b < 0n ? -b : b;
    while (b !== 0n) { const t = a % b; a = b; b = t; }
    return a;
  }

  class Fraction {
    constructor(n, d) {
      n = BigInt(n);
      d = d === undefined ? 1n : BigInt(d);
      if (d === 0n) throw new Error('Fraction: zero denominator');
      if (d < 0n) { n = -n; d = -d; }
      const g = gcd(n, d) || 1n;
      this.n = n / g;
      this.d = d / g;
      Object.freeze(this);
    }

    /* Accepts Fraction, integer, "a/b", "12", "17.5". Throws on anything else. */
    static from(v) {
      if (v instanceof Fraction) return v;
      if (typeof v === 'bigint') return new Fraction(v, 1n);
      if (typeof v === 'number') {
        if (!Number.isFinite(v)) throw new Error('Fraction: not finite');
        return Fraction.from(String(v));
      }
      if (typeof v !== 'string') throw new Error('Fraction: unsupported input');
      // Bangla digits (০-৯) are accepted; the caller keeps the raw text.
      const s = v.trim().replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
      let m = /^(-?\d+)\s*\/\s*(\d+)$/.exec(s);
      if (m) return new Fraction(BigInt(m[1]), BigInt(m[2]));
      m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(s);
      if (m) {
        const frac = m[3] || '';
        const n = BigInt(m[2] + frac) * (m[1] === '-' ? -1n : 1n);
        return new Fraction(n, 10n ** BigInt(frac.length));
      }
      throw new Error('Fraction: cannot parse "' + v + '"');
    }

    static tryFrom(v) {
      try { return Fraction.from(v); } catch (e) { return null; }
    }

    add(o) { o = Fraction.from(o); return new Fraction(this.n * o.d + o.n * this.d, this.d * o.d); }
    sub(o) { o = Fraction.from(o); return new Fraction(this.n * o.d - o.n * this.d, this.d * o.d); }
    mul(o) { o = Fraction.from(o); return new Fraction(this.n * o.n, this.d * o.d); }
    div(o) {
      o = Fraction.from(o);
      if (o.n === 0n) throw new Error('Fraction: division by zero');
      return new Fraction(this.n * o.d, this.d * o.n);
    }
    cmp(o) { o = Fraction.from(o); const l = this.n * o.d, r = o.n * this.d; return l < r ? -1 : l > r ? 1 : 0; }
    eq(o) { return this.cmp(o) === 0; }
    lt(o) { return this.cmp(o) < 0; }
    gt(o) { return this.cmp(o) > 0; }
    isZero() { return this.n === 0n; }
    isNegative() { return this.n < 0n; }

    toString() { return this.d === 1n ? String(this.n) : this.n + '/' + this.d; }

    /* Decimal rendering, rounded half away from zero, trailing zeros trimmed. */
    toDecimal(places) {
      places = places === undefined ? 2 : places;
      const neg = this.n < 0n;
      const n = neg ? -this.n : this.n;
      const scale = 10n ** BigInt(places);
      let q = (n * scale * 2n + this.d) / (this.d * 2n);
      const whole = q / scale;
      let frac = (q % scale).toString().padStart(places, '0').replace(/0+$/, '');
      const s = frac ? whole + '.' + frac : String(whole);
      return (neg && s !== '0' ? '-' : '') + s;
    }

    /* True when the decimal rendering is exact (no rounding happened). */
    isExactDecimal(places) {
      const scale = 10n ** BigInt(places === undefined ? 2 : places);
      return (this.n * scale) % this.d === 0n;
    }
  }

  Fraction.ZERO = new Fraction(0n, 1n);
  Fraction.ONE = new Fraction(1n, 1n);

  const api = { Fraction };
  root.Sutro = Object.assign(root.Sutro || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
