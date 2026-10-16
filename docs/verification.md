# Verification log

Date: 2026-10-15 · Engine 0.3.0 · Commit range: `686c282` → current. Everything below was actually run; items not run are listed as **not verified**.

## 1. Automated tests

Command: `node --test tests/*.test.js` (also `npm test`).

| Suite | Tests | Result |
|---|---|---|
| `tests/fraction.test.js` — exact arithmetic, parsing, rounding markers, Bangla digits | 5 | pass |
| `tests/inheritance.test.js` — 4 externally published reference cases (islamweb.net, cited in file), all 240 supported heir combinations sum to 1, every refusal path, predeceased-child handling, unknown school/will surfaced as assumptions | 13 | pass |
| `tests/engine.test.js` — three demo packets, **no-hidden-knowledge** (removing a deed / search never yields a finding about it), contradiction scenarios, input errors are never zero, stated shares, area changes between surveys, empty packet, checklist mapping, shares are Fractions not floats, engine version echo, same-year ordering assumption only when years are shared, Bangla digits in numeric fields, revision echo | 21 | pass |
| **Total** | **39** | **39 pass, 0 fail** |

Baseline before this work (commit `686c282`, measured by the workspace audit): 31 pass. The `fraction.test.js` file was missing from the original commit and has been restored.

## 2. Dynamic input → result behaviour (browser, desktop 1280×820, Chromium/Edge engine)

Served with `node scripts/serve.js 5174`; demo case B unless noted. Console: no script errors on any page (only the expected 404 for `artifacts/runs/index.json` while no training run is imported).

