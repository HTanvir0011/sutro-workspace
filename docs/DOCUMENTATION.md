# Sutro (সূত্র) — Technical & User Documentation

**Version:** 0.3.0 (LandTech 2026, Round 1) · **Repository:** https://github.com/HTanvir0011/sutro
**Primary problem statement:** P5 — Citizen Pre-Purchase Verification (P3 partially covered)

> All demo data is synthetic. Sutro is a prototype and is not legal advice.

This file is the entry point. Detailed documents:

| Document | Contents |
|---|---|
| `docs/architecture.md` | Components, runtime and training flow diagrams, page map, data contracts, storage/privacy behaviour, what is deliberately not built |
| `docs/algorithms.md` | Every implemented algorithm (exact arithmetic, validation, reference indexing, dual-account replay, finding codes, coverage intervals, offer comparison, inheritance scope, model-assisted extraction) with interfaces, invariants, edge cases and complexity |
| `docs/runbook.md` | Install, run, test, dataset bundle, train on Kaggle or locally, import a run, export/import cases, troubleshooting |
| `docs/verification.md` | What was actually tested (unit tests, browser checks on desktop and mobile, failure states) and what was not |
| `docs/dataset-and-model-card.md` | Datasets used/excluded with licences and eligibility; the two models, their training and limitations |
| `docs/workspace-audit.md`, `data/manifest.json` | Measured inventory of the workspace (counts, sizes, provenance, runtimes, baseline tests) |
| `docs/dataset-bundle-card.md` | Card of the full dataset bundle (not in the repo) |
| `docs/concept-note.md` / `.pdf`, `docs/demo-script.md` | Round-1 concept note (4 pages) and the 3-minute demo script |

---

## 1. Overview

Sutro is a **share audit for a single land plot**. A buyer (or their lawyer) enters the documents they actually hold — khatians, deeds, mutation records, heir certificates, registry-search results — and the proposed sale. Sutro replays those documents as an ownership timeline using exact fractions and reports, separately:

| Output | Meaning |
|---|---|
| **Contradictions** | Supplied documents make claims that cannot all be true as written. |
| **Missing evidence** | Something is unexplained or not covered by the supplied documents. Not proof of wrongdoing. |
| **Unsupported — human review** | Scenarios Sutro deliberately does not compute. Nothing is calculated; the case is routed to a person. |

Every figure carries the **assumptions** it depends on, the **case revision and engine version** it was computed from, and cites its **source documents**. A **document checklist** names the next document to obtain, the office that issues it, and what it could clarify. Sutro never determines legal title, possession or document authenticity.

Two small trained models are available as **input assistance only** (reading one text line from a scan; reading one handwritten digit). They suggest text that the user must confirm; the audit engine is deterministic and uses no model.

## 2. Quick start

Requirements: Node.js ≥ 20. No build step, no dependencies.

```bash
cd sutro
npm start            # serves http://localhost:5173
npm test             # 39 automated tests
```

| Page | Purpose |
|---|---|
| `index.html` Home | Introduction, Start verification, interactive 3D scene built from demo case B (year slider replays the real chain account; click a document to open it; SVG fallback on narrow screens / reduced motion / no WebGL), demo cases |
| `cases.html` Cases | Case workspace: kind, documents, revision, last update, live audit status; new, what-if copy, rename, export, import, delete |
| `intake.html` Document Intake | Structured entry for six document types with inline validation; attach a scan (IndexedDB); *Read from scan* with a confirm step |
| `timeline.html` Ownership Timeline | Supplied documents, events with chain and record accounts, registry-search coverage, side-by-side comparison of two khatians |
| `audit.html` Share Audit | What the evidence supports, inheritance tables with rule basis, assumptions, contradictions and unsupported cases, findings filter |
| `report.html` Verification Report | Full findings, evidence gaps, next-document checklist, revision and engine version; printable |
| `models.html` Model results | Real training-run metrics read from `artifacts/runs/` (empty state when none is included) |
| `about.html` About | Problem, solution, methodology, coverage, team (placeholders), limitations, AI use |
| `ocr.html` Digit reader | Reads one handwritten Bangla digit in the browser (NumtaDB-trained CNN) |

