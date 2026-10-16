# Sutro runbook

How to install, run, test, train and troubleshoot. Commands are run from the repository root unless stated otherwise. Paths are relative to the repository root; `..` is the workspace folder that also holds the dataset bundle. Nothing here uploads case data anywhere: the app is client-side only, and the only remote service used is Kaggle for optional model training.

## 1. Install

| Need | Required for | Notes |
|---|---|---|
| Node.js ≥ 20 (`package.json` `engines`) | `npm start`, `npm test`, `scripts/*.js` | No npm dependencies; there is nothing to `npm install`. |
| Python 3 + `pip install kaggle` | Pushing data and kernels to Kaggle, pulling outputs (`scripts/kaggle.js` calls `python -m kaggle`) | Credentials via `kaggle auth login` or `~/.kaggle/kaggle.json`. `kaggle.json` and `.kaggle/` are git-ignored; never commit them. |
| Python 3 + `torch`, `numpy`, `pillow`, `onnx`, `onnxruntime` | Running a notebook locally with `notebooks/run_local.py` | The notebooks also try to import `onnxscript` and `pip install` the ONNX packages when missing; `matplotlib` is optional (sample plot is skipped without it). |

A browser with WebGL shows the home-page 3D scene; without it (or with reduced motion, a narrow viewport, or the three.js CDN blocked) the inline SVG fallback is used.

## 2. Run the site

```bash
npm start            # node scripts/serve.js 5173
```

Open http://localhost:5173. The server binds `127.0.0.1`, serves files from the repository root only (paths outside it get 403) and takes the port from the first argument or `PORT`.

The audit pages also work when opened from disk, because the engine runs entirely in the page. The model-results page, the About-page metric lines, the digit pad and the intake "Read from scan" button need an HTTP origin because they `fetch` files under `artifacts/`.

Deep links: `intake.html?case=demo-b` selects a case; `models.html?run=<run-id>` preselects a run; `intake.html#doc-<docId>` scrolls to a document.

## 3. Test

```bash
npm test             # node --test tests/*.test.js
```

Three suites: `tests/fraction.test.js`, `tests/inheritance.test.js`, `tests/engine.test.js`. At the time of writing 39 tests pass (Node 26). The suites cover exact arithmetic, the four published inheritance reference cases and every refusal path, the three demo packets, regression scenarios, input errors, Bangla digits, same-year ordering and the revision echo. There are no browser tests; the UI is exercised manually.

To run one suite: `node --test tests/engine.test.js`.

## 4. Dataset bundle

The training data lives outside the repository in `../sutro-dataset` (the repository stays free of datasets, scans and binaries). The bundle is built by its own `tools/` scripts; the parts Sutro uses:

| Part | Built by | Used by |
|---|---|---|
| `khatian_form5462/` synthetic khatian pages, CSV tables, `ocr_cells/` line crops (height 40 px, split by land) | `tools/khatian_data.py`, `tools/khatian_render.py`, `tools/build_khatian.py` | source of the OCR crops |
| `ocr_cells_packed/cells_{train,val,test}.npz` + `.csv` | `tools/pack_cells.py` | `notebooks/01_khatian_cell_ocr_crnn.ipynb` |
| `real_public/numta_digits/numta_32x32.npz` + `.json` (NumtaDB, CC BY-SA 4.0, converted to 32×32 inverted grayscale) | `tools/convert_numta.py` | `notebooks/02_numta_digit_cnn.ipynb` |
| `synthetic/packets/` (20,000 generated case packets with injected faults), `synthetic/tables/` | `tools/gen_packets.py`, `tools/build_packets.py`, `tools/export_tables.py`, checked by `tools/verify_packets.js` | regression and demo variety only; not an accuracy benchmark |
| `DATASET_CARD.md` | — | copied to `docs/dataset-bundle-card.md` |

`python tools/load_dataset.py <bundle-root>` (inside the bundle) loads every part and checks page-to-CSV links.

Inside the repository, `data/manifest.json` records what is relied on, with counts, provenance, licence and eligibility per part, and `data/samples/` holds small samples: `khatian_pages/` (8 JPG pages + `annotations.jsonl`), `ocr_cells/` (12 PNG crops + `labels.csv`), `packets/` (57 generated packets, each importable through Import JSON), `tables/` (first 40 rows of each table). The bundle's `real_public/dolil_deeds/` scans are real documents and are not used by the app, the notebooks or the repository.

## 5. Train on Kaggle

The two kernels run on Kaggle GPU with internet enabled (the notebooks pip-install ONNX packages if needed) and read a private Kaggle dataset.

1. **Stage and push the training dataset.** The folder must contain `dataset-metadata.json` (template in `kaggle/dataset/`), `numta_32x32.npz` (+ `.json`) and `cells_{train,val,test}.npz` / `.csv`. The default folder is `../kaggle/dataset`.
   ```bash
   node scripts/kaggle.js dataset ../kaggle/dataset
   ```
   The script tries `datasets create`; if that command fails (for example because the dataset already exists) it runs `datasets version` instead.
