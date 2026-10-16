# Sutro implementation progress

Started 15 October 2026 (Asia/Dhaka). Local changes only. No AGENTS.md found at C:/, C:/land, repository root or code subdirectories. Initial branch: main; initial worktree clean.

Status: pending / in progress / complete / blocked. Completion requires recorded acceptance evidence. Scope remains all 14 phases and 86 exact task IDs. Available corpus is not the requested 15 GB.

| Task | Scope | Status | Changed files / checks / blocker / next dependency |
|---|---|---|---|
| P00-T01 | — Source and workspace inventory | complete | BASELINE.md, ARCHITECTURE_DECISIONS.md, engine-baseline.json, baseline-browser.json; 39/39 tests; 18 route captures. Next P01. |
| P00-T02 | — Runtime baseline | complete | BASELINE.md, ARCHITECTURE_DECISIONS.md, engine-baseline.json, baseline-browser.json; 39/39 tests; 18 route captures. Next P01. |
| P00-T03 | — Dataset readiness | complete | BASELINE.md, ARCHITECTURE_DECISIONS.md, engine-baseline.json, baseline-browser.json; 39/39 tests; 18 route captures. Next P01. |
| P00-T04 | — Product decisions | complete | BASELINE.md, ARCHITECTURE_DECISIONS.md, engine-baseline.json, baseline-browser.json; 39/39 tests; 18 route captures. Next P01. |
| P00-T05 | — Acceptance fixtures | complete | BASELINE.md, ARCHITECTURE_DECISIONS.md, engine-baseline.json, baseline-browser.json; 39/39 tests; 18 route captures. Next P01. |
| P01-T01 | — Public build allowlist | complete | P01_SECURITY_BOUNDARY.md; security/browser negatives and actual worker/CSP parity passed. Next P02. |
| P01-T02 | — Static server replacement | complete | P01_SECURITY_BOUNDARY.md; security/browser negatives and actual worker/CSP parity passed. Next P02. |
| P01-T03 | — Git/publication exclusions | complete | P01_SECURITY_BOUNDARY.md; security/browser negatives and actual worker/CSP parity passed. Next P02. |
| P01-T04 | — Input/rendering audit | complete | P01_SECURITY_BOUNDARY.md; security/browser negatives and actual worker/CSP parity passed. Next P02. |
| P01-T05 | — Request and execution controls | complete | P01_SECURITY_BOUNDARY.md; security/browser negatives and actual worker/CSP parity passed. Next P02. |
| P01-T06 | — Browser policy | complete | P01_SECURITY_BOUNDARY.md; security/browser negatives and actual worker/CSP parity passed. Next P02. |
| P02-T01 | — Module boundaries | complete | Core/repository/provider/page modules; Node engine snapshot parity and Chrome controller journeys. See P02_CONTRACTS_STORAGE.md. |
| P02-T02 | — Versioned packet schema | complete | Contract tests reject unsupported envelope/nested packet versions, unsafe structures and IDs; browser import strips review authority and preserves exact source values. |
| P02-T03 | — Exact input normalization | complete | Contract/domain tests cover Bangla digits, strict years, leading zeros, malformed values and exact fractions. |
| P02-T04 | — IndexedDB case repository | complete | State tests and real Chrome IndexedDB journeys cover save draining, failure/export/retry, conflicts, blocked upgrade recovery and atomic clear. |
| P02-T05 | — Legacy migration and attachments | complete | Interrupted migration resumes without overwriting saved cases; originals retained. Chrome verifies session/persistent scans, failed opt-out rollback and document cleanup. |
| P02-T06 | — Typed operational states | complete | Save draining, explicit readiness/analysis revisions, stale case/crop/record guards, abortable library views and checklist persistence covered in Node/Chrome. See UX_FLOW_REDESIGN.md. |
| P02-T07 | — Data provider interface | in progress | Static-demo covered in browser; catalog policy tests pass. Paired local-full browser/provider acceptance remains. |
| P03-T01 | — Design tokens | in progress | See phase evidence; acceptance checks ongoing. |
| P03-T02 | — Shared components | in progress | See phase evidence; acceptance checks ongoing. |
| P03-T03 | — Motion primitives | in progress | See phase evidence; acceptance checks ongoing. |
| P03-T04 | — Responsive/accessibility specimens | in progress | See phase evidence; acceptance checks ongoing. |
| P03-T05 | — i18n presentation | in progress | See phase evidence; acceptance checks ongoing. |
| P04-T01 | — Home redesign | in progress | See phase evidence; acceptance checks ongoing. |
| P04-T02 | — Navigation and trust content | in progress | See phase evidence; acceptance checks ongoing. |
| P04-T03 | — About/methodology redesign | in progress | See phase evidence; acceptance checks ongoing. |
| P04-T04 | — Real capability/status binding | in progress | See phase evidence; acceptance checks ongoing. |
| P04-T05 | — Metadata and page performance | in progress | See phase evidence; acceptance checks ongoing. |
| P05-T01 | — My cases | in progress | See phase evidence; acceptance checks ongoing. |
| P05-T02 | — Guided intake | complete | setup → documents → review → findings → report buyer journey passes; no draft before setup continuation. |
| P05-T03 | — Source and field layout | in progress | See phase evidence; acceptance checks ongoing. |
| P05-T04 | — Validation/recovery | in progress | See phase evidence; acceptance checks ongoing. |
| P05-T05 | — Review checklist and provenance | in progress | See phase evidence; acceptance checks ongoing. |
| P05-T06 | — Import/export usability | complete | Explicit data/scans backup choices, previewed restore, atomic case+scan transaction, fresh import IDs and reset review authority; Chrome end-to-end restore passes. |
| P06-T01 | — Dataset source registry | in progress | See phase evidence; acceptance checks ongoing. |
| P06-T02 | — Streaming inventory | in progress | See phase evidence; acceptance checks ongoing. |
| P06-T03 | — Format and relationship validation | in progress | See phase evidence; acceptance checks ongoing. |
| P06-T04 | — Integrity and split preservation | in progress | See phase evidence; acceptance checks ongoing. |
| P06-T05 | — SQLite catalog generation | in progress | See phase evidence; acceptance checks ongoing. |
| P06-T06 | — Preview derivatives | in progress | See phase evidence; acceptance checks ongoing. |
| P06-T07 | — Operations and full-corpus run | in progress | See phase evidence; acceptance checks ongoing. |
| P07-T01 | — Repository/query layer | pending | P00 baseline underway; see BASELINE.md. |
| P07-T02 | — Policy enforcement | pending | P00 baseline underway; see BASELINE.md. |
| P07-T03 | — Secure media streaming | pending | P00 baseline underway; see BASELINE.md. |
| P07-T04 | — Lifecycle/caching | pending | P00 baseline underway; see BASELINE.md. |
| P07-T05 | — Resource and origin protections | pending | P00 baseline underway; see BASELINE.md. |
| P07-T06 | — Real readiness | pending | P00 baseline underway; see BASELINE.md. |
| P08-T01 | — Library UI | pending | P00 baseline underway; see BASELINE.md. |
| P08-T02 | — Dataset-aware states | pending | P00 baseline underway; see BASELINE.md. |
| P08-T03 | — Record detail/viewer | pending | P00 baseline underway; see BASELINE.md. |
| P08-T04 | — Versions and relationships | pending | P00 baseline underway; see BASELINE.md. |
| P08-T05 | — Selected record actions | pending | P00 baseline underway; see BASELINE.md. |
| P08-T06 | — Real browsing budget | pending | P00 baseline underway; see BASELINE.md. |
| P08-T07 | — Profile parity | pending | P00 baseline underway; see BASELINE.md. |
| P09-T01 | — Single-plot adapter | pending | P00 baseline underway; see BASELINE.md. |
| P09-T02 | — Partial interests and missing evidence | pending | P00 baseline underway; see BASELINE.md. |
| P09-T03 | — Domain validation review | pending | P00 baseline underway; see BASELINE.md. |
| P09-T04 | — Entity identity and evidence boundaries | pending | P00 baseline underway; see BASELINE.md. |
| P09-T05 | — Timeline and share audit UI | pending | P00 baseline underway; see BASELINE.md. |
| P09-T06 | — Report and checklist | pending | P00 baseline underway; see BASELINE.md. |
| P09-T07 | — Synthetic regression corpus | pending | P00 baseline underway; see BASELINE.md. |
| P10-T01 | — Training sources/configuration | pending | P00 baseline underway; see BASELINE.md. |
| P10-T02 | — Bounded-memory loaders | pending | P00 baseline underway; see BASELINE.md. |
| P10-T03 | — Task-specific models | pending | P00 baseline underway; see BASELINE.md. |
| P10-T04 | — Evaluation design | pending | P00 baseline underway; see BASELINE.md. |
| P10-T05 | — ONNX runtime package | pending | P00 baseline underway; see BASELINE.md. |
| P10-T06 | — Release thresholds and promotion | pending | P00 baseline underway; see BASELINE.md. |
| P11-T01 | — Safe source ingestion | pending | P00 baseline underway; see BASELINE.md. |
| P11-T02 | — Worker lifecycle | pending | P00 baseline underway; see BASELINE.md. |
| P11-T03 | — Crop/layout support | pending | P00 baseline underway; see BASELINE.md. |
| P11-T04 | — Candidate review UI | in progress | Isolated Chrome OCR fixture verifies crop/case staleness, review requirement and review reset after editing; actual model-backed accuracy/usability gate remains. |
| P11-T05 | — Apply and preserve provenance | in progress | Isolated Chrome fixture verifies corrected value, original candidate and captured crop metadata; real runtime end-to-end acceptance remains. |
| P11-T06 | — End-to-end accuracy and usability | pending | P00 baseline underway; see BASELINE.md. |
| P12-T01 | — Domain and contracts | pending | P00 baseline underway; see BASELINE.md. |
| P12-T02 | — Browser journeys | pending | P00 baseline underway; see BASELINE.md. |
| P12-T03 | — Visual and accessibility review | pending | P00 baseline underway; see BASELINE.md. |
| P12-T04 | — Security abuse cases | pending | P00 baseline underway; see BASELINE.md. |
| P12-T05 | — Real full-corpus benchmarks | pending | P00 baseline underway; see BASELINE.md. |
| P12-T06 | — Model/runtime verification | pending | P00 baseline underway; see BASELINE.md. |
| P12-T07 | — Release evidence and CI | pending | P00 baseline underway; see BASELINE.md. |
| P13-T01 | — Run/setup documentation | pending | P00 baseline underway; see BASELINE.md. |
| P13-T02 | — User guide and content accuracy | pending | P00 baseline underway; see BASELINE.md. |
| P13-T03 | — Release artifacts and local delivery | pending | P00 baseline underway; see BASELINE.md. |
| P13-T04 | — Hosted-full gate if selected | pending | P00 baseline underway; see BASELINE.md. |
| P13-T05 | — Backup/restore/rollback | pending | P00 baseline underway; see BASELINE.md. |
| P13-T06 | — Handoff evidence | pending | P00 baseline underway; see BASELINE.md. |

