# Sutro algorithms

One section per algorithm that is actually implemented, with its interface, invariants, edge cases and complexity as read from the code. Paths are relative to the repository root. Symbols used in complexity notes: K khatians, D deeds, M mutations, C heir certificates, S registry searches, E = C + D + M + K events, L distinct names in a ledger, h heirs on one certificate, P total parties/owner rows.

## A. Exact rational arithmetic (`js/fraction.js`)

**Interface.** `new Fraction(n, d)` (BigInt-able values, `d` defaults to 1). `Fraction.from(v)` accepts a `Fraction`, a `bigint`, a finite `number` (converted through `String(v)`), or a string of the form `a/b`, `12`, `17.5`, optionally negative, with Bangla digits `০-৯` mapped to ASCII first; anything else throws. `Fraction.tryFrom(v)` returns `null` instead of throwing. Methods: `add sub mul div cmp eq lt gt isZero isNegative toString toDecimal(places = 2) isExactDecimal(places = 2)`; constants `Fraction.ZERO`, `Fraction.ONE`.

**Invariants.** Every instance is reduced by `gcd` and frozen; the denominator is always positive (sign moves to the numerator); a zero denominator throws at construction, so `"1/0"` is rejected by `from`/`tryFrom`; `div` by a zero fraction throws. No floating point is used anywhere in the share pipeline; `tests/engine.test.js` checks that every exported share is a `Fraction`.

**Edge cases.** `toDecimal` rounds half away from zero and trims trailing zeros; `isExactDecimal` reports whether that rendering lost information, and the UI prefixes `≈` when it did. `toString` prints integers without a denominator. A `number` input that `String()` renders in exponent form (for example `1e21`) does not match the decimal pattern and throws. Inputs such as `""`, `"abc"`, `"1//2"`, `"0.5.1"`, `"½"` are rejected (tested).

**Complexity.** Each operation does a constant number of BigInt multiplications plus one Euclidean `gcd`, so cost is proportional to the digit length of the operands; denominators stay minimal because every result is reduced.

## B. Packet validation and normalisation (`js/engine.js` parse block, `js/app.js` `validate`)

**Interface.** `analyze(packet)` reads `packet.docs`, `packet.plot`, `packet.offer`, `packet.asOfYear`, `packet.revision`, `packet.synthetic`. Helper functions: `asciiDigits(v)` maps Bangla digits to ASCII; `intYear(v)` is `parseInt` after that mapping, `null` when not finite; `norm(name)` trims, lower-cases and collapses whitespace; `splitList(v)` accepts an array or splits a string on `,`, `;` or newline; `khatianKey(k)` is `survey + '-' + khatianNo` (survey `?` when absent).

**Rules per document type.** A document that fails a rule is recorded as `inputErrors.push({docId, field, value})` and skipped entirely; a row that fails is skipped individually.

| Type | Required to parse | Rows |
|---|---|---|
| `khatian` | `area` > 0 (`field: area`), `year` | owners: nameless rows ignored; `share` must parse and be non-negative (`field: share`) |
| `deed` | `year` | sellers/buyers: nameless rows ignored; `area` > 0 (`field: sellerArea` / `buyerArea`) |
| `mutation` | `year` | — |
| `heirCert` | `deathYear` | heir rows are validated by `computeEstate` (section H) |
| `search` | `fromYear`, `toYear`, `toYear >= fromYear` (`field: period`) | — |

**Invariants.** A missing or malformed value is never treated as zero: it is either an input error (document dropped) or an ignored row, and `summary.inputErrors` counts them. The raw text in the packet is never rewritten; Bangla digits remain as typed and are only normalised at read time (tested with `১০০`, `১৯৬২`, `৫০`). `asOfYear` falls back to the current calendar year when unparsable; the offer is simply `null` (no error) until `offer.seller` is non-empty and `offer.area` parses as a positive fraction.

**UI validation (`app.js`).** Inputs marked `data-kind="num"` must satisfy `Fraction.tryFrom` and be non-negative; `data-kind="year"` must match `^[0-9০-৯]{4}$`. Invalid fields are flagged inline but still stored, so the engine reports them as input errors on the other pages.

