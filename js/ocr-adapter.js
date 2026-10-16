/*
 * Browser inference adapter for the trained models (ONNX Runtime Web, loaded on demand from a CDN).
 *   line reader : artifacts/models/khatian_ocr.onnx  + khatian_ocr.charset.json   (CRNN + CTC, height 40)
 *   digit reader: artifacts/models/numta_cnn.onnx    + numta_cnn.preprocessing.json (32x32, ink bright)
 * Preprocessing mirrors the training notebooks exactly (see charset/preprocessing json). If a model file is
 * missing the adapter reports "unavailable" and the app keeps working manually.
 */
(function (root) {
  'use strict';
  const ORT_VER = '1.20.1';
  const ORT_URL = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VER}/dist/ort.min.js`;
  const ORT_WASM = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VER}/dist/`;
  const FILES = {
    line: { model: 'artifacts/models/khatian_ocr.onnx', meta: 'artifacts/models/khatian_ocr.charset.json' },
    digit: { model: 'artifacts/models/numta_cnn.onnx', meta: 'artifacts/models/numta_cnn.preprocessing.json' }
  };
  const sessions = {};

  function loadOrt() {
    if (root.ort) return Promise.resolve();
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = ORT_URL; s.onload = res; s.onerror = () => rej(new Error('ort-load-failed')); document.head.appendChild(s); })
      .then(() => { root.ort.env.wasm.wasmPaths = ORT_WASM; });
  }
  function init(kind) {
    if (sessions[kind]) return sessions[kind];
    sessions[kind] = (async () => {
      const f = FILES[kind];
      const meta = await fetch(f.meta).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (!meta) return null;
      const head = await fetch(f.model, { method: 'HEAD' }).catch(() => null);
      if (!head || !head.ok) return null;
      await loadOrt();
      const session = await root.ort.InferenceSession.create(f.model, { executionProviders: ['wasm'] });
      return { session, meta };
    })().catch(() => null);
    return sessions[kind];
  }

  /* ---- line reader ---- */
  function prepLine(canvas, H) {
    const scale = H / canvas.height;
    let W = Math.max(16, Math.round(canvas.width * scale)); W += (4 - (W % 4)) % 4;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.drawImage(canvas, 0, 0, Math.min(W, Math.round(canvas.width * scale)), H);
    const d = g.getImageData(0, 0, W, H).data; const out = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) { const gray = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) / 255; out[i] = (gray - 0.5) / 0.5; }
    return { data: out, W };
  }
  function ctcDecode(logp, T, V, chars) {
    let prev = 0; const s = [];
    for (let t = 0; t < T; t++) {
      let best = 0, bv = -Infinity;
      for (let v = 0; v < V; v++) { const x = logp[t * V + v]; if (x > bv) { bv = x; best = v; } }
      if (best !== prev && best !== 0) s.push(chars[best - 1]);
      prev = best;
    }
    return s.join('');
  }
  async function readLine(canvas) {
    const m = await init('line'); if (!m) throw new Error('model-unavailable');
    const H = m.meta.height || 40; const { data, W } = prepLine(canvas, H);
    const out = await m.session.run({ image: new root.ort.Tensor('float32', data, [1, 1, H, W]) });
    const lp = out.logprobs; return ctcDecode(lp.data, lp.dims[0], lp.dims[2], m.meta.chars);
  }

  /* ---- digit reader ---- */
  function prepDigit(canvas) {
    const { width: W, height: Hh } = canvas; const d = canvas.getContext('2d').getImageData(0, 0, W, Hh).data;
    let x0 = W, y0 = Hh, x1 = -1, y1 = -1;
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if ((d[i] + d[i + 1] + d[i + 2]) / 3 < 160) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    if (x1 < 0) return null;
    const side = Math.max(x1 - x0, y1 - y0) * 1.3 + 8, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const t = document.createElement('canvas'); t.width = t.height = 32; const g = t.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 32, 32); g.drawImage(canvas, cx - side / 2, cy - side / 2, side, side, 0, 0, 32, 32);
    const px = g.getImageData(0, 0, 32, 32).data; const arr = new Float32Array(32 * 32);
    for (let i = 0; i < 32 * 32; i++) arr[i] = (255 - (px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2]) / 3) / 255;   // ink bright, like training
    return arr;
  }
  async function readDigit(canvas) {
    const m = await init('digit'); if (!m) throw new Error('model-unavailable');
    const arr = prepDigit(canvas); if (!arr) return null;
    const out = await m.session.run({ image: new root.ort.Tensor('float32', arr, [1, 1, 32, 32]) });
    const logits = Array.from(out.logits.data); const mx = Math.max(...logits); const ex = logits.map((v) => Math.exp(v - mx)); const sum = ex.reduce((a, b) => a + b, 0);
    const probs = ex.map((v) => v / sum); const best = probs.indexOf(Math.max(...probs));
    return { best, probs, classes: m.meta.classes || Array.from('০১২৩৪৫৬৭৮৯') };
  }

  root.Sutro = Object.assign(root.Sutro || {}, {
    ocr: {
      lineAvailable: () => init('line').then((m) => !!m), digitAvailable: () => init('digit').then((m) => !!m),
      readLine, readDigit
    }
  });
})(window);