| Check (from the master plan §6) | Observed |
|---|---|
| Change offered area so it crosses the supported amount | Offer 50 → headline "offer exceeds what the supplied evidence supports" with contradiction `C_BASIS_OVERCOMMIT` (20 + 50 > 50). Offer 30 → headline "conflicting accounts" (chain 15 < 30 ≤ record 30) and the over-commitment finding **disappears** (20 + 30 = 50). Contradiction count 1 → 0. |
| Invalid value | Typing `abc` in *Area offered* flags the field inline ("Not a valid number — use an integer, a decimal (17.5) or a fraction (7/40)"), sets `aria-invalid`, bumps the revision; the engine lists it under *Input errors* and does **not** treat it as zero. |
| Bangla digits | `৩০` accepted as 30; the raw text `৩০` is what is stored in the case. |
| Revision tracking | Case bar shows Revision 0 → 1 → 2 across two edits; Audit and Report print "Analysis of revision 2, engine 0.3.0". Cases page shows the same revision. |
| Remove a deed | Covered by the automated no-hidden-knowledge tests (`engine.test.js`): removing deed 4417 leaves no finding that mentions it; the account returns to 35. |
| Add registry-search coverage | Covered by demo B vs A: coverage bar changes from one gap (1962–2026) to 2005–2015 covered with gaps on both sides; ownership is not asserted. |
| Unsupported heir scenario | Demo C: *children survived = unknown* → missing-information finding and **undetermined** chain account (not zero); *yes* → routed to human review; *no* → estate computed (automated test + earlier browser check). |
| Findings filter | Chip *Contradictions* → 0 of 4 shown (offer 30 state); text `4417` → 1 of 4 shown; counter "1/4 shown". |
| Record comparison (Timeline) | SA-87 vs BS-512: meta table (survey, number, year, dag changed; area same; copy type changed) and owner table (Karim only in A; Rahim, Salim only in B) with the chain account at each record. |
| Report | Meta line shows case id, generation date, revision and engine version; sections present: supports, not established, contradictions, missing, review, assumptions, checklist, coverage, estates, timeline. |
| Edit that must not change findings | Renaming the mouza on demo A: revision 0 → 1, but the finding set (`M_UNEXPLAINED`, `M_COVERAGE_GAP`, `M_UNCERTIFIED`) and the headline were identical before and after — no artificial change. |
| Import a packet file | `data/samples/packets/syn-0000.json` imported through the file input on Cases: a 4th row appears, tagged *Imported · declared synthetic* (the file's own declaration), with 6 documents and a live audit status (clean, 0/0/0). |
| Attach a scan, reload | A sample page attached to SA-87 on demo A: preview and *Read from scan* button appear, revision increments; after a full reload the preview is restored from IndexedDB. |
| Model results page with no run | Honest empty state: "No completed training run is included in this build…"; selector empty. |
| About | Engine version shown; model metrics "pending" until a run is imported. |
| Home scene | WebGL canvas rendered with the 5 documents of demo B; year slider recomputes the caption from the engine timeline: 1970 → Karim 100 dec; 1990 → Rahim 35, Salim 35, Rokeya 17.5, Amena 12.5; 2026 → Salim 35, Farid 20, Rokeya 17.5, Rahim 15, Amena 12.5. |

## 3. Mobile (375×812 emulation)

| Page | Observed |
|---|---|
| Home | SVG fallback shown instead of WebGL (narrow viewport rule), 5 document cards generated from the same data, slider and caption work; no horizontal overflow (`scrollWidth == innerWidth`). |
| Cases | Table collapses to stacked labelled rows; actions wrap; no overflow. |
| Timeline / Audit | No overflow; comparison selects stack vertically; case bar wraps; menu button replaces the nav. |

## 4. Storage and failure states

| Item | Status |
|---|---|
| Cases persist across reload (localStorage) | verified (revision and edited offer survive navigation between pages) |
| Scans persist across reload (IndexedDB) | verified (scan attached through the file input, page reloaded, preview restored) |
| Storage quota failure | handled in code (toast "Could not save…", edit kept in memory); **not verified** |
| Model file missing | verified: Intake "Read from scan" reports "line-reader model is not included"; `ocr.html` reports the missing model; manual entry continues |
| Import | valid file verified (see §2); malformed-file rejection handled in code (schema check, 5 MB cap) but **not verified** |
| Reduced motion / no WebGL fallback | code path exists (`matchMedia('(prefers-reduced-motion: reduce)')`, WebGL probe); narrow-viewport fallback verified; reduced-motion **not verified** |
| Keyboard access | skip link, focus styles, hero `tabindex` + arrow keys; filter chips focusable; **not systematically verified** |
| Print | print stylesheet present; **not verified** |
| Offline | **not verified**; the 3D scene and the model readers load libraries from a CDN, so they need network; the audit engine itself has no network dependency |

## 5. Model training and inference

See `docs/dataset-and-model-card.md`.

| Run | Status | Imported | Headline (held-out test) |
|---|---|---|---|
| `numta-cnn-20261014-215200` (digit classifier, Kaggle GPU, 20 epochs) | completed | yes, **active** | accuracy 99.31 %, macro-F1 99.31 %, n = 3,602 |
| `khatian-crnn-20261014-215159` (line reader, Kaggle GPU, 30 epochs) | completed | yes, **active** | CER 0.0000, exact match 100.00 %, n = 10,801 — same-generator test split; measures the synthetic distribution only |

Verified in the browser after import: the Model-results page lists the run with status *completed* / *active in this build*, shows the summary stats, two training curves, the per-class table, the per-source-set table and the 10×10 confusion matrix (raw / row-normalised toggle), and all run files download; `ocr.html` loads `artifacts/models/numta_cnn.onnx` through ONNX Runtime Web and reads programmatically drawn digits (result below).

Browser inference check on `ocr.html` (ONNX Runtime Web, wasm backend, model loaded from `artifacts/models/numta_cnn.onnx`): five digits were drawn programmatically as **font glyphs** (Nirmala UI, bold, 170 px) — not handwriting — and read by the model: ৩ → ৩ (93.5 %), ৭ → ৭ (67.8 %), ০ → **৩** (56.2 %, wrong), ৫ → ৫ (98.9 %), ৮ → ৮ (76.3 %). 4/5 correct on inputs outside the training distribution; the softmax values are not calibrated confidences. The page shows the run's test accuracy read from `metrics.json`.

**Read-from-scan, end to end (browser, `intake.html`, demo A with the sample page `L01853-v0.jpg` attached — a CS page in the Hind Siliguri font, 1602×934 px):**
- Adapter level: the eight annotated fields khatian no., dag no., mouza, land class, father line, village, area and district were cropped by their ground-truth boxes and read through `Sutro.ocr.readLine` (ONNX Runtime Web, wasm): **8/8 exact matches** (e.g. `পিং-ইমরান মিয়া`, `সাং- দক্ষিণপাড়া`, `০২৩৩`); 434 ms for the first line (model warm-up), 22–47 ms per line afterwards.
- UI level: *Read from scan* opened the overlay, the model loaded, a pointer drag over the khatian-number box produced the suggestion `১৭০` (ground truth `১৭০`), choosing the target field and **Accept** wrote `১৭০` into *Khatian no.* and moved the case from revision 2 to 3; the overlay closed. *Reset packet* restored the demo (khatian no. 87, revision 0) while the attached scan stayed in IndexedDB.
- This is a synthetic page from the same generator as the training data, so it demonstrates the mechanism, not real-scan accuracy.

Status before import: both Kaggle GPU runs (`sutro-numta-digit-cnn`, `sutro-khatian-ocr-crnn`) were pushed and running; local CPU smoke runs of both notebooks completed end-to-end (artifacts written, ONNX parity ≤ 2e-6 vs PyTorch) but are **not results**. This file is updated when the runs are imported with `scripts/import-run.js`.

**Engine evaluation and model evaluation are separate.** Passing unit tests is not real-world accuracy. The 20,000 generated packets agree 20,000/20,000 with the engine, but they were produced by rules written by the same author as the checker, so that is a self-consistency check, not an independent benchmark.

## 6. Interface redesign check ("Ledger & Ink", 2026-10-15)

| Check | Observed |
|---|---|
| Home, desktop (pane width ≈ 800 px and 1280 px emulation) | Navy hero band with Fraunces headline, copper primary action, trust line; WebGL scene renders the five documents of demo B as paper cards over the plot field; hover highlights a card and shows its label; year slider recomputes the caption; sections reveal on scroll; live example block shows the engine's current result for demo B; demo list rows show live audit status. Web fonts loaded: Fraunces, Inter, Noto Sans Bengali, Noto Serif Bengali. No console errors. |
| Home, Bangla | Headline, lede, buttons, slider caption and scene labels switch to Bangla (Noto Serif Bengali for display text); layout holds. |
| Home, mobile (375×812) | SVG fallback with the same five documents, hero text fully visible (entrance animation is non-blocking: content is visible by default and force-finished after 1.5 s), no horizontal overflow, sections stack in one column. |
| Internal pages | Intake, Audit, Report, Cases, Model results and About share the identity (ink masthead, ledger case bar, hairline sheets, copper focus states); verdict, accounts, findings and tables remain readable; filter chips are keyboard-operable (Enter/Space). |
| States | Loading skeleton and network-error box on Model results; empty states for findings/comparison/no runs; success toasts on save, what-if copy and export; selected states for the current case row, filter chips and steps; disabled Read button on the digit reader until the model loads and disabled styling for `.btn[disabled]`; invalid-field styling with inline messages. |
| Fix found during the check | A new `never` string for the cases table shadowed the home callout's key (showed "never"); renamed to `neverUpdated`. Fallback SVG document labels were clipped; cards widened. |

## 7. Known limitations remaining

- Inheritance rules pending qualified legal review; Bangla strings AI-drafted pending native review.
- No real khatian data exists publicly for evaluation; model numbers describe synthetic / NumtaDB distributions only.
- Names are matched by normalised string; two different people with the same written name are treated as one (listed as assumption A_NAMES).
- Same-year events are replayed in a fixed order (assumption A_YEAR_ORDER); no finer chronology is modelled.
