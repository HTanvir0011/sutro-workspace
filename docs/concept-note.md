# Sutro (সূত্র): a share account for one plot, from the evidence a buyer actually holds

**LandTech 2026 — Round 1 concept note** · Track: Digital Land Records, Verification & Digitization
**Problem statement: P5 — Citizen Pre-Purchase Verification** (P3 partially covered; see §6)

| | |
|---|---|
| Team name | _[placeholder]_ |
| Student 1 (Team Leader) | _[name, ID, department — placeholder]_ |
| Student 2 | _[name, ID, department — placeholder]_ |
| Faculty mentor | _[name, department — placeholder]_ |
| Industry mentor | _[name, organisation — placeholder]_ |
| Repository | _[GitHub URL — placeholder]_ |
| Demo video | _[URL — placeholder]_ |

---

## 1. The problem in the Bangladesh context

A buyer is shown a current khatian with the seller's name on it, checks the same record online, and pays the advance (বায়না). Months later a co-sharer, a prior buyer, or a court tells them the seller never held what they sold.

Three features of Bangladeshi land records make this common:

- **A khatian is a snapshot, not a history.** It does not show unmutated sales, nor whether an inheritance was divided correctly. Survey records (CS → SA → RS → BS) were produced decades apart; SA records carried no presumptive value and generated large numbers of civil suits, and RS surveys took decades per district.¹
- **Ownership is fractional.** Land passes by inheritance to several co-sharers in fixed fractions. A seller who inherited 7/20 of a plot can sign a deed for 1/2 of it; nothing in the registration step checks the arithmetic against the inheritance.
- **Records are split across offices.** Deeds sit with the sub-registry (Law Ministry); khatians and mutations with AC Land (Land Ministry). Government has linked registration to mutation and digitised tens of millions of records of rights,² but the buyer's question — *can this person transfer this much of this plot?* — still requires a lawyer to assemble and reconcile documents by hand.

An official estimate puts land-related matters at roughly 80% of court cases.³ Whatever the exact figure, the harm is concentrated at one moment: the purchase decision.

## 2. What existing solutions miss

| Existing | Does | Misses |
|---|---|---|
| e-Porcha / e-Khatian, e-Mutation | Show the current record; link a deed to one mutation | The seller's whole history of inheritance and prior sales; whether shares add up |
| Inheritance (ফারায়েজ) calculators | Compute heirs' shares for one death | Any connection to khatians or deeds; whether a recorded share matches the law |
| Commercial chain-of-title software (US) | Builds deed chains from complete databases, with a human examiner | Fractional co-ownership through intestate succession, which vendors themselves describe as beyond automation |
| Manual vetting by a lawyer | Cross-checks everything | Not reproducible; the buyer receives an opinion, not a list of gaps they can act on |

We found no tool — commercial, academic, or Bangladeshi — that combines legal inheritance shares with deed and khatian records to account for every share, and that reports which periods and documents the evidence does not cover. (Search described in the repository; not a claim of being first.)

## 3. Proposed solution

**Sutro is a share audit for a single plot.** The buyer or their lawyer enters the documents they have actually obtained (six structured forms: khatian, deed, mutation, heir certificate, registry search, plus the proposed sale). Sutro replays them as an ownership timeline with exact fractions and answers three separate questions:

1. **Do the supplied documents agree?** Contradictions are listed with the documents that conflict.
2. **Is the evidence complete?** Unexplained changes between records, cited-but-missing documents, transfers without mutation, and years not covered by a registry search are listed as *missing evidence* — explicitly *not* as proof of wrongdoing.
3. **Is the scenario within what Sutro computes?** Everything else (most inheritance cases, wills, non-Hanafi succession) is routed to human review with nothing computed.

It then states **what the supplied evidence supports** — e.g. *"Through the supplied chain, the evidence accounts for 15 of the 50 decimals offered"* — alongside the **assumptions** that figure depends on, and a **document checklist** naming the next document, the office that issues it, and what it could clarify.

Sutro never says "safe". It never determines legal title, possession, or document authenticity.

**Reasoning principles that distinguish it**

- *Absence is unknown, never "did not happen".* Sutro finds gaps only from the documents themselves — references they recite, transitions they fail to explain, years no search covers.
- *Agreement ≠ completeness ≠ ownership.* Two agreeing documents may both be wrong; a derived record (a mutation khatian made from deed X) is not independent confirmation of X.
- *Narrow, refusing inheritance.* Only the case where a surviving son exists is computed (fixed shares then never exceed the estate). A predeceased child does **not** by itself trigger the orphaned-grandchild rule; Sutro asks whether that child left surviving children and otherwise refuses.
- *Every number is exact.* Shares are BigInt fractions; 7/40 of 100 decimals is 17.5, never 17.499.

## 4. System architecture and tech stack

Client-only web application (HTML, CSS, vanilla JavaScript; Node ≥ 20 for tests and a static server). No backend, no database, no accounts: a packet is a JSON document that stays on the user's device.

