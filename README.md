# Sutro (সূত্র) — pre-purchase evidence check for a single plot

**Live website: [sutro-workspace.vercel.app](https://sutro-workspace.vercel.app)**

Public source snapshot: [HTanvir0011/sutro-workspace](https://github.com/HTanvir0011/sutro-workspace). See [delivery scope and setup](docs/implementation/PUBLICATION.md) and [third-party notices](THIRD_PARTY_NOTICES.md). Dataset folders and generated training histories are kept local; reviewed runtime model copies are included under `assets/models/`.

**LandTech 2026 · Track: Digital Land Records, Verification & Digitization**
**Primary problem statement: P5 — Citizen Pre-Purchase Verification.** P3 (fraud / double-selling) is partially covered through evidence-based inconsistency detection. See [Coverage](#problem-statement-coverage).

> All demo data is **synthetic**. Every person, plot, khatian, deed and office in this repository is invented. Sutro is a prototype and is **not legal advice**.

## What it does

A buyer (or their lawyer) enters the documents they have actually been given for one plot — khatians from each survey, deeds, mutation records, heir certificates, registry-search results — and the proposed sale. Sutro produces a **share account**: it traces, with exact fractions, how many decimals the supplied evidence accounts for in the seller's hands, and reports three things separately:

| Section | Meaning |
|---|---|
| **Contradictions** | Supplied documents make claims that cannot all be true as written (e.g. transfers citing the same khatian exceed what it records — a possible double sale). |
| **Missing evidence** | Something is unexplained or not covered by the supplied documents (e.g. a change between two khatians with no deed, gift, partition or decree to explain it; years not covered by any registry search). **Not** proof of wrongdoing. |
| **Unsupported — needs human review** | Scenarios Sutro deliberately does not compute (most inheritance cases, wills, non-Hanafi succession). No share is computed; the case is routed to a person. |

Every figure is shown with the **assumptions it depends on**, the **case revision and engine version** it was computed from, and links back to the **source documents**. A **document checklist** says which document to obtain next, from which office, and what it could clarify.

Sutro never determines legal ownership, possession, or whether a document is genuine. It states *what the supplied evidence supports* and what it does not.

### How it knows evidence is missing (without cheating)

Sutro sees only the entered documents. It never assumes an event that is not in the packet did not happen. Gaps are found from the documents themselves:

1. **References inside documents** — a deed recites the khatian it rests on and previous deeds; a mutation cites its deed. A referenced document that is not supplied is a *known gap*.
2. **Unexplained transitions** — if the chain of supplied events does not produce what a later khatian records, the difference is reported as *unexplained* (not as a contradiction).
3. **Uncovered years** — only a registry search (তল্লাশি) covering a stated period narrows the risk of undisclosed transfers. Years with no search are reported as uncovered, and the assumption "no transfers in those years" is listed explicitly.

Removing a deed from a packet therefore does **not** make Sutro "detect" it; `tests/engine.test.js` checks this.

## Run it

Requirements: Node.js ≥ 22.13 (verified here on 26.7), npm and a current browser. Install the pinned dependencies and build the explicit public allowlist first.

```bash
npm ci --ignore-scripts --omit=optional
npm run build
npm start
```
Open http://127.0.0.1:5173. The server exposes only the public `dist/` build. Audit calculations, PDF preview and optional crop reading run locally. Rebuild after source changes, or use `node scripts/serve.js 5173 --build`. Use `npm run start:full` for the existing registered private catalog on loopback port 5174; it does not expose raw dataset folders.

```bash
npm test
```
Runs 58 Node tests covering exact fractions, domain refusal paths, baseline parity, contracts, storage races, catalog policy and workflow readiness. `npm run test:e2e` runs the Chrome buyer journey and responsive/storage/PDF/OCR-review checks. See [the workflow redesign evidence](docs/implementation/UX_FLOW_REDESIGN.md).

### Site map

| Page | Purpose |
|---|---|
| `index.html` — Home | Outcome preview calculated from synthetic case B; start with your land or inspect a worked example. |
| `workspace.html` / `cases.html` — My cases | Resume drafts, see document/progress state, create a case, back up/restore, duplicate data or deliberately delete. |
| `setup.html` — Land & sale | Preparation, district/upazila/mouza, selected survey/dag, seller and proposed area. Creates a draft only after Continue. |
| `intake.html` — Documents | Five document types, source beside the fields, multiple photos/PDFs, PDF page navigation, experimental crop review and explicit local retention. |
| `review.html` — Evidence review | Required-data issues, name matching caution, document confirmation and analysis of the current revision. |
| `audit.html` — Findings | Main issue, plain-language history/record comparison, next action, prioritized source-linked findings, checklist and calculation details. |
| `timeline.html` — Evidence timeline | Supporting view of supplied events and registry-search coverage. |
| `report.html` — Case report | Plot/sale summary, findings, checklist, evidence register and readable provenance. Drafts are labelled; prepared reports print/save through the browser. |
| `library.html` — Examples / local references | Bilingual public example gallery. With local-full, inspect permitted research records before creating a reviewed-source draft. Not a government lookup. |
| `about.html` — How it works | Inputs, findings, scope, review, retention and dataset limitations. |
| `models.html` / `ocr.html` — Reading assistance | Supplemental research status/help; current real-form accuracy and release gates remain unaccepted. |

Cases use per-case IndexedDB storage with revision conflict detection; localStorage holds preferences and retained legacy originals. Source attachments default to memory and stay available while moving between a case's steps. Reload/close clears them unless explicitly retained. Export can include original scans; restoring a scan backup uses one transaction and resets review approvals. A case can be opened directly with `?case=demo-b`. Bangla and English are supported. See [source limits and backup details](docs/implementation/UX_FLOW_REDESIGN.md#source-files-and-backup).

### Demo packets

| Packet | Shows |
|---|---|
| **A — Seller's packet** | SA khatian → heir certificate → BS khatian. The BS record omits the widow and daughter; the chain accounts for 35 of the 50 decimals offered. No registry search covers any year. |
| **B — After a registry search** | A 2005–2015 search lists a 2011 deed by which the seller already sold 20 decimals citing the same BS khatian. Contradiction (over-commitment of BS-512); account drops to 15; 2011 sale has no supplied mutation. |
| **C — Predeceased son** | Whether the predeceased son left surviving children is not stated. Sutro reports missing information and computes nothing. Change the field to *No* → estate computed; *Yes* → routed to legal review (possible s.4 MFLO 1961). |

## Dynamic behaviour (what changes when you edit)

Every accepted edit increments the case **revision**; every view recomputes `analyze(packet)` from the current revision and prints which revision it shows. Invalid numbers are flagged where they are typed and listed as input errors by the engine — they are never treated as zero. Removing a document removes every finding that depended on it. A model suggestion is tagged with the revision at request time and discarded if the case changed meanwhile; only a value you accept enters the calculation.

## Inheritance rules — scope and validation status

Implemented (and only this): Muslim decedent, Hanafi school (or unstated → shown as an assumption), no bequest, heirs drawn only from husband / wife(s) / sons / daughters / father / mother, **and at least one surviving son**. Everything else returns *unsupported* or *missing* and no share is computed. A predeceased child does **not** by itself trigger the orphaned-grandchild rule: Sutro asks whether that child left children who survived the decedent.

**Validation status: pending qualified review.** The rules were checked by the developers against Qur'an 4:11–12 and four worked examples published on islamweb.net (cited in `tests/inheritance.test.js`). They have **not** been reviewed by a lawyer or a scholar of Islamic law. The UI labels every computed estate accordingly.

## Models (input assistance only)

Two small models help with *reading*, never with *deciding*. The following are historical experiment records, not current release acceptance or real-form accuracy claims. Approved ONNX artifacts and the runtime are self-hosted; inference is local and candidate text requires review. The manual flow remains usable when a reader fails. Independent model/data/runtime acceptance is still open.

| Model | Notebook | Data | What it does |
|---|---|---|---|
| Khatian text-line reader (CRNN + CTC) | `notebooks/01_khatian_cell_ocr_crnn.ipynb` | 107k line crops from the **synthetic** Form-5462-style khatian pages, split by land | Reads one cropped text line (names, dag numbers, shares, areas, remarks) → suggestion on the Intake page. Active run `khatian-crnn-20261014-215159`: CER 0.00 %, exact match 100 % on 10,801 held-out synthetic lines — a same-generator split, so this measures the synthetic distribution only. |
| Bangla digit classifier (small CNN) | `notebooks/02_numta_digit_cnn.ipynb` | NumtaDB (public, CC BY-SA 4.0), 32×32 | Reads one isolated handwritten digit → `ocr.html`. Active run `numta-cnn-20261014-215200`: held-out test accuracy 99.31 %, macro-F1 99.31 % (n = 3,602). |

Training workflow (Kaggle GPU; local fallback with `notebooks/run_local.py`): see `docs/runbook.md`. Results are published on the **Model results** page from the run artifacts under `artifacts/runs/<run-id>/` (`config.json`, `dataset_manifest.json`, `split_manifest.json`, `history.json`, `metrics.json`, `confusion_matrix.json`, `model_card.md`). **Numbers there measure the synthetic / NumtaDB distributions only; accuracy on real scanned khatians has not been measured.** Problem statement P1 is *not* claimed.

## Problem-statement coverage

| Statement | Claim |
|---|---|
| **P5** Citizen pre-purchase verification | **Primary — demonstrated** on synthetic packets. |
| **P3** Fraud & double-selling | **Partial — demonstrated**: over-commitment of a cited record, sale by a recorded-deceased person, registration/mutation mismatches *within supplied documents*. Does not detect forged paper. |
| P4 e-Mutation workflow | Not claimed. |
| P1 Historical record digitization | **Not claimed.** The line/digit readers are input-layer experiments on synthetic pages and isolated digits. |
| P2 Deed verification | Not claimed. |

## Data

- **Demo packets and samples** (`js/demo-packets.js`, `data/samples/`): hand-written and generated synthetic data. No real names, NIDs, phone numbers, addresses or land records anywhere in this repository.
- **Dataset bundle** (not in the repo; built with the tools described in `docs/dataset-bundle-card.md`): 5,794 synthetic khatian pages with field boxes and linked CSV tables (lands with 2–4 khatian versions each: CS → SA → RS → BS, inheritance and sale transitions as ground truth), 107k OCR line crops, 20,000 Sutro case packets with injected faults, NumtaDB digits. `data/manifest.json` is the aggregated inventory.
- **Restricted sources:** local research folders include real deed scans. Those originals stay private and excluded from the public build, browse results and unapproved training. Public examples are invented. Existing dataset delivery restrictions remain in force.

## Docs

`docs/workspace-audit.md` · `docs/architecture.md` · `docs/algorithms.md` · `docs/dataset-and-model-card.md` · `docs/runbook.md` · `docs/verification.md` · `docs/concept-note.md` · `docs/demo-script.md` · `docs/DOCUMENTATION.md`

## AI tool disclosure

This project was built with substantial assistance from **Claude (Anthropic)** via Claude Code, used for: drafting and refactoring the JavaScript engine, UI and CSS; writing tests; drafting Bangla and English interface strings; the dataset generators and training notebooks; and drafting the documentation. The team reviewed and edited the output. **Bangla strings were AI-drafted and need native-speaker review.** No AI model is used inside the evidence engine; the only trained models are the optional readers above.

## Layout

```
index.html cases.html intake.html timeline.html audit.html report.html models.html about.html ocr.html
js/fraction.js        exact rational arithmetic (BigInt; Bangla digits accepted)
js/inheritance.js     narrow succession calculator with explicit refusals
js/engine.js          packet analysis: ledgers, findings, coverage, checklist, assumptions (ENGINE_VERSION)
js/app.js             shared state, revisions, validation, forms, OCR assist, pages
js/ocr-adapter.js     browser inference (ONNX Runtime Web) for the two models
js/models-page.js     model-results page (reads artifacts/runs)
js/idb.js             IndexedDB store for attached scans
js/i18n*.js           strings (en, bn);  js/demo-packets.js  three synthetic cases;  js/hero3d.js  home scene
css/                  document skin, site chrome, workspace additions
tests/                Node and Chrome workflow/security/regression suites
notebooks/            training notebooks + run_local.py
kaggle/               kernel/dataset metadata;  scripts/kaggle.js  push/status/pull;  scripts/import-run.js  import a run
artifacts/            runs/<run-id>/ (metrics etc.), models/ (ONNX used by the app) — created by import-run.js
data/                 manifest.json, samples/
docs/                 documentation
```

## Team

| Role | Name | Affiliation |
|---|---|---|
| Student (Team Leader) | _[placeholder]_ | DIU |
| Student | _[placeholder]_ | DIU |
| Faculty mentor | _[placeholder]_ | DIU |
| Industry mentor | _[placeholder]_ | _[placeholder]_ |

## Changes since Round 1

_(To be filled before the Final Round, as required by the rulebook.)_

## Redesign roadmap and dataset delivery

The [professional redesign implementation plan](docs/PROFESSIONAL_REDESIGN_IMPLEMENTATION_PLAN.md)
defines 14 phases and 86 tasks for the next UI, dataset and security work. Its
original local-snapshot baseline must be reconciled with the newer application
already present on this branch before implementation.

The supplied sample datasets and the future approximately 15 GB corpus are kept
locally and are not uploaded with this delivery. Place the full corpus under
[`docs/datasets/full/`](docs/datasets/README.md), preserving original folders
and filenames. See the [local dataset notes](docs/dataset_archives/README.md)
and included dataset cards for setup, attribution and privacy requirements.
Dataset-backed functionality requires the planned indexing and API work.

## Licence

MIT. Third-party: Noto fonts (OFL), three.js (MIT), ONNX Runtime Web (MIT), NumtaDB (CC BY-SA 4.0 — the trained digit model is a derivative and is shared under the same licence).
