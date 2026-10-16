#!/usr/bin/env node
/*
 * Import a downloaded Kaggle run into the web app:
 *   node scripts/import-run.js nb01|nb02 [--activate]
 * Looks for run/<run-id>/ under artifacts/incoming/<nb>/ (the notebooks write there), copies the run folder to
 * artifacts/runs/<run-id>/ (never overwriting an existing run), copies the ONNX + preprocessing files to
 * artifacts/models/ when --activate is given, and rewrites artifacts/runs/index.json.
 * Nothing is fabricated: a run without metrics.json is recorded with status "failed".
 */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const [nb, flag] = process.argv.slice(2);
if (!['nb01', 'nb02'].includes(nb)) { console.error('usage: import-run.js nb01|nb02 [--activate]'); process.exit(1); }
const incoming = path.join(root, 'artifacts', 'incoming', nb);
const runsDir = path.join(root, 'artifacts', 'runs'); const modelsDir = path.join(root, 'artifacts', 'models');
fs.mkdirSync(runsDir, { recursive: true }); fs.mkdirSync(modelsDir, { recursive: true });

function findRuns(dir) {
  const out = [];
  (function walk(d, depth) {
    if (depth > 4 || !fs.existsSync(d)) return;
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) { if (fs.existsSync(path.join(p, 'config.json'))) out.push(p); else walk(p, depth + 1); }
    }
  })(dir, 0);
  return out;
}
const found = findRuns(incoming);
if (!found.length) { console.error('no run folder with config.json under ' + incoming); process.exit(1); }
const kind = nb === 'nb01' ? 'line-ocr' : 'digit';
const index = fs.existsSync(path.join(runsDir, 'index.json')) ? JSON.parse(fs.readFileSync(path.join(runsDir, 'index.json'), 'utf8')) : { runs: [] };
for (const src of found) {
  const id = path.basename(src); const dst = path.join(runsDir, id);
  if (fs.existsSync(dst)) { console.log('already imported, skipping:', id); continue; }
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src)) if (!/\.pt$/.test(f)) fs.copyFileSync(path.join(src, f), path.join(dst, f));   // weights (.pt) stay out of the repo; ONNX is the shipped form
  const metrics = fs.existsSync(path.join(dst, 'metrics.json')) ? JSON.parse(fs.readFileSync(path.join(dst, 'metrics.json'), 'utf8')) : null;
  const cfg = JSON.parse(fs.readFileSync(path.join(dst, 'config.json'), 'utf8'));
  const status = metrics ? (metrics.smoke ? 'smoke' : metrics.status || 'completed') : 'failed';
  index.runs = index.runs.filter((r) => r.id !== id);
  index.runs.push({ id, dir: 'artifacts/runs/' + id, kind, task: cfg.task, status, active: false, timestamp: id.replace(/^.*?-(\d{8}-\d{6})$/, '$1'), device: cfg.device, epochs: cfg.epochs });
  console.log('imported', id, status);
  if (flag === '--activate' && status === 'completed') {
    const onnx = fs.readdirSync(dst).find((f) => f.endsWith('.onnx'));
    if (onnx) {
      const base = nb === 'nb01' ? 'khatian_ocr' : 'numta_cnn';
      fs.copyFileSync(path.join(dst, onnx), path.join(modelsDir, base + '.onnx'));
      const meta = nb === 'nb01' ? 'charset.json' : 'preprocessing.json';
      fs.copyFileSync(path.join(dst, meta), path.join(modelsDir, base + '.' + meta));
      index.runs.forEach((r) => { if (r.kind === kind) r.active = r.id === id; });
      console.log('activated', id, '->', base + '.onnx');
    } else console.log('no ONNX file in run; not activated');
  }
}
index.generated = new Date().toISOString();
index.runs.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
fs.writeFileSync(path.join(runsDir, 'index.json'), JSON.stringify(index, null, 1));
console.log('index.json:', index.runs.map((r) => `${r.id} [${r.kind}] ${r.status}${r.active ? ' *active' : ''}`).join('\n  '));