**Complexity.** One pass over all documents and rows: O(K + D + M + C + S + P).

## C. Evidence-reference indexing (`js/engine.js`)

**Indexes built.**

- `khatianByKey`: khatians sorted by year ascending, first document per key wins (an earlier duplicate key shadows a later one as a reference target; both still appear in the timeline).
- `deedByNo`: first deed per non-empty `deedNo`. A later deed with the same number is dropped from `uniqueDeeds`; if its signature (year, normalised seller and buyer names with areas) differs, `C_DUP_DEED` is raised citing both. Deeds without a number are kept but can never be cited.
- `deathOf`: `norm(decedent)` to certificate (the last certificate for a name wins).
- `commitments`: `(khatianKey, seller)` to the list of transfers that recite that khatian (deeds and the offer), used for the over-commitment check (section E).

**Reference checks.**

| Reference | Resolved against | Missing | Resolved but inconsistent |
|---|---|---|---|
| deed `basisKhatian` | `khatianByKey` | `M_REF_KHATIAN` | khatian dated after the deed: `C_BASIS_LATER`; a seller not among its owners: `C_BASIS_NOT_OWNER`; otherwise the seller's area is committed against that khatian |
| deed `previousDeeds` (each) | `deedByNo` | `M_REF_DEED` (`from` = citing deed) | a seller who was not a buyer in the previous deed: `C_PREV_DEED_PARTY` |
| mutation `deedNo` | `deedByNo` | `M_REF_DEED` (`from` = case no.) | mutation year before the deed: `C_MUTATION_BEFORE_DEED`; a transferee who is not a buyer: `C_MUTATION_PARTY`; otherwise the deed is marked mutated |
| search `deedsFound` (each) | `deedByNo` | `M_SEARCH_DEED_NOT_SUPPLIED` | — |
| supplied deed vs search window | search period and dag | — | deed with a number, inside the period, dag compatible (search has no dag, deed has no dag, or equal), not listed: `C_SEARCH_OMITS` |
| offer `basisKhatian` | `khatianByKey` | `M_REF_KHATIAN` | seller not an owner: `C_BASIS_NOT_OWNER`; otherwise the offered area is committed with kind `offer` |
| dag mapping `plot.dags[survey]` | khatian `dag` / deed `dag` | — | khatian dag differs from the mapping for its survey, or a deed dag is not among the mapped dags (only when a mapping exists): `M_DAG_UNMAPPED` |

**Invariants.** Only identifiers present in the packet are ever compared; nothing is inferred from an identifier that is absent (removing a deed from demo B leaves `M_SEARCH_DEED_NOT_SUPPLIED`, not a contradiction, and removing the search too leaves no trace of the deed number; both tested).

**Complexity.** Building the maps is O(K + D + C). Deed checks are O(D · (sellers + previous deeds)); the search-window scan is O(S · D) plus O(S · listed numbers); dag checks are O(K + D).

## D. Chronological replay and dual accounts (`js/engine.js`, class `Ledger`)

**Event list.** Deaths (one per certificate, year = `deathYear`), deeds (`uniqueDeeds`), mutations, and every khatian except the root. Sorted by year, then by `TYPE_ORDER = { death: 0, deed: 1, mutation: 2, khatian: 3 }`; the sort is stable, so same-year, same-type events keep packet order. The root is the earliest khatian; without one, `M_NO_ROOT` is raised and no account is kept (reference checks still run).

**Ledger.** A map from `norm(name)` to `{name, share}` (share of the whole plot) plus `pending`, a map from name to the set of decedents whose estate the person may inherit from but which could not be distributed. Setting a share to zero deletes the entry; `addPending` creates a zero-share entry so the person stays visible. `snapshot()` sorts by share descending, then name.

**Two accounts.** The *chain* ledger starts from the root owners and replays every supplied event. The *record* ledger starts the same way but is *replaced* by each later khatian's owners when that khatian's event is reached, then adjusted by subsequent deaths and deeds. Both are snapshotted after every event into `timeline[]` together with the plot area in force.

**Event handlers.**

