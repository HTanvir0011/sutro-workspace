# Buyer workflow redesign — 16 October 2026

This implements the owner's requested fixes to the ten-item UI/flow review. Changes remain local. Engine rules, raw datasets and existing model weights are unchanged.

| Review issue | Implemented behavior |
|---|---|
| Unclear homepage outcome | Compact homepage shows the real engine's 50-versus-15 synthetic example, a concrete finding and a direct route to its results. |
| Premature complex intake | `setup.html` explains what to have ready and asks for land/sale details. A draft is created only after Continue. |
| Plot identity buried | Mouza, district/upazila, selected survey/dag, seller and offered area come before documents. Existing survey mappings remain editable. |
| Decorative step navigation | Land & sale → Documents → Review → Findings → Report. Readiness depends on required entries, document review and the analyzed revision. Incomplete reports are marked Draft and their print action is disabled. |
| Technical results | Findings begin with the main unresolved issue, explained numeric comparisons and a relevant next step. Sources remain linked; calculations and assumptions are secondary. |
| Confusing library | Static mode is a bilingual example gallery with no unsupported record filters. Local-full retains capability-based record controls, explicit research context and cancellation guards. |
| Weak visual hierarchy | Smaller headings and tighter sections; distinct result preview, issue panels, comparison, review rows and report cover. Responsive desktop/Bangla mobile captures are included. |
| Competing navigation | Case workspace has focused navigation, persistent case identity/readiness and one sequence. Timeline is a supporting findings view. |
| Source friction | Multiple images and PDFs per document, bounded local PDF rendering/page navigation, crop review from a PDF page, source retention during case navigation, explicit leave choices, and scan-inclusive backups with validated atomic restore. |
| No report endpoint | Report includes land/sale summary, prioritized findings, follow-up checklist, evidence register and readable provenance. Print expands details; report has no self-referencing next action. |

## Running

Use Node 22.13 or newer (verified here on Node 26.7), then:

```text
npm install
npm run build
npm start
```

Open `http://127.0.0.1:5173`. After source changes rebuild, or use `node scripts/serve.js 5173 --build`. For the existing private catalog use `npm run start:full` on loopback port 5174 after building. No dataset ingestion is required for the public examples or manual case flow.

## Source files and backup

- Session-only is the default. Navigation among the case's steps retains source bytes in memory. Reloading or closing clears them. Following an in-app link out of a case offers explicit retention before leaving.
- **Keep scan on this device** stores its files in IndexedDB. Browser storage is neither encrypted nor guaranteed backup.
- **Export case → Include scans** creates a portable `.backup.sutro.json` containing available original files and entered values. **Case data only** omits file bytes.
- Restore validates structured values, source IDs, signatures/types and limits before writing. **Restore case and scans** explicitly retains the restored sources on this device; it saves the case and sources in one transaction. Imported approvals and analysis status are reset.
- JPEG/PNG: 15 MiB, 25 million pixels, maximum dimension 10,000 px. PDF: 20 MiB, at most 100 pages. At most 20 source files per document and 50 files / 40 MiB per case; backup input is bounded to 58 MiB.
- PDF.js 6.4.299 is pinned and self-hosted with its Apache-2.0 license. The renderer mounts canvas pages only; document scripts, links, forms and embedded actions are not mounted. `isEvalSupported`, WASM and remote resource loading are disabled. Protected/malformed PDFs are rejected; rendering failures preserve the supplied source/manual entry path. See [Mozilla API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html).
- PDF crop provenance identifies the source file, page, rendered dimensions and crop coordinates. Existing readers remain experimental; no real-form accuracy is claimed.

## Verification and limits

Acceptance tests cover a new buyer journey, review invalidation after edits, report readiness, exact inputs, checklist persistence, scan-inclusive backup/restore, session navigation and explicit retention, multi-file/two-page PDF rendering, gallery search, stale library selection, previous storage/OCR recovery cases, responsive layouts and print media.

Results: `npm test` — 58 passed; `npm run test:e2e` — 16 passed; `npm run check:release` — 69 public files passed, zero staged paths. All client modules pass syntax checks and the diff passes the whitespace check with Windows CRLF handling. The seven new buyer/library/PDF journeys also pass after final copy/layout corrections. Desktop, Bangla mobile, report and print screenshots were visually inspected.

Screenshots use invented examples and isolated test-case values. Browser screenshots are lab layout evidence, not a user study or accessibility certification. Full corpus acceptance, independent real-form model measurement and qualified domain review remain separate open gates.