```
documents (6 forms) ──► parse & validate ──► estates (narrow succession calculator)
                                          ──► timeline replay: two exact-fraction ledgers
                                                 • chain account  (earliest record + supplied events)
                                                 • record account (latest khatian, adjusted)
                                          ──► findings: contradiction | missing | review
                                          ──► coverage of registry searches; assumptions; checklist
                                          ──► bilingual report (বাংলা / English), printable
```

Two optional input-assistance models, trained on Kaggle GPUs and exported to ONNX (parity-checked), run in the browser with ONNX Runtime Web: a CRNN+CTC line reader trained on 107k lines cropped from our synthetic Form-5462-style khatian pages (split by land), and a small CNN trained on the public NumtaDB digit dataset. Neither is part of the evidence engine; both only suggest text that the user confirms.

## 5. Key features (built and demonstrable)

- Three synthetic demo packets and fully editable forms; export/import JSON; blank packet for user-authored cases.
- Ownership timeline with chain and record accounts side by side, shares shown as decimals and exact fractions.
- Findings in three separated sections, each citing its source documents.
- Visible assumptions list; "what the supplied evidence supports" wording throughout.
- Document checklist: document → office → what it could clarify.
- Registry-search coverage bar (covered years vs. uncovered years).
- Inheritance panel showing rule basis per share, labelled *pending qualified review*.
- Bangla/English interface with Bangla numerals; print-ready "official extract" layout.
- Case workspace: every case with its revision, what-if copies for experiments, export/import; every view states the revision and engine version it was computed from.
- Model-assisted reading with a confirm step: drag a box over one line of an attached scan, a CRNN trained on the synthetic pages suggests the text, and only what the user accepts enters the case (stale suggestions are discarded).
- Model-results page fed only by real run artifacts (curves, per-field/per-class metrics, confusion matrix, model card), with "Not measured" wherever a number is missing.
- 39 automated tests, including four externally published inheritance reference cases and tests proving no hidden knowledge of removed documents.

## 6. Problem-statement coverage (stated honestly)

- **P5 — primary, demonstrated** on synthetic packets.
- **P3 — partial, demonstrated**: over-commitment of a cited record (possible double sale), sale by a person the heir certificate records as deceased, registration/mutation mismatches within supplied documents. Forged paper is *not* detected.
- P1, P2, P4 — **not claimed.** The digit reader is not a document digitizer; a report is not a mutation workflow.

## 7. Evaluation

What we can measure now, and what we cannot:

| Measure | Status |
|---|---|
| Inheritance shares vs. externally published worked examples | 4/4 match (islamweb.net, 2010–2014); **not** a qualified legal review |
| Internal consistency (all supported heir combinations sum to 1; son = 2 × daughter) | 240 combinations pass |
| No-hidden-knowledge property (removing a document never produces findings about it) | Tested |
| Precision/recall of findings on independently authored cases | **Not yet measured.** We will ask mentors to author sealed case packets with expected findings before the Final Round and report hits, misses and over-claims — including misses. |
| Data-entry time per packet | **Not measured.** Estimate 15–30 min. |
| Khatian line-reader (CRNN) | Held-out test split of the synthetic pages (10,801 lines, split by land): **CER 0.00 %, exact match 100 %** (Kaggle GPU run `khatian-crnn-20261014-215159`, 30 epochs). Same-generator test data, so this measures the synthetic distribution only — not real scans. |
| Digit-reader accuracy | NumtaDB held-out test slice (3,602 images): **accuracy 99.31 %, macro-F1 99.31 %** (Kaggle GPU run `numta-cnn-20261014-215200`, 20 epochs). Accuracy on digits cropped from real land forms unknown. |

We will not report accuracy on data generated from the same rules the checker uses.

## 8. Countrywide implementation plan

**Phase 0 (now, no government access):** usable by buyers and lawyers from documents they already collect before paying an advance. Zero infrastructure; runs offline.

**Phase 1 — pilot with a legal-aid clinic or a sub-registry district:** sealed case evaluation with practising lawyers; native-speaker review of Bangla strings; qualified review of inheritance rules; extend succession coverage case by case, keeping refusals for everything unreviewed.

**Phase 2 — integration (requires agreements):** read-only fetch from e-Khatian / e-Mutation / registry systems to replace manual entry; checks against the register of forged documents under the Land Offences Prevention and Remedy Rules 2024; court-case and khas-land feeds. The same engine then serves AC Land officers as a pre-mutation check.

**Portability:** the engine is a configuration of document types, reference fields and succession rules; it applies wherever land is held in inherited fractional shares, which is a South Asian pattern more than a universal one. We do not claim "all nations".

## 9. Risks and limits

Inheritance edge cases are deliberately refused rather than guessed; output is flags for human and legal review, not advice; all results so far are on synthetic data; Bangla text is AI-drafted pending native review; usefulness depends on the buyer being able to obtain certified copies and a registry search.

---

¹ Financial Express, "Basic land survey long overdue". ² TBS News (2020) on registration–mutation linkage and ~43 million online records; Dhaka Tribune op-ed (Dec 2025) on e-Mutation and online registration pilots. ³ Senior Secretary, Ministry of Land, as reported in The Daily Observer (2025) — an official's estimate, not a measured study.