2. **Push a kernel.** The script copies `notebooks/<file>.ipynb` next to `kaggle/<nb>/kernel-metadata.json` and runs `kernels push`.
   ```bash
   node scripts/kaggle.js push nb01      # 01_khatian_cell_ocr_crnn.ipynb
   node scripts/kaggle.js push nb02      # 02_numta_digit_cnn.ipynb
   ```
   (`npm run kaggle:push -- nb01` is equivalent; the `npm run kaggle:*` scripts need the kernel name after `--`.)
3. **Check status.**
   ```bash
   node scripts/kaggle.js status nb01
   ```
4. **Pull the output** into `artifacts/incoming/<nb>/`.
   ```bash
   node scripts/kaggle.js pull nb01
   ```
5. **Import the run** (section 7).
   ```bash
   node scripts/import-run.js nb01 --activate
   ```

The notebooks find their data with a glob under `/kaggle/input/**` (`cells_train.npz`, `numta_32x32.npz`), so the dataset attached in `kernel-metadata.json` `dataset_sources` must contain those files. Each run writes its artifacts under `run/<run-id>/` in the kernel output.

## 6. Train locally

`notebooks/run_local.py <ipynb>` executes the notebook's code cells in one namespace and prints `NOTEBOOK OK` at the end. The notebooks read these environment variables:

| Variable | Notebook | Meaning | Default |
|---|---|---|---|
| `SMOKE=1` | both | Tiny CPU-sized check: nb01 uses 3,000 / 500 / 500 lines, batch 64; nb02 uses 4,000 training images; both default to 2 epochs | off |
| `EPOCHS` | both | Number of epochs | 30 (nb01), 20 (nb02); 2 in smoke mode |
| `BATCH` | nb01 | Batch size | 128 (64 in smoke mode); nb02 is fixed at 256 |
| `CELLS_DIR` | nb01 | Folder holding `cells_{train,val,test}.npz` / `.csv` | a path on the author's machine; set it explicitly |
| `NUMTA_NPZ` | nb02 | Path to `numta_32x32.npz` | a path on the author's machine; set it explicitly |
| `RUN_DIR` | both | Parent folder for the run folder `RUN_DIR/<run-id>/` | `run` (relative to the current directory) |

The device is chosen automatically (`cuda` if available, else `cpu`). nb01 enables mixed precision only on CUDA and uses DataLoader workers only outside smoke mode and outside Windows; nb02 uses neither. A smoke check:

```bash
# bash
SMOKE=1 CELLS_DIR=../sutro-dataset/ocr_cells_packed RUN_DIR=artifacts/incoming/nb01 python notebooks/run_local.py notebooks/01_khatian_cell_ocr_crnn.ipynb
SMOKE=1 NUMTA_NPZ=../sutro-dataset/real_public/numta_digits/numta_32x32.npz RUN_DIR=artifacts/incoming/nb02 python notebooks/run_local.py notebooks/02_numta_digit_cnn.ipynb
```

```powershell
# PowerShell
$env:SMOKE = '1'; $env:CELLS_DIR = '..\sutro-dataset\ocr_cells_packed'; $env:RUN_DIR = 'artifacts\incoming\nb01'
python notebooks\run_local.py notebooks\01_khatian_cell_ocr_crnn.ipynb
```

Pointing `RUN_DIR` at `artifacts/incoming/<nb>` lets `scripts/import-run.js` find the run without copying. For a real local run, unset `SMOKE` and set `EPOCHS`/`BATCH` as the GPU allows (nb01 reads `BATCH`; lower it on small GPUs). Smoke runs are imported with status `smoke`, are never activated and are labelled "smoke test — not a real run" on the models page; their numbers must not be quoted.

## 7. What the import produces and how the site picks it up

`node scripts/import-run.js nb01|nb02 [--activate]`:

1. Walks `artifacts/incoming/<nb>/` (up to four levels) for folders containing `config.json`.
2. Copies each run folder to `artifacts/runs/<run-id>/`, skipping `.pt` weights; an already imported id is skipped entirely (and therefore cannot be re-activated by this call).
3. Sets status: `smoke` if `metrics.json` has `smoke: true`, else `metrics.status` (`completed`), or `failed` when `metrics.json` is missing. Nothing is fabricated.
4. Rewrites `artifacts/runs/index.json` (`runs[]` with `id, dir, kind, task, status, active, timestamp, device, epochs`, newest first, plus `generated`).
5. With `--activate` and status `completed` and an `.onnx` file present: copies the model to `artifacts/models/khatian_ocr.onnx` + `khatian_ocr.charset.json` (nb01) or `numta_cnn.onnx` + `numta_cnn.preprocessing.json` (nb02) and marks that run as the only active one of its kind.

The site reads these files at runtime and shows pending states when they are absent:

| Consumer | Reads | When absent |
|---|---|---|
| `models.html` (`js/models-page.js`) | `index.json`; per run `config.json`, `dataset_manifest.json`, `history.json`, `metrics.json`, `confusion_matrix.json`, `model_card.md`; download chips also list `split_manifest.json`, `charset.json`, `preprocessing.json` | "No completed training run is included in this build"; each missing value "Not measured" |
| `about.html` | `index.json`, then `metrics.json` of every active run | "Training run pending — no result yet." |
| `ocr.html` | digit model files; `index.json` for the active digit run's metrics | "No trained digit model is included in this build" |
| `intake.html` "Read from scan" | `artifacts/models/khatian_ocr.onnx` + `khatian_ocr.charset.json` | "The line-reader model is not included in this build — manual entry only." |

At the time of writing `artifacts/` does not exist in the repository and the real runs are still training on Kaggle: artifacts pending. Note that `.gitignore` does not exclude `artifacts/`; decide deliberately what to commit (the UI describes the line-reader model as about 25 MB).

## 8. Export and import of cases

- **Export JSON** (case bar on intake/timeline/audit/report) downloads the current case as `<caseId>.sutro.json`. On the Cases page, **Export JSON** per row does the same and **Export all cases** downloads `sutro-cases.json` as `{ exported, engineVersion, packets: [...] }`.
- **Import JSON** (case bar or Cases page) accepts either a single packet object or an object with a `packets` array. Each packet must have a `docs` array whose items have a known `type`; otherwise "Could not read that file as a Sutro packet." Files above 5 MB are refused.
- Imported cases get a new id (`import-<timestamp>-<random>`), `provenance: "imported"`, `revision: 0`, default `plot`/`offer`/`title` when missing, and `synthetic: true` only if the file says exactly `true`; a `labels` object is kept as metadata. The last imported case becomes current.
- Attached scans are not exported; they live only in this browser's IndexedDB.
- **What-if copy** (Cases page) clones a case with `parentId` and revision 0; **Reset packet** restores a demo case (asks for confirmation when it has edits); **Delete** removes a non-demo case and its scans.
- The packets under `data/samples/packets/` can be imported directly to try generated fault scenarios.

## 9. Troubleshooting

| Symptom | Cause | What to do |
|---|---|---|
| "The line-reader model is not included in this build — manual entry only." / digit pad says no trained digit model | `artifacts/models/*.onnx` or its metadata JSON is missing, the page is opened from disk (no `fetch`), or ONNX Runtime could not be loaded | Everything else keeps working manually. Import a completed run with `--activate`, serve over `npm start`, and check that `https://cdn.jsdelivr.net` is reachable. |
| Reader loads but the suggestion is "discarded" | The case was edited (revision changed) while inference ran | Expected: drag the box again. |
| "Could not save to browser storage (quota or private mode)." | `localStorage.setItem` threw | Edits stay in memory for this page view only; Export JSON to keep them; leave private mode or free space; attach smaller scans (max 15 MB each, image types only). |
| Scan previews vanish after reload | IndexedDB unavailable or blocked | Previews are session-only in that case; the case data itself is unaffected. |
| Home page shows the flat SVG instead of the 3D scene | No WebGL, reduced-motion preference, narrow viewport, or the three.js CDN script did not load | Intentional fallback; no action needed. |
| Model results page: "No completed training run is included in this build." | `artifacts/runs/index.json` missing or empty | Run the import (section 7). A run without `metrics.json` is listed as `failed`; a smoke run as `smoke`. |
| `npm test` says it cannot find `tests/*.test.js` | The pattern reached Node unexpanded (Windows shells do not expand globs; only newer Node test runners expand patterns themselves) | Run `node --test tests/engine.test.js tests/fraction.test.js tests/inheritance.test.js`. On Node 26 here the glob works as is. |
| `kaggle.js push` fails with a missing file | `notebooks/<file>.ipynb` or `kaggle/<nb>/kernel-metadata.json` is missing, or `python -m kaggle` is not installed / not authenticated | Restore the files; `pip install kaggle`; `kaggle auth login`. |
| `import-run.js`: "no run folder with config.json under artifacts/incoming/<nb>" | Output not pulled yet, pulled into another folder, or nested deeper than four levels | `node scripts/kaggle.js pull <nb>` first, or set `RUN_DIR=artifacts/incoming/<nb>` for local runs. |
| `import-run.js`: "already imported, skipping" and the model is not activated | A run id is never overwritten, and activation only applies to newly imported runs | Remove `artifacts/runs/<run-id>/` and import again, or edit `index.json` and `artifacts/models/` by hand. |
| Local run out of GPU memory | Default batch too large for the card | Set `BATCH` lower for nb01; nb02's batch is fixed at 256 in the notebook. |
| A case opened with `?case=<id>` shows another case | Unknown id | The first available case is selected; check the id on the Cases page. |