- *Before root*: a non-khatian event earlier than the root year is listed with note `before_root` and not applied.
- *Death* (`applyDeath`): `held` = decedent's share, `inherited` = decedent's pending estates. In the chain, a decedent with no holding and nothing pending raises `M_DECEDENT_NO_HOLDING`. The decedent's share and pending set are cleared. Heirs are the named, non-predeceased rows of the certificate. If the estate has a distribution (stated or computed, section H), each heir receives `held × share`; any estates the decedent was pending on are forwarded to every heir as pending. Otherwise every heir becomes pending on the decedent (plus forwarded estates) and the chain notes `estate_unresolved`.
- *Deed* (`applyDeed`): plot area = `areaAt(year)`, the area of the latest khatian dated at or before the deed (root area by default). Each seller gives up `area / plotArea`. If the seller holds less: when the seller is pending on an estate, note `chain_depends_on_estate` / `record_depends_on_estate`; otherwise `M_CHAIN_SHORTFALL` / `M_RECORD_SHORTFALL` (held and sold in decimals). The seller's share is then set to zero, never negative. Buyers receive `area / plotArea`. Independently of the ledgers, `C_DEED_SPLIT` (seller total not equal to buyer total) and `C_DEAD_SELLER` (a seller whose certificate records death in an earlier year) are checked.
- *Mutation*: reference checks only (section C); no ledger change.
- *Later khatian*: for the union of chain names and recorded owners, pending names are listed as `uncomparable`; for the rest, chain share versus recorded share (summed over duplicate owner rows) is compared and every difference, converted to decimals of that khatian's area, goes into one `M_UNEXPLAINED` finding. The record ledger is then reset to the khatian's owners.

**Afterwards.** A deed with no supplied mutation and no later khatian listing all its buyers raises `M_DEED_NO_MUTATION`.