## Latest checkpoint — 16 October 2026

Owner-requested UI/flow correction: the ten-item review is implemented and mapped in UX_FLOW_REDESIGN.md. Added setup and review screens, focused case navigation, draft/readiness gates, plain-language prioritized findings, a calculated homepage example, an honest bilingual example gallery, a report endpoint with readable provenance, multiple source files/PDF page viewing, in-case session retention, explicit exit choices and scan-inclusive backups. PDF.js is pinned/self-hosted; document values and engine rules remain separate.

Verification for this correction: 58 Node tests; 16 Chrome journeys, including the new buyer-to-report-and-restore path, PDF/image multi-file viewing and PDF crop entry, review invalidation, incomplete report gates, stale record guards, bilingual/responsive checks and print media. Public build now contains 69 allowlisted files. Desktop/Bangla mobile homepage, gallery, screen report and print captures are under `screenshots/flow-*`. This is lab acceptance, not a user study or accessibility certification. Full-corpus/model/legal-review gates remain open. No publish or raw-data/model changes.

### Earlier storage checkpoint

P00/P01 and P02-T01–T05 are complete. Storage continuation fixes pending-edit save races, blocked IndexedDB retries, atomic case/scan clearing, attachment choice rollback/cleanup, and nested schema-version rejection. OCR review now rejects stale crops/cases and records the crop actually recognized; editing a candidate resets approval. Browser-test startup builds the current public source instead of reusing stale dist output.

Verification: `npm test` passes 55 tests. `npm run test:e2e` passes nine Chrome journeys, including the existing 40 route/width checks, migration interruption, quota recovery, export/import, scan retention, atomic clear and isolated OCR review fixtures. `npm run check:release` passes the 60-file public artifact boundary with no staged paths. Exact-engine snapshot assertions pass. OCR fixtures verify UI control flow only, not model accuracy. See P02_CONTRACTS_STORAGE.md for evidence and remaining acceptance.

P03–P05 UI foundation exists; full accessibility/print acceptance remains. Existing private inventory/catalog outputs are present for the available registered corpus; P06 full-corpus acceptance is still open. This continuation does not modify or regenerate raw datasets or existing models, and does not publish. Next dependency: finish P02-T06/T07 library/provider checks, then P03 component accessibility. Full approximately 15 GB and measured-model gates remain unaccepted.
