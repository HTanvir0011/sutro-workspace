#!/usr/bin/env node
/*
 * Kaggle helpers for the two training notebooks (GPU runs) and the training dataset.
 *   node scripts/kaggle.js dataset <dir>       create (or version) the private dataset from a folder holding
 *                                              numta_32x32.npz(+json) and cells_{train,val,test}.npz/.csv + dataset-metadata.json
 *   node scripts/kaggle.js push nb01|nb02      push a kernel: copies notebooks/<file>.ipynb next to kaggle/<nb>/kernel-metadata.json
 *   node scripts/kaggle.js status nb01|nb02
 *   node scripts/kaggle.js pull nb01|nb02      download the kernel's output into artifacts/incoming/<nb>/
 * Requires: python -m pip install kaggle, and Kaggle credentials (`kaggle auth login` or ~/.kaggle/kaggle.json; never committed).
 */
'use strict';
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const NB = { nb01: '01_khatian_cell_ocr_crnn.ipynb', nb02: '02_numta_digit_cnn.ipynb' };
const [cmd, arg] = process.argv.slice(2);

function kaggle(args) { const line = `python -m kaggle ${args}`; console.log('> ' + line); return execSync(line, { stdio: 'inherit', encoding: 'utf8' }); }
function kernelId(nb) { return JSON.parse(fs.readFileSync(path.join(root, 'kaggle', nb, 'kernel-metadata.json'), 'utf8')).id; }

if (cmd === 'dataset') {
  const dir = path.resolve(arg || path.join(root, '..', 'kaggle', 'dataset'));
  if (!fs.existsSync(path.join(dir, 'dataset-metadata.json'))) { console.error('dataset-metadata.json missing in ' + dir); process.exit(1); }
  try { kaggle(`datasets create -p "${dir}"`); } catch (e) { console.log('create failed (already exists?) — trying a new version'); kaggle(`datasets version -p "${dir}" -m "update"`); }
} else if (cmd === 'push' && NB[arg]) {
  const dir = path.join(root, 'kaggle', arg);
  fs.copyFileSync(path.join(root, 'notebooks', NB[arg]), path.join(dir, NB[arg]));
  kaggle(`kernels push -p "${dir}"`);
} else if (cmd === 'status' && NB[arg]) {
  kaggle(`kernels status ${kernelId(arg)}`);
} else if (cmd === 'pull' && NB[arg]) {
  const out = path.join(root, 'artifacts', 'incoming', arg); fs.mkdirSync(out, { recursive: true });
  kaggle(`kernels output ${kernelId(arg)} -p "${out}"`);
  console.log('\nDownloaded to ' + out + ' — then run: node scripts/import-run.js ' + arg);
} else {
  console.error('usage: kaggle.js dataset <dir> | push nb01|nb02 | status nb01|nb02 | pull nb01|nb02'); process.exit(1);
}