**Same-year assumption.** Only years are known. `typesByYear` collects the event types per year; when more than one type shares a year, assumption `A_YEAR_ORDER` lists those years (tested: absent for demo B, present when the deed is moved to the BS khatian's year).

**Other invariants.** Shares are fractions of the whole plot, so a change of recorded area between surveys is handled by `areaAt` and declared by `A_AREA_CHANGES` (tested: area 98 makes 1/2 render as 49 decimals). An unexplained transition is always `missing`, never `contradiction`. Two certificates for the same decedent are both replayed; the second finds nothing to distribute.

**Complexity.** Sorting is O(E log E). Each event does O(L) work for the snapshots (plus O(L + owners) for the khatian comparison and O(heirs × pending) for deaths), so the replay is roughly O(E · L).

## E. Rule-based findings (`js/engine.js`)

Every finding is `{kind, code, params, docs}`. Codes, grouped by kind, each with the condition that raises it:

**Contradictions**

- `C_SUM` — a khatian's owner shares do not sum to 1.
- `C_DUP_DEED` — two deeds share a number but differ in year, parties or areas.
- `C_DEED_SPLIT` — a deed's seller areas and buyer areas differ.
- `C_DEAD_SELLER` — a seller's heir certificate records death in a year before the deed.
- `C_BASIS_LATER` — a deed cites a khatian dated after the deed.
- `C_BASIS_NOT_OWNER` — a seller (or the offer's seller) is not an owner on the khatian they cite.
- `C_BASIS_OVERCOMMIT` — two or more transfers citing the same khatian for the same seller total more than it records for that seller (possible double sale; the offer counts as a transfer).
- `C_BASIS_EXCEEDED` — a single transfer citing a khatian exceeds what it records for the seller.
- `C_PREV_DEED_PARTY` — a seller was not a buyer in the previous deed the deed cites.
- `C_MUTATION_PARTY` — a mutation names a transferee who is not a buyer in its deed.
- `C_MUTATION_BEFORE_DEED` — a mutation is dated before its deed.
- `C_SEARCH_OMITS` — a supplied, numbered deed inside a search's period (and dag) is not in the search's list.
- `C_STATED_SUM` — stated inheritance shares on a certificate do not sum to 1.
- `C_STATED_INCOMPLETE` — some eligible heirs have a stated share and others do not, or one cannot be parsed.
- `C_CERT_INVALID` — `computeEstate` returned an `invalid` reason (nameless heir, unknown relation, husband and wife both listed, more than one husband/father/mother, more than four wives).

**Missing evidence**

- `M_NO_ROOT` — no parseable khatian.
- `M_DAG_UNMAPPED` — a document's dag does not match the plot's dag mapping.
- `M_UNEXPLAINED` — a later khatian differs from what the chain produces.
- `M_DEED_NO_MUTATION` — a deed has no supplied mutation and is not reflected by a later khatian.
- `M_COVERAGE_GAP` — years between the root and `asOfYear` not covered by any search (section F).
- `M_SEARCH_DEED_NOT_SUPPLIED` — a search lists a deed number that was not supplied.
- `M_REF_DEED` — a deed or mutation cites a deed that was not supplied.
- `M_REF_KHATIAN` — a deed or the offer cites a khatian that was not supplied.
- `M_CHAIN_SHORTFALL` / `M_RECORD_SHORTFALL` — a seller transfers more than the chain / record account holds for them.
- `M_DECEDENT_NO_HOLDING` — a decedent holds nothing in the chain at death.
- `M_ESTATE_INFO` — `computeEstate` returned a `missing` reason (religion not stated, no heirs, predeceased child with unknown issue).
- `M_UNCERTIFIED` — one finding counting all documents with `provenance: seller_copy`.

**Needs human review**

- `U_INHERITANCE` — `computeEstate` returned an `unsupported` reason; no share is computed.
- `U_STATED_DIFF` — stated shares were used and differ from Sutro's own computed shares.
- `U_STATED_USED` — stated shares were used because the scenario is not computable.

**Stated shares.** For a certificate whose eligible (named, surviving) heirs carry any `statedShare`, all of them are parsed; failure gives `C_STATED_INCOMPLETE`, a sum other than 1 gives `C_STATED_SUM`, otherwise the stated distribution is used (`estate.used = 'stated'`) and compared name by name with the computed one when available.

**Assumptions** (`result.assumptions`, codes rendered from `js/i18n.js`): `A_GENUINE`, `A_NAMES`, `A_SAME_PLOT` always; `A_HEIRS_COMPLETE` and `A_RULES_PENDING` when any estate was computed; `A_NO_BEQUEST` / `A_HANAFI` when the calculator assumed them; `A_STATED_SHARES` when stated shares were used; `A_NO_HIDDEN_TRANSFERS` when coverage gaps exist; `A_AREA_CHANGES`; `A_YEAR_ORDER`.

**Checklist** (`buildChecklist`): `CHECK_MAP` maps missing and review codes to a document item (`certified_deed`, `certified_khatian`, `transfer_records`, `mutation_record`, `registry_search`, `acquisition_docs`, `heir_details`, `dag_concordance`, `certified_copies`, `legal_review`); any contradiction without a mapping becomes `resolve_conflict`. Items are deduplicated and keep the indexes of the findings that need them. Office names in the strings are indicative.

**Complexity.** Each rule is a linear or pairwise scan already counted in sections C and D; the over-commitment pass is O(number of commitment groups × items).

## F. Coverage intervals (`js/engine.js`)

**Interface.** `coverage = { from: rootYear | null, to: asOfYear, covered: [[from, to, docId]], gaps: [[from, to]] }`.

**Algorithm.** Each search becomes a window clipped to `[root year, asOfYear]`; empty windows are dropped; windows are sorted by start. A cursor starts at the root year: for each window, a gap `[cursor, start - 1]` is emitted when the window starts after the cursor, then the cursor moves to `max(cursor, end + 1)`. A final gap covers `[cursor, asOfYear]` if anything remains. Any gap raises one `M_COVERAGE_GAP` listing all gaps and adds `A_NO_HIDDEN_TRANSFERS`.

**Invariants.** Years are inclusive integers; overlapping and nested windows merge naturally; a search's dag does not affect coverage (it only affects `C_SEARCH_OMITS`). Without a root khatian there is no coverage object content (`from` is `null`).

**Edge cases.** Searches entirely before the root year or after `asOfYear` contribute nothing. Demo A yields the single gap `[1962, 2026]`; demo B yields `[1962, 2004]` and `[2016, 2026]` (tested).

**Complexity.** O(S log S) for the sort plus one O(S) sweep.

## G. Proposed-sale comparison and headline states (`js/engine.js`, `js/app.js`)

**Engine side.** When `offer.seller` is non-empty, `offer.area` parses as a positive fraction and a root exists: `plotArea = areaAt(asOfYear)`; for each ledger, `held = share(seller) × plotArea`, `pending = pendingOf(seller)`, and `status` is `exceeds` when the offered area is greater than `held` and nothing is pending, `undetermined` when it is greater but an estate is pending, otherwise `within`. The result is `offer = { seller, area, basis, plotArea, chain: {held, pending, status}, record: {held, pending, status} }`. The cited khatian, if any, goes through the reference checks of section C.

**Headline (`headlineOf` in `app.js`).** No offer: `noOffer`. Both accounts `exceeds`: `headline_exceeds`. Exactly one `exceeds`: `headline_split`. Any `undetermined`: `headline_undetermined`. Otherwise, any contradiction, missing or review finding: `headline_gaps`; none: `headline_clean`. Tone: `headline_clean` neutral; `headline_gaps`, `headline_undetermined`, `noOffer` amber; the rest red. The cases page shows the same headline with the three counts.

**Invariants.** The two accounts are reported separately and can disagree (demo A: chain 35 decimals, record 50, offer 50, so chain `exceeds` and record `within`). Pending estates only change the status when the offer is larger than the determinate holding.

**Complexity.** O(1) beyond ledger lookups.

## H. Inheritance scope and refusals (`js/inheritance.js`)

**Interface.** `computeEstate(cert)` with `cert = { religion, school, will, heirs: [{name, relation, status, childrenSurvived}] }` returns `{ status, reasons: [{kind, code, params}], assumptions: [code], shares: [{name, relation, share, basis}], excluded: [{name, reason}] }`. `RULES_STATUS` is `pending-qualified-review`; `RULE_SOURCES` lists Qur'an 4:11, 4:12 and the islamweb.net worked examples cited in `tests/inheritance.test.js`.

**Checks, in order.** Religion `unknown` → missing `religion_unknown`; not `muslim` → unsupported `religion_other`. For Muslims, school `unknown` → assumption `school_assumed_hanafi`; not `hanafi` → unsupported `school_other`. Will `yes` → unsupported `will_yes`; `unknown` → assumption `no_bequest_assumed`. No heirs → missing `no_heirs_listed`. Per heir: empty name → invalid `heir_without_name`; relation outside the list → invalid `unknown_relation`; `other` → unsupported `other_relative`; predeceased son/daughter with `childrenSurvived` `yes` → unsupported `predeceased_child_with_issue`, `unknown` → missing `predeceased_child_issue_unknown`, `no` → excluded `predeceased_no_issue`; any other predeceased relative → excluded `predeceased_not_heir`. Counts: more than one husband, husband and wife together, more than four wives, more than one father or mother → invalid. No surviving son → unsupported `no_surviving_son`, except when a predeceased child with unknown issue is already reported (that missing fact could change every share and is reported alone).

**Status precedence.** `invalid` > `unsupported` > `missing` > `computed`. When the status is not `computed`, `assumptions` is cleared and `shares` stays empty (tested for every refusal path).

**Shares when computed.** Husband 1/4; wives share 1/8 equally; father 1/6; mother 1/6 (basis strings `Q4:12`, `Q4:11`, `Q4:11+IW`). Residue = 1 minus the fixed shares, split into `2 × sons + daughters` units: a son takes two units, a daughter one.

**Invariants.** Because a son always survives in the supported case, the fixed shares total at most 1/4 + 1/6 + 1/6 = 7/12, the residue is positive, and `'awl`/`radd` never arise; the shares sum to exactly 1 for all 240 spouse/parent/children combinations exercised by the tests, with son = 2 × daughter. The calculator never infers facts: a predeceased child is only excluded when the certificate says `no` surviving children.

**Engine integration.** Reasons map to findings (`unsupported` → `U_INHERITANCE`, `missing` → `M_ESTATE_INFO`, `invalid` → `C_CERT_INVALID`); the distribution feeds `applyDeath` (section D); stated shares override the computed ones (section E).

**Complexity.** O(h) per certificate.

## I. Model-assisted extraction (`js/ocr-adapter.js`, `js/app.js`, `ocr.html`)

**Availability.** `init(kind)` fetches the metadata JSON (`artifacts/models/khatian_ocr.charset.json` or `numta_cnn.preprocessing.json`), sends a `HEAD` request for the `.onnx` file, injects `onnxruntime-web@1.20.1` from jsDelivr and creates a WASM session. Any failure yields `null`; `readLine`/`readDigit` then throw `model-unavailable` and the UI shows the "model not included in this build" message. Sessions are cached per kind.

**Line reader preprocessing (`prepLine`).** The selected crop is scaled to height `H = meta.height || 40`; the width is scaled proportionally, at least 16 and rounded up to a multiple of 4; the canvas is filled white before drawing so padding is white; pixels become grayscale (`0.299 R + 0.587 G + 0.114 B`) / 255 and are normalised as `(g − 0.5) / 0.5`. Input tensor `image` of shape `[1, 1, H, W]`. This mirrors the notebook's collate step (white padding to a multiple of 4, same normalisation).

**CTC greedy decode (`ctcDecode`).** The output `logprobs` has shape `[T, 1, V]` with `T = W / 4`. For each time step the arg-max class is taken; a class is emitted only when it differs from the previous step's class and is not the blank (index 0), mapping index `k` to `chars[k − 1]` from the charset file. This is the same greedy decode as the notebook's `decode`; there is no language model or beam search.

**Digit reader preprocessing (`prepDigit`).** The bounding box of dark pixels (mean channel value below 160) is found; if none, `null` is returned ("Nothing drawn"). A square of side `max(width, height) × 1.3 + 8` centred on the box is resampled to 32×32 on white, then inverted to `(255 − gray) / 255` so ink is bright, matching the NumtaDB conversion. Output `logits` of shape `[1, 10]` is soft-maxed in JavaScript; `classes` come from the preprocessing file. The page states that the bars are not calibrated confidences.

**Confirm step (`openOcr`, `runOcr`, action `ocr-use`).** The dialog draws the attached scan on a canvas (scaled to at most 2200 px wide). The user drags a box around one line (boxes smaller than 8×6 px are ignored). The crop is read and the suggestion is placed in an editable text box next to a selector of the document's fields (top-level fields and row fields from `FIELD_KEYS`/`ROW_KEYS`). Nothing is written until Accept: then `pathSet(packet, path, text)` stores the text, `packet.ocrRaw[path]` records it, `commit()` bumps the revision and the editor re-renders. Discard clears the suggestion; Escape or Close hides the dialog.

**Stale handling.** `runOcr` captures `rev = packet.revision` before awaiting inference. When the result arrives, if the current case is a different object or its revision changed, the suggestion is dropped and "The case changed while the reader was working" is shown; the packet is untouched.

**Invariants.** The engine never sees the model; only text the user accepted enters the packet, through the same `commit()` path as typed edits. Model files are optional at runtime: when they are absent every page works in manual mode.

**Complexity.** `prepLine` and `prepDigit` are O(W × H) over the crop or pad pixels; `ctcDecode` is O(T × V); the soft-max is O(10). Inference cost inside ONNX Runtime is not derived here.

## Closing note: two separate evaluations

- **Engine evaluation** is the `node --test` suite (`tests/engine.test.js`, `tests/inheritance.test.js`, `tests/fraction.test.js`): hand-written demo packets, regression scenarios, no-hidden-knowledge checks, four externally published inheritance examples and refusal paths. The 20,000 generated packets in the dataset bundle (`tools/gen_packets.py`, verified by `tools/verify_packets.js`) were produced by rules written by the same author as the engine; agreement between them is a generator-versus-engine self-consistency check and **not an independent benchmark** of real-world detection accuracy.
- **Model evaluation** is what the notebooks write to `metrics.json` on their held-out splits: synthetic printed khatian lines (nb01) and NumtaDB handwritten digits (nb02). Those numbers measure the synthetic or isolated-digit distribution only; accuracy on real scanned khatians is not measured, and they say nothing about land verification. At the time of writing the training runs are still in progress on Kaggle: artifacts pending.