The selected case, all edits and the language choice persist in this browser (`localStorage`; scans in IndexedDB). Deep links: `intake.html?case=demo-b`. Language: বাংলা / English toggle in the header, including numerals.

## 3. User guide

### 3.1 Cases
The **Cases** page lists every case in this browser. **New blank case** starts empty; **What-if copy** duplicates a case so you can experiment without touching the original (the copy is marked *What-if* and keeps a link to its parent); **Rename**, **Export JSON**, **Import JSON** (one case or an "export all" file; the file's `synthetic` declaration is kept as metadata, never assumed); **Delete** (not for demo cases). Demo cases can be reset to their original state; if a demo has saved edits you are asked to confirm.

Each case shows its **revision** (incremented on every accepted edit), the time of the last edit, and a live one-line **audit status** computed by the engine.

### 3.2 Entering documents (Intake)
1. **Proposed sale**: seller, area offered (decimals), the khatian the seller cites (e.g. `BS-512`), year to check as of.
2. Optionally **Plot**: mouza, JL, and the dag number under each survey.
3. **Add document** → Khatian / Deed / Mutation / Heir certificate / Registry search. Shares and areas accept integers, decimals (`17.5`), fractions (`7/40`) and Bangla digits (`৭/৪০`). Years are 4 digits. Invalid values are flagged where you type them and listed by the engine as input errors — they are never treated as zero.
4. **Copy type**: *Certified copy* or *Copy given by seller* (a declared provenance, not a verification).
5. **Attach scan** keeps an image beside the fields; it survives reloads (IndexedDB) but never leaves this browser.
6. **Read from scan** (when the line-reader model is included): drag a box around *one* text line; the model suggests text; choose the target field and **Accept**. Nothing enters the case until you accept, and a suggestion that arrives after the case changed is discarded.

### 3.3 Reading results
- **Timeline**: each event (earliest record, death, deed, mutation, later record) with the *chain account* (earliest record replayed through supplied events) and the *record account* (latest khatian adjusted by later supplied events); "pending" marks a share that depends on an estate Sutro could not compute. **Coverage bar**: years covered by a registry search vs. uncovered. **Compare two records**: pick any two khatians; differences in metadata and owner shares are highlighted, with the chain account at each.
- **Audit / Report**: headline state (*exceeds*, *conflicting accounts*, *not sufficient to compare*, *within — gaps remain*, *within — no open gaps*), the two accounts, inheritance calculations with their rule basis (labelled *pending qualified review*), assumptions, findings in three sections (filter by kind or text), checklist, print. Every analysis states the revision and engine version it belongs to.

### 3.4 Model results
`models.html` reads `artifacts/runs/index.json` and the per-run files written by the training notebooks: configuration, dataset manifest and split, training curves, test metrics (CER / exact match per field type for the line reader; accuracy / macro-F1 / per class / per NumtaDB source set for the digit classifier), confusion matrix (raw or row-normalised), inference timing, model card and downloads. Missing values show **Not measured**; smoke runs are labelled as such; the run used for inference is marked *active*. These numbers measure the synthetic / NumtaDB distributions only.

## 4. Methodology (summary — full detail in `docs/algorithms.md`)
1. **Absence is unknown, never "did not happen".** Gaps come only from the documents: references they recite, transitions they fail to explain, years no search covers. Removing a document removes every finding about it (tested).
2. **Agreement ≠ completeness ≠ ownership.** A derived record is not independent confirmation of its source. Legal title is never decided.
3. **An unexplained change is not a contradiction.** It is reported as missing evidence.
4. **Exact arithmetic.** Shares are BigInt rationals; renderings that round are marked `≈`.
5. **Only years are known.** Same-year events are replayed death → deed → mutation → record and this is listed as an assumption.
6. **Narrow inheritance, explicit refusals.** Hanafi intestate case with at least one surviving son only; everything else is refused and routed to a person. A predeceased child triggers the orphaned-grandchild route only when the certificate states they left surviving children.

## 5. Architecture (summary — full detail in `docs/architecture.md`)
Client-only web app: no backend, no accounts, no cloud. State in `localStorage` (`sutro.packets.v1`), scans in IndexedDB. The engine (`js/engine.js`, `ENGINE_VERSION`) is pure and deterministic; views recompute from the current revision. Optional browser inference uses ONNX Runtime Web (loaded from a CDN on demand) with the ONNX models under `artifacts/models/`. Training runs on Kaggle GPUs (`scripts/kaggle.js`) or locally (`notebooks/run_local.py`); `scripts/import-run.js` publishes a run's artifacts to `artifacts/runs/<run-id>/` and the site reads them.

```
index.html cases.html intake.html timeline.html audit.html report.html models.html about.html ocr.html
js/fraction.js  js/inheritance.js  js/engine.js      core (tested)
js/app.js  js/idb.js  js/ocr-adapter.js  js/models-page.js  js/hero3d.js  js/i18n*.js  js/demo-packets.js
css/styles.css  css/site.css  css/app.css
tests/            notebooks/            kaggle/            scripts/            artifacts/ (created by import)            data/            docs/
```

## 6. Testing
`node --test tests/*.test.js` — 39 tests (fraction arithmetic incl. Bangla digits; inheritance with four externally published reference cases and every refusal path; engine on the demo packets, no-hidden-knowledge, contradictions, input errors, stated shares, area changes, empty packet, checklist, version/assumption/revision echo). Browser verification on desktop and mobile is recorded in `docs/verification.md`. Engine evaluation and model evaluation are separate; generated packets are a self-consistency check, not an independent benchmark.

## 7. Models (summary — full detail in `docs/dataset-and-model-card.md`)
| Model | Data | Use in the app |
|---|---|---|
| Khatian text-line reader, CRNN + CTC (`notebooks/01_khatian_cell_ocr_crnn.ipynb`) | 107k line crops from the synthetic Form-5462-style khatian pages, split by land | *Read from scan* on Intake |
| Bangla digit classifier, small CNN (`notebooks/02_numta_digit_cnn.ipynb`) | NumtaDB (public, CC BY-SA 4.0) | `ocr.html` |

Both export to ONNX with a parity check and run in the browser. Accuracy on real scanned or handwritten khatians is **not measured**; problem statement P1 is not claimed.

## 8. Problem-statement coverage
| Statement | Claim |
|---|---|
| **P5** Pre-purchase verification | Primary — demonstrated on synthetic cases |
| **P3** Fraud & double-selling | Partial — over-commitment of a cited record, sale by a recorded-deceased person, registration/mutation mismatches within supplied documents; forged paper is not detected |
| P4 e-Mutation workflow | Not claimed |
| P1 Digitization | Not claimed (readers are input-layer experiments) |
| P2 Deed verification | Not claimed |

## 9. Limitations
Results so far are on synthetic data only; precision/recall on independently authored cases is not measured. Inheritance rules are narrow and pending qualified legal review. Bangla strings were AI-drafted and need native review. No government systems are connected; data entry is manual. Names are matched by normalised string. The 3D scene and the model readers need network access for their libraries; the audit engine does not.

## 10. Data, privacy and AI disclosure
- No real names, NIDs, phone numbers, addresses or land records anywhere in the repository (rulebook §8). Real deed scans from a public dataset were deliberately excluded.
- Inheritance rule sources: Qur'an 4:11, 4:12; islamweb.net worked examples (cited in the tests). NumtaDB: CC BY-SA 4.0.
- Built with substantial assistance from **Claude (Anthropic)** via Claude Code: code, tests, strings, generators, notebooks and documents were AI-drafted and reviewed by the team. No AI model runs inside the evidence engine.

## 11. Team
| Role | Name | Affiliation |
|---|---|---|
| Student (Team Leader) | _placeholder_ | Daffodil International University |
| Student | _placeholder_ | Daffodil International University |
| Faculty mentor | _placeholder_ | Daffodil International University |
| Industry mentor | _placeholder_ | _placeholder_ |

## 12. Licence
MIT. Third-party: Noto fonts (OFL), three.js (MIT), ONNX Runtime Web (MIT), NumtaDB (CC BY-SA 4.0; the digit model is a derivative under the same licence).
