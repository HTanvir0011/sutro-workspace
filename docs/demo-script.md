# Sutro — 3-minute demo script

Record at 1280×720 or higher, browser zoomed so the report column is readable. English voice-over with Bangla UI shown at the end (or the reverse — both are supported). Keep the synthetic-data banner visible throughout. **Do not** say "safe", "proves", "verified owner" or "fraud detected"; say *what the supplied evidence supports*.

| Time | On screen | Voice-over |
|---|---|---|
| 0:00–0:20 | Packet **A** open. Cursor on the BS khatian: *Rahim ½, Salim ½, 100 decimals*. | "Rahim is selling 50 decimals. His BS khatian shows his name against half the plot, and the online record would show the same. Should the buyer pay the advance? Sutro answers a narrower question: what does the evidence the buyer actually holds support?" |
| 0:20–0:50 | Scroll report: headline *"conflicting accounts"*; the two account lines (**35** via chain, **50** via record). Click the *unexplained change* finding; the table Rahim 35/50, Rokeya 17.5/0, Amena 12.5/0 appears. | "The seller also handed over his father Karim's heir certificate: a widow, two sons, a daughter. Replaying that inheritance with exact fractions, the chain accounts for 35 decimals in Rahim's hands — not 50. The BS record omits the widow and the daughter. Sutro does *not* call that a contradiction: a sale, gift or partition we haven't seen could explain it. It calls it unexplained, and names the documents that would explain it." |
| 0:50–1:05 | Scroll to **coverage bar**: 1962–2026 striped. Checklist item *registry search*. | "And no registry search covers any year. Sutro never assumes nothing happened in years it cannot see — it lists them." |
| 1:05–1:40 | Switch to packet **B**. Headline turns red: *offer exceeds*. Contradiction: *transfers citing BS-512 total 70 of 50*. Accounts now **15** and **30**. Coverage bar: green 2005–2015, gaps either side. | "The buyer obtains a registry search for 2005–2015. It lists a 2011 deed: Rahim already sold 20 decimals, citing the same khatian. Now there *is* a contradiction — transfers citing BS-512 exceed what it records. The account drops to 15. The 2011 sale has no supplied mutation, and 2016 onward is still uncovered." |
| 1:40–1:55 | Delete the 2011 deed card (×). Report: no contradiction; *search lists a deed not supplied*; account back to 35. | "Important: if we remove that deed, Sutro does not secretly remember it. It only knows the search lists a deed we haven't supplied." |
| 1:55–2:25 | Packet **C**. Heir row *Kamal — died before — left surviving children? Not stated*. Headline *not sufficient to compare*. Change to **No** → everything computes, offer within. Change to **Yes** → blue *needs human review* finding, nothing computed. | "Inheritance is where tools usually guess. Sutro refuses. Kamal died before his father; whether he left children isn't stated, so no share is computed. Say *no* — he isn't an heir, the estate computes and matches the record exactly. Say *yes* — that may be an orphaned-grandchild case under the 1961 Ordinance, and Sutro routes it to a lawyer." |
| 2:25–2:40 | Scroll **assumptions** list and **document checklist** (office + what it clarifies). Toggle **বাংলা**. | "Every figure carries its assumptions. Every gap becomes a document to fetch, the office that issues it, and what it would clarify — in Bangla or English." |
| 2:40–3:00 | Terminal: `npm test` → 31 passing. Optional 3-second cut of `ocr.html` reading a drawn digit, captioned *input-layer experiment — P1 not claimed*. End card: repo URL. | "Thirty-one tests, including four published inheritance cases and the no-hidden-knowledge checks. Sutro never says a plot is safe. It says what the supplied evidence supports — and exactly what it doesn't." |

## Optional 15-second insert (if time allows, between 2:10 and 2:40)
Intake → attach a sample page from `data/samples/khatian_pages` → **Read from scan** → drag a box over the dag number → the suggestion appears → **Accept** → the value lands in the field and the revision increments. Say: "The reader only suggests; the case changes only when I accept." Then one glance at **Model results**: "every number here is read from the run files; nothing is typed in."

## Page flow (multi-page site)
Home → **Start verification** → Intake (case selector top-left, `?case=demo-a|demo-b|demo-c` also works) → Timeline → Audit → Report. The case and edits persist across pages. Findings and timeline rows link back to the exact document card on Intake. In the script above, "switch to packet B" = pick it in the case selector; "delete the 2011 deed" = the × on its card on Intake; results are read on Audit/Report.

## Before recording
- `Reset packet` on A, B and C so edits from rehearsal are cleared.
- Light theme is pinned; check fonts have loaded (Noto Serif Bengali).
- If the digit reader is included, run `npm run kaggle:pull` first and open `ocr.html` via `npm start` (not from disk, or the model fetch is blocked).

## Final-round live demo (5 min + 3 min Q&A)
Same storyline, but let a judge **edit a field live** (e.g. change Rahim's offered area, or add a wife to the heir certificate) and narrate the change. Prepared answers:
- *"Why not blockchain / QR?"* — They prove a record hasn't changed, not that it was right. Our problem is records that are internally inconsistent.
- *"How accurate is it?"* — Inheritance arithmetic matches four published cases and 240 internal combinations; finding precision on independently written cases is not yet measured, and we say so.
- *"What if the seller hides a deed?"* — Sutro can't see it either; it reports the uncovered years and tells the buyer to obtain a registry search.
