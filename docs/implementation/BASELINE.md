# P00 baseline — 15 October 2026

Branch `main`, initially clean. No applicable AGENTS.md found in repository/code folders or parent directories. No Git initialization, commit, upload or publication performed. Existing services were left running; port 5173 was unused and the baseline server was started on loopback only.

## Reproduce

Windows 11 ASUS Vivobook K3605ZC, Intel i7-12700H (14 cores), 16,835,108,864 bytes RAM; Intel Iris Xe / RTX 3050 Laptop 4 GB. Node v26.7.0, npm 11.19.0, Python 3.14.6 (`C:\.venv\Scripts\python.exe`). Browser version is recorded in `baseline-browser.json`.

`node --test tests/engine.test.js tests/inheritance.test.js tests/fraction.test.js`: **39 passed, 0 failed**. `node scripts/capture-baseline.js` captures all nine original routes at 1280 and 390 px with a fresh browser context; external CDNs blocked. All 18 route checks had no uncaught page errors. Mobile intake, audit and report overflow horizontally. Screenshots are in `screenshots/baseline-*.png`; desktop home and mobile intake were visually inspected. Baseline inspection is not model-runtime acceptance.

`node scripts/baseline-snapshot.js docs/implementation/engine-baseline.json` records deterministic exact-value engine results. Demo A: chain 35, record 50; offer exceeds chain, record within. Demo B: chain 15, record 30; both exceeded. Demo C: chain undetermined with pending Hasan estate, record within. Three handwritten demos are synthetic and have no hidden expected-answer key. Snapshot comparison must preserve fraction strings, findings, source IDs and refusal paths; documented domain fixes need separate regression evidence.

## Current source

Inspected plan in full, README/package/ignore, nine HTML pages, app/shared navigation/i18n, three engine modules/demos/tests, CSS, local server, publication/Kaggle scripts, dataset cards, documentation/concept/demo sections, schema headers and synthetic fixtures. Current application already has scan IndexedDB, draft cases, cropped line suggestions and ONNX artifacts. Case packets remain a whole-list localStorage object. Import validation is insufficient; years use permissive prefixes; scan retention is automatic. Renderer mixes escaped strings and HTML interpolation. Server serves the project root; publisher contains blanket staging and implicit initialization. These are implementation targets, not accepted controls.

## Dataset readiness

Read-only live metadata inventory: **251,339 files, 3,771,853,955 bytes** under `docs/datasets/full/`. Prior extraction verified every file size and CRC32 against both local ZIPs. New metadata inventory output is private at `docs/.runtime/baseline-dataset.json`. Root names and source bytes were not changed.

Available: `sutro-dataset/khatian_form5462` (5,794 JPG pages, 107,475 PNG crops, annotations JSONL and linked CSV tables), reasoning JSONL packets/CSV tables, number crops, packed NPZ derivatives, 653 real deed JPGs, and original Numta folders/CSV labels. Schema inspected for lands, khatians, owners, dag_rows, title_line and crop labels. Original Numta contains corrected and augmented test folders: overlap and derivative lineage require auditing. Raw and packed crops are the same examples. Real deeds remain restricted, unlabelled and unavailable to public browsing/training unless permission and labels are supplied.

No approximately 15 GB corpus is present. No new measured OCR/full-data capability is accepted. Existing model records are historical evidence only, pending reproducible inference/parity/lineage review. Independent real-form labels and qualified legal review remain unavailable. The sample roots described in older docs are absent; existing public `data/samples/` remains intact.

## Next

P01: explicit public build, safe streamed serving, publication guard, strict input and browser policy. Full-data gates remain open while independent work proceeds.
